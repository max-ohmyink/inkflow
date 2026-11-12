import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { findEnclosedWhiteRegions } from "../server/stencils/colorVersion";
import { findGapAwareFillRegions } from "../server/stencils/gapAwareRegions";

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

function labelAt(
  labels: Int32Array,
  width: number,
  x: number,
  y: number,
): number {
  return labels[y * width + x];
}

function totalArea(areas: Uint32Array, count: number): number {
  let total = 0;
  for (let label = 1; label <= count; label += 1) total += areas[label];
  return total;
}

async function rawRgb(
  filename: string,
): Promise<{ pixels: Buffer; width: number; height: number }> {
  const decoded = await sharp(filename)
    .flatten({ background: "#FFFFFF" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    pixels: decoded.data,
    width: decoded.info.width,
    height: decoded.info.height,
  };
}

describe("gap-aware fill regions", () => {
  it("recovers the interior of a small outline break without changing source pixels", () => {
    const width = 20;
    const height = 20;
    const pixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(pixels, width, 3, 3, 16, 16);
    // A one-pixel gap makes the otherwise enclosed area strict-exterior.
    setPixel(pixels, width, 9, 3, [255, 255, 255]);
    const original = Buffer.from(pixels);

    const strict = findEnclosedWhiteRegions(pixels, width, height);
    const gapAware = findGapAwareFillRegions(pixels, width, height);

    expect(labelAt(strict.labels, width, 9, 9)).toBe(0);
    const recovered = labelAt(gapAware.labels, width, 9, 9);
    expect(recovered).toBeGreaterThan(strict.count);
    expect(gapAware.areas[recovered]).toBeGreaterThan(100);
    expect(pixels.equals(original)).toBe(true);
  });

  it("leaves existing black and grey strict contour labels and areas unchanged", () => {
    const width = 24;
    const height = 14;
    const pixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(pixels, width, 2, 3, 9, 10, [0, 0, 0]);
    rectangleOutline(pixels, width, 14, 3, 21, 10, [225, 225, 225]);

    const strict = findEnclosedWhiteRegions(pixels, width, height);
    const gapAware = findGapAwareFillRegions(pixels, width, height);

    expect(gapAware.count).toBe(strict.count);
    expect(Array.from(gapAware.labels)).toEqual(Array.from(strict.labels));
    expect(Array.from(gapAware.areas.subarray(0, strict.count + 1))).toEqual(
      Array.from(strict.areas.subarray(0, strict.count + 1)),
    );
    expect(labelAt(gapAware.labels, width, 2, 6)).toBe(0);
    expect(labelAt(gapAware.labels, width, 14, 6)).toBe(0);
  });

  it("does not invent an enclosure for an intentionally wide-open U contour", () => {
    const width = 26;
    const height = 24;
    const pixels = Buffer.alloc(width * height * 3, 255);
    for (let x = 3; x <= 17; x += 1) {
      setPixel(pixels, width, x, 3, [0, 0, 0]);
      setPixel(pixels, width, x, 18, [0, 0, 0]);
    }
    for (let y = 3; y <= 18; y += 1) {
      setPixel(pixels, width, 3, y, [0, 0, 0]);
    }

    const regions = findGapAwareFillRegions(pixels, width, height);
    expect(regions.count).toBe(0);
    expect(labelAt(regions.labels, width, 10, 10)).toBe(0);
  });

  it("keeps exterior whitespace between separate closed objects outside the fill mask", () => {
    const width = 25;
    const height = 20;
    const pixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(pixels, width, 2, 4, 8, 15);
    rectangleOutline(pixels, width, 12, 4, 18, 15);

    const strict = findEnclosedWhiteRegions(pixels, width, height);
    const regions = findGapAwareFillRegions(pixels, width, height);

    expect(strict.count).toBe(2);
    expect(regions.count).toBe(2);
    expect(labelAt(regions.labels, width, 5, 9)).toBe(
      labelAt(strict.labels, width, 5, 9),
    );
    expect(labelAt(regions.labels, width, 15, 9)).toBe(
      labelAt(strict.labels, width, 15, 9),
    );
    expect(labelAt(regions.labels, width, 10, 9)).toBe(0);
  });

  it("uses padded exterior flooding safely when contours touch the image edge", () => {
    const width = 20;
    const height = 20;
    const pixels = Buffer.alloc(width * height * 3, 255);
    for (let x = 0; x <= 12; x += 1) setPixel(pixels, width, x, 0, [0, 0, 0]);
    for (let y = 0; y <= 12; y += 1) {
      setPixel(pixels, width, 0, y, [0, 0, 0]);
      setPixel(pixels, width, 12, y, [0, 0, 0]);
    }

    const regions = findGapAwareFillRegions(pixels, width, height);
    expect(regions.count).toBe(0);
    expect(labelAt(regions.labels, width, 6, 6)).toBe(0);
    expect(labelAt(regions.labels, width, 19, 19)).toBe(0);
  });

  it("recovers substantial bounded Tiger torso fill space beyond the strict source mask", async () => {
    const tiger = await rawRgb(
      path.resolve(process.cwd(), "assets/catalog/inspiration/tiger.png"),
    );
    const strict = findEnclosedWhiteRegions(
      tiger.pixels,
      tiger.width,
      tiger.height,
    );
    const gapAware = findGapAwareFillRegions(
      tiger.pixels,
      tiger.width,
      tiger.height,
    );
    const strictTotal = totalArea(strict.areas, strict.count);
    const gapAwareTotal = totalArea(gapAware.areas, gapAware.count);
    const recoveredAreas = Array.from(
      gapAware.areas.subarray(strict.count + 1, gapAware.count + 1),
    );

    expect(tiger).toMatchObject({ width: 437, height: 437 });
    expect(gapAwareTotal).toBeGreaterThan(strictTotal + 10_000);
    expect(Math.max(...recoveredAreas)).toBeGreaterThan(6_000);
    expect(Math.max(...recoveredAreas)).toBeLessThan(
      tiger.width * tiger.height * 0.12,
    );
  });

  it("does not add a canvas-sized unknown region to a catalog butterfly", async () => {
    const butterfly = await rawRgb(
      path.resolve(process.cwd(), "assets/catalog/inspiration/butterfly-effect.png"),
    );
    const strict = findEnclosedWhiteRegions(
      butterfly.pixels,
      butterfly.width,
      butterfly.height,
    );
    const gapAware = findGapAwareFillRegions(
      butterfly.pixels,
      butterfly.width,
      butterfly.height,
    );
    const recovered =
      totalArea(gapAware.areas, gapAware.count) -
      totalArea(strict.areas, strict.count);

    expect(recovered).toBeGreaterThanOrEqual(0);
    expect(recovered).toBeLessThan(butterfly.width * butterfly.height * 0.01);
    expect(
      Math.max(
        ...Array.from(
          gapAware.areas.subarray(strict.count + 1, gapAware.count + 1),
        ),
        0,
      ),
    ).toBeLessThan(butterfly.width * butterfly.height * 0.01);
  });
});
