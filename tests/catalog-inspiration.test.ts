import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  filterCatalog,
  INSPIRATION_CATEGORIES,
  type CatalogRecord,
} from "../lib/inspiration-utils";
const root = new URL("../assets/catalog/inspiration/", import.meta.url);
const items = JSON.parse(
  readFileSync(new URL("catalog-items.json", root), "utf8"),
) as CatalogRecord[];
describe("original catalog collections excluding mandala", () => {
  it("covers every eligible design page and all imported collections, not the former 12-item edit", () => {
    expect(items.length).toBeGreaterThan(100);
    expect(new Set(items.map((item) => item.category)).size).toBeGreaterThan(
      15,
    );
    expect(INSPIRATION_CATEGORIES).toHaveLength(4);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    const pages = new Set(items.map((item) => item.page));
    for (let page = 5; page <= 54; page++)
      if (page !== 21)
        expect(pages.has(page), `artwork page ${page}`).toBe(true);
    expect(pages.has(21)).toBe(false);
    for (const category of INSPIRATION_CATEGORIES)
      expect(filterCatalog(items, category.id, "").length).toBeGreaterThan(0);
    expect(
      items.some((item) =>
        /mandala|曼陀羅|曼陀罗|曼荼羅|曼荼罗/i.test(
          `${item.title} ${item.collection}`,
        ),
      ),
    ).toBe(false);
    expect(
      items.some(
        (item) =>
          item.page === 32 && /line art design v\.?\s*5$/i.test(item.title),
      ),
    ).toBe(false);
  });
  it("searches real titles and collections without mutating catalog records", () => {
    expect(filterCatalog(items, "all", " TULIP ").length).toBeGreaterThan(0);
    expect(filterCatalog(items, "all", "arrow").length).toBeGreaterThan(0);
    expect(filterCatalog(items, "all", "mandala")).toHaveLength(0);
    expect(filterCatalog(items, "all", "poodle").length).toBeGreaterThan(0);
  });
  it("retains valid original identities, captions/fallback labels, source pages, and safe local PNGs", () => {
    for (const item of items) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.collection.trim().length).toBeGreaterThan(0);
      expect(item.page).toBeGreaterThanOrEqual(5);
      expect(item.page).toBeLessThanOrEqual(54);
      expect(["fine_line", "traditional", "geometric", "cyber"]).toContain(
        item.style,
      );
      expect(item.filename).toMatch(/^[a-z0-9-]+\.png$/);
      expect(existsSync(new URL(item.filename, root))).toBe(true);
      if (item.titleIsGenerated !== undefined)
        expect(typeof item.titleIsGenerated).toBe("boolean");
    }
  });
  it("keeps complete source artwork on square canvases, with no generated redraw", async () => {
    for (const item of items) {
      const metadata = await sharp(
        readFileSync(new URL(item.filename, root)),
      ).metadata();
      expect(metadata.width).toBe(metadata.height);
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.width).toBeLessThanOrEqual(720);
    }
  });
});
