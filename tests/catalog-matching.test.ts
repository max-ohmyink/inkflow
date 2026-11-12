import { describe, expect, it } from "vitest";
import {
  findCatalogMatches,
  type PortableCatalogItem,
} from "../shared/catalog-matching";
const item = (
  id: string,
  title: string,
  collection = "Flowers",
  keywords = title.toLowerCase().split(/\s+/),
): PortableCatalogItem => ({
  id,
  title,
  collection,
  category: collection.toLowerCase(),
  page: 20,
  filename: `${id}.png`,
  keywords,
});
const items = [
  item("rose-1", "Rose 1"),
  item("rose-2", "Rose 2"),
  item("fine-line-tulip", "Fine Line Tulip"),
  item("heart-with-arrow", "Heart with Arrow", "Hearts"),
  item("poodle", "Poodle", "Fluffy Friends: Poodle"),
  item("cat", "Cat", "Fluffy Friends: Short Hair Cat"),
  item("taxi", "Taxi", "Home Kong", ["hong", "kong", "taxi"]),
  item("moon-with-leaf", "Moon with Leaf", "Above the Sky"),
  item("mandala", "Mandala v.1", "Mandala"),
];
describe("original catalog retrieval", () => {
  it("returns actual matching records, not invented or unrelated padding", () => {
    const result = findCatalogMatches(items, "rose");
    expect(result.map((row) => row.id)).toEqual(["rose-1", "rose-2"]);
    expect(result.every((row) => items.includes(row))).toBe(true);
  });
  it("keeps ordinary guest words out of theme matching", () => {
    expect(
      findCatalogMatches(items, "a small heart").map((row) => row.id),
    ).toEqual(["heart-with-arrow"]);
    expect(
      findCatalogMatches(items, "a pretty cat").map((row) => row.id),
    ).toEqual(["cat"]);
  });
  it("recognizes local Chinese themes and English collection names", () => {
    expect(findCatalogMatches(items, "玫瑰")).toHaveLength(2);
    expect(findCatalogMatches(items, "我想揀心心")[0].id).toBe(
      "heart-with-arrow",
    );
    expect(findCatalogMatches(items, "香港")[0].id).toBe("taxi");
    expect(findCatalogMatches(items, "Hong Kong")[0].id).toBe("taxi");
    expect(findCatalogMatches(items, "狗狗")[0].id).toBe("poodle");
  });
  it("does not invent artwork for themes absent from the catalog", () => {
    expect(findCatalogMatches(items, "spaceship")).toEqual([]);
    expect(findCatalogMatches(items, "cat with a moon")).toEqual([]);
  });
  it("never offers mandalas, even for all/surprise browsing", () => {
    expect(findCatalogMatches(items, "mandala")).toEqual([]);
    expect(findCatalogMatches(items, "曼陀羅")).toEqual([]);
    expect(findCatalogMatches(items, "Surprise me")).toHaveLength(4);
    expect(
      findCatalogMatches(items, "all").some((row) => row.id === "mandala"),
    ).toBe(false);
    expect(items).toHaveLength(9);
  });
});
