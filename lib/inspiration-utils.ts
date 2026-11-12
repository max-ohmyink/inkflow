import records from "../assets/catalog/inspiration/catalog-items.json";
import { FAMILY_DESIGN_IDS } from "../shared/family-designs";
import type { StyleId } from "./studio-theme";
import { catalogDisplayTitle } from "../shared/catalog-labels";

export type InspirationCategory = string;
export type CatalogRecord = {
  id: string;
  title: string;
  category: InspirationCategory;
  collection: string;
  page: number;
  filename: string;
  concept: string;
  style: StyleId;
  keywords: string[];
  sourceXref?: number;
  titleIsGenerated?: boolean;
};
const recordsById = new Map(
  (records as CatalogRecord[]).map((item) => [item.id, item]),
);

/** Collection options shown for new family-event gallery browsing. */
export const INSPIRATION_CATEGORIES = Array.from(
  new Map(
    FAMILY_DESIGN_IDS.flatMap((id) => {
      const item = recordsById.get(id);
      return item
        ? [
            [
              item.category,
              { id: item.category, label: item.collection },
            ] as const,
          ]
        : [];
    }),
  ).values(),
);
export type InspirationPreset = Pick<
  CatalogRecord,
  "id" | "title" | "concept" | "style"
> & { version: number };
export function filterCatalog<T extends CatalogRecord>(
  items: readonly T[],
  category: string,
  query: string,
): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    const text = [
      item.title,
      catalogDisplayTitle(item),
      item.collection,
      item.category,
      ...item.keywords,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .replace(/_/g, " ");
    return terms.every((term) => text.includes(term));
  });
}
