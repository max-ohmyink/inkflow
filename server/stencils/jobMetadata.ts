import {
  parseCatalogFilters,
  type CatalogColorMix,
  type CatalogFilters,
} from "../../shared/catalog-filters";
import type { TattooInkId } from "../../shared/tattoo-inks";
import { isDisallowedInstantDrawConcept } from "../../shared/instant-draw";
import type { StencilMedium, StencilStyle } from "./prompt";

const STENCIL_STYLES = new Set<StencilStyle>([
  "fine_line",
  "traditional",
  "geometric",
  "cyber",
]);
const STENCIL_MEDIA = new Set<StencilMedium>(["blackwork", "jagua", "twotone"]);

export type AiJobPromptV1 = {
  version: 1;
  mode: "ai";
  concept: string;
  style: StencilStyle;
  /** Retained wire field; actual source colors can follow a persisted painted style direction. */
  medium: "blackwork";
  filters: CatalogFilters;
  colorMode: CatalogColorMix;
  /** Mirrors filters.inkColors when a custom palette is requested, for retry-safe worker access. */
  inkColors?: TattooInkId[];
  fillEnclosedRegions: true;
};

type RawObject = Record<string, unknown>;

function parseObject(value: string): RawObject | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RawObject)
      : undefined;
  } catch {
    return undefined;
  }
}

function validStoredConcept(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 240 &&
    !/[\r\n\u0000]/.test(value) &&
    !isDisallowedInstantDrawConcept(value)
  );
}

function sameInkColors(
  left: readonly TattooInkId[] | undefined,
  right: unknown,
): boolean {
  // Older or in-progress metadata may store custom IDs only inside filters. New constructors
  // always mirror them at the envelope level for worker retry access.
  if (right === undefined) return true;
  return (
    Array.isArray(right) &&
    left !== undefined &&
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

function parsedFiltersForMetadata(raw: RawObject): CatalogFilters | undefined {
  try {
    const filters = parseCatalogFilters(raw.filters);
    return typeof raw.colorMode === "string" &&
      raw.colorMode === filters.colorMix &&
      sameInkColors(filters.inkColors, raw.inkColors)
      ? filters
      : undefined;
  } catch {
    return undefined;
  }
}

function validAiMetadata(value: unknown): value is AiJobPromptV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as RawObject;
  if (
    raw.version !== 1 ||
    raw.mode !== "ai" ||
    !validStoredConcept(raw.concept) ||
    typeof raw.style !== "string" ||
    !STENCIL_STYLES.has(raw.style as StencilStyle) ||
    raw.medium !== "blackwork" ||
    raw.fillEnclosedRegions !== true
  ) {
    return false;
  }
  return Boolean(parsedFiltersForMetadata(raw));
}

/** Stores only validated, self-contained AI fallback intent before provider work is enqueued. */
export function createAiJobPrompt(metadata: AiJobPromptV1): string {
  if (!validAiMetadata(metadata)) throw new Error("ai_metadata_invalid");
  const filters = parseCatalogFilters(metadata.filters);
  return JSON.stringify({
    ...metadata,
    filters,
    colorMode: filters.colorMix,
    ...(filters.inkColors ? { inkColors: filters.inkColors } : {}),
  });
}

/** Invalid or incomplete AI metadata is deliberately not treated as a legacy free-form prompt. */
export function parseAiJobPrompt(prompt: string): AiJobPromptV1 | undefined {
  const raw = parseObject(prompt);
  if (!raw || !validAiMetadata(raw)) return undefined;
  const filters = parsedFiltersForMetadata(raw);
  if (!filters) return undefined;
  return {
    version: 1,
    mode: "ai",
    concept: raw.concept as string,
    style: raw.style as StencilStyle,
    medium: "blackwork",
    filters,
    colorMode: filters.colorMix,
    ...(filters.inkColors ? { inkColors: filters.inkColors } : {}),
    fillEnclosedRegions: true,
  };
}

/**
 * Detects a source-decision envelope even when it is malformed or an unsupported future version.
 * The worker uses this to fail closed rather than treating tampered metadata as legacy work.
 */
export function isVersionedStencilMetadata(prompt: string): boolean {
  const raw = parseObject(prompt);
  return Boolean(
    raw &&
    (raw.mode === "catalog" ||
      raw.mode === "ai" ||
      Object.prototype.hasOwnProperty.call(raw, "version")),
  );
}

export function declaredMetadataMode(
  prompt: string,
): "catalog" | "ai" | undefined {
  const raw = parseObject(prompt);
  return raw?.mode === "catalog" || raw?.mode === "ai" ? raw.mode : undefined;
}
