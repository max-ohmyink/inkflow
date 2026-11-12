import type { EnclosedWhiteRegions } from "./colorVersion";

/** Matches the source contour threshold used by the strict color-region helper. */
const LINE_SUPPORT_THRESHOLD = 230;

// The color renderer analyzes at no more than 720px per edge. A one-pixel close repairs a
// rasterized hairline break (up to two pixels across) without treating a deliberately open
// contour as closed. It is intentionally far below the six-pixel safety ceiling.
const MAX_ANALYSIS_REPAIR_RADIUS = 1;
const MIN_RECOVERED_AREA = 4;
const MIN_RECOVERED_SPAN = 3;
const MAX_RECOVERED_ASPECT_RATIO = 12;
const MAX_RECOVERED_CANVAS_RATIO = 0.12;
const MIN_MAX_RECOVERED_AREA = 256;

type RegionScan = {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function assertDimensions(pixels: Buffer, width: number, height: number): void {
  const pixelCount = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length < pixelCount * 3
  ) {
    throw new RangeError("invalid_region_mask_dimensions");
  }
}

function isLineSupportPixel(pixels: Buffer, pixel: number): boolean {
  const offset = pixel * 3;
  return (
    Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) <=
    LINE_SUPPORT_THRESHOLD
  );
}

function sourceLineMask(pixels: Buffer, pixelCount: number): Uint8Array {
  const mask = new Uint8Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (isLineSupportPixel(pixels, pixel)) mask[pixel] = 1;
  }
  return mask;
}

function enqueueIfOpen(
  candidate: number,
  lineSupport: Uint8Array,
  exterior: Uint8Array,
  queue: Int32Array,
  tail: number,
): number {
  if (lineSupport[candidate] || exterior[candidate]) return tail;
  exterior[candidate] = 1;
  queue[tail] = candidate;
  return tail + 1;
}

/**
 * This is deliberately equivalent to the strict helper's component labelling, but local so
 * `colorVersion.ts` can import this module without a runtime import cycle. Its labels are copied
 * unchanged into the gap-aware result.
 */
function findStrictRegions(
  lineSupport: Uint8Array,
  width: number,
  height: number,
): EnclosedWhiteRegions {
  const pixelCount = width * height;
  const exterior = new Uint8Array(pixelCount);
  const labels = new Int32Array(pixelCount);
  const areas = new Uint32Array(pixelCount + 1);
  const queue = new Int32Array(pixelCount);

  let head = 0;
  let tail = 0;
  for (let x = 0; x < width; x += 1) {
    tail = enqueueIfOpen(x, lineSupport, exterior, queue, tail);
    if (height > 1) {
      tail = enqueueIfOpen(
        (height - 1) * width + x,
        lineSupport,
        exterior,
        queue,
        tail,
      );
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    tail = enqueueIfOpen(y * width, lineSupport, exterior, queue, tail);
    if (width > 1) {
      tail = enqueueIfOpen(
        y * width + (width - 1),
        lineSupport,
        exterior,
        queue,
        tail,
      );
    }
  }

  while (head < tail) {
    const current = queue[head++];
    const x = current % width;
    if (x > 0) {
      tail = enqueueIfOpen(current - 1, lineSupport, exterior, queue, tail);
    }
    if (x + 1 < width) {
      tail = enqueueIfOpen(current + 1, lineSupport, exterior, queue, tail);
    }
    if (current >= width) {
      tail = enqueueIfOpen(current - width, lineSupport, exterior, queue, tail);
    }
    if (current + width < pixelCount) {
      tail = enqueueIfOpen(current + width, lineSupport, exterior, queue, tail);
    }
  }

  let count = 0;
  for (let start = 0; start < pixelCount; start += 1) {
    if (lineSupport[start] || exterior[start] || labels[start]) continue;
    count += 1;
    head = 0;
    tail = 0;
    labels[start] = count;
    queue[tail++] = start;
    let area = 0;
    while (head < tail) {
      const current = queue[head++];
      area += 1;
      const x = current % width;
      const visit = (candidate: number): void => {
        if (
          !lineSupport[candidate] &&
          !exterior[candidate] &&
          labels[candidate] === 0
        ) {
          labels[candidate] = count;
          queue[tail++] = candidate;
        }
      };
      if (x > 0) visit(current - 1);
      if (x + 1 < width) visit(current + 1);
      if (current >= width) visit(current - width);
      if (current + width < pixelCount) visit(current + width);
    }
    areas[count] = area;
  }

  return { width, height, labels, areas, count };
}

/**
 * A bounded binary close (dilate then erode). The result is only an analysis barrier: all source
 * ink is ORed back in and callers continue to render original source contour pixels themselves.
 */
function closedAnalysisMask(
  original: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const radius = Math.min(
    MAX_ANALYSIS_REPAIR_RADIUS,
    Math.max(1, Math.round(Math.min(width, height) / 720)),
  );
  const pixelCount = width * height;
  const dilated = new Uint8Array(pixelCount);
  const closed = new Uint8Array(pixelCount);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      let foundSupport = false;
      for (let offsetY = -radius; offsetY <= radius && !foundSupport; offsetY += 1) {
        const sampleY = y + offsetY;
        if (sampleY < 0 || sampleY >= height) continue;
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = x + offsetX;
          if (
            sampleX >= 0 &&
            sampleX < width &&
            original[sampleY * width + sampleX]
          ) {
            foundSupport = true;
            break;
          }
        }
      }
      if (foundSupport) dilated[pixel] = 1;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      let allSupport = true;
      for (let offsetY = -radius; offsetY <= radius && allSupport; offsetY += 1) {
        const sampleY = y + offsetY;
        if (sampleY < 0 || sampleY >= height) {
          allSupport = false;
          break;
        }
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = x + offsetX;
          if (
            sampleX < 0 ||
            sampleX >= width ||
            !dilated[sampleY * width + sampleX]
          ) {
            allSupport = false;
            break;
          }
        }
      }
      // Never remove or overwrite original support; this mask is only for topology analysis.
      if (allSupport || original[pixel]) closed[pixel] = 1;
    }
  }

  return closed;
}

/**
 * Flood exterior through a one-pixel white frame. Unlike starting at source-edge pixels, the
 * padded seed remains valid even when source ink touches an image edge.
 */
function paddedExterior(
  lineSupport: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const paddedWidth = width + 2;
  const paddedHeight = height + 2;
  const paddedPixelCount = paddedWidth * paddedHeight;
  const paddedSupport = new Uint8Array(paddedPixelCount);
  const exterior = new Uint8Array(paddedPixelCount);
  const queue = new Int32Array(paddedPixelCount);

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * width;
    const targetOffset = (y + 1) * paddedWidth + 1;
    for (let x = 0; x < width; x += 1) {
      paddedSupport[targetOffset + x] = lineSupport[sourceOffset + x];
    }
  }

  let head = 0;
  let tail = 0;
  exterior[0] = 1;
  queue[tail++] = 0;
  while (head < tail) {
    const current = queue[head++];
    const x = current % paddedWidth;
    const visit = (candidate: number): void => {
      if (!paddedSupport[candidate] && !exterior[candidate]) {
        exterior[candidate] = 1;
        queue[tail++] = candidate;
      }
    };
    if (x > 0) visit(current - 1);
    if (x + 1 < paddedWidth) visit(current + 1);
    if (current >= paddedWidth) visit(current - paddedWidth);
    if (current + paddedWidth < paddedPixelCount) visit(current + paddedWidth);
  }

  return exterior;
}

function isPaddedExterior(
  exterior: Uint8Array,
  pixel: number,
  width: number,
): boolean {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  return Boolean(exterior[(y + 1) * (width + 2) + x + 1]);
}

function acceptsRecoveredRegion(
  scan: RegionScan,
  pixelCount: number,
): boolean {
  const width = scan.maxX - scan.minX + 1;
  const height = scan.maxY - scan.minY + 1;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const maximumArea = Math.max(
    MIN_MAX_RECOVERED_AREA,
    Math.floor(pixelCount * MAX_RECOVERED_CANVAS_RATIO),
  );
  return (
    scan.area >= MIN_RECOVERED_AREA &&
    scan.area <= maximumArea &&
    shortSide >= MIN_RECOVERED_SPAN &&
    longSide <= shortSide * MAX_RECOVERED_ASPECT_RATIO
  );
}

/**
 * Returns strict source-enclosed white labels plus conservative regions made enclosed by closing
 * only raster-scale outline breaks. The three-argument contract accepts flattened RGB pixels and
 * returns the same one-based 4-connected `EnclosedWhiteRegions` shape as `findEnclosedWhiteRegions`.
 *
 * Source pixels are never mutated. Original strict labels and areas remain byte-for-byte identical;
 * accepted recovered components are appended after them. Small, wide-open, border-connected,
 * seam-like, or canvas-sized candidates stay exterior (label zero).
 */
export function findGapAwareFillRegions(
  pixels: Buffer,
  width: number,
  height: number,
): EnclosedWhiteRegions {
  assertDimensions(pixels, width, height);
  const pixelCount = width * height;
  const originalLineSupport = sourceLineMask(pixels, pixelCount);
  const strict = findStrictRegions(originalLineSupport, width, height);
  const repairedLineSupport = closedAnalysisMask(
    originalLineSupport,
    width,
    height,
  );
  const repairedExterior = paddedExterior(repairedLineSupport, width, height);

  const labels = new Int32Array(strict.labels);
  const areas = new Uint32Array(pixelCount + 1);
  areas.set(strict.areas.subarray(0, strict.count + 1));
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let count = strict.count;

  for (let start = 0; start < pixelCount; start += 1) {
    if (
      strict.labels[start] ||
      repairedLineSupport[start] ||
      isPaddedExterior(repairedExterior, start, width) ||
      visited[start]
    ) {
      continue;
    }

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const scan: RegionScan = {
      area: 0,
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
    };
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      scan.area += 1;
      scan.minX = Math.min(scan.minX, x);
      scan.maxX = Math.max(scan.maxX, x);
      scan.minY = Math.min(scan.minY, y);
      scan.maxY = Math.max(scan.maxY, y);
      const visit = (candidate: number): void => {
        if (
          !strict.labels[candidate] &&
          !repairedLineSupport[candidate] &&
          !isPaddedExterior(repairedExterior, candidate, width) &&
          !visited[candidate]
        ) {
          visited[candidate] = 1;
          queue[tail++] = candidate;
        }
      };
      if (x > 0) visit(current - 1);
      if (x + 1 < width) visit(current + 1);
      if (current >= width) visit(current - width);
      if (current + width < pixelCount) visit(current + width);
    }

    if (!acceptsRecoveredRegion(scan, pixelCount)) continue;
    count += 1;
    areas[count] = scan.area;
    for (let index = 0; index < tail; index += 1) {
      labels[queue[index]] = count;
    }
  }

  return { width, height, labels, areas, count };
}
