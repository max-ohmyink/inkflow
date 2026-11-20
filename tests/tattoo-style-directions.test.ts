import { describe, expect, it } from "vitest";
import {
  CATALOG_STYLE_OPTIONS,
  catalogFilterSummary,
  parseCatalogFilters,
  type CatalogArtStyle,
} from "../shared/catalog-filters";
import {
  ALLOWED_FAMILY_ART_STYLE_IDS,
  isAllowedFamilyArtStyle,
  isUnsafeFamilyTheme,
} from "../shared/family-designs";
import { isDisallowedInstantDrawConcept } from "../shared/instant-draw";
import { compileAiFallbackGenerationPrompt } from "../server/stencils/aiFallback";
import { tattooInkScreenPalette } from "../shared/tattoo-inks";

const STYLED = [
  "traditional",
  "neo_traditional",
  "blackwork",
  "engraving",
  "tribal",
  "watercolor",
  "japanese",
] as const;
const DEFAULT_LOOK = [
  "fine_line",
  "old_school",
  "illustrated",
  "lettering",
  "cyber_ornamental",
] as const;
const FORBIDDEN =
  /simple|minimal|child|family|6–12|--no dense detail|--no ornate detail|silly/i;

function promptFor(
  filters?: Parameters<typeof compileAiFallbackGenerationPrompt>[0]["filters"],
): string {
  return compileAiFallbackGenerationPrompt({
    concept: "a skull with roses",
    style: "fine_line",
    filters,
  });
}
const styled = (artStyle: CatalogArtStyle) =>
  promptFor({ category: "all", artStyle, colorMix: "any" });

describe("tattoo style directions", () => {
  it("offers the restored styles while legacy styles still parse", () => {
    expect(CATALOG_STYLE_OPTIONS).toEqual([
      { id: "fine_line", label: "Fine Line" },
      { id: "old_school", label: "Old School" },
      { id: "traditional", label: "Traditional" },
      { id: "watercolor", label: "Watercolor" },
      { id: "blackwork", label: "Blackwork" },
      { id: "engraving", label: "Engraving" },
      { id: "japanese", label: "Japanese" },
      { id: "neo_traditional", label: "Neo-Traditional" },
      { id: "tribal", label: "Tribal" },
    ]);
    for (const artStyle of [...STYLED, ...DEFAULT_LOOK, "any"]) {
      expect(parseCatalogFilters({ artStyle }).artStyle).toBe(artStyle);
    }
    expect(
      catalogFilterSummary(parseCatalogFilters({ artStyle: "illustrated" })),
    ).toContain("Playful line art");
    // Removed styles are gone completely and no longer parse.
    for (const removed of ["new-school", "cartoon", "minimalism", "dotwork"]) {
      expect(() => parseCatalogFilters({ artStyle: removed })).toThrow(
        "invalid_catalog_filters",
      );
    }
  });

  it("uses the refined fine-line prompt by default, for `any` and for legacy styles", () => {
    const base = promptFor();
    expect(base).toContain(
      "Create 4 distinct tattoo design variations of a skull with roses.",
    );
    expect(base).toContain("extremely fine hairline tattoo");
    expect(base).toContain("about 0.05 mm wide");
    expect(base).toContain("perfectly uniform in thickness");
    expect(base).toContain("never swelling, tapering");
    expect(base).toContain("thinnest line possible");
    // The thin, even line is also forbidden from being any other weight.
    expect(base).toContain("--no thick, bold or medium lines");
    expect(base).toContain("--no varying line weight");
    expect(base).toContain("--no sexual or explicit content");
    // Other styles must not inherit the fine-line restrictions.
    expect(styled("traditional")).not.toContain(
      "--no thick, bold or medium lines",
    );
    expect(styled("blackwork")).not.toContain("--no varying line weight");
    expect(base).toContain("gallery-quality line art");
    expect(base).toContain(
      "premium tattoo flash design by a master tattoo artist",
    );
    expect(styled("any")).toBe(base);
    for (const artStyle of DEFAULT_LOOK) expect(styled(artStyle)).toBe(base);
  });

  it("gives every restored style its own sophisticated direction", () => {
    const key: Record<(typeof STYLED)[number], string> = {
      traditional: "classic American traditional tattoo flash at master level",
      neo_traditional: "ornate neo-traditional tattoo",
      blackwork: "blackwork tattoo rendered entirely in 100% black ink",
      engraving: "classic engraving and etching tattoo",
      tribal: "bold tribal tattoo",
      watercolor: "artistic watercolor tattoo",
      japanese: "traditional Japanese irezumi tattoo",
    };
    const prompts = new Set([promptFor()]);
    for (const artStyle of STYLED) {
      const prompt = styled(artStyle);
      expect(prompt).toContain(key[artStyle]);
      prompts.add(prompt);
    }
    expect(prompts.size).toBe(STYLED.length + 1);
    // Blackwork is pure 100% black with no tribal or pattern work; tribal is its own style.
    const blackStyleText = styled("blackwork").split("\n\n")[0];
    expect(blackStyleText).toContain("100% solid black ink only");
    expect(blackStyleText).toContain("No tribal motifs");
    expect(blackStyleText).toContain(
      "from fine, precise linework to bold strokes",
    );
    expect(blackStyleText).not.toMatch(/spiral|interlocking|tapered/i);
    // Engraving is built from short, thin strokes and uses black ink only.
    const engraving = styled("engraving");
    expect(engraving).toContain("short, thin, finely cut strokes");
    expect(engraving).toContain("100% black ink only");
    expect(engraving).toContain("--no solid black fills");
    expect(styled("tribal")).toContain(
      "sweeping, interlocking solid black forms",
    );
    expect(styled("traditional")).toContain("black, red, yellow and green");
    expect(styled("japanese")).toContain("bokashi shading");
    expect(styled("japanese")).toContain(
      "waves, clouds and flowers wrapped around it",
    );
  });

  it("has no simplicity, child or family wording, and keeps only the explicit-content rule", () => {
    for (const artStyle of [...STYLED, "fine_line"] as const) {
      const prompt = styled(artStyle);
      expect(prompt).not.toMatch(FORBIDDEN);
      expect(prompt).toContain("--no sexual or explicit content");
      expect(prompt).toContain("--no nudity");
      expect(prompt).toContain("Exactly 4 separate artworks in equal 2x2");
      expect(prompt).not.toContain("--no skulls");
      expect(prompt).not.toContain("--no weapons");
      expect(prompt).not.toContain("--no mandalas");
    }
  });

  it("lets an ink palette replace the default colors, except for black-only Blackwork", () => {
    const inks = ["sky_blue", "orange"] as const;
    for (const artStyle of [...STYLED, "fine_line"] as const) {
      const withInks = promptFor({
        category: "all",
        artStyle,
        colorMix: "custom",
        inkColors: [...inks],
      });
      if (artStyle === "blackwork" || artStyle === "engraving") {
        expect(withInks).toBe(styled(artStyle));
        expect(withInks).toContain("black ink only");
        continue;
      }
      for (const ink of tattooInkScreenPalette([...inks])) {
        expect(withInks).toContain(`${ink.name} (RGB ${ink.rgb.join(", ")})`);
      }
      expect(withInks).not.toContain("on a pure white background.\n");
    }
  });

  it("allows the restored styles for new work and only refuses explicit themes", () => {
    expect(ALLOWED_FAMILY_ART_STYLE_IDS).toEqual([
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
    ]);
    expect(isAllowedFamilyArtStyle("lettering")).toBe(false);
    expect(isAllowedFamilyArtStyle("cyber_ornamental")).toBe(false);
    for (const concept of [
      "skull with a dagger",
      "hannya demon mask",
      "lotus mandala",
      "bleeding heart",
    ]) {
      expect(isUnsafeFamilyTheme(concept)).toBe(false);
      expect(isDisallowedInstantDrawConcept(concept)).toBe(false);
    }
    for (const concept of ["nude woman", "explicit pin-up", "porn star"]) {
      expect(isUnsafeFamilyTheme(concept)).toBe(true);
      expect(isDisallowedInstantDrawConcept(concept)).toBe(true);
    }
  });
});
