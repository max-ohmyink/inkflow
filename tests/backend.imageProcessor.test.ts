import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  uniqueQuadrants,
  createMirroredStencilPng,
  splitContactSheet,
} from "../server/stencils/imageProcessor";

function rgb(
  width: number,
  height: number,
  color: [number, number, number],
): Buffer {
  const data = Buffer.alloc(width * height * 3);
  for (let offset = 0; offset < data.length; offset += 3)
    data.set(color, offset);
  return data;
}

async function rawPng(png: Buffer) {
  return sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

function pixel(
  data: Buffer,
  width: number,
  x: number,
  y: number,
): [number, number, number] {
  const offset = (y * width + x) * 3;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

describe("stencil contact sheet processing", () => {
  it("crops all four native-resolution quadrants without dropping odd trailing pixels", async () => {
    const width = 5;
    const height = 5;
    const data = rgb(width, height, [255, 255, 255]);
    const fill = (
      left: number,
      top: number,
      cropWidth: number,
      cropHeight: number,
      color: [number, number, number],
    ) => {
      for (let y = top; y < top + cropHeight; y += 1) {
        for (let x = left; x < left + cropWidth; x += 1)
          data.set(color, (y * width + x) * 3);
      }
    };
    fill(0, 0, 2, 2, [255, 0, 0]);
    fill(2, 0, 3, 2, [0, 255, 0]);
    fill(0, 2, 2, 3, [0, 0, 255]);
    fill(2, 2, 3, 3, [255, 255, 0]);
    const sheet = await sharp(data, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();

    const quadrants = await splitContactSheet(sheet);
    expect(quadrants.map((part) => [part.width, part.height])).toEqual([
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]);
    const expected: Array<[number, number, number]> = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
    ];
    for (const [index, quadrant] of quadrants.entries()) {
      const decoded = await rawPng(quadrant.bytes);
      expect(pixel(decoded.data, quadrant.width, 0, 0)).toEqual(
        expected[index],
      );
      expect((await sharp(quadrant.bytes).metadata()).density).toBe(300);
    }
  });

  it("returns only #000000/#FFFFFF, preserves a three-pixel dot, removes one-pixel dust, and mirrors exactly once", async () => {
    const width = 7;
    const height = 5;
    const data = rgb(width, height, [255, 255, 255]);
    const setBlack = (x: number, y: number) =>
      data.set([0, 0, 0], (y * width + x) * 3);
    // Deliberately asymmetric three-pixel vertical dot/stroke on the left.
    setBlack(0, 0);
    setBlack(0, 1);
    setBlack(0, 2);
    // Isolated one-pixel input dust should not survive component cleanup.
    setBlack(5, 4);
    const source = await sharp(data, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();

    const result = await createMirroredStencilPng(source, {
      threshold: 180,
      minimumComponentPixels: 3,
    });
    expect([result.width, result.height]).toEqual([width, height]);
    const decoded = await rawPng(result.png);
    for (let offset = 0; offset < decoded.data.length; offset += 3) {
      const color = [
        decoded.data[offset],
        decoded.data[offset + 1],
        decoded.data[offset + 2],
      ];
      expect([
        [0, 0, 0],
        [255, 255, 255],
      ]).toContainEqual(color);
    }
    // A single horizontal flip moves x=0 to x=6, not back to x=0.
    expect(pixel(decoded.data, width, 6, 0)).toEqual([0, 0, 0]);
    expect(pixel(decoded.data, width, 6, 1)).toEqual([0, 0, 0]);
    expect(pixel(decoded.data, width, 6, 2)).toEqual([0, 0, 0]);
    expect(pixel(decoded.data, width, 0, 0)).toEqual([255, 255, 255]);
    // Source dust x=5 would land at x=1 after flip, but is removed first.
    expect(pixel(decoded.data, width, 1, 4)).toEqual([255, 255, 255]);
    expect((await sharp(result.png).metadata()).density).toBe(300);
  });
});

describe("duplicate variation removal", () => {
  const quadrant = (index: number, bytes: Buffer) => ({
    index,
    bytes,
    width: 64,
    height: 64,
  });
  /** A white 64x64 PNG with one black rectangle, so different rectangles are different designs. */
  async function design(
    rect: { left: number; top: number; width: number; height: number },
    noisePixel = false,
  ): Promise<Buffer> {
    const data = Buffer.alloc(64 * 64 * 3, 255);
    for (let y = rect.top; y < rect.top + rect.height; y += 1)
      for (let x = rect.left; x < rect.left + rect.width; x += 1)
        data.fill(0, (y * 64 + x) * 3, (y * 64 + x) * 3 + 3);
    if (noisePixel) data.fill(128, 0, 3);
    return sharp(data, { raw: { width: 64, height: 64, channels: 3 } })
      .png()
      .toBuffer();
  }
  const square = { left: 8, top: 8, width: 32, height: 32 };
  const bar = { left: 4, top: 40, width: 56, height: 12 };
  const dot = { left: 28, top: 28, width: 8, height: 8 };
  const indexes = (kept: { index: number }[]) => kept.map((q) => q.index);

  it("keeps one when all four are byte-identical", async () => {
    const png = await design(square);
    const kept = await uniqueQuadrants(
      [0, 1, 2, 3].map((i) => quadrant(i, png)),
    );
    expect(indexes(kept)).toEqual([0]);
  });

  it("keeps one when all four are redraws that differ only by tiny noise", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await design(square)),
      quadrant(1, await design(square, true)),
      quadrant(2, await design(square)),
      quadrant(3, await design(square, true)),
    ]);
    expect(indexes(kept)).toEqual([0]);
  });

  it("drops only the copy when exactly one image matches another", async () => {
    const same = await design(square);
    const kept = await uniqueQuadrants([
      quadrant(0, same),
      quadrant(1, same),
      quadrant(2, await design(bar)),
      quadrant(3, await design(dot)),
    ]);
    expect(indexes(kept)).toEqual([0, 2, 3]);
  });

  it("keeps one of each design when there are two different pairs", async () => {
    const a = await design(square);
    const b = await design(bar);
    const kept = await uniqueQuadrants([
      quadrant(0, a),
      quadrant(1, b),
      quadrant(2, a),
      quadrant(3, b),
    ]);
    expect(indexes(kept)).toEqual([0, 1]);
  });

  it("keeps all four when every design is different", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await design(square)),
      quadrant(1, await design(bar)),
      quadrant(2, await design(dot)),
      quadrant(3, await design({ left: 2, top: 2, width: 10, height: 50 })),
    ]);
    expect(indexes(kept)).toEqual([0, 1, 2, 3]);
  });

  it("treats redraws of the same subject with slightly moved strokes as the same design", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await design({ left: 8, top: 8, width: 32, height: 32 })),
      quadrant(1, await design({ left: 10, top: 9, width: 31, height: 33 })),
      quadrant(2, await design({ left: 7, top: 10, width: 33, height: 31 })),
      quadrant(3, await design({ left: 9, top: 7, width: 30, height: 32 })),
    ]);
    expect(indexes(kept)).toEqual([0]);
  });

  it("still keeps designs with a different composition", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await design({ left: 8, top: 8, width: 32, height: 32 })),
      quadrant(1, await design({ left: 4, top: 40, width: 56, height: 12 })),
      quadrant(2, await design({ left: 2, top: 2, width: 10, height: 50 })),
      quadrant(3, await design({ left: 28, top: 28, width: 8, height: 8 })),
    ]);
    expect(indexes(kept)).toEqual([0, 1, 2, 3]);
  });

  it("treats a left-right mirrored copy as the same design", async () => {
    // An off-center shape and its mirror image: only the facing direction differs.
    const facingLeft = await design({
      left: 6,
      top: 10,
      width: 30,
      height: 36,
    });
    const facingRight = await design({
      left: 28,
      top: 10,
      width: 30,
      height: 36,
    });
    const kept = await uniqueQuadrants([
      quadrant(0, facingLeft),
      quadrant(1, facingRight),
      quadrant(2, facingLeft),
      quadrant(3, facingRight),
    ]);
    expect(indexes(kept)).toEqual([0]);
  });

  it("keeps a mirrored pair apart from a genuinely different third design", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await design({ left: 6, top: 10, width: 30, height: 36 })),
      quadrant(1, await design({ left: 28, top: 10, width: 30, height: 36 })),
      quadrant(2, await design({ left: 4, top: 40, width: 56, height: 12 })),
      quadrant(3, await design({ left: 28, top: 28, width: 8, height: 8 })),
    ]);
    expect(indexes(kept)).toEqual([0, 2, 3]);
  });

  it("can be tuned with STENCIL_DUPLICATE_THRESHOLD", async () => {
    const a = await design({ left: 8, top: 8, width: 32, height: 32 });
    const b = await design({ left: 12, top: 12, width: 32, height: 32 });
    const pair = [quadrant(0, a), quadrant(1, b)];
    try {
      process.env.STENCIL_DUPLICATE_THRESHOLD = "0";
      expect(indexes(await uniqueQuadrants(pair))).toEqual([0, 1]);
      process.env.STENCIL_DUPLICATE_THRESHOLD = "100";
      expect(indexes(await uniqueQuadrants(pair))).toEqual([0]);
    } finally {
      delete process.env.STENCIL_DUPLICATE_THRESHOLD;
    }
  });

  /**
   * Thin black lines on paper: the kind of picture that is almost all background. Drawn on a 256px
   * canvas (coordinates are in 64-unit space, scaled x4) like a real, much larger render; `dx`/`dy`
   * shift every line by that many real pixels.
   */
  async function lineArt(
    lines: { left: number; top: number; width: number; height: number }[],
    paper = 255,
    dx = 0,
    dy = 0,
  ): Promise<Buffer> {
    const size = 256;
    const data = Buffer.alloc(size * size * 3, paper);
    for (const r of lines)
      for (let y = r.top * 4 + dy; y < (r.top + r.height) * 4 + dy; y += 1)
        for (let x = r.left * 4 + dx; x < (r.left + r.width) * 4 + dx; x += 1)
          data.fill(0, (y * size + x) * 3, (y * size + x) * 3 + 3);
    return sharp(data, { raw: { width: size, height: size, channels: 3 } })
      .png()
      .toBuffer();
  }
  const horizontal = [10, 22, 34, 46].map((top) => ({
    left: 6,
    top,
    width: 52,
    height: 2,
  }));
  const vertical = [10, 22, 34, 46].map((left) => ({
    left,
    top: 6,
    width: 2,
    height: 52,
  }));
  const diagonalish = [8, 20, 32, 44].map((i) => ({
    left: i,
    top: i,
    width: 14,
    height: 2,
  }));

  it("keeps different line drawings apart even though both are mostly white paper", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await lineArt(horizontal)),
      quadrant(1, await lineArt(vertical)),
      quadrant(2, await lineArt(diagonalish)),
      quadrant(3, await lineArt([{ left: 20, top: 20, width: 24, height: 2 }])),
    ]);
    expect(indexes(kept)).toEqual([0, 1, 2, 3]);
  });

  it("keeps line drawings of the same subject when the lines are placed differently", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await lineArt(horizontal)),
      quadrant(1, await lineArt(horizontal, 255, 0, 20)),
    ]);
    expect(indexes(kept)).toEqual([0, 1]);
  });

  it("still merges a line drawing with a copy shifted by a couple of pixels on off-white paper", async () => {
    const kept = await uniqueQuadrants([
      quadrant(0, await lineArt(horizontal)),
      quadrant(1, await lineArt(horizontal, 244, 2, 2)),
    ]);
    expect(indexes(kept)).toEqual([0]);
  });

  it("fails open: unreadable images are never treated as duplicates", async () => {
    const kept = await uniqueQuadrants(
      ["a", "b", "c", "d"].map((t, i) => quadrant(i, Buffer.from(t))),
    );
    expect(indexes(kept)).toEqual([0, 1, 2, 3]);
  });
});
