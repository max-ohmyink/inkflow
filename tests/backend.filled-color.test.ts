import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  ColorVersionError,
  colorVersionEditPrompt,
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
  rgb: Rgb = [0, 0, 0],
): void {
  for (let x = left; x <= right; x += 1) {
    setPixel(pixels, width, x, top, rgb);
    setPixel(pixels, width, x, bottom, rgb);
  }
  for (let y = top; y <= bottom; y += 1) {
    setPixel(pixels, width, left, y, rgb);
    setPixel(pixels, width, right, y, rgb);
  }
}

function solidRectangle(
  pixels: Buffer,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  rgb: Rgb,
): void {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      setPixel(pixels, width, x, y, rgb);
    }
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

function proposalService(proposal: Buffer): ColorVersionImageService {
  return {
    generateImage: vi
      .fn()
      .mockResolvedValue({ bytes: proposal, mimeType: "image/png" }),
  };
}

describe("whole-design enclosed color versions", () => {
  it("fills proposal-supported enclosed square, petal, and leaf areas while retaining black contours and a pure-white exterior", async () => {
    const width = 38;
    const height = 20;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    // Closed outlines stand in for a square motif, petal, and leaf motif.
    rectangleOutline(sourcePixels, width, 2, 3, 10, 13);
    rectangleOutline(sourcePixels, width, 14, 2, 23, 12);
    rectangleOutline(sourcePixels, width, 27, 4, 35, 15);
    const source = await pngFromPixels(sourcePixels, width, height);
    const originalBytes = Buffer.from(source);

    const proposalPixels = Buffer.alloc(width * height * 3, 255);
    solidRectangle(proposalPixels, width, 3, 4, 9, 12, [230, 45, 55]);
    solidRectangle(proposalPixels, width, 15, 3, 22, 11, [55, 105, 230]);
    solidRectangle(proposalPixels, width, 28, 5, 34, 14, [250, 210, 20]);
    const service = proposalService(
      await pngFromPixels(proposalPixels, width, height),
    );

    const result = await createColorVersion(source, "mixed_color", service);
    const output = await rawRgb(result.png);
    const generated = service.generateImage as ReturnType<typeof vi.fn>;

    expect(source.equals(originalBytes)).toBe(true);
    expect(result).toMatchObject({ width, height, treatment: "filled" });
    expect(pixelAt(output.pixels, width, 6, 8)).toEqual([212, 61, 66]);
    expect(pixelAt(output.pixels, width, 18, 7)).toEqual([63, 112, 191]);
    expect(pixelAt(output.pixels, width, 31, 9)).toEqual([246, 204, 17]);
    expect(pixelAt(output.pixels, width, 2, 7)).toEqual([0, 0, 0]);
    expect(pixelAt(output.pixels, width, 14, 7)).toEqual([0, 0, 0]);
    expect(pixelAt(output.pixels, width, 0, 0)).toEqual([255, 255, 255]);
    expect(pixelAt(output.pixels, width, 12, 8)).toEqual([255, 255, 255]);

    expect(generated).toHaveBeenCalledOnce();
    const [prompt, references] = generated.mock.calls[0];
    expect(prompt).toContain("Fill the existing enclosed petals, leaves");
    expect(prompt).toContain("pure white exterior background");
    expect(prompt).not.toContain("Do not add, remove, redraw, fill");
    expect(references).toHaveLength(1);
    expect(Buffer.from(references[0].b64Json, "base64").equals(source)).toBe(
      true,
    );
  });

  it("treats a one-pixel anti-aliased contour as a closed boundary without tinting that contour", async () => {
    const width = 14;
    const height = 14;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(sourcePixels, width, 3, 3, 10, 10, [225, 225, 225]);
    const proposalPixels = Buffer.alloc(width * height * 3, 255);
    solidRectangle(proposalPixels, width, 4, 4, 9, 9, [220, 40, 50]);

    const result = await createColorVersion(
      await pngFromPixels(sourcePixels, width, height),
      "red_accent",
      proposalService(await pngFromPixels(proposalPixels, width, height)),
    );
    const output = await rawRgb(result.png);

    expect(pixelAt(output.pixels, width, 6, 6)).toEqual([212, 61, 66]);
    expect(pixelAt(output.pixels, width, 3, 6)).toEqual([225, 225, 225]);
    expect(pixelAt(output.pixels, width, 1, 6)).toEqual([255, 255, 255]);
  });

  it("keeps an open-line motif's interior and exterior white while retaining its proposal-backed line accent", async () => {
    const width = 14;
    const height = 14;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    // A three-sided, right-open contour: its apparent middle must remain connected to exterior.
    for (let x = 2; x <= 9; x += 1) {
      setPixel(sourcePixels, width, x, 2, [0, 0, 0]);
      setPixel(sourcePixels, width, x, 10, [0, 0, 0]);
    }
    for (let y = 2; y <= 10; y += 1)
      setPixel(sourcePixels, width, 2, y, [0, 0, 0]);

    const proposalPixels = Buffer.alloc(width * height * 3, 255);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const offset = pixel * 3;
      if (sourcePixels[offset] === 0) {
        proposalPixels[offset] = 220;
        proposalPixels[offset + 1] = 40;
        proposalPixels[offset + 2] = 50;
      }
    }

    const result = await createColorVersion(
      await pngFromPixels(sourcePixels, width, height),
      "red_accent",
      proposalService(await pngFromPixels(proposalPixels, width, height)),
    );
    const output = await rawRgb(result.png);

    expect(result.treatment).toBe("ink_only");
    expect(pixelAt(output.pixels, width, 2, 6)).toEqual([212, 61, 66]);
    expect(pixelAt(output.pixels, width, 6, 6)).toEqual([255, 255, 255]);
    expect(pixelAt(output.pixels, width, 11, 6)).toEqual([255, 255, 255]);
  });

  it("fails rather than claiming a whole-design fill when closed regions have no valid proposal color", async () => {
    const width = 12;
    const height = 12;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(sourcePixels, width, 2, 2, 9, 9);
    const source = await pngFromPixels(sourcePixels, width, height);
    const blank = await pngFromPixels(
      Buffer.alloc(width * height * 3, 255),
      width,
      height,
    );

    await expect(
      createColorVersion(source, "red_accent", proposalService(blank)),
    ).rejects.toBeInstanceOf(ColorVersionError);

    const unavailable: ColorVersionImageService = {
      generateImage: vi
        .fn()
        .mockRejectedValue(new Error("provider unavailable")),
    };
    await expect(
      createColorVersion(source, "red_accent", unavailable),
    ).rejects.toBeInstanceOf(ColorVersionError);
  });

  it("keeps explicit V2 requests ink-only with their legacy no-fill prompt", async () => {
    const width = 14;
    const height = 14;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(sourcePixels, width, 3, 3, 10, 10);
    const source = await pngFromPixels(sourcePixels, width, height);
    const immutableSource = Buffer.from(source);

    const proposalPixels = Buffer.alloc(width * height * 3, 255);
    solidRectangle(proposalPixels, width, 4, 4, 9, 9, [220, 40, 50]);
    const service = proposalService(
      await pngFromPixels(proposalPixels, width, height),
    );
    const result = await createColorVersion(source, "red_accent", service, {
      fillEnclosedRegions: false,
    });
    const output = await rawRgb(result.png);
    const prompt = (service.generateImage as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(source.equals(immutableSource)).toBe(true);
    expect(pixelAt(output.pixels, width, 6, 6)).toEqual([255, 255, 255]);
    expect(prompt).toContain("Do not add, remove, redraw, fill");
    expect(prompt).not.toContain("Fill the existing enclosed petals");
    expect(colorVersionEditPrompt("red_accent")).not.toContain(
      "Do not add, remove, redraw, fill",
    );
  });
});
