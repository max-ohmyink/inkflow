import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
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
