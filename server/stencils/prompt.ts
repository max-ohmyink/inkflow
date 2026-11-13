import {
  parseCatalogFilters,
  type CatalogFilters,
} from "../../shared/catalog-filters";
import { isDisallowedInstantDrawConcept } from "../../shared/instant-draw";

export const STYLE_OPTIONS = [
  {
    id: "fine_line",
    label: "Fine Line",
    snippet:
      "simple monoline outline, delicate clean contours, minimal hand-drawn flash",
  },
  {
    id: "traditional",
    label: "Bold Outline",
    snippet:
      "simple bold monoline outline, clean contours, minimal hand-drawn flash",
  },
  {
    id: "geometric",
    label: "Simple Shapes",
    snippet:
      "simple monoline outlines with basic shapes, clean contours, minimal hand-drawn flash",
  },
  {
    id: "cyber",
    label: "Flowing Lines",
    snippet:
      "simple flowing monoline outline, clean contours, minimal hand-drawn flash",
  },
] as const;

export const MEDIUM_OPTIONS = [
  {
    id: "blackwork",
    label: "Classic Blackwork",
    snippet:
      "simple black outlines on pure white background, 100% monochrome, zero shading, high contrast line art",
  },
  {
    id: "jagua",
    label: "Jagua Stain",
    snippet:
      "deep blue-black simple outlines on pure white background, zero shading, high contrast line art",
  },
  {
    id: "twotone",
    label: "Two-Tone Accent",
    snippet:
      "simple black outlines with selective red ink accent highlights on pure white background, zero shading",
  },
] as const;

export type StencilStyle = (typeof STYLE_OPTIONS)[number]["id"];
export type StencilMedium = (typeof MEDIUM_OPTIONS)[number]["id"];

export type StencilInput = {
  concept: string;
  style: StencilStyle;
  medium: StencilMedium;
  clientId: string;
  requestId?: string;
  capabilityToken?: string;
  filters?: CatalogFilters;
};

export class StencilInputError extends Error {
  constructor(message = "invalid_request") {
    super(message);
    this.name = "StencilInputError";
  }
}

const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function optionFor<T extends readonly { id: string }[]>(
  options: T,
  id: unknown,
): T[number] | undefined {
  return typeof id === "string"
    ? options.find((option) => option.id === id)
    : undefined;
}

/** Validates guest input while keeping the compiled prompt a predictable five lines. */
export function parseStencilInput(body: unknown): StencilInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new StencilInputError();
  }

  const value = body as Record<string, unknown>;
  if (typeof value.concept !== "string") throw new StencilInputError();
  const concept = value.concept.trim();
  if (!concept || concept.length > 240 || /[\r\n\u0000]/.test(concept)) {
    throw new StencilInputError();
  }
  if (isDisallowedInstantDrawConcept(concept)) {
    throw new StencilInputError("instant_draw_only");
  }

  const style = optionFor(STYLE_OPTIONS, value.style);
  const medium = optionFor(MEDIUM_OPTIONS, value.medium);
  if (!style || !medium) throw new StencilInputError();

  if (
    typeof value.clientId !== "string" ||
    !ID_PATTERN.test(value.clientId) ||
    value.clientId.length > 128
  ) {
    throw new StencilInputError();
  }

  let requestId: string | undefined;
  if (value.requestId !== undefined) {
    if (
      typeof value.requestId !== "string" ||
      !ID_PATTERN.test(value.requestId) ||
      value.requestId.length > 128
    ) {
      throw new StencilInputError();
    }
    requestId = value.requestId;
  }

  let capabilityToken: string | undefined;
  if (value.capabilityToken !== undefined) {
    if (
      typeof value.capabilityToken !== "string" ||
      !/^[0-9a-f]{64}$/.test(value.capabilityToken)
    ) {
      throw new StencilInputError();
    }
    capabilityToken = value.capabilityToken;
  }
  let filters: CatalogFilters | undefined;
  if (value.filters !== undefined) {
    try {
      filters = parseCatalogFilters(value.filters);
    } catch {
      throw new StencilInputError();
    }
  }
  return {
    concept,
    style: style.id,
    medium: medium.id,
    clientId: value.clientId,
    requestId,
    capabilityToken,
    ...(filters ? { filters } : {}),
  };
}

function requiredSnippet<T extends readonly { id: string; snippet: string }[]>(
  options: T,
  id: string,
): string {
  const option = options.find((candidate) => candidate.id === id);
  if (!option) throw new StencilInputError();
  return option.snippet;
}

/**
 * The approved five-line prompt, verbatim apart from the three submitted variables.
 * Keep this separate from contact-sheet layout text so it is auditable and testable.
 */
export function compileStencilPrompt(
  concept: string,
  style: StencilStyle,
  medium: StencilMedium,
): string {
  if (isDisallowedInstantDrawConcept(concept)) {
    throw new StencilInputError("instant_draw_only");
  }
  const styleSnippet = requiredSnippet(STYLE_OPTIONS, style);
  const mediumSnippet = requiredSnippet(MEDIUM_OPTIONS, medium);

  return `Create 4 distinct instant-draw outline variations of ${concept}.\nStyle: ${styleSnippet}.\nMedium & Color: ${mediumSnippet}.\nConstraints: One small recognizable motif; approximately 6–12 clean strokes as guidance, not a guarantee; minimal interior detail; open whitespace; high contrast on #FFFFFF for instant hand drawing; no overlapping, multi-subject, or dense effects.\nNegative Constraints: --no mandalas, radial ornaments, sacred geometry, dotwork, stippling, hatching, shading, solid filled areas, tiny intricate details, complex tribal patterns, 3D photorealism, skin, body parts, realistic shading, grey gradients, complex background clutter, shadows, blur`;
}

/** Added only for the single contact-sheet call; it never alters the approved compiled prompt. */
export const CONTACT_SHEET_LAYOUT_INSTRUCTIONS =
  "Exactly 4 separate artworks in equal 2x2 pure-white quadrants, no text, frames, overlap, or central artwork; maintain white gutters; do not mirror artwork before postprocessing.";

export function compileGenerationPrompt(
  input: Pick<StencilInput, "concept" | "style" | "medium">,
): string {
  return `${compileStencilPrompt(input.concept, input.style, input.medium)}\n\n${CONTACT_SHEET_LAYOUT_INSTRUCTIONS}`;
}
