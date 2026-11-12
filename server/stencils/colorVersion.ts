import sharp from "sharp";
import type { CatalogColorMix } from "../../shared/catalog-filters";
import {
  tattooInkPalette,
  tattooInkScreenPalette,
  type TattooInkId,
} from "../../shared/tattoo-inks";
import type { ImageServiceOriginalImage } from "./platform";
import type { ActualColorTreatment } from "./colorOutcomes";
import type { SafeProviderFailure } from "./platform";
import { findGapAwareFillRegions } from "./gapAwareRegions";

export type ColorVersionMode = Exclude<CatalogColorMix, "any">;

export type ColorVersionImageService = {
  generateImage: (
    prompt: string,
    originalImages: ImageServiceOriginalImage[],
  ) => Promise<{ bytes: Buffer; mimeType: string }>;
};

export type ColorVersionOptions = {
  /**
   * Version 3/default custom fills use bounded gap-aware regions and bright screen inks.
   * Passing false preserves the V2 ink-only projection exactly for saved V2 jobs.
   */
  fillEnclosedRegions?: boolean;
  /** Required for custom mode: one to three validated tattoo ink IDs. */
  inkColors?: readonly TattooInkId[];
};

export type ColorVersionResult = {
  png: Buffer;
  width: number;
  height: number;
  treatment: ActualColorTreatment;
};

type RgbImage = { pixels: Buffer; width: number; height: number };

type PaletteColor = {
  name: string;
  rgb: readonly [number, number, number];
  id?: TattooInkId;
  hex?: string;
};

type ProposalColor = {
  rgb: readonly [number, number, number];
  score: number;
  paletteIndex: number;
};

export type EnclosedWhiteRegions = {
  width: number;
  height: number;
  /** One-based 4-connected enclosed-white component labels; zero is line support or exterior. */
  labels: Int32Array;
  /** Pixel counts indexed by the corresponding one-based component label. */
  areas: Uint32Array;
  count: number;
};

const COLOR_VERSION_PALETTES: Record<
  Exclude<ColorVersionMode, "monochrome" | "custom">,
  readonly PaletteColor[]
> = {
  red_accent: [{ name: "red", rgb: [212, 61, 66] }],
  blue_accent: [{ name: "blue", rgb: [63, 112, 191] }],
  mixed_color: [
    { name: "red", rgb: [212, 61, 66] },
    { name: "blue", rgb: [63, 112, 191] },
    { name: "Burmese yellow", rgb: [246, 204, 17] },
  ],
};

const SAFE_COLOR_FAILURE =
  "The requested color version could not be prepared. Please create a new request to retry.";
const LINE_SUPPORT_THRESHOLD = 230;
const MAX_ANALYSIS_EDGE = 720;
const MAX_ANALYSIS_PIXELS = MAX_ANALYSIS_EDGE * MAX_ANALYSIS_EDGE;
const MINIMUM_MEANINGFUL_ENCLOSED_REGION_PIXELS = 4;

export class ColorVersionError extends Error {
  constructor(
    readonly reason: "color_projection" | "image_service" = "color_projection",
    cause?: unknown,
  ) {
    super(SAFE_COLOR_FAILURE, { cause });
    this.name = "ColorVersionError";
  }
}
export function safeColorFailureDetails(error: unknown): {
  reason: string;
  httpStatus?: number;
  providerCode?: string;
} {
  if (
    error instanceof ColorVersionError &&
    error.cause instanceof Error &&
    error.cause.name === "PlatformServiceError"
  ) {
    const details = (
      error.cause as Error & { diagnostics?: SafeProviderFailure }
    ).diagnostics;
    if (
      details &&
      [
        "quota_or_credits",
        "rate_limited",
        "access_denied",
        "provider_unavailable",
        "invalid_request",
        "unknown",
      ].includes(details.reason)
    ) {
      return {
        reason: details.reason,
        ...(Number.isInteger(details.httpStatus) &&
        details.httpStatus! >= 100 &&
        details.httpStatus! <= 599
          ? { httpStatus: details.httpStatus }
          : {}),
        ...(typeof details.providerCode === "string" &&
        /^[a-zA-Z_0-9-]{1,60}$/.test(details.providerCode)
          ? { providerCode: details.providerCode }
          : {}),
      };
    }
  }
  return {
    reason:
      error instanceof ColorVersionError ? error.reason : "color_unavailable",
  };
}

export function isColorVersionMode(value: unknown): value is ColorVersionMode {
  return (
    value === "monochrome" ||
    value === "red_accent" ||
    value === "blue_accent" ||
    value === "mixed_color" ||
    value === "custom"
  );
}

function paletteForMode(
  mode: Exclude<ColorVersionMode, "monochrome">,
  options: ColorVersionOptions,
): readonly PaletteColor[] {
  if (mode === "custom") {
    return options.fillEnclosedRegions === false
      ? tattooInkPalette(options.inkColors ?? [])
      : tattooInkScreenPalette(options.inkColors ?? []);
  }
  return COLOR_VERSION_PALETTES[mode];
}

function customPaletteDescription(options: ColorVersionOptions): string {
  return tattooInkPalette(options.inkColors ?? [])
    .map((ink) => `${ink.name} (${ink.hex})`)
    .join(", ");
}

function legacyColorVersionEditPrompt(
  mode: ColorVersionMode,
  options: ColorVersionOptions,
): string {
  const colors =
    mode === "monochrome"
      ? "black and grey ink only"
      : mode === "red_accent"
        ? "selective saturated red accents with remaining ink black"
        : mode === "blue_accent"
          ? "selective saturated blue accents with remaining ink black"
          : mode === "mixed_color"
            ? "selective saturated red, blue, and Burmese yellow color-pop accents with remaining ink black"
            : `only these approximate custom inks: ${customPaletteDescription(options)}, with remaining ink black`;
  return `Edit the provided tattoo catalog image. Change only the ink color to ${colors}. Preserve exactly all geometry, silhouettes, lettering, line thickness, placement, and the pure white background. Do not add, remove, redraw, fill, or invent any motif, shape, text, shadow, gradient, or background element.`;
}

/**
 * A referenced edit supplies only the intended palette. Version 3 asks for solid colors inside
 * existing closed motif areas; source-derived masks still decide every output pixel.
 */
export function colorVersionEditPrompt(
  mode: ColorVersionMode,
  options: ColorVersionOptions = {},
): string {
  if (mode === "monochrome" || options.fillEnclosedRegions === false) {
    return legacyColorVersionEditPrompt(mode, options);
  }
  const colors =
    mode === "red_accent"
      ? "solid saturated red"
      : mode === "blue_accent"
        ? "solid saturated blue"
        : mode === "mixed_color"
          ? "solid saturated red, blue, and Burmese yellow"
          : `only these exact approximate custom inks: ${customPaletteDescription(options)}`;
  return `Edit the provided tattoo catalog image. Change only the ink color to ${colors}. Fill the existing enclosed petals, leaves, and other closed motif areas with those flat solid colors while keeping the original contour lines clear black; make this a whole-design color proposal rather than only colored lines. Preserve exactly all geometry, silhouettes, lettering, line thickness, placement, native framing, and pure white exterior background. Do not add, remove, redraw, or invent any motif, shape, text, shadow, gradient, background element, or additional design.`;
}

function hueFor(rgb: readonly [number, number, number]): number {
  const red = rgb[0] / 255;
  const green = rgb[1] / 255;
  const blue = rgb[2] / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (!delta) return 0;
  let hue: number;
  if (maximum === red) hue = ((green - blue) / delta) % 6;
  else if (maximum === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function hueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

function requestedColorForProposalPixel(
  rgb: readonly [number, number, number],
  palette: readonly PaletteColor[],
): ProposalColor | undefined {
  const maximum = Math.max(rgb[0], rgb[1], rgb[2]) / 255;
  const minimum = Math.min(rgb[0], rgb[1], rgb[2]) / 255;
  const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
  const blackIndex = palette.findIndex((color) => color.id === "black");
  // A black custom fill is only meaningful inside a source-enclosed region. Source contours
  // are excluded before this signal is considered, so a dark proposal can safely vote for black.
  if (blackIndex >= 0 && maximum <= 0.38 && saturation <= 0.3) {
    return {
      rgb: palette[blackIndex].rgb,
      paletteIndex: blackIndex,
      score: 0.5 + (0.38 - maximum),
    };
  }
  // Black/grey proposal strokes are intentionally not color instructions for normal palettes.
  if (saturation < 0.32 || maximum < 0.24) return undefined;
  const hue = hueFor(rgb);
  let closest: { paletteIndex: number; hueDistance: number } | undefined;
  for (let index = 0; index < palette.length; index += 1) {
    if (palette[index].id === "black") continue;
    const distance = hueDistance(hue, hueFor(palette[index].rgb));
    if (!closest || distance < closest.hueDistance) {
      closest = { paletteIndex: index, hueDistance: distance };
    }
  }
  // Reject saturated colors outside the requested red/blue/yellow palette.
  if (!closest || closest.hueDistance > 34) return undefined;
  return {
    rgb: palette[closest.paletteIndex].rgb,
    paletteIndex: closest.paletteIndex,
    score: saturation * maximum * (1 - closest.hueDistance / 45),
  };
}

function originalInkCoverage(red: number, green: number, blue: number): number {
  return Math.max(0, Math.min(1, (255 - Math.min(red, green, blue)) / 255));
}

function colorNear(
  proposal: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  palette: readonly PaletteColor[],
): readonly [number, number, number] | undefined {
  let selected: ProposalColor | undefined;
  const radius = 3;
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    const sampleY = y + offsetY;
    if (sampleY < 0 || sampleY >= height) continue;
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const sampleX = x + offsetX;
      if (sampleX < 0 || sampleX >= width) continue;
      const offset = (sampleY * width + sampleX) * 3;
      const candidate = requestedColorForProposalPixel(
        [proposal[offset], proposal[offset + 1], proposal[offset + 2]],
        palette,
      );
      if (!candidate) continue;
      const distance = Math.hypot(offsetX, offsetY);
      const score = candidate.score - distance * 0.025;
      if (!selected || score > selected.score) {
        selected = { ...candidate, score };
      }
    }
  }
  return selected?.rgb;
}

async function flattenedRgb(
  input: Buffer,
  dimensions?: { width: number; height: number },
): Promise<RgbImage> {
  const pipeline = sharp(input, { failOn: "error" })
    .ensureAlpha()
    .flatten({ background: "#FFFFFF" })
    .removeAlpha();
  if (dimensions) {
    pipeline.resize({
      width: dimensions.width,
      height: dimensions.height,
      fit: "fill",
      kernel: "nearest",
    });
  }
  const raw = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (
    !raw.info.width ||
    !raw.info.height ||
    !raw.info.channels ||
    raw.info.channels < 3
  ) {
    throw new ColorVersionError();
  }
  if (raw.info.channels === 3) {
    return { pixels: raw.data, width: raw.info.width, height: raw.info.height };
  }
  // `ensureAlpha().flatten()` may still expose an opaque alpha channel in raw output.
  // Normalize to RGB before coverage work, while retaining the flattened white background.
  const pixels = Buffer.allocUnsafe(raw.info.width * raw.info.height * 3);
  for (
    let sourceOffset = 0, targetOffset = 0;
    sourceOffset < raw.data.length;
    sourceOffset += raw.info.channels, targetOffset += 3
  ) {
    pixels[targetOffset] = raw.data[sourceOffset];
    pixels[targetOffset + 1] = raw.data[sourceOffset + 1];
    pixels[targetOffset + 2] = raw.data[sourceOffset + 2];
  }
  return { pixels, width: raw.info.width, height: raw.info.height };
}

async function encodeRgb(
  pixels: Buffer,
  width: number,
  height: number,
  treatment: ActualColorTreatment = "ink_only",
): Promise<ColorVersionResult> {
  const png = await sharp(pixels, {
    raw: { width, height, channels: 3 },
  })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer();
  return { png, width, height, treatment };
}

async function monochromeVersion(
  originalBuffer: Buffer,
): Promise<ColorVersionResult> {
  const source = await flattenedRgb(originalBuffer);
  const gray = Buffer.allocUnsafe(source.width * source.height);
  for (
    let sourceOffset = 0, targetOffset = 0;
    sourceOffset < source.pixels.length;
    sourceOffset += 3, targetOffset += 1
  ) {
    const red = source.pixels[sourceOffset];
    const green = source.pixels[sourceOffset + 1];
    const blue = source.pixels[sourceOffset + 2];
    gray[targetOffset] = Math.round(
      red * 0.2126 + green * 0.7152 + blue * 0.0722,
    );
  }
  const png = await sharp(gray, {
    raw: { width: source.width, height: source.height, channels: 1 },
  })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer();
  return {
    png,
    width: source.width,
    height: source.height,
    treatment: "monochrome",
  };
}

function isLineSupportPixel(pixels: Buffer, pixel: number): boolean {
  const offset = pixel * 3;
  // This intentionally includes a one-pixel anti-aliased contour at roughly #E6E6E6.
  // This remains the authoritative source stroke; gap repair only changes a separate fill mask.
  return (
    Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) <=
    LINE_SUPPORT_THRESHOLD
  );
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
 * Finds white components that cannot reach the image edge through four-connected white pixels.
 * Typed flat arrays bound working memory and avoid recursion regardless of image complexity.
 */
export function findEnclosedWhiteRegions(
  pixels: Buffer,
  width: number,
  height: number,
): EnclosedWhiteRegions {
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

  const lineSupport = new Uint8Array(pixelCount);
  const exterior = new Uint8Array(pixelCount);
  const labels = new Int32Array(pixelCount);
  const areas = new Uint32Array(pixelCount + 1);
  const queue = new Int32Array(pixelCount);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (isLineSupportPixel(pixels, pixel)) lineSupport[pixel] = 1;
  }

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

function analysisDimensions(
  width: number,
  height: number,
): {
  width: number;
  height: number;
} {
  if (
    width * height <= MAX_ANALYSIS_PIXELS &&
    width <= MAX_ANALYSIS_EDGE &&
    height <= MAX_ANALYSIS_EDGE
  ) {
    return { width, height };
  }
  const scale = Math.min(
    MAX_ANALYSIS_EDGE / width,
    MAX_ANALYSIS_EDGE / height,
    Math.sqrt(MAX_ANALYSIS_PIXELS / (width * height)),
  );
  return {
    width: Math.max(1, Math.min(MAX_ANALYSIS_EDGE, Math.floor(width * scale))),
    height: Math.max(
      1,
      Math.min(MAX_ANALYSIS_EDGE, Math.floor(height * scale)),
    ),
  };
}

function composeInkOnlyColor(
  source: RgbImage,
  proposalPixels: RgbImage,
  palette: readonly PaletteColor[],
): { output: Buffer; coloredPixelCount: number } {
  const output = Buffer.allocUnsafe(source.pixels.length);
  let coloredPixelCount = 0;

  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    const offset = pixel * 3;
    const coverage = originalInkCoverage(
      source.pixels[offset],
      source.pixels[offset + 1],
      source.pixels[offset + 2],
    );
    if (coverage <= 0) {
      output[offset] = 255;
      output[offset + 1] = 255;
      output[offset + 2] = 255;
      continue;
    }

    const x = pixel % source.width;
    const y = Math.floor(pixel / source.width);
    const accent = colorNear(
      proposalPixels.pixels,
      source.width,
      source.height,
      x,
      y,
      palette,
    );
    if (accent) {
      output[offset] = Math.round(255 * (1 - coverage) + accent[0] * coverage);
      output[offset + 1] = Math.round(
        255 * (1 - coverage) + accent[1] * coverage,
      );
      output[offset + 2] = Math.round(
        255 * (1 - coverage) + accent[2] * coverage,
      );
      if (coverage >= 0.025) coloredPixelCount += 1;
    } else {
      const black = Math.round(255 * (1 - coverage));
      output[offset] = black;
      output[offset + 1] = black;
      output[offset + 2] = black;
    }
  }

  return { output, coloredPixelCount };
}

function chooseFilledRegionColors(
  regions: EnclosedWhiteRegions,
  proposal: RgbImage,
  palette: readonly PaletteColor[],
): { componentColors: Uint8Array; filledRegionCount: number } {
  const paletteLength = palette.length;
  const scores = new Float64Array((regions.count + 1) * paletteLength);
  const signals = new Uint32Array((regions.count + 1) * paletteLength);

  for (let pixel = 0; pixel < regions.labels.length; pixel += 1) {
    const label = regions.labels[pixel];
    if (!label) continue;
    const offset = pixel * 3;
    const candidate = requestedColorForProposalPixel(
      [
        proposal.pixels[offset],
        proposal.pixels[offset + 1],
        proposal.pixels[offset + 2],
      ],
      palette,
    );
    if (!candidate) continue;
    const voteIndex = label * paletteLength + candidate.paletteIndex;
    scores[voteIndex] += candidate.score;
    signals[voteIndex] += 1;
  }

  const componentColors = new Uint8Array(regions.count + 1);
  let filledRegionCount = 0;
  for (let label = 1; label <= regions.count; label += 1) {
    let bestIndex = -1;
    let bestScore = 0;
    let bestSignals = 0;
    for (
      let paletteIndex = 0;
      paletteIndex < paletteLength;
      paletteIndex += 1
    ) {
      const voteIndex = label * paletteLength + paletteIndex;
      if (scores[voteIndex] > bestScore) {
        bestScore = scores[voteIndex];
        bestSignals = signals[voteIndex];
        bestIndex = paletteIndex;
      }
    }
    // A proposal needs more than a stray colored pixel before it can color a source region.
    // Fully colored small petals/leaves still pass because their signal density is high.
    const minimumSignals = Math.max(1, Math.ceil(regions.areas[label] * 0.003));
    if (bestIndex >= 0 && bestSignals >= minimumSignals) {
      componentColors[label] = bestIndex + 1;
      filledRegionCount += 1;
    }
  }

  return { componentColors, filledRegionCount };
}

function composeFilledRegions(
  source: RgbImage,
  regions: EnclosedWhiteRegions,
  componentColors: Uint8Array,
  palette: readonly PaletteColor[],
): Buffer {
  const output = Buffer.allocUnsafe(source.pixels.length);
  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    const offset = pixel * 3;
    if (isLineSupportPixel(source.pixels, pixel)) {
      // The original contour remains black/grey, never proposal-colored, in a successful fill.
      const coverage = originalInkCoverage(
        source.pixels[offset],
        source.pixels[offset + 1],
        source.pixels[offset + 2],
      );
      const black = Math.round(255 * (1 - coverage));
      output[offset] = black;
      output[offset + 1] = black;
      output[offset + 2] = black;
      continue;
    }

    const x = pixel % source.width;
    const y = Math.floor(pixel / source.width);
    const analysisX = Math.min(
      regions.width - 1,
      Math.floor((x * regions.width) / source.width),
    );
    const analysisY = Math.min(
      regions.height - 1,
      Math.floor((y * regions.height) / source.height),
    );
    const label = regions.labels[analysisY * regions.width + analysisX];
    const colorIndex = label ? componentColors[label] : 0;
    if (colorIndex) {
      const color = palette[colorIndex - 1].rgb;
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
    } else {
      output[offset] = 255;
      output[offset + 1] = 255;
      output[offset + 2] = 255;
    }
  }
  return output;
}

/**
 * Chooses source-enclosed regions in a fixed geometric order. Tiny isolated white specks are not
 * meaningful tattoo areas, so they deliberately fall through to the source-ink-only projection.
 */
function chooseSelectedInkRegionColors(
  regions: EnclosedWhiteRegions,
  palette: readonly PaletteColor[],
): { componentColors: Uint8Array; filledRegionCount: number } {
  const tops = new Int32Array(regions.count + 1);
  const lefts = new Int32Array(regions.count + 1);
  tops.fill(regions.height);
  lefts.fill(regions.width);

  for (let pixel = 0; pixel < regions.labels.length; pixel += 1) {
    const label = regions.labels[pixel];
    if (!label) continue;
    const x = pixel % regions.width;
    const y = Math.floor(pixel / regions.width);
    if (y < tops[label]) tops[label] = y;
    if (x < lefts[label]) lefts[label] = x;
  }

  const meaningful = Array.from(
    { length: regions.count },
    (_, index) => index + 1,
  )
    .filter(
      (label) =>
        regions.areas[label] >= MINIMUM_MEANINGFUL_ENCLOSED_REGION_PIXELS,
    )
    .sort((left, right) => {
      if (tops[left] !== tops[right]) return tops[left] - tops[right];
      if (lefts[left] !== lefts[right]) return lefts[left] - lefts[right];
      if (regions.areas[left] !== regions.areas[right]) {
        return regions.areas[right] - regions.areas[left];
      }
      return left - right;
    });

  const componentColors = new Uint8Array(regions.count + 1);
  for (let index = 0; index < meaningful.length; index += 1) {
    componentColors[meaningful[index]] = (index % palette.length) + 1;
  }
  return { componentColors, filledRegionCount: meaningful.length };
}

/**
 * A no-enclosed-area custom selection can still tint existing source ink. Every output pixel is
 * derived from source coverage, so open contours remain open and the white canvas remains white.
 */
function composeSelectedInkOnlyColor(
  source: RgbImage,
  palette: readonly PaletteColor[],
): { output: Buffer; inkPixelCount: number } {
  if (!palette.length) throw new ColorVersionError();
  const output = Buffer.allocUnsafe(source.pixels.length);
  const selected = palette[0].rgb;
  let inkPixelCount = 0;

  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    const offset = pixel * 3;
    const coverage = originalInkCoverage(
      source.pixels[offset],
      source.pixels[offset + 1],
      source.pixels[offset + 2],
    );
    if (coverage <= 0) {
      output[offset] = 255;
      output[offset + 1] = 255;
      output[offset + 2] = 255;
      continue;
    }

    output[offset] = Math.round(255 * (1 - coverage) + selected[0] * coverage);
    output[offset + 1] = Math.round(
      255 * (1 - coverage) + selected[1] * coverage,
    );
    output[offset + 2] = Math.round(
      255 * (1 - coverage) + selected[2] * coverage,
    );
    inkPixelCount += 1;
  }

  return { output, inkPixelCount };
}

async function createSelectedInkColorVersion(
  originalBuffer: Buffer,
  palette: readonly PaletteColor[],
): Promise<ColorVersionResult> {
  const source = await flattenedRgb(originalBuffer);
  const dimensions = analysisDimensions(source.width, source.height);
  const analysis =
    dimensions.width === source.width && dimensions.height === source.height
      ? source
      : await flattenedRgb(originalBuffer, dimensions);
  const regions = findGapAwareFillRegions(
    analysis.pixels,
    analysis.width,
    analysis.height,
  );
  const selected = chooseSelectedInkRegionColors(regions, palette);

  if (selected.filledRegionCount) {
    return encodeRgb(
      composeFilledRegions(source, regions, selected.componentColors, palette),
      source.width,
      source.height,
      "filled",
    );
  }

  const composited = composeSelectedInkOnlyColor(source, palette);
  if (!composited.inkPixelCount) throw new ColorVersionError();
  return encodeRgb(composited.output, source.width, source.height, "ink_only");
}

async function createInkOnlyColorVersion(
  originalBuffer: Buffer,
  mode: Exclude<ColorVersionMode, "monochrome">,
  imageService: ColorVersionImageService,
  options: ColorVersionOptions,
): Promise<ColorVersionResult> {
  const source = await flattenedRgb(originalBuffer);
  const palette = paletteForMode(mode, options);
  const proposal = await imageService.generateImage(
    colorVersionEditPrompt(mode, { ...options, fillEnclosedRegions: false }),
    [{ b64Json: originalBuffer.toString("base64"), mimeType: "image/png" }],
  );
  const proposalPixels = await flattenedRgb(proposal.bytes, {
    width: source.width,
    height: source.height,
  });
  const composited = composeInkOnlyColor(source, proposalPixels, palette);
  if (!composited.coloredPixelCount) throw new ColorVersionError();
  return encodeRgb(composited.output, source.width, source.height);
}

async function createFilledColorVersion(
  originalBuffer: Buffer,
  mode: Exclude<ColorVersionMode, "monochrome">,
  imageService: ColorVersionImageService,
  options: ColorVersionOptions,
): Promise<ColorVersionResult> {
  const source = await flattenedRgb(originalBuffer);
  const palette = paletteForMode(mode, options);
  const dimensions = analysisDimensions(source.width, source.height);
  const analysis =
    dimensions.width === source.width && dimensions.height === source.height
      ? source
      : await flattenedRgb(originalBuffer, dimensions);
  const regions = findEnclosedWhiteRegions(
    analysis.pixels,
    analysis.width,
    analysis.height,
  );
  const proposal = await imageService.generateImage(
    colorVersionEditPrompt(mode, options),
    [{ b64Json: originalBuffer.toString("base64"), mimeType: "image/png" }],
  );
  const proposalPixels = await flattenedRgb(proposal.bytes, dimensions);

  // Open-line artwork has no source-enclosed white component. Retain its useful V2-style accent
  // behavior while still keeping every colored pixel on original ink coverage.
  if (!regions.count) {
    // Region analysis is deliberately bounded to 720px, but the ink-only fallback must sample
    // proposal pixels at the native source coordinates.
    const nativeProposalPixels =
      dimensions.width === source.width && dimensions.height === source.height
        ? proposalPixels
        : await flattenedRgb(proposal.bytes, {
            width: source.width,
            height: source.height,
          });
    const composited = composeInkOnlyColor(
      source,
      nativeProposalPixels,
      palette,
    );
    if (!composited.coloredPixelCount) throw new ColorVersionError();
    return encodeRgb(composited.output, source.width, source.height);
  }

  const selected = chooseFilledRegionColors(regions, proposalPixels, palette);
  // Closed areas existed, so do not quietly recolor their outlines when the proposal did not
  // actually support a source-contained fill.
  if (!selected.filledRegionCount) throw new ColorVersionError();
  return encodeRgb(
    composeFilledRegions(source, regions, selected.componentColors, palette),
    source.width,
    source.height,
    "filled",
  );
}

/**
 * V3 custom ink selections are composed locally from source pixels. Other color modes use
 * ImageService proposals projected onto source-enclosed regions; `fillEnclosedRegions: false`
 * retains the V2 provider-backed ink-only compositor.
 */
export async function createColorVersion(
  originalBuffer: Buffer,
  mode: ColorVersionMode,
  imageService: ColorVersionImageService,
  options: ColorVersionOptions = {},
): Promise<ColorVersionResult> {
  try {
    if (mode === "monochrome") return await monochromeVersion(originalBuffer);
    if (mode === "custom") {
      const palette = paletteForMode(mode, options);
      // A one-ink black custom choice remains fully serialized as custom intent, but is a
      // deterministic monochrome rendition rather than a chromatic provider request.
      if (palette.length === 1 && palette[0].id === "black") {
        return await monochromeVersion(originalBuffer);
      }
      // V3 custom ink selection is intentionally source-only. It never asks a provider to infer
      // new subject matter: closed source regions receive selected inks, otherwise only existing
      // ink coverage is tinted. V2 jobs retain the historic provider-backed projection below.
      if (options.fillEnclosedRegions !== false) {
        return await createSelectedInkColorVersion(originalBuffer, palette);
      }
    }
    if (options.fillEnclosedRegions === false) {
      return await createInkOnlyColorVersion(
        originalBuffer,
        mode,
        imageService,
        options,
      );
    }
    return await createFilledColorVersion(
      originalBuffer,
      mode,
      imageService,
      options,
    );
  } catch (error) {
    if (error instanceof ColorVersionError) throw error;
    throw new ColorVersionError(
      error instanceof Error && error.name === "PlatformServiceError"
        ? "image_service"
        : "color_projection",
      error,
    );
  }
}
