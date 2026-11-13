import type { CatalogArtStyle } from "./catalog-filters";

/** Art-style values accepted for newly created family-event work. */
export const ALLOWED_FAMILY_ART_STYLE_IDS = [
  "any",
  "fine_line",
  "old_school",
  "traditional",
  "watercolor",
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
 * This is deliberately a narrow new-work guard. Stored metadata is never passed through it, so
 * historical jobs retain their resolved source records and their original provenance.
 */
const UNSAFE_FAMILY_THEME = new RegExp(
  [
    // Dense or unsuitable style requests.
    "\\b(?:mandalas?|sacred\\s+geometry|radial\\s+ornaments?)\\b",
    "\\b(?:complex|complicated|intricate|detailed)\\s+roses?\\b",
    "\\b(?:melted|melting|sad|crying)\\s+(?:smile(?:y)?|face)\\b",
    // Scary figures and graphic injury.
    "\\b(?:scary|horror|spooky|creepy|evil|demon|devil|skulls?|skeletons?|monsters?|zombies?|vampires?|scary\\s+masks?)\\b",
    "\\b(?:gore|gory|blood|bloody|wounds?|injury|injuries|dismember(?:ed|ment)?)\\b",
    // Weapons and explicit themes.
    "\\b(?:weapons?|guns?|rifles?|pistols?|knives|daggers?|swords?|axes|grenades?|bombs?)\\b",
    "\\b(?:sexual|explicit|nude|naked|nudity|porn(?:ography)?|genitals?)\\b",
  ].join("|"),
  "iu",
);

export function isUnsafeFamilyTheme(concept: string): boolean {
  return UNSAFE_FAMILY_THEME.test(concept);
}
