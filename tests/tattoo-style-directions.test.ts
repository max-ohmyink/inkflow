import { describe, expect, it } from "vitest";
import records from "../assets/catalog/inspiration/catalog-items.json";
import traits from "../assets/catalog/inspiration/catalog-traits.json";
import {
  CATALOG_STYLE_OPTIONS,
  catalogFilterSummary,
  filterCatalogByChoices,
  matchesCatalogFilters,
  parseCatalogFilters,
} from "../shared/catalog-filters";
import {
  ALLOWED_FAMILY_ART_STYLE_IDS,
  isAllowedFamilyArtStyle,
  isUnsafeFamilyTheme,
} from "../shared/family-designs";
import { compileAiFallbackGenerationPrompt } from "../server/stencils/aiFallback";
import { tattooInkScreenPalette } from "../shared/tattoo-inks";

const filtersFor = (
  artStyle: "fine_line" | "old_school" | "traditional" | "watercolor",
) => ({
  category: "all",
  artStyle,
  colorMix: "any" as const,
});

function fallbackFor(
  artStyle: "fine_line" | "old_school" | "traditional" | "watercolor",
): string {
  return compileAiFallbackGenerationPrompt({
    concept: "happy cloud",
    style: "fine_line",
    filters: filtersFor(artStyle),
  });
}

describe("tattoo style directions", () => {
  it("validates the four new visible directions while retaining legacy filter parsing and summaries", () => {
    for (const artStyle of [
      "fine_line",
      "old_school",
      "traditional",
      "watercolor",
    ] as const) {
      expect(parseCatalogFilters({ artStyle }).artStyle).toBe(artStyle);
    }

    expect(CATALOG_STYLE_OPTIONS).toEqual([
      { id: "fine_line", label: "Fine Line" },
      { id: "old_school", label: "Old School" },
      { id: "traditional", label: "Traditional" },
      { id: "watercolor", label: "Watercolor" },
    ]);

    expect(
      catalogFilterSummary(parseCatalogFilters({ artStyle: "any" })),
    ).toContain("Catalog match");
    expect(
      catalogFilterSummary(parseCatalogFilters({ artStyle: "illustrated" })),
    ).toContain("Playful line art");
    expect(
      catalogFilterSummary(parseCatalogFilters({ artStyle: "lettering" })),
    ).toContain("Lettering");
    expect(
      catalogFilterSummary(
        parseCatalogFilters({ artStyle: "cyber_ornamental" }),
      ),
    ).toContain("Cyber & ornamental");
    expect(() => parseCatalogFilters({ artStyle: "new-school" })).toThrow(
      "invalid_catalog_filters",
    );
  });

  it("maps Traditional only to actual old_school catalog labels and Watercolor only to genuine watercolor labels", () => {
    const classicFlash = records.find((record) => record.id === "dragon-v-1")!;
    expect(
      traits.entries[classicFlash.id as keyof typeof traits.entries].artStyles,
    ).toContain("old_school");
    expect(matchesCatalogFilters(classicFlash, filtersFor("old_school"))).toBe(
      true,
    );
    expect(matchesCatalogFilters(classicFlash, filtersFor("traditional"))).toBe(
      true,
    );

    const watercolorMatches = filterCatalogByChoices(
      records,
      filtersFor("watercolor"),
    );
    expect(
      watercolorMatches.every((record) => {
        const trait = traits.entries[
          record.id as keyof typeof traits.entries
        ] as { artStyles: readonly string[] };
        return trait.artStyles.includes("watercolor");
      }),
    ).toBe(true);
    expect(matchesCatalogFilters(classicFlash, filtersFor("watercolor"))).toBe(
      false,
    );
  });

  it("uses non-contradictory, family-safe fallback briefs for all four directions", () => {
    const fineLine = fallbackFor("fine_line");
    const oldSchool = fallbackFor("old_school");
    const traditional = fallbackFor("traditional");
    const watercolor = compileAiFallbackGenerationPrompt({
      concept: "happy cloud",
      style: "fine_line",
      filters: {
        category: "all",
        artStyle: "watercolor",
        colorMix: "custom",
        inkColors: ["lake_blue", "rose_pink"],
      },
    });

    expect(fineLine).toContain("simple monoline outline");
    expect(oldSchool).toContain("classic American old-school tattoo flash");
    expect(oldSchool).toContain("bright, flat, limited color fills");
    expect(oldSchool).not.toContain("--no solid filled areas");
    expect(traditional).toContain("bold traditional tattoo motifs");
    expect(traditional).toContain("strong contours");
    expect(traditional).toContain("minimal, clean interior detail");
    expect(watercolor).toContain("soft digital colored washes");
    expect(watercolor).toContain(
      "washed gradients and soft shading are allowed",
    );
    for (const ink of tattooInkScreenPalette(["lake_blue", "rose_pink"])) {
      expect(watercolor).toContain(`${ink.name} (RGB ${ink.rgb.join(", ")})`);
    }
    expect(watercolor).not.toMatch(
      /--no shading|--no .*gradients|zero shading|100% monochrome/i,
    );

    for (const prompt of [fineLine, oldSchool, traditional, watercolor]) {
      expect(prompt).toContain("Exactly 4 separate artworks in equal 2x2");
      expect(prompt).toContain("--no mandalas");
      expect(prompt).toContain("--no dense detail");
      expect(prompt).toContain("--no ornate detail");
      expect(prompt).toContain("--no skin or body parts");
      expect(prompt).toContain("--no 3D photorealism");
    }
  });

  it("allows the new directions for new family work without relaxing the mandala safety guard", () => {
    expect(ALLOWED_FAMILY_ART_STYLE_IDS).toEqual([
      "any",
      "fine_line",
      "old_school",
      "traditional",
      "watercolor",
      "illustrated",
    ]);
    for (const artStyle of ["old_school", "traditional", "watercolor"]) {
      expect(isAllowedFamilyArtStyle(artStyle)).toBe(true);
    }
    expect(isAllowedFamilyArtStyle("cyber_ornamental")).toBe(false);
    expect(isUnsafeFamilyTheme("watercolor flower mandala")).toBe(true);
  });
});
