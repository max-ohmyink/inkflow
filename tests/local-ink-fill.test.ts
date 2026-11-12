import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { TattooInkId } from "../shared/tattoo-inks";
import {
  ColorVersionError,
  createColorVersion,
  type ColorVersionImageService,
} from "../server/stencils/colorVersion";

type Rgb = readonly [number, number, number];

function setPixel(
  pixels: Buffer,
  width: number,
  x: number,
  y: number,
  rgb: Rgb,
): void {
  const offset = (y * width + x) * 3;
  pixels[offset] = rgb[0];
  pixels[offset + 1] = rgb[1];
  pixels[offset + 2] = rgb[2];
}

function pixelAt(pixels: Buffer, width: number, x: number, y: number): Rgb {
  const offset = (y * width + x) * 3;
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
}

function rectangleOutline(
  pixels: Buffer,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  for (let x = left; x <= right; x += 1) {
    setPixel(pixels, width, x, top, [0, 0, 0]);
    setPixel(pixels, width, x, bottom, [0, 0, 0]);
  }
  for (let y = top; y <= bottom; y += 1) {
    setPixel(pixels, width, left, y, [0, 0, 0]);
    setPixel(pixels, width, right, y, [0, 0, 0]);
  }
}

async function pngFromPixels(
  pixels: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

async function rawRgb(
  input: Buffer,
): Promise<{ pixels: Buffer; width: number; height: number }> {
  const image = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    pixels: image.data,
    width: image.info.width,
    height: image.info.height,
  };
}

function throwingProvider(): ColorVersionImageService {
  return {
    generateImage: vi
      .fn()
      .mockRejectedValue(new Error("provider must not run")),
  };
}

function expectOnlyRgb(pixels: Buffer, allowed: readonly Rgb[]): void {
  const allowedKeys = new Set(allowed.map((rgb) => rgb.join(",")));
  for (let offset = 0; offset < pixels.length; offset += 3) {
    expect(
      allowedKeys.has(
        `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`,
      ),
    ).toBe(true);
  }
}

describe("local selected tattoo ink fills", () => {
  it("round-robins selected inks through meaningful closed source regions without calling the provider", async () => {
    const width = 38;
    const height = 20;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(sourcePixels, width, 2, 3, 10, 13);
    rectangleOutline(sourcePixels, width, 14, 3, 23, 13);
    rectangleOutline(sourcePixels, width, 27, 3, 35, 13);
    // Preserve a grey anti-aliased contour exactly rather than tinting it.
    setPixel(sourcePixels, width, 2, 8, [180, 180, 180]);
    const source = await pngFromPixels(sourcePixels, width, height);
    const immutableSource = Buffer.from(source);
    const provider = throwingProvider();

    const result = await createColorVersion(source, "custom", provider, {
      inkColors: ["red", "lake_blue", "lemon_yellow"],
    });
    const output = await rawRgb(result.png);

    expect(source.equals(immutableSource)).toBe(true);
    expect(result).toMatchObject({ width, height, treatment: "filled" });
    expect(output).toMatchObject({ width, height });
    expect(provider.generateImage).not.toHaveBeenCalled();
    expect(pixelAt(output.pixels, width, 6, 8)).toEqual([244, 67, 69]);
    expect(pixelAt(output.pixels, width, 18, 8)).toEqual([40, 191, 225]);
    expect(pixelAt(output.pixels, width, 31, 8)).toEqual([255, 228, 77]);
    expect(pixelAt(output.pixels, width, 2, 7)).toEqual([0, 0, 0]);
    expect(pixelAt(output.pixels, width, 2, 8)).toEqual([180, 180, 180]);
    expect(pixelAt(output.pixels, width, 0, 0)).toEqual([255, 255, 255]);
    expectOnlyRgb(output.pixels, [
      [255, 255, 255],
      [0, 0, 0],
      [180, 180, 180],
      [244, 67, 69],
      [40, 191, 225],
      [255, 228, 77],
    ]);
  });

  it("tints only existing open strokes when no meaningful closed region exists, without calling the provider", async () => {
    const width = 14;
    const height = 14;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    for (let x = 2; x <= 9; x += 1) {
      setPixel(sourcePixels, width, x, 2, [0, 0, 0]);
      setPixel(sourcePixels, width, x, 10, [0, 0, 0]);
    }
    for (let y = 2; y <= 10; y += 1)
      setPixel(sourcePixels, width, 2, y, [0, 0, 0]);
    const source = await pngFromPixels(sourcePixels, width, height);
    const immutableSource = Buffer.from(source);
    const provider = throwingProvider();

    const result = await createColorVersion(source, "custom", provider, {
      inkColors: ["purple"],
    });
    const output = await rawRgb(result.png);

    expect(source.equals(immutableSource)).toBe(true);
    expect(result).toMatchObject({ width, height, treatment: "ink_only" });
    expect(provider.generateImage).not.toHaveBeenCalled();
    expect(pixelAt(output.pixels, width, 2, 6)).toEqual([160, 32, 240]);
    expect(pixelAt(output.pixels, width, 6, 6)).toEqual([255, 255, 255]);
    expect(pixelAt(output.pixels, width, 11, 6)).toEqual([255, 255, 255]);
    expectOnlyRgb(output.pixels, [
      [255, 255, 255],
      [160, 32, 240],
    ]);
  });

  it("keeps a black-only custom selection local and monochrome", async () => {
    const width = 9;
    const height = 7;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    setPixel(sourcePixels, width, 3, 3, [40, 80, 120]);
    const source = await pngFromPixels(sourcePixels, width, height);
    const immutableSource = Buffer.from(source);
    const provider = throwingProvider();

    const result = await createColorVersion(source, "custom", provider, {
      inkColors: ["black"],
    });
    const output = await rawRgb(result.png);

    expect(source.equals(immutableSource)).toBe(true);
    expect(result).toMatchObject({ width, height, treatment: "monochrome" });
    expect(output).toMatchObject({ width, height });
    expect(provider.generateImage).not.toHaveBeenCalled();
    for (let offset = 0; offset < output.pixels.length; offset += 3) {
      expect(output.pixels[offset]).toBe(output.pixels[offset + 1]);
      expect(output.pixels[offset + 1]).toBe(output.pixels[offset + 2]);
    }
  });

  it.each<readonly unknown[]>([
    [],
    ["red", "red"],
    ["not_an_ink"],
    ["red", "green", "lake_blue", "black"],
  ])(
    "rejects invalid custom palette selections without calling the provider: %j",
    async (inkColors) => {
      const source = await pngFromPixels(Buffer.alloc(8 * 8 * 3, 255), 8, 8);
      const provider = throwingProvider();

      await expect(
        createColorVersion(source, "custom", provider, {
          inkColors: inkColors as readonly TattooInkId[],
        }),
      ).rejects.toBeInstanceOf(ColorVersionError);
      expect(provider.generateImage).not.toHaveBeenCalled();
    },
  );
});
