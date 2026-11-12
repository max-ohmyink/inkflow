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
