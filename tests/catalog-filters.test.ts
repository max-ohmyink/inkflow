import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import records from "../assets/catalog/inspiration/catalog-items.json";
import traits from "../assets/catalog/inspiration/catalog-traits.json";
import {
  CATALOG_CATEGORY_OPTIONS,
  CATALOG_STYLE_OPTIONS,
  CATALOG_COLOR_OPTIONS,
  DEFAULT_CATALOG_FILTERS,
  catalogFinderFilters,
  catalogDesignSelectionFilters,
  filterCatalogByChoices,
  matchesCatalogFilters,
  parseCatalogFilters,
} from "../shared/catalog-filters";
import { catalogDisplayTitle } from "../shared/catalog-labels";
import { findCatalogMatches } from "../shared/catalog-matching";

describe("guest catalog options", () => {
  it("keeps all 451 original records and exposes 30 collections plus Any", () => {
    expect(records).toHaveLength(451);
    expect(CATALOG_CATEGORY_OPTIONS).toHaveLength(31);
    expect(
      filterCatalogByChoices(records, DEFAULT_CATALOG_FILTERS),
    ).toHaveLength(451);
    expect(Object.keys(traits.entries).sort()).toEqual(
      records.map((x) => x.id).sort(),
    );
  });
  it("removes the finder category option and searches all collections with style/color intact", () => {
    const input = {
      category: records.find((x) => x.id === "fine-line-tulip")!.category,
      artStyle: "fine_line" as const,
      colorMix: "monochrome" as const,
    };
    const normalized = catalogFinderFilters(input);
    expect(normalized).toEqual({ ...input, category: "all" });
    expect(input.category).not.toBe("all");
    const source = readFileSync(
      new URL("../components/studio-form.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain('label="Category"');
    expect(source).toContain('label="Art style"');
    expect(source).toContain("<TattooInkPicker");
    const inkPicker = readFileSync(
      new URL("../components/tattoo-ink-picker.tsx", import.meta.url),
      "utf8",
    );
    expect(inkPicker).toContain("Color mix");
    expect(inkPicker).toContain("Pick up to 3 colors");
    expect(source).toContain("Generate your tattoo live!");
    expect(source).toContain(
      "Catalog first. AI only when no suitable match is found.",
    );
    expect(source).not.toContain(
      "if (disallowed || choices.count === 0 || busy)",
    );
    expect(source).not.toContain("disabled={busy || choices.count === 0}");
    expect(source).toContain("tattoo inks for filled shapes");
  });
  it("applies output colors after design selection rather than filtering existing palettes", () => {
    const before = JSON.stringify(records);
    const style = {
      ...DEFAULT_CATALOG_FILTERS,
      artStyle: "fine_line" as const,
    };
    const expected = filterCatalogByChoices(records, style).map((x) => x.id);
    for (const color of CATALOG_COLOR_OPTIONS) {
      const selected = catalogDesignSelectionFilters({
        ...style,
        colorMix: color.id,
      });
      expect(selected.colorMix).toBe("any");
      expect(
        filterCatalogByChoices(records, selected).map((x) => x.id),
      ).toEqual(expected);
    }
    expect(JSON.stringify(records)).toBe(before);
  });
  it("defaults legacy requests and rejects unknown categories or choices", () => {
    expect(parseCatalogFilters(undefined)).toEqual(DEFAULT_CATALOG_FILTERS);
    expect(parseCatalogFilters({ colorMix: "monochrome" })).toEqual({
      ...DEFAULT_CATALOG_FILTERS,
      colorMix: "monochrome",
    });
    expect(() => parseCatalogFilters({ category: "mandala" })).toThrow();
    expect(() => parseCatalogFilters({ artStyle: "invented" })).toThrow();
    expect(() => parseCatalogFilters({ colorMix: "turn-it-purple" })).toThrow();
  });
  it("applies category, labeled style and measured palette together", () => {
    const item = records.find((x) => x.id === "fine-line-tulip")!;
    const filters = {
      category: item.category,
      artStyle: "fine_line" as const,
      colorMix: "monochrome" as const,
    };
    const pool = filterCatalogByChoices(records, filters);
    expect(pool.some((x) => x.id === item.id)).toBe(true);
    for (const match of pool) {
      expect(match.category).toBe(item.category);
      const trait = traits.entries[match.id as keyof typeof traits.entries];
      expect(trait.artStyles).toContain("fine_line");
      expect(trait.colorMix).toBe("monochrome");
    }
    expect(
      matchesCatalogFilters(item, { ...filters, artStyle: "old_school" }),
    ).toBe(false);
    expect(
      matchesCatalogFilters(item, { ...filters, colorMix: "red_accent" }),
    ).toBe(false);
    expect(findCatalogMatches(pool, "tulip").map((x) => x.id)).toContain(
      item.id,
    );
  });
  it("never changes the original records or matches unrelated prompts", () => {
    const before = JSON.stringify(records);
    for (const style of CATALOG_STYLE_OPTIONS)
      for (const color of CATALOG_COLOR_OPTIONS) {
        const pool = filterCatalogByChoices(records, {
          ...DEFAULT_CATALOG_FILTERS,
          artStyle: style.id,
          colorMix: color.id,
        });
        expect(
          findCatalogMatches(
            pool,
            "nonexistent interstellar avocado spaceship",
          ),
        ).toEqual([]);
      }
    expect(JSON.stringify(records)).toBe(before);
  });
  it("uses English labels without overwriting original source captions", () => {
    const original = records.find((x) => x.id === "vertical")!;
    expect(catalogDisplayTitle(original)).toBe("Hong Kong (Vertical)");
    expect(original.title).toBe("香港 (Vertical)");
    expect(
      findCatalogMatches(records, "gweilo").some(
        (x) => x.id === "catalog-design",
      ),
    ).toBe(true);
    expect(
      records.every(
        (item) => !/[\u3400-\u9fff]/.test(catalogDisplayTitle(item)),
      ),
    ).toBe(true);
  });
  it("removes Chinese marketing copy from guest-facing components", () => {
    for (const filename of [
      "studio-form.tsx",
      "catalog-gallery.tsx",
      "catalog-choice.tsx",
    ]) {
      const source = readFileSync(
        new URL(`../components/${filename}`, import.meta.url),
        "utf8",
      );
      expect(source).not.toMatch(/[\u3400-\u9fff]/);
    }
  });
});
