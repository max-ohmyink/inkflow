# Gap-aware fills and brighter screen inks

New local custom fills use `findGapAwareFillRegions` on flattened RGB artwork at the bounded analysis resolution. Strict source-enclosed labels and areas remain unchanged. A radius-1 binary close affects only an internal topology mask; original visible black/grey strokes and source PNG bytes are not redrawn.

A padded white exterior flood rejects background-connected candidates. Recovered regions need at least 4 pixels, a 3×3 span, aspect ratio ≤12:1 and area ≤`max(256, 12% of analysis canvas)`. There is no broad hull or rectangular fill. The operation handles only very small raster gaps, up to approximately two analysis pixels. Larger, intentional or ambiguous openings remain a limitation; downscaling quantizes the corresponding native span.

## Actual examples

Tiger (437×437) gained 26 regions. Its colored area increased from 6,509 to 18,515 pixels (2.845×), including the formerly open torso. All 16,615 black/grey core pixels remained unchanged. It uses only bright Orange `#FF8A2B` and Lemon Yellow `#FFE44D`, with zero detected exterior leakage and no provider calls.

Butterfly w/ Heart (244×244) retained its 58 labels and 3,257 colored pixels, using brighter Lake Blue, Rose Pink and Lemon Yellow. Its 8,006 contour-core pixels and white background remain intact. This is a newly rendered output, not a reread or modification of the uploaded butterfly example.

A new Fine Line Rose 1 API request returned 3,090 colored pixels at native 326×326, with all three selected bright RGB values. The original download was byte-identical and the protected artist PNG was available. Access credentials remain in ignored cache files and are never published in this report.

## Digital and physical reference palettes

`TATTOO_INKS` and sampled JSON retain the photo-derived values. New custom images and visible swatches use a separate brighter `TATTOO_INK_SCREEN_HEX` mapping. These are digital previews, not physical ink calibration. Black strokes stay clear and original colors are not silently overwritten. Ready saved images retain their previous pixels; create a new request for the updated version.

`fillEnclosedRegions: false` retains legacy V2 reference projection. Family eligibility, archived identity, original/colored/artist roles and exactly-once stencil mirroring are unchanged. Local selected-ink coloring needs no image provider; new AI originals/styles still do.

## Evidence

Twenty-four affected mask/local/screen/reference tests passed, followed by actual Tiger/Butterfly checks, TypeScript, combined browser/API build and web export verification. The narrow read-only review found no confirmed defect. These are bounded algorithm safeguards, not a promise to automatically close every complex shape or apply a physical tattoo.
