import type {
  CatalogArtStyle,
  CatalogFilters,
} from "../../shared/catalog-filters";
import { tattooInkScreenPalette } from "../../shared/tattoo-inks";
import {
  compileGenerationPrompt,
  CONTACT_SHEET_LAYOUT_INSTRUCTIONS,
  type StencilMedium,
  type StencilStyle,
} from "./prompt";

/**
 * Catalog art-style choices are customer-facing directions, not the old frontend style control.
 * Persisted filters retain the specific direction; this legacy profile field stays within the
 * existing metadata schema for retry-safe worker compatibility.
 */
export function aiFallbackStyleForArtStyle(
  artStyle: CatalogArtStyle,
  _submittedStyle: StencilStyle,
): StencilStyle {
  switch (artStyle) {
    case "fine_line":
    case "watercolor":
      return "fine_line";
    case "old_school":
    case "traditional":
      return "traditional";
    case "illustrated":
      return "geometric";
    case "lettering":
      return "fine_line";
    case "cyber_ornamental":
      return "cyber";
    case "any":
      // New family work must not inherit an older free-form style selection.
      return "fine_line";
  }
}

/** Legacy wire medium; actual source colors follow the persisted style-specific prompt. */
export const AI_FALLBACK_BASE_MEDIUM: StencilMedium = "blackwork";

type FallbackDirection =
  | "fine_line"
  | "old_school"
  | "traditional"
  | "watercolor";

const FAMILY_SAFETY =
  "Family safety: each variation is one friendly, child-appropriate motif; keep it simple, recognizable, and limited to approximately 6–12 clean strokes with generous open whitespace.";
const FAMILY_SAFETY_NEGATIVES =
  "Family safety negatives: --no dense detail; --no ornate detail; --no complicated roses; --no melted or sad smiles; --no scary masks; --no skulls or monsters; --no gore or blood; --no weapons; --no sexual or explicit content; --no mandalas; --no radial ornaments; --no sacred geometry; --no complex backgrounds; --no multiple subjects; --no skin or body parts; --no 3D photorealism.";

function fallbackDirection(
  filters: CatalogFilters | undefined,
): FallbackDirection {
  switch (filters?.artStyle) {
    case "old_school":
      return "old_school";
    case "traditional":
      return "traditional";
    case "watercolor":
      return "watercolor";
    case "fine_line":
    case "any":
    case "illustrated":
    case "lettering":
    case "cyber_ornamental":
    case undefined:
      // Archived or filter-less metadata retains the established minimal-outline fallback.
      return "fine_line";
  }
}

function selectedPaletteInstruction(
  filters: CatalogFilters | undefined,
): string {
  if (filters?.colorMix !== "custom" || !filters.inkColors) return "";
  try {
    const inks = tattooInkScreenPalette(filters.inkColors);
    const palette = inks
      .map((ink) => `${ink.name} (RGB ${ink.rgb.join(", ")})`)
      .join(", ");
    return `\nSelected tattoo-ink palette: use only ${palette}; do not add other colors.`;
  } catch {
    // Stored metadata is validated before a worker reaches this point; fail closed to no palette
    // wording if a malformed historical payload somehow bypasses that invariant.
    return "";
  }
}

function styleDirectionPrompt(
  concept: string,
  direction: Exclude<FallbackDirection, "fine_line">,
  filters: CatalogFilters | undefined,
): string {
  const palette = selectedPaletteInstruction(filters);
  const style =
    direction === "old_school"
      ? "classic American old-school tattoo flash with bold black outlines and bright, flat, limited color fills"
      : direction === "traditional"
        ? "bold traditional tattoo motifs with strong contours and minimal, clean interior detail; use only small flat fills when they clarify the motif"
        : "a simple, defined dark contour with soft digital colored washes; washed gradients and soft shading are allowed";
  const colorConstraint =
    direction === "watercolor"
      ? "Keep the wash controlled inside and immediately around the simple contour on a pure white background."
      : "Keep flat fills limited and clean on a pure white background; do not use gradients.";

  return `Create 4 distinct instant-draw tattoo variations of ${concept}.\nStyle: ${style}.${palette}\nConstraints: ${colorConstraint} One small recognizable motif; open whitespace; no overlap or dense effects.\n\n${CONTACT_SHEET_LAYOUT_INSTRUCTIONS}\n${FAMILY_SAFETY}\n${FAMILY_SAFETY_NEGATIVES}`;
}

/**
 * Builds the one-contact-sheet fallback prompt. `filters` is optional for stored legacy callers;
 * worker callers pass persisted filters so Traditional and Watercolor retain their distinct intent.
 */
export function compileAiFallbackGenerationPrompt(input: {
  concept: string;
  style: StencilStyle;
  filters?: CatalogFilters;
}): string {
  const direction = fallbackDirection(input.filters);
  if (direction === "fine_line") {
    // Keep the approved black-outline prompt verbatim for the legacy/default direction.
    const base = compileGenerationPrompt({
      concept: input.concept,
      style: "fine_line",
      medium: AI_FALLBACK_BASE_MEDIUM,
    });
    return `${base}\n${FAMILY_SAFETY}\n${FAMILY_SAFETY_NEGATIVES}`;
  }
  return styleDirectionPrompt(input.concept, direction, input.filters);
}

/** Neutral provenance for AI options; never invent catalog collection/page or catalog IDs. */
export function aiFallbackOptionTitle(concept: string, index: number): string {
  const variation = Number.isInteger(index) && index >= 0 ? index + 1 : 1;
  return `AI-created ${concept} — variation ${variation}`;
}

export function aiFallbackMetadataInput(
  concept: string,
  submittedStyle: StencilStyle,
  filters: CatalogFilters,
) {
  return {
    concept,
    style: aiFallbackStyleForArtStyle(filters.artStyle, submittedStyle),
    medium: "blackwork" as const,
    filters,
    colorMode: filters.colorMix,
    fillEnclosedRegions: true as const,
  };
}
