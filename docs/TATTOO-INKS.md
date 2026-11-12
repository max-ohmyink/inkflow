# Tattoo ink palettes

The application keeps two separate representations of the same 20 named ink IDs. `TATTOO_INKS` and `assets/event-brand/tattoo-ink-palette.json` retain the original approximate HEX values sampled from the supplied physical-swatch photograph. The photograph is not modified or served publicly. These observations are not calibrated physical-color promises.

`TATTOO_INK_SCREEN_HEX`, `tattooInkDisplayHex(id)` and `tattooInkScreenPalette(ids)` provide a separate brighter digital mapping. New custom filled images and visible ink swatches use this mapping; colors remain within the selected named ink palette and black/grey catalog contours stay clear. `tattooInkPalette(ids)` still returns the unchanged reference values. Old ready images are not automatically recolored, and legacy `fillEnclosedRegions: false` uses the reference projection. Physical inks may look different from bright screen previews.

## Selection and source preservation

A custom selection accepts one to three unique valid `TattooInkId` values. No selection means Original colors. IDs, order, English names, retry capability credentials and catalogue identity are retained. The selected palette is an output instruction, not a source-art restriction; the finder continues to search all eligible family catalog designs without a Category form option.

New catalog V3 and AI V1 envelopes keep custom IDs in validated filters and compatible top-level metadata. Parsers reject invalid IDs, duplicates, over-three selections and conflicting metadata. Archived style parsing and source-original/colored/artist asset roles remain separate.

## Rendering

New custom ink coloring runs locally on the source image; it does not need the restricted ImageService. The fill analyzer may recover bounded small gaps in an internal mask, but source PNG bytes and visible source strokes remain unchanged. Wide ambiguous openings should not be filled by a broad hull or rectangle. Meaningful enclosed/recovered areas receive selected flat colors. When no defensible area is found, existing source-coverage tint reports `ink_only`; black-only work remains local monochrome.

The image service may still be needed to create a genuinely new AI fallback original. Its availability has not been restored by this display/segmentation update. Existing stored outcomes and older line-only versions retain truthful labels.

## Tests and output evidence

Reference JSON synchronization and custom metadata compatibility are tested separately from the new screen mapping. New screen tests verify the 20 IDs, exact digital HEX/RGB values, reference preservation and one-to-three validation. Renderer tests retain native dimensions, original black/grey contours, exterior white pixels and zero provider calls. Tiger, Butterfly and family-rose checks provide actual output evidence rather than an assumption that every open contour can be safely closed.
