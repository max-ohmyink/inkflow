export const TATTOO_INKS = [
  { id: "cool_purple", name: "Cool Purple", hex: "#483468" },
  { id: "purple", name: "Purple", hex: "#512E5F" },
  { id: "warm_purple", name: "Warm Purple", hex: "#803A5C" },
  { id: "rose_pink", name: "Rose Pink", hex: "#A94F73" },
  { id: "red", name: "Red", hex: "#B64457" },
  { id: "cherry_red", name: "Cherry Red", hex: "#A64F61" },
  { id: "deep_red", name: "Deep Red", hex: "#89444F" },
  { id: "rust_red", name: "Rust Red", hex: "#604953" },
  { id: "brown", name: "Brown", hex: "#645352" },
  { id: "black", name: "Black", hex: "#3E414A" },
  { id: "lemon_yellow", name: "Lemon Yellow", hex: "#A99740" },
  { id: "apricot_yellow", name: "Apricot Yellow", hex: "#A9833C" },
  { id: "orange", name: "Orange", hex: "#A65037" },
  { id: "light_green", name: "Light Green", hex: "#6B8A3E" },
  { id: "green", name: "Green", hex: "#397867" },
  { id: "dark_green", name: "Dark Green", hex: "#305449" },
  { id: "lake_blue", name: "Lake Blue", hex: "#418599" },
  { id: "sky_blue", name: "Sky Blue", hex: "#3D6895" },
  { id: "navy_blue", name: "Navy Blue", hex: "#2D3485" },
  { id: "tattoo_blue", name: "Tattoo Blue", hex: "#2D365A" },
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
  cool_purple: "#8A4FFF",
  purple: "#A020F0",
  warm_purple: "#D04DBA",
  rose_pink: "#F55AA5",
  red: "#F44345",
  cherry_red: "#EC3063",
  deep_red: "#BD2542",
  rust_red: "#CC5B35",
  brown: "#A76D42",
  black: "#202327",
  lemon_yellow: "#FFE44D",
  apricot_yellow: "#FFC85C",
  orange: "#FF8A2B",
  light_green: "#A3DA54",
  green: "#37B56E",
  dark_green: "#25845D",
  lake_blue: "#28BFE1",
  sky_blue: "#56A8F7",
  navy_blue: "#3E62C9",
  tattoo_blue: "#3657A4",
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
