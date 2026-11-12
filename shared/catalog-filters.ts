import records from "../assets/catalog/inspiration/catalog-items.json";
import indexed from "../assets/catalog/inspiration/catalog-traits.json";
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
 * `any` is deliberately source-catalog first rather than a visual style.
 */
const ARCHIVED_STYLE_LABELS: Partial<Record<CatalogArtStyle, string>> = {
  any: "Catalog match",
  illustrated: "Playful line art",
  lettering: "Lettering",
  cyber_ornamental: "Cyber & ornamental",
};

/**
 * Catalog trait labels are source-data labels, not a promise that every guest direction already
 * exists in the source catalog. Traditional shares the catalog's classic-flash old_school group;
 * Watercolor deliberately has no alias and can only match a genuine future watercolor trait.
 */
const CATALOG_TRAIT_LABELS_BY_ART_STYLE: Partial<
  Record<CatalogArtStyle, readonly string[]>
> = {
  traditional: ["old_school"],
};

export function catalogFinderFilters(filters: CatalogFilters): CatalogFilters {
  return { ...filters, category: "all" };
}

/** Output color is intent, not a catalog retrieval constraint. */
export function catalogDesignSelectionFilters(
  filters: CatalogFilters,
): CatalogFilters {
  const { inkColors: _inkColors, ...withoutInks } = filters;
  return { ...withoutInks, colorMix: "any" };
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

export const CATALOG_CATEGORY_OPTIONS = [
  { id: "all", label: "Any collection" },
  ...Array.from(
    new Map(
      records.map((item) => [
        item.category,
        { id: item.category, label: item.collection },
      ]),
    ).values(),
  ),
];

type Trait = {
  artStyles: string[];
  colorMix: string;
  colorFamilies: string[];
  colorInkFraction: number;
};
const traits = indexed.entries as Record<string, Trait>;
export function catalogTrait(id: string): Trait | undefined {
  return traits[id];
}

export function parseCatalogFilters(value: unknown): CatalogFilters {
  if (value === undefined || value === null)
    return { ...DEFAULT_CATALOG_FILTERS };
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_catalog_filters");
  const input = value as Record<string, unknown>;
  const category = input.category ?? "all";
  const artStyle = input.artStyle ?? "any";
  const colorMix = input.colorMix ?? "any";
  if (
    typeof category !== "string" ||
    !CATALOG_CATEGORY_OPTIONS.some((option) => option.id === category) ||
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

export function matchesCatalogFilters(
  item: { id: string; category: string },
  filters: CatalogFilters,
): boolean {
  if (filters.category !== "all" && item.category !== filters.category)
    return false;
  const trait = traits[item.id];
  const acceptedTraitLabels =
    CATALOG_TRAIT_LABELS_BY_ART_STYLE[filters.artStyle] ?? [
      filters.artStyle,
    ];
  if (
    filters.artStyle !== "any" &&
    !acceptedTraitLabels.some((label) => trait?.artStyles.includes(label))
  )
    return false;
  if (
    filters.colorMix !== "any" &&
    filters.colorMix !== "custom" &&
    trait?.colorMix !== filters.colorMix
  )
    return false;
  return true;
}

export function filterCatalogByChoices<
  T extends { id: string; category: string },
>(items: readonly T[], filters: CatalogFilters): T[] {
  return items.filter((item) => matchesCatalogFilters(item, filters));
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
