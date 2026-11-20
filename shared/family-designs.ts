import type { CatalogArtStyle } from "./catalog-filters";

/** Art-style values accepted for newly created work. */
export const ALLOWED_FAMILY_ART_STYLE_IDS = [
  "any",
  "fine_line",
  "old_school",
  "traditional",
  "watercolor",
  "blackwork",
  "engraving",
  "japanese",
  "neo_traditional",
  "tribal",
  "illustrated",
] as const satisfies readonly CatalogArtStyle[];

export type AllowedFamilyArtStyle =
  (typeof ALLOWED_FAMILY_ART_STYLE_IDS)[number];

const ALLOWED_FAMILY_ART_STYLE_SET = new Set<string>(
  ALLOWED_FAMILY_ART_STYLE_IDS,
);

export function isAllowedFamilyArtStyle(
  value: unknown,
): value is AllowedFamilyArtStyle {
  return typeof value === "string" && ALLOWED_FAMILY_ART_STYLE_SET.has(value);
}

/**
 * The only content rule for new work: no sexual or explicit themes. Classic tattoo subjects such as
 * skulls, daggers, demons, masks and mandalas are allowed. Stored metadata is never passed through
 * the new-work guard, so historical jobs retain their resolved source records.
 */
export const EXPLICIT_THEME =
  /\b(?:sexual|sex|explicit|nude|naked|nudity|porn(?:ography)?|genitals?|erotic)\b/iu;

export function isUnsafeFamilyTheme(concept: string): boolean {
  return EXPLICIT_THEME.test(concept);
}
