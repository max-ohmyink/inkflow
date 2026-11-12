# Oh My Ink — catalog-first output and source boundaries

The active library contains 451 imported source artwork records across 30 collections. Design pages 5–54 are represented except Mandala on page 21; mandala-like Line Art Design v.5 on page 32 is excluded. The private PDF is not shipped. Some image objects are grouped motifs, so the record count is not the brand’s full sticker inventory.

The import retains 243 source captions and assigns 208 fallback labels to uncaptained art. `titleIsGenerated` refers only to display labels, not generated artwork. Original collections/pages and image-xref provenance are retained in catalog-import-report.md and inspiration-provenance.md. Three source captions have English display labels without overwriting tattoo lettering or source metadata.

## Selection priority

Theme/art-style retrieval checks validated catalog records first. Every meaningful query theme must match source labels/keywords or supported language aliases; color is output intent. One to four applicable records return as catalog options without AI extras or unrelated padding. Gallery IDs select exact originals. Invalid/mismatched exact IDs and mandala requests do not cause AI replacement.

Only a valid free-text request with no suitable catalog match creates four AI outline alternatives. Source is explicitly AI; no source collection/page/catalog ID or artist attribution is fabricated. Matching is deterministic, not an unimplemented semantic AI review of the private PDF. Empty UI prompts use catalog-first Surprise me. The source decision is stored before processing, so reconnecting does not change provenance or repeat uncertain generation.

## Source versus color/preparation

Imported PNGs are read and stored byte-for-byte. The importer itself applies PDF transparency masks, trims transparent margins, centers artwork on white and optionally downscales to 720px maximum square; it does not redraw source art or render private pages into the interface. Generated AI originals are separate new assets, never replacements for catalog PNGs.

New colored modes request whole-design color proposals from the original image reference. Requested ink colors may fill source-enclosed motif areas and original ink while preserving native contours, lettering, size and white exterior. They do not fill the full canvas or invent closures for open strokes. Black & grey remains a deterministic monochrome version; Original colors preserves source colors. The color placement is an interpretation, not a factory/catalog colorway.

An uncolored source, normal-orientation color version and original-derived mirrored artist PNG/SVG remain separate assets. Artist printing mirrors exactly once; disable printer-side mirroring. Older versioned palette-filtered and line-accent jobs stay readable and unchanged, with treatment-aware labels. Failed generation/edits are explicit and never automatically retried or mislabeled successful.

Use extract-all-catalog.py only with authorized source-PDF access; do not rebuild the full library with the retired curated extractor. Reload the API after imports and include the catalog asset directory in the production container. No source PNG is modified by guest generation/color choices. Catalog art may be intricate, so artists review/simplify for live drawing; no fixed drawing time is promised. Guest selection does not print automatically, notify a queue or apply a skin/photo/hardware try-on.
