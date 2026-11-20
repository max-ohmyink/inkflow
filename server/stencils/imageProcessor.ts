import sharp from "sharp";

export type ContactSheetQuadrant = {
  index: number;
  bytes: Buffer;
  width: number;
  height: number;
};

export type StencilProcessingConfig = {
  threshold: number;
  minimumComponentPixels: number;
};

function boundedInt(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function stencilProcessingConfig(): StencilProcessingConfig {
  return {
    threshold: boundedInt(process.env.STENCIL_THRESHOLD, 180, 0, 255),
    minimumComponentPixels: boundedInt(
      process.env.STENCIL_MIN_COMPONENT_PIXELS,
      3,
      1,
      10_000,
    ),
  };
}

/** A full-frame single design (no sheet to split), normalized to the same PNG form as a quadrant. */
export async function singleDesign(
  input: Buffer,
): Promise<ContactSheetQuadrant[]> {
  const image = sharp(input, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("contact_sheet_dimensions_invalid");
  }
  return [
    {
      index: 0,
      width: metadata.width,
      height: metadata.height,
      bytes: await sharp(input).png().withMetadata({ density: 300 }).toBuffer(),
    },
  ];
}

/** Splits all native pixels into four non-overlapping quadrants, including odd trailing rows/columns. */
export async function splitContactSheet(
  input: Buffer,
): Promise<ContactSheetQuadrant[]> {
  const source = sharp(input, { failOn: "error" });
  const metadata = await source.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 2 ||
    metadata.height < 2
  ) {
    throw new Error("contact_sheet_dimensions_invalid");
  }

  const leftWidth = Math.floor(metadata.width / 2);
  const topHeight = Math.floor(metadata.height / 2);
  const rectangles = [
    { left: 0, top: 0, width: leftWidth, height: topHeight },
    {
      left: leftWidth,
      top: 0,
      width: metadata.width - leftWidth,
      height: topHeight,
    },
    {
      left: 0,
      top: topHeight,
      width: leftWidth,
      height: metadata.height - topHeight,
    },
    {
      left: leftWidth,
      top: topHeight,
      width: metadata.width - leftWidth,
      height: metadata.height - topHeight,
    },
  ];

  return Promise.all(
    rectangles.map(async (rectangle, index) => ({
      index,
      width: rectangle.width,
      height: rectangle.height,
      bytes: await sharp(input)
        .extract(rectangle)
        .png()
        .withMetadata({ density: 300 })
        .toBuffer(),
    })),
  );
}

/**
 * Default share of the drawn area (0–100 %) that may differ for two quadrants to still count as the
 * same design. It is measured on the INK only, not on the whole picture: line art is mostly white, so
 * a plain pixel average would call two completely different drawings "almost identical". Override
 * with STENCIL_DUPLICATE_THRESHOLD (higher drops more look-alikes, lower keeps more variations).
 */
export const DUPLICATE_MAX_DIFFERENCE_PERCENT = 30;
const THUMBNAIL_SIZE = 32;
/** Light blur so a stroke moved by a pixel or two still overlaps itself. */
const THUMBNAIL_BLUR = 1.2;
/** Paper tint and JPEG-style noise below this is not ink. */
const INK_FLOOR = 12;

/** The allowed difference as a 0–1 fraction. */
export function duplicateThreshold(): number {
  return (
    boundedInt(
      process.env.STENCIL_DUPLICATE_THRESHOLD,
      DUPLICATE_MAX_DIFFERENCE_PERCENT,
      0,
      100,
    ) / 100
  );
}

/** A blurred 32×32 map of how much ink each cell holds (0 = bare paper), whatever the paper tint. */
async function thumbnail(bytes: Buffer): Promise<Buffer> {
  const gray = await sharp(bytes, { failOn: "error" })
    .flatten({ background: "#ffffff" })
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "fill" })
    .greyscale()
    .blur(THUMBNAIL_BLUR)
    .raw()
    .toBuffer();
  let paper = 0;
  for (const value of gray) if (value > paper) paper = value;
  const ink = Buffer.alloc(gray.length);
  for (let i = 0; i < gray.length; i += 1)
    ink[i] = Math.max(0, paper - gray[i] - INK_FLOOR);
  return ink;
}

/**
 * How different two ink maps are, from 0 (same) to 1 (nothing overlaps): the share of the combined
 * ink that is not shared. `right` can be read flipped left-to-right.
 */
function inkDistance(left: Buffer, right: Buffer, mirrored: boolean): number {
  let shared = 0;
  let combined = 0;
  for (let y = 0; y < THUMBNAIL_SIZE; y += 1) {
    const row = y * THUMBNAIL_SIZE;
    for (let x = 0; x < THUMBNAIL_SIZE; x += 1) {
      const a = left[row + x];
      const b = right[row + (mirrored ? THUMBNAIL_SIZE - 1 - x : x)];
      shared += Math.min(a, b);
      combined += Math.max(a, b);
    }
  }
  // Two blank images are the same; a blank one against a drawing is not.
  return combined === 0 ? 0 : 1 - shared / combined;
}

/**
 * True when two quadrants are the same design. A left-right mirrored copy counts as the same, since
 * the model often redraws a subject facing the other way. Fails open: unreadable images are never
 * "the same".
 */
async function sameDesign(
  a: ContactSheetQuadrant,
  b: ContactSheetQuadrant,
  thumbnails: Map<ContactSheetQuadrant, Promise<Buffer>>,
): Promise<boolean> {
  if (a.bytes.equals(b.bytes)) return true;
  try {
    const cached = (q: ContactSheetQuadrant) => {
      if (!thumbnails.has(q)) thumbnails.set(q, thumbnail(q.bytes));
      return thumbnails.get(q) as Promise<Buffer>;
    };
    const [left, right] = await Promise.all([cached(a), cached(b)]);
    if (left.length !== right.length || left.length !== THUMBNAIL_SIZE ** 2)
      return false;
    const closest = Math.min(
      inkDistance(left, right, false),
      inkDistance(left, right, true),
    );
    return closest <= duplicateThreshold();
  } catch {
    return false;
  }
}

/**
 * Keeps one quadrant per distinct design: any quadrant that matches one already kept is dropped,
 * so the guest never picks between copies. Different designs are all kept, in their original order.
 * Each candidate is compared with the quadrants kept so far (not with dropped ones), so near-copies
 * cannot chain two different designs together.
 */
export async function uniqueQuadrants(
  quadrants: ContactSheetQuadrant[],
): Promise<ContactSheetQuadrant[]> {
  const thumbnails = new Map<ContactSheetQuadrant, Promise<Buffer>>();
  const kept: ContactSheetQuadrant[] = [];
  for (const quadrant of quadrants) {
    let duplicate = false;
    for (const existing of kept) {
      if (await sameDesign(existing, quadrant, thumbnails)) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) kept.push(quadrant);
  }
  return kept;
}

function removeSmallBlackComponents(
  data: Buffer,
  width: number,
  height: number,
  minimumPixels: number,
): void {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const component: number[] = [];
  const stack: number[] = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || data[start] !== 0) continue;
    visited[start] = 1;
    stack.push(start);
    component.length = 0;

    while (stack.length) {
      const current = stack.pop();
      if (current === undefined) continue;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      // 8-connected treatment keeps intentional small stipple/dots intact at the configured minimum.
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
            continue;
          const next = nextY * width + nextX;
          if (!visited[next] && data[next] === 0) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
    }

    if (component.length < minimumPixels) {
      for (const position of component) data[position] = 255;
    }
  }
}

function mirrorBinaryHorizontally(
  input: Buffer,
  width: number,
  height: number,
): Buffer {
  const output = Buffer.allocUnsafe(input.length);
  for (let y = 0; y < height; y += 1) {
    const offset = y * width;
    for (let x = 0; x < width; x += 1) {
      output[offset + (width - 1 - x)] = input[offset + x];
    }
  }
  return output;
}

/**
 * Forces RGB pixels to exactly #000000 or #FFFFFF, drops one/two-pixel dust, then mirrors once.
 * The output remains native resolution and embeds 300-DPI PNG metadata.
 */
export async function createMirroredStencilPng(
  input: Buffer,
  config: StencilProcessingConfig = stencilProcessingConfig(),
): Promise<{ png: Buffer; width: number; height: number }> {
  const binary = await sharp(input, { failOn: "error" })
    .flatten({ background: "#FFFFFF" })
    .greyscale()
    .threshold(config.threshold, { grayscale: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = binary.info.width;
  const height = binary.info.height;
  const pixels = Buffer.from(binary.data);
  removeSmallBlackComponents(
    pixels,
    width,
    height,
    config.minimumComponentPixels,
  );
  const mirrored = mirrorBinaryHorizontally(pixels, width, height);

  const rgb = Buffer.allocUnsafe(width * height * 3);
  for (
    let source = 0, target = 0;
    source < mirrored.length;
    source += 1, target += 3
  ) {
    const value = mirrored[source];
    rgb[target] = value;
    rgb[target + 1] = value;
    rgb[target + 2] = value;
  }

  const png = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer();
  return { png, width, height };
}

/** Produces SVG path data with potrace when installed; absent/failed vectorization returns undefined. */
export async function traceStencilSvg(
  png: Buffer,
): Promise<string | undefined> {
  try {
    const potrace = (await import("potrace")) as {
      trace?: (
        input: Buffer,
        options: { threshold: number; optCurve: boolean },
        callback: (error: Error | null, svg?: string) => void,
      ) => void;
      default?: {
        trace?: (
          input: Buffer,
          options: { threshold: number; optCurve: boolean },
          callback: (error: Error | null, svg?: string) => void,
        ) => void;
      };
    };
    const trace = potrace.trace ?? potrace.default?.trace;
    if (!trace) return undefined;
    return await new Promise<string | undefined>((resolve) => {
      trace(png, { threshold: 128, optCurve: true }, (error, svg) => {
        if (error || !svg || !svg.includes("<path")) resolve(undefined);
        else resolve(svg);
      });
    });
  } catch {
    return undefined;
  }
}

export async function potraceIsAvailable(): Promise<boolean> {
  try {
    const potrace = (await import("potrace")) as {
      trace?: unknown;
      default?: { trace?: unknown };
    };
    return (
      typeof potrace.trace === "function" ||
      typeof potrace.default?.trace === "function"
    );
  } catch {
    return false;
  }
}
