import { describe, expect, it } from "vitest";
import {
  TATTOO_INKS,
  TATTOO_INK_SCREEN_HEX,
  tattooInkDisplayHex,
  tattooInkScreenPalette,
  validateTattooInkIds,
  type GenericPaletteColor,
  type TattooInkId,
} from "../shared/tattoo-inks";

const expectedScreenHex: Record<TattooInkId, string> = {
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

describe("tattoo ink screen palette", () => {
  it("defines a bright screen color for all 20 catalog IDs in catalog order", () => {
    expect(Object.keys(TATTOO_INK_SCREEN_HEX)).toEqual(
      TATTOO_INKS.map(({ id }) => id),
    );
    expect(TATTOO_INK_SCREEN_HEX).toEqual(expectedScreenHex);
    expect(
      TATTOO_INKS.map(({ id }) => tattooInkScreenPalette([id])[0].hex),
    ).toEqual(TATTOO_INKS.map(({ id }) => expectedScreenHex[id]));
  });

  it("keeps named hues distinct and exposes the requested display hex", () => {
    const palette = tattooInkScreenPalette([
      "purple",
      "warm_purple",
      "red",
    ]);
    expect(palette.map(({ hex }) => hex)).toEqual([
      "#A020F0",
      "#D04DBA",
      "#F44345",
    ]);
    expect(tattooInkDisplayHex("cool_purple")).toBe("#8A4FFF");
    expect(new Set(palette.map(({ hex }) => hex)).size).toBe(palette.length);
  });

  it("derives RGB from each bright screen hex and preserves each original reference hex", () => {
    const palette = TATTOO_INKS.map(
      ({ id }) => tattooInkScreenPalette([id])[0],
    );
    expect(palette).toEqual(
      TATTOO_INKS.map((ink) => {
        const hex = expectedScreenHex[ink.id];
        return {
          name: ink.name,
          id: ink.id,
          hex,
          rgb: [
            Number.parseInt(hex.slice(1, 3), 16),
            Number.parseInt(hex.slice(3, 5), 16),
            Number.parseInt(hex.slice(5, 7), 16),
          ],
          referenceHex: ink.hex,
        };
      }),
    );
    const genericColors: GenericPaletteColor[] = palette;
    expect(genericColors).toHaveLength(20);
  });

  it("validates one-to-three unique IDs and preserves caller order", () => {
    const ids = ["tattoo_blue", "black", "lemon_yellow"] as const;
    expect(validateTattooInkIds(ids)).toEqual([...ids]);
    expect(tattooInkScreenPalette(ids).map(({ id }) => id)).toEqual([...ids]);
    expect(() => validateTattooInkIds([])).toThrow(
      "invalid_tattoo_ink_selection",
    );
    expect(() => validateTattooInkIds(["red", "red"])).toThrow(
      "invalid_tattoo_ink_selection",
    );
    expect(() => validateTattooInkIds(["red", "green", "black", "purple"])).toThrow(
      "invalid_tattoo_ink_selection",
    );
  });
});
