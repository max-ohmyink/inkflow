import {
  tattooInkPalette,
  validateTattooInkIds,
  type TattooInkId,
} from "./tattoo-inks";

export type CatalogArtStyle =
  | "any"
  | "fine_line"
  | "old_school"
  | "traditional"
  | "watercolor"
  | "illustrated"
  | "lettering"
  | "cyber_ornamental";
export type CatalogColorMix =
  | "any"
  | "monochrome"
  | "red_accent"
  | "blue_accent"
  | "mixed_color"
  | "custom";
export type CatalogFilters = {
  category: string;
  artStyle: CatalogArtStyle;
  colorMix: CatalogColorMix;
  /** Present only when colorMix is custom; values are one to three unique tattoo ink IDs. */
  inkColors?: TattooInkId[];
};

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  category: "all",
  artStyle: "any",
  colorMix: "any",
};

const VALID_CATALOG_ART_STYLES = new Set<CatalogArtStyle>([
  "any",
  "fine_line",
  "old_school",
  "traditional",
  "watercolor",
  "illustrated",
  "lettering",
  "cyber_ornamental",
]);

/**
 * Directions that remain valid in stored filters but are no longer part of the guest picker.
 * `any` means no specific art style was chosen.
 */
const ARCHIVED_STYLE_LABELS: Partial<Record<CatalogArtStyle, string>> = {
  any: "Any art style",
  illustrated: "Playful line art",
  lettering: "Lettering",
  cyber_ornamental: "Cyber & ornamental",
};

export function catalogFinderFilters(filters: CatalogFilters): CatalogFilters {
  return { ...filters, category: "all" };
}

/** The only guest-visible art-style directions. */
export const CATALOG_STYLE_OPTIONS: readonly {
  id: CatalogArtStyle;
  label: string;
}[] = [
  { id: "fine_line", label: "Fine Line" },
  { id: "old_school", label: "Old School" },
  { id: "traditional", label: "Traditional" },
  { id: "watercolor", label: "Watercolor" },
] as const;

export const CATALOG_COLOR_OPTIONS = [
  {
    id: "any",
    label: "Original colors",
    swatches: ["#333333", "#D43D42", "#5E87D8"],
  },
  { id: "monochrome", label: "Black & grey", swatches: ["#242424", "#878787"] },
  { id: "red_accent", label: "Black + red", swatches: ["#242424", "#D43D42"] },
  {
    id: "blue_accent",
    label: "Black + blue",
    swatches: ["#242424", "#3F70BF"],
  },
  {
    id: "mixed_color",
    label: "Color pop",
    swatches: ["#D43D42", "#F6CC11", "#5E87D8"],
  },
  {
    id: "custom",
    label: "Custom inks",
    swatches: ["#483468", "#B64457", "#418599"],
  },
] as const;

/** There is no longer a catalog to browse, so the category is always "all". */
export const CATALOG_CATEGORY_OPTIONS = [
  { id: "all", label: "Any collection" },
] as const;

export function parseCatalogFilters(value: unknown): CatalogFilters {
  if (value === undefined || value === null)
    return { ...DEFAULT_CATALOG_FILTERS };
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_catalog_filters");
  const input = value as Record<string, unknown>;
  // Stored filters from the retired catalog may carry another category; it is ignored.
  const category = "all";
  const artStyle = input.artStyle ?? "any";
  const colorMix = input.colorMix ?? "any";
  if (
    typeof artStyle !== "string" ||
    !VALID_CATALOG_ART_STYLES.has(artStyle as CatalogArtStyle) ||
    typeof colorMix !== "string" ||
    !CATALOG_COLOR_OPTIONS.some((option) => option.id === colorMix)
  ) {
    throw new Error("invalid_catalog_filters");
  }

  if (colorMix === "custom") {
    try {
      return {
        category,
        artStyle: artStyle as CatalogArtStyle,
        colorMix,
        inkColors: validateTattooInkIds(input.inkColors),
      };
    } catch {
      throw new Error("invalid_catalog_filters");
    }
  }

  // An ink list without custom mode is ambiguous and must not leak into non-custom retries.
  if (input.inkColors !== undefined) throw new Error("invalid_catalog_filters");
  return {
    category,
    artStyle: artStyle as CatalogArtStyle,
    colorMix: colorMix as Exclude<CatalogColorMix, "custom">,
  };
}

function artStyleSummary(style: CatalogArtStyle): string | undefined {
  return (
    CATALOG_STYLE_OPTIONS.find((option) => option.id === style)?.label ??
    ARCHIVED_STYLE_LABELS[style]
  );
}

function colorSummary(filters: CatalogFilters): string | undefined {
  if (filters.colorMix !== "custom") {
    return CATALOG_COLOR_OPTIONS.find((x) => x.id === filters.colorMix)?.label;
  }
  try {
    return `Custom inks: ${tattooInkPalette(filters.inkColors ?? [])
      .map((ink) => ink.name)
      .join(", ")}`;
  } catch {
    return undefined;
  }
}

export function catalogFilterSummary(filters: CatalogFilters): string {
  return [
    CATALOG_CATEGORY_OPTIONS.find((x) => x.id === filters.category)?.label,
    artStyleSummary(filters.artStyle),
    colorSummary(filters),
  ]
    .filter(Boolean)
    .join(" · ");
}
