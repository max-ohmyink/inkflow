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

describe("tattoo ink screen palette", () => {
  it("defines a bright screen color for all 10 marker colors in catalog order", () => {
    expect(Object.keys(TATTOO_INK_SCREEN_HEX)).toEqual(
      TATTOO_INKS.map(({ id }) => id),
    );
    expect(TATTOO_INK_SCREEN_HEX).toEqual(expectedScreenHex);
    expect(
      TATTOO_INKS.map(({ id }) => tattooInkScreenPalette([id])[0].hex),
    ).toEqual(TATTOO_INKS.map(({ id }) => expectedScreenHex[id]));
  });

  it("keeps named hues distinct and exposes the requested display hex", () => {
    const palette = tattooInkScreenPalette(["purple", "orange", "red"]);
    expect(palette.map(({ hex }) => hex)).toEqual([
      "#A020F0",
      "#FF8A2B",
      "#F44345",
    ]);
    expect(tattooInkDisplayHex("gold")).toBe("#E0A82E");
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
    expect(genericColors).toHaveLength(10);
  });

  it("validates one-to-three unique IDs and preserves caller order", () => {
    const ids = ["sky_blue", "black", "gold"] as const;
    expect(validateTattooInkIds(ids)).toEqual([...ids]);
    expect(tattooInkScreenPalette(ids).map(({ id }) => id)).toEqual([...ids]);
    expect(() => validateTattooInkIds([])).toThrow(
      "invalid_tattoo_ink_selection",
    );
    expect(() => validateTattooInkIds(["red", "red"])).toThrow(
      "invalid_tattoo_ink_selection",
    );
    expect(() =>
      validateTattooInkIds(["red", "green", "black", "purple"]),
    ).toThrow("invalid_tattoo_ink_selection");
  });
});
