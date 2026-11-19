import type {
  CatalogArtStyle,
  CatalogFilters,
} from "../../shared/catalog-filters";
import { tattooInkScreenPalette } from "../../shared/tattoo-inks";
import {
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
    case "lettering":
      return "fine_line";
    case "old_school":
    case "traditional":
    case "neo_traditional":
    case "japanese":
      return "traditional";
    case "blackwork":
    case "tribal":
    case "illustrated":
      return "geometric";
    case "cyber_ornamental":
      return "cyber";
    case "any":
      return "fine_line";
  }
}

/** Legacy wire medium; the actual source look follows the art-style direction below. */
export const AI_FALLBACK_BASE_MEDIUM: StencilMedium = "blackwork";

/** Technical rules for a clean 2x2 flash sheet, plus the one content rule: nothing explicit. */
const NEGATIVES =
  "Negatives: --no frame, border or box around a design; --no text, letters, signatures or watermark; --no skin, body parts or tattoo mockup; --no sexual or explicit content; --no nudity.";

/** Shared composition: premium, finished flash by a master artist. */
const COMPOSITION =
  "Composition: a finished, premium tattoo flash design by a master tattoo artist, refined and balanced, rich in considered detail. The subject is centered with breathing room and does not touch the edges, with no background scene. Clean, crisp, print-ready artwork, not a sketch.";

type Direction = { look: string; color: string; composition?: string };

const FINE_LINE: Direction = {
  look: "Style: elegant continuous-line fine-line tattoo, drawn as one flowing line that rarely lifts the pen. The line is hair-thin, precise and black, with graceful sweeping curves, delicate loops and deliberate small details that define the form. Refined, airy, gallery-quality line art with no fill and no heavy shading.",
  color: "Pure black ink on a pure white background.",
};

const TRADITIONAL: Direction = {
  look: "Style: classic American traditional tattoo flash at master level, like a vintage swallow or eagle sheet. A bold, clean, confident black outline, solid black shading, and flat fills of color, with rich, considered detail: rows of scalloped feathers or scales, crisp white highlights and well-placed decorative accents. Balanced, iconic and timeless.",
  color:
    "Colors: the traditional limited palette of black, red, yellow and green in flat solid fills, with solid black shading, on a pure white background.",
};

const NEO_TRADITIONAL: Direction = {
  look: "Style: ornate neo-traditional tattoo with dramatic, varied line weight (heavy outer contour, fine inner linework), lush dimensional shading and decorative elements such as filigree, ornamental frames, curling leaves, ribbons or jewels arranged around the subject. Painterly depth, elegant curves and a rich, luxurious finish.",
  color:
    "Colors: a rich jewel-tone palette that suits the subject, blended smoothly with soft gradients, glowing highlights and deep shadows, on a pure white background.",
};

/**
 * Pure blackwork: 100% black ink, but not necessarily heavy. Line weight can range from fine,
 * precise lines to solid black areas. No tribal motifs (that is its own style).
 */
const BLACKWORK: Direction = {
  look: "Style: blackwork tattoo rendered entirely in 100% black ink. The line weight is chosen to suit the subject and can range from fine, precise linework to bold strokes and solid black areas, with crisp negative space in the white of the page defining the form and its details. Refined, high-contrast and elegant, with clean, sharp edges. No tribal motifs, no grey, no gradients, no washes and no soft shading tones: only pure black and pure white.",
  color:
    "Colors: 100% solid black ink only on a pure white background, with no other color and no grey.",
};

/** Tribal, as in the flowing tribal-sleeve reference. */
const TRIBAL: Direction = {
  look: "Style: bold tribal tattoo built from sweeping, interlocking solid black forms with sharp tapered tips, flowing curves and spiral curls, like a refined Polynesian-inspired or neo-tribal design. Crisp negative space between the shapes, rhythmic symmetry where the subject allows, and refined pattern detail that follows the flow of the form. Powerful and elegant.",
  color: "Colors: solid black ink on a pure white background.",
};

const WATERCOLOR: Direction = {
  look: "Style: artistic watercolor tattoo. A fine, expressive black sketch line, with translucent layered washes of color that bleed past the outline, wet blooms, splatters and soft gradients. Painterly, loose and sophisticated.",
  color:
    "Colors: soft, luminous watercolor hues that suit the subject, layered and blended where they meet, with the white of the page glowing through, on a pure white background.",
};

const JAPANESE: Direction = {
  look: "Style: traditional Japanese irezumi tattoo, like a master's flash painting. A bold, confident black outline, rich color with smooth bokashi shading, and classic elements composed around the subject: wind bars, curling waves, swirling clouds and flowers such as peony, maple or cherry blossom. Dynamic movement and fine detail.",
  color:
    "Colors: a rich traditional Japanese palette of deep indigo, vermilion red, golden orange and jade green, with smoky black-to-grey shading, on a pure white background.",
  composition:
    "Composition: a dynamic, flowing irezumi flash design by a master artist, rich in detail, with the subject as the main focus and the waves, clouds and flowers wrapped around it in one compact group that stays inside the frame and does not touch the edges. Clean, crisp, print-ready artwork, not a sketch.",
};

function directionFor(artStyle: CatalogArtStyle | undefined): Direction {
  switch (artStyle) {
    case "traditional":
      return TRADITIONAL;
    case "neo_traditional":
      return NEO_TRADITIONAL;
    case "blackwork":
      return BLACKWORK;
    case "tribal":
      return TRIBAL;
    case "watercolor":
      return WATERCOLOR;
    case "japanese":
      return JAPANESE;
    default:
      // fine_line, `any`, and every legacy style.
      return FINE_LINE;
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
    return `Selected tattoo-ink palette: use only ${palette}; do not add other colors.`;
  } catch {
    // Stored metadata is validated before a worker reaches this point; fail closed to no palette
    // wording if a malformed historical payload somehow bypasses that invariant.
    return "";
  }
}

/**
 * Builds the one-contact-sheet fallback prompt. `filters` is optional for stored legacy callers.
 * A customer-selected ink palette replaces the style's default colour line, except for Blackwork,
 * which is always black ink only.
 */
export function compileAiFallbackGenerationPrompt(input: {
  concept: string;
  style: StencilStyle;
  filters?: CatalogFilters;
}): string {
  const artStyle = input.filters?.artStyle;
  const direction = directionFor(artStyle);
  const palette =
    artStyle === "blackwork" ? "" : selectedPaletteInstruction(input.filters);
  const color = palette || direction.color;

  return `Create 4 distinct tattoo design variations of ${input.concept}.\n${direction.look} ${color}\n${direction.composition ?? COMPOSITION}\n\n${CONTACT_SHEET_LAYOUT_INSTRUCTIONS}\n${NEGATIVES}`;
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
