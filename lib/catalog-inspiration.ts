import type { ImageSourcePropType } from "react-native";
import records from "../assets/catalog/inspiration/catalog-items.json";
import { CATALOG_ARTWORK } from "../assets/catalog/inspiration/artwork";
import { FAMILY_DESIGN_IDS } from "../shared/family-designs";
import type { CatalogRecord } from "./inspiration-utils";

export type CatalogDesign = CatalogRecord & { art: ImageSourcePropType };
export const ALL_CATALOG_DESIGNS: CatalogDesign[] = (
  records as CatalogRecord[]
).map((item) => ({ ...item, art: CATALOG_ARTWORK[item.id] }));

const ALL_CATALOG_DESIGNS_BY_ID = new Map(
  ALL_CATALOG_DESIGNS.map((design) => [design.id, design]),
);

/** The family-event gallery exposes only this fixed, intentionally ordered source pool. */
export const CATALOG_DESIGNS: CatalogDesign[] = FAMILY_DESIGN_IDS.flatMap(
  (id) => {
    const design = ALL_CATALOG_DESIGNS_BY_ID.get(id);
    return design ? [design] : [];
  },
);
