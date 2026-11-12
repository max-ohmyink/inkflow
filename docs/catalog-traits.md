# Catalog trait index

`assets/catalog/inspiration/catalog-traits.json` is a deterministic, **read-only trait index** for the original catalog. It contains **451 entries** for the **30 literal collections** in `catalog-items.json`; there is exactly one entry for every catalog ID and no extra IDs.

## Exact schema

```json
{
  "version": 1,
  "entries": {
    "catalogId": {
      "artStyles": ["fine_line"],
      "colorMix": "monochrome",
      "colorFamilies": [],
      "colorInkFraction": 0.0
    }
  }
}
```

The root has only `version` (the number `1`) and `entries`. Each entry has only the four fields shown above:

- `artStyles`: zero or more public style enum tags.
- `colorMix`: one of `monochrome`, `red_accent`, `blue_accent`, or `mixed_color`.
- `colorFamilies`: meaningful measured HSV families, descending by qualifying-pixel count (fixed family ordering breaks ties).
- `colorInkFraction`: qualifying colored foreground pixels divided by visible foreground ink pixels, rounded to six decimals. It is a measurement aid, not a UI facet.

## Scope and limits

- This index reads `catalog-items.json` plus the 451 referenced original PNGs. It does **not** modify, recolor, generate, classify semantically, or otherwise transform artwork.
- Art styles use only the literal catalog title/caption and collection labels. The legacy per-item `style` field is deliberately never read.
- The index has no Mandala tag or synthesized Mandala collection. A missing label basis remains `artStyles: []`; it is not promoted to fine line.
- Tags describe **catalog directions**, not a promise that every style/color combination exists. Consumers should strictly return no matches for unavailable combinations.
- The collection table is a grouping audit, not visual recognition. A single original artwork can hold multiple explicit tags (for example, a fine-line caption in an original-graphic collection).

## Label-to-style rules

| Tag | Literal-label rule |
| --- | --- |
| `fine_line` | Any title/caption or collection label contains `fine line` or `fine-line`. |
| `old_school` | A title/caption or collection label contains `oldschool`, `old school`, `american traditional`, or `traditional style`. |
| `lettering` | The label is from `Script & Speak | Wordings`, or its Kong Strong title is one of the explicitly supplied wording captions (Vertical, 852 A/B, HONGKONG, Made In Hong Kong, Home Kong, Mirror Tattoo). |
| `cyber_ornamental` | A label contains `cyber`, `neo-tribal`, `tribal`, `y2k`, or `ornamental`. |
| `illustrated` | The non-lettering original-graphic collection label is Fluffy Friends, Happy Arcade, Above The Sky, Metamorphosis, Old School, Wild Majesty, Memento, an Artist/Living Gallery collection, a Sports/Game collection, or Spooky/Christmas. |

## Deterministic color measurement

PNG pixels are converted to RGBA and composited on white before any test, so fully or partly transparent pixels are white-normalized. A visible-ink pixel is non-white (`HSV value <= 0.960784`) or a qualifying saturated color. A qualifying color pixel needs all of: value `>= 0.098039` (at least 25/255), saturation `>= 0.22`, and RGB channel spread `>= 20`. This preserves measurable dark blue-black ink while rejecting nearly black RGB noise and low-saturation anti-aliasing.

| Constant | Value | Purpose |
| --- | ---: | --- |
| `MIN_FAMILY_PIXELS` | 24 | Absolute minimum qualifying pixels for a color family. |
| `MIN_FAMILY_SHARE_OF_VISIBLE_INK` | 0.0125 | Relative minimum; a family needs `max(24, ceil(visibleInk × share))`. |
| Hue bins | red, orange, yellow, green, blue, purple | HSV color families; warm red/pink remains `red`. |

A family is retained only when it meets both the absolute and relative threshold. No retained family means `monochrome`; red alone is `red_accent`; blue alone is `blue_accent`; every other retained configuration (including green alone) is `mixed_color` (the parent UI label is **Other & mixed colors**).

## Result counts

### Color mix

| Color mix | Entries |
| --- | --- |
| monochrome | 419 |
| red_accent | 15 |
| blue_accent | 2 |
| mixed_color | 15 |

### Retained color families

| HSV family | Entries containing family |
| --- | --- |
| red | 18 |
| blue | 3 |
| green | 4 |
| yellow | 0 |
| orange | 11 |
| purple | 0 |

### Art-style tags

| Tag | Entries tagged |
| --- | --- |
| fine_line | 30 |
| old_school | 13 |
| illustrated | 333 |
| lettering | 53 |
| cyber_ornamental | 3 |

## Art-style tags by literal collection

| Collection | Items | fine_line | old_school | illustrated | lettering | cyber_ornamental | No tag |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Above The Sky | Sun, Moon & Angel | 11 | 2 | 0 | 11 | 0 | 0 | 0 |
| Christmas Collection | 10 | 0 | 0 | 10 | 0 | 0 | 0 |
| Fluffy Friends: Bichon | 11 | 0 | 0 | 11 | 0 | 0 | 0 |
| Fluffy Friends: Corgi | 15 | 0 | 0 | 15 | 0 | 0 | 0 |
| Fluffy Friends: Domestic Cat | 11 | 0 | 0 | 11 | 0 | 0 | 0 |
| Fluffy Friends: Frenchie | 22 | 0 | 0 | 22 | 0 | 0 | 0 |
| Fluffy Friends: Golden Retriever | 15 | 0 | 0 | 15 | 0 | 0 | 0 |
| Fluffy Friends: Long Hair Cat | 14 | 0 | 0 | 14 | 0 | 0 | 0 |
| Fluffy Friends: Mongrel | 14 | 0 | 0 | 14 | 0 | 0 | 0 |
| Fluffy Friends: Poodle | 10 | 0 | 0 | 10 | 0 | 0 | 0 |
| Fluffy Friends: Shiba | 13 | 0 | 0 | 13 | 0 | 0 | 0 |
| Fluffy Friends: Short Hair Cat | 15 | 0 | 0 | 15 | 0 | 0 | 0 |
| Fluffy Friends: Sphynx Cat | 32 | 0 | 0 | 32 | 0 | 0 | 0 |
| Happy Arcade | Smileys & Toys | 17 | 0 | 0 | 17 | 0 | 0 | 0 |
| Heritage Ink | Old School | 13 | 0 | 13 | 13 | 0 | 0 | 0 |
| Kong Strong Collection | 29 | 0 | 0 | 0 | 9 | 0 | 20 |
| Memento Mori | Skull Art | 19 | 0 | 0 | 19 | 0 | 0 | 0 |
| Metamorphosis | Butterfly | 9 | 0 | 0 | 9 | 0 | 1 | 0 |
| Petal & Vine | Fine Line Flowers & Leafs | 16 | 16 | 0 | 0 | 0 | 0 | 0 |
| Sacred Pulse | Hearts | 13 | 0 | 0 | 0 | 0 | 0 | 13 |
| Sanskrit & Soul | Fine Line Yogi | 12 | 12 | 0 | 0 | 0 | 0 | 0 |
| Script & Speak | Wordings | 44 | 0 | 0 | 0 | 44 | 0 | 0 |
| Spooky Collection | 18 | 0 | 0 | 18 | 0 | 0 | 0 |
| The 7s Game | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| The Beautiful Game | 31 | 0 | 0 | 31 | 0 | 0 | 0 |
| The Composite Canvas Collection | 4 | 0 | 0 | 0 | 0 | 2 | 2 |
| The Living Gallery | Artist Brian | 6 | 0 | 0 | 6 | 0 | 0 | 0 |
| The Living Gallery | Artist Sandra | 6 | 0 | 0 | 6 | 0 | 0 | 0 |
| The Living Gallery | Artist TJ | 6 | 0 | 0 | 6 | 0 | 0 | 0 |
| Wild Majesty | Tiger & Lion | 10 | 0 | 0 | 10 | 0 | 0 | 0 |

## Source preservation evidence

The script hashes every referenced PNG before indexing and again after the JSON is written. Its aggregate hashes the stable filename plus each PNG's SHA-256. The script raises an error if they differ.

| Check | Aggregate SHA-256 |
| --- | --- |
| Before indexing (451 PNGs) | `81e5b0a7d76b02b77cbf7ffe760cc00817e6f69439430ddfea9a66c8ffa698a4` |
| After JSON write (451 PNGs) | `81e5b0a7d76b02b77cbf7ffe760cc00817e6f69439430ddfea9a66c8ffa698a4` |

**Result:** hashes match; original PNG source bytes were not changed by this run.

## Regeneration

```bash
python3 scripts/index-catalog-traits.py
```

The script writes JSON first, verifies that the source PNG aggregate is unchanged, then writes this document. It uses only Python's standard library and the already-available Pillow package.
