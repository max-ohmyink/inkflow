/**
 * The ten marker colors of the temporary-tattoo pen set (red, orange, gold, green, mint, sky blue,
 * purple, white, silver, black). Only these can be picked. `hex` is the reference color used by
 * the color compositor; the bright on-screen color is in TATTOO_INK_SCREEN_HEX below.
 */
export const TATTOO_INKS = [
  { id: "red", name: "Red", hex: "#B64457" },
  { id: "orange", name: "Orange", hex: "#A65037" },
  { id: "gold", name: "Gold", hex: "#A9833C" },
  { id: "green", name: "Green", hex: "#397867" },
  { id: "mint_green", name: "Mint Green", hex: "#4E9A86" },
  { id: "sky_blue", name: "Sky Blue", hex: "#3D6895" },
  { id: "purple", name: "Purple", hex: "#512E5F" },
  { id: "white", name: "White", hex: "#D9D9D9" },
  { id: "silver", name: "Silver", hex: "#9A9EA5" },
  { id: "black", name: "Black", hex: "#3E414A" },
] as const;

export type TattooInkId = (typeof TATTOO_INKS)[number]["id"];
export type TattooInk = (typeof TATTOO_INKS)[number];
export type TattooInkPaletteColor = TattooInk & {
  rgb: readonly [number, number, number];
};

/** Common shape consumed by palette pickers and other generic color displays. */
export type GenericPaletteColor = {
  name: string;
  id: string;
  hex: string;
  rgb: readonly [number, number, number];
};

export type TattooInkScreenPaletteColor = GenericPaletteColor & {
  id: TattooInkId;
  referenceHex: string;
};

const INK_BY_ID = new Map<TattooInkId, TattooInk>(
  TATTOO_INKS.map((ink) => [ink.id, ink]),
);
const HEX_RGB = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/;

/** Brighter display-only colors; catalog/source hex values remain unchanged. */
export const TATTOO_INK_SCREEN_HEX: Record<TattooInkId, string> = {
  red: "#F44345",
  orange: "#FF8A2B",
  gold: "#E0A82E",
  green: "#37B56E",
  mint_green: "#3FD0AE",
  sky_blue: "#3FB4EA",
  purple: "#A020F0",
  white: "#F7F7F7",
  silver: "#BCC0C8",
  black: "#202327",
};

function rgbFromHex(hex: string): readonly [number, number, number] {
  const match = HEX_RGB.exec(hex);
  if (!match) throw new Error("invalid_tattoo_ink_palette");
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

export function isTattooInkId(value: unknown): value is TattooInkId {
  return typeof value === "string" && INK_BY_ID.has(value as TattooInkId);
}

/**
 * Validates an explicit custom selection. A custom tattoo palette must contain one to three
 * distinct catalog IDs; callers should omit the field entirely when no custom palette is chosen.
 */
export function validateTattooInkIds(value: unknown): TattooInkId[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    value.some((id) => !isTattooInkId(id))
  ) {
    throw new Error("invalid_tattoo_ink_selection");
  }
  const ids = value as TattooInkId[];
  if (new Set(ids).size !== ids.length) {
    throw new Error("invalid_tattoo_ink_selection");
  }
  return [...ids];
}

export function tattooInkForId(id: TattooInkId): TattooInk {
  const ink = INK_BY_ID.get(id);
  if (!ink) throw new Error("invalid_tattoo_ink_selection");
  return ink;
}

/** Returns the brighter display-only hex for an ink without changing its reference/catalog hex. */
export function tattooInkDisplayHex(id: TattooInkId): string {
  if (!isTattooInkId(id)) throw new Error("invalid_tattoo_ink_selection");
  return TATTOO_INK_SCREEN_HEX[id];
}

/** Returns selected inks in caller order with bright screen colors and preserved reference hexes. */
export function tattooInkScreenPalette(
  ids: readonly TattooInkId[],
): TattooInkScreenPaletteColor[] {
  return validateTattooInkIds(ids).map((id) => {
    const ink = tattooInkForId(id);
    const hex = tattooInkDisplayHex(id);
    return {
      name: ink.name,
      id: ink.id,
      hex,
      rgb: rgbFromHex(hex),
      referenceHex: ink.hex,
    };
  });
}

/** Returns the exact selected screen-RGB approximations used by the color compositor. */
export function tattooInkPalette(
  ids: readonly TattooInkId[],
): TattooInkPaletteColor[] {
  return validateTattooInkIds(ids).map((id) => {
    const ink = tattooInkForId(id);
    return {
      ...ink,
      rgb: rgbFromHex(ink.hex),
    };
  });
}
