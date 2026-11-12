const ENGLISH_LABELS: Record<string, string> = {
  vertical: "Hong Kong (Vertical)",
  "catalog-design": "Gweilo Lettering",
  "catalog-design-p7-x1853": "What Are You Looking At?",
};
/** UI labels only: original captions, catalog IDs and PNG pixels remain intact. */
export function catalogDisplayTitle(item: {
  id?: string;
  catalogId?: string;
  title?: string;
}): string {
  return (
    ENGLISH_LABELS[item.catalogId || item.id || ""] ||
    item.title ||
    "Saved artwork"
  );
}
