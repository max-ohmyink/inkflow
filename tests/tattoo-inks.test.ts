import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  CATALOG_STYLE_OPTIONS,
  catalogDesignSelectionFilters,
  parseCatalogFilters,
} from "../shared/catalog-filters";
import {
  TATTOO_INKS,
  tattooInkPalette,
  validateTattooInkIds,
} from "../shared/tattoo-inks";
import {
  colorTreatmentForCatalogPrompt,
  createCatalogJobPrompt,
  getValidatedCatalogRecord,
  parseCatalogJobPrompt,
} from "../server/stencils/catalogOutput";
import { persistActualColorTreatments } from "../server/stencils/colorOutcomes";
import {
  createAiJobPrompt,
  parseAiJobPrompt,
} from "../server/stencils/jobMetadata";
import {
  colorVersionEditPrompt,
  createColorVersion,
  type ColorVersionImageService,
} from "../server/stencils/colorVersion";

type Rgb = readonly [number, number, number];

function setPixel(
  pixels: Buffer,
  width: number,
  x: number,
  y: number,
  rgb: Rgb,
): void {
  const offset = (y * width + x) * 3;
  pixels[offset] = rgb[0];
  pixels[offset + 1] = rgb[1];
  pixels[offset + 2] = rgb[2];
}

function rectangleOutline(
  pixels: Buffer,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  for (let x = left; x <= right; x += 1) {
    setPixel(pixels, width, x, top, [0, 0, 0]);
    setPixel(pixels, width, x, bottom, [0, 0, 0]);
  }
  for (let y = top; y <= bottom; y += 1) {
    setPixel(pixels, width, left, y, [0, 0, 0]);
    setPixel(pixels, width, right, y, [0, 0, 0]);
  }
}

function solidRectangle(
  pixels: Buffer,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  rgb: Rgb,
): void {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      setPixel(pixels, width, x, y, rgb);
    }
  }
}

async function pngFromPixels(
  pixels: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

async function rawRgb(
  png: Buffer,
): Promise<{ pixels: Buffer; width: number; height: number }> {
  const raw = await sharp(png).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return { pixels: raw.data, width: raw.info.width, height: raw.info.height };
}

function pixelAt(pixels: Buffer, width: number, x: number, y: number): Rgb {
  const offset = (y * width + x) * 3;
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
}

describe("tattoo ink palette contract", () => {
  it("keeps the 20 extracted English ink records synchronized with the derived JSON data", () => {
    const extracted = JSON.parse(
      readFileSync(
        new URL(
          "../assets/event-brand/tattoo-ink-palette.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { inks: { id: string; name: string; hex: string }[] };
    expect(
      extracted.inks.map(({ id, name, hex }) => ({ id, name, hex })),
    ).toEqual(TATTOO_INKS);
    expect(extracted.inks).toHaveLength(20);
    expect(extracted.inks.map((ink) => ink.id)).toEqual([
      "cool_purple",
      "purple",
      "warm_purple",
      "rose_pink",
      "red",
      "cherry_red",
      "deep_red",
      "rust_red",
      "brown",
      "black",
      "lemon_yellow",
      "apricot_yellow",
      "orange",
      "light_green",
      "green",
      "dark_green",
      "lake_blue",
      "sky_blue",
      "navy_blue",
      "tattoo_blue",
    ]);
  });

  it("accepts only one to three unique IDs and exposes their exact RGB screen approximations", () => {
    expect(validateTattooInkIds(["cool_purple", "lemon_yellow"])).toEqual([
      "cool_purple",
      "lemon_yellow",
    ]);
    expect(tattooInkPalette(["cool_purple", "lemon_yellow"])).toEqual([
      {
        id: "cool_purple",
        name: "Cool Purple",
        hex: "#483468",
        rgb: [72, 52, 104],
      },
      {
        id: "lemon_yellow",
        name: "Lemon Yellow",
        hex: "#A99740",
        rgb: [169, 151, 64],
      },
    ]);
    expect(() => validateTattooInkIds([])).toThrow(
      "invalid_tattoo_ink_selection",
    );
    expect(() => validateTattooInkIds(["red", "red"])).toThrow(
      "invalid_tattoo_ink_selection",
    );
    expect(() =>
      validateTattooInkIds(["red", "green", "blue", "black"]),
    ).toThrow("invalid_tattoo_ink_selection");
    expect(() => validateTattooInkIds(["invented"])).toThrow(
      "invalid_tattoo_ink_selection",
    );
  });

  it("requires custom mode exactly when selected IDs are present and keeps archived styles parseable but hidden", () => {
    const custom = parseCatalogFilters({
      category: "all",
      artStyle: "illustrated",
      colorMix: "custom",
      inkColors: ["black"],
    });
    expect(custom).toEqual({
      category: "all",
      artStyle: "illustrated",
      colorMix: "custom",
      inkColors: ["black"],
    });
    expect(catalogDesignSelectionFilters(custom)).toEqual({
      category: "all",
      artStyle: "illustrated",
      colorMix: "any",
    });
    expect(parseCatalogFilters({ artStyle: "old_school" }).artStyle).toBe(
      "old_school",
    );
    expect(CATALOG_STYLE_OPTIONS).toEqual([
      { id: "fine_line", label: "Fine Line" },
      { id: "old_school", label: "Old School" },
      { id: "traditional", label: "Traditional" },
      { id: "watercolor", label: "Watercolor" },
    ]);
    expect(() => parseCatalogFilters({ colorMix: "custom" })).toThrow(
      "invalid_catalog_filters",
    );
    expect(() =>
      parseCatalogFilters({ colorMix: "red_accent", inkColors: ["red"] }),
    ).toThrow("invalid_catalog_filters");
  });
});

describe("custom ink metadata persistence", () => {
  const filters = {
    category: "all",
    artStyle: "fine_line" as const,
    colorMix: "custom" as const,
    inkColors: ["black"] as const,
  };

  it("serializes and reparses catalog and AI custom selections, including black-only custom intent", () => {
    const record = getValidatedCatalogRecord("fine-line-tulip")!;
    const catalogPrompt = createCatalogJobPrompt([record], {
      ...filters,
      inkColors: [...filters.inkColors],
    });
    expect(JSON.parse(catalogPrompt)).toMatchObject({
      version: 3,
      colorMode: "custom",
      filters,
      inkColors: ["black"],
      fillEnclosedRegions: true,
    });
    expect(parseCatalogJobPrompt(catalogPrompt)).toMatchObject({
      colorMode: "custom",
      filters,
      inkColors: ["black"],
    });
    expect(
      colorTreatmentForCatalogPrompt(
        persistActualColorTreatments(catalogPrompt, ["monochrome"]),
      ),
    ).toBe("monochrome");

    const aiPrompt = createAiJobPrompt({
      version: 1,
      mode: "ai",
      concept: "little comet",
      style: "fine_line",
      medium: "blackwork",
      filters: { ...filters, inkColors: [...filters.inkColors] },
      colorMode: "custom",
      // The constructor derives and persists the optional envelope-level copy.
      fillEnclosedRegions: true,
    });
    expect(JSON.parse(aiPrompt)).toMatchObject({
      colorMode: "custom",
      filters,
      inkColors: ["black"],
    });
    expect(parseAiJobPrompt(aiPrompt)).toMatchObject({
      colorMode: "custom",
      filters,
      inkColors: ["black"],
    });

    const tampered = JSON.stringify({
      ...JSON.parse(catalogPrompt),
      inkColors: ["red"],
    });
    expect(parseCatalogJobPrompt(tampered)).toBeUndefined();
  });
});

describe("custom ink color composition", () => {
  it("uses only the selected RGB approximation, retains source geometry, black contours, white exterior, and original bytes", async () => {
    const width = 12;
    const height = 12;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    rectangleOutline(sourcePixels, width, 3, 3, 8, 8);
    const source = await pngFromPixels(sourcePixels, width, height);
    const immutableSource = Buffer.from(source);

    // Selected ink filling must work even when the image provider is unavailable.
    const generateImage = vi
      .fn()
      .mockRejectedValue(new Error("image service unavailable"));
    const service: ColorVersionImageService = { generateImage };

    const result = await createColorVersion(source, "custom", service, {
      inkColors: ["cool_purple"],
    });
    const output = await rawRgb(result.png);

    expect(source.equals(immutableSource)).toBe(true);
    expect(result).toMatchObject({ width, height, treatment: "filled" });
    expect(output).toMatchObject({ width, height });
    expect(pixelAt(output.pixels, width, 5, 5)).toEqual([138, 79, 255]);
    expect(pixelAt(output.pixels, width, 3, 5)).toEqual([0, 0, 0]);
    expect(pixelAt(output.pixels, width, 0, 0)).toEqual([255, 255, 255]);
    expect(generateImage).not.toHaveBeenCalled();
    const prompt = colorVersionEditPrompt("custom", {
      inkColors: ["cool_purple"],
    });
    expect(prompt).toContain("only these exact approximate custom inks");
    expect(prompt).toContain("Cool Purple (#483468)");
    expect(
      colorVersionEditPrompt("custom", { inkColors: ["cool_purple"] }),
    ).toContain("pure white exterior background");
  });

  it("treats a black-only custom selection as deterministic monochrome with no provider request", async () => {
    const width = 7;
    const height = 5;
    const sourcePixels = Buffer.alloc(width * height * 3, 255);
    setPixel(sourcePixels, width, 2, 2, [120, 40, 180]);
    const source = await pngFromPixels(sourcePixels, width, height);
    const immutableSource = Buffer.from(source);
    const generateImage = vi.fn().mockRejectedValue(new Error("must not run"));

    const result = await createColorVersion(
      source,
      "custom",
      { generateImage },
      { inkColors: ["black"] },
    );
    const output = await rawRgb(result.png);

    expect(source.equals(immutableSource)).toBe(true);
    expect(result).toMatchObject({ width, height, treatment: "monochrome" });
    expect(generateImage).not.toHaveBeenCalled();
    expect(output).toMatchObject({ width, height });
    for (let offset = 0; offset < output.pixels.length; offset += 3) {
      expect(output.pixels[offset]).toBe(output.pixels[offset + 1]);
      expect(output.pixels[offset + 1]).toBe(output.pixels[offset + 2]);
    }
  });
});
