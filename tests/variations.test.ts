import { describe, expect, it } from "vitest";
import {
  DEFAULT_VARIATIONS,
  parseCatalogFilters,
  variationCount,
} from "../shared/catalog-filters";
import {
  artworksPerImage,
  compileAiFallbackGenerationPrompt,
} from "../server/stencils/aiFallback";

const filters = (variations?: number) => ({
  category: "all",
  artStyle: "fine_line" as const,
  colorMix: "any" as const,
  ...(variations === undefined ? {} : { variations }),
});
const promptFor = (variations?: number) =>
  compileAiFallbackGenerationPrompt({
    concept: "a fox",
    style: "fine_line",
    filters: filters(variations),
  });

describe("variation count", () => {
  it("defaults to 4 and treats an explicit 4 the same as not set", () => {
    expect(DEFAULT_VARIATIONS).toBe(4);
    expect(variationCount(undefined)).toBe(4);
    expect(variationCount(filters())).toBe(4);
    expect(parseCatalogFilters({ variations: 4 })).toEqual(
      parseCatalogFilters({}),
    );
    expect(parseCatalogFilters({})).not.toHaveProperty("variations");
  });

  it("accepts 1 to 3 and keeps the choice, with or without custom inks", () => {
    for (const count of [1, 2, 3]) {
      expect(parseCatalogFilters({ variations: count }).variations).toBe(count);
      expect(variationCount(parseCatalogFilters({ variations: count }))).toBe(
        count,
      );
    }
    expect(
      parseCatalogFilters({
        colorMix: "custom",
        inkColors: ["red"],
        variations: 2,
      }),
    ).toMatchObject({ variations: 2, inkColors: ["red"] });
  });

  it.each([0, 5, -1, 2.5, "3", null, NaN])("rejects %j", (value) => {
    expect(() => parseCatalogFilters({ variations: value })).toThrow(
      "invalid_catalog_filters",
    );
  });
});

describe("variation prompts", () => {
  it("uses one 2x2 sheet for 2 to 4 designs and a single image for 1", () => {
    for (const count of [undefined, 2, 3, 4]) {
      expect(artworksPerImage(filters(count))).toBe(4);
      const prompt = promptFor(count);
      expect(prompt).toContain(
        "Create 4 distinct tattoo design variations of a fox.",
      );
      expect(prompt).toContain("Exactly 4 separate artworks in equal 2x2");
    }
    expect(artworksPerImage(filters(1))).toBe(1);
    const single = promptFor(1);
    expect(single).toContain("Create 1 tattoo design of a fox.");
    expect(single).toContain("Exactly 1 artwork");
    expect(single).not.toContain("2x2");
    expect(single).not.toContain("Variety:");
  });

  it("tells the model every variation must differ, including no mirrored copies", () => {
    for (const count of [undefined, 2, 3]) {
      const prompt = promptFor(count);
      expect(prompt).toContain(
        "Variety: every variation must be clearly different",
      );
      expect(prompt).toContain(
        "never show the same design flipped, mirrored or facing the other way",
      );
    }
  });
});
