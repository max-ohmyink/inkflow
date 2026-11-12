#!/usr/bin/env python3
"""Build a deterministic trait index for the original inspiration catalog.

This reads catalog-items.json and the referenced PNG pixels only.  It never
edits metadata or artwork.  Art-style tags come exclusively from literal
catalog title/collection/category labels; the legacy ``style`` field is never
read.  Color traits are conventional HSV pixel measurements, not semantic
image classification.
"""

from __future__ import annotations

import colorsys
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "catalog" / "inspiration"
METADATA_PATH = ASSET_DIR / "catalog-items.json"
OUTPUT_PATH = ASSET_DIR / "catalog-traits.json"
DOCS_PATH = ROOT / "docs" / "catalog-traits.md"
EXPECTED_RECORDS = 451
EXPECTED_COLLECTIONS = 30

# Pixel-measurement constants. Values are deliberately explicit so that the
# result can be regenerated identically on a supported Pillow version.
WHITE_VALUE_MIN = 245 / 255
MIN_COLOR_VALUE = 25 / 255
MIN_COLOR_SATURATION = 0.22
MIN_CHANNEL_SPREAD = 20
MIN_FAMILY_PIXELS = 24
MIN_FAMILY_SHARE_OF_VISIBLE_INK = 0.0125
HASH_BLOCK_BYTES = 1024 * 1024

STYLE_ORDER = (
    "fine_line",
    "old_school",
    "illustrated",
    "lettering",
    "cyber_ornamental",
)
FAMILY_TIE_ORDER = ("red", "blue", "green", "yellow", "orange", "purple")

# These are literal, catalog-facing collection/caption label fragments. They
# identify the supplied broad original-graphic collections; they do not infer
# a subject or style from image pixels.
ILLUSTRATED_COLLECTION_LABELS = (
    "fluffy friends",
    "happy arcade",
    "above the sky",
    "metamorphosis",
    "old school",
    "wild majesty",
    "memento",
    "artist",
    "the beautiful game",
    "the 7s game",
    "spooky collection",
    "christmas collection",
)
KONG_WORDING_CAPTIONS = frozenset(
    {
        "香港vertical",
        "鬼佬",
        "你望咩呀",
        "852a",
        "852b",
        "hongkong",
        "madeinhongkong",
        "homekong",
        "mirrortattoo",
    }
)
FINE_LINE_RE = re.compile(r"\bfine[\s-]+line\b", re.IGNORECASE)
OLD_SCHOOL_RE = re.compile(
    r"\bold[\s-]*school\b|\bamerican[\s-]*traditional\b|\btraditional[\s-]*style\b",
    re.IGNORECASE,
)
CYBER_ORNAMENTAL_RE = re.compile(
    r"\bcyber\b|\bneo[\s-]*tribal\b|\btribal\b|\by2k\b|\bornamental\b",
    re.IGNORECASE,
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(HASH_BLOCK_BYTES):
            digest.update(block)
    return digest.hexdigest()


def source_hash_aggregate(paths: Iterable[Path]) -> str:
    """Hash exact source bytes plus stable relative filenames."""
    aggregate = hashlib.sha256()
    for path in sorted(paths, key=lambda value: value.name):
        aggregate.update(path.name.encode("utf-8"))
        aggregate.update(b"\t")
        aggregate.update(sha256_file(path).encode("ascii"))
        aggregate.update(b"\n")
    return aggregate.hexdigest()


def load_catalog() -> list[dict[str, Any]]:
    with METADATA_PATH.open(encoding="utf-8") as handle:
        items = json.load(handle)
    if not isinstance(items, list) or len(items) != EXPECTED_RECORDS:
        raise ValueError(f"Expected exactly {EXPECTED_RECORDS} metadata records.")
    if any(not isinstance(item, dict) for item in items):
        raise ValueError("Every catalog record must be an object.")

    ids = [item.get("id") for item in items]
    if any(not isinstance(catalog_id, str) or not catalog_id for catalog_id in ids):
        raise ValueError("Every catalog record needs a nonempty string id.")
    if len(set(ids)) != len(ids):
        raise ValueError("Catalog IDs must be unique.")

    for item in items:
        filename = item.get("filename")
        if not isinstance(filename, str) or Path(filename).suffix.lower() != ".png":
            raise ValueError(f"{item['id']} does not reference one PNG filename.")
        if Path(filename).name != filename:
            raise ValueError(f"{item['id']} has a non-local filename.")
        if not (ASSET_DIR / filename).is_file():
            raise FileNotFoundError(f"Missing PNG for {item['id']}: {filename}")
    referenced = {ASSET_DIR / item["filename"] for item in items}
    source_pngs = set(ASSET_DIR.glob("*.png"))
    if len(referenced) != EXPECTED_RECORDS or referenced != source_pngs:
        raise ValueError("Metadata must reference the exact set of 451 source PNGs once each.")
    return items


def label_text(item: dict[str, Any]) -> str:
    """Use only literal catalog caption/title and collection labels."""
    fields = (item.get("title", ""), item.get("collection", ""))
    if any(not isinstance(value, str) for value in fields):
        raise ValueError(f"Label fields must be strings for {item['id']}.")
    return " | ".join(fields)


def compact_label(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKC", value).casefold()
        if character.isalnum()
    )


def art_styles(item: dict[str, Any]) -> list[str]:
    """Return label-derived tags in the fixed public enum order."""
    labels = label_text(item)
    normalized = labels.casefold()
    caption = compact_label(item["title"])
    tags: set[str] = set()

    if FINE_LINE_RE.search(labels):
        tags.add("fine_line")
    if OLD_SCHOOL_RE.search(labels):
        tags.add("old_school")
    if "script & speak" in normalized or caption in KONG_WORDING_CAPTIONS:
        tags.add("lettering")
    if CYBER_ORNAMENTAL_RE.search(labels):
        tags.add("cyber_ornamental")
    if any(fragment in normalized for fragment in ILLUSTRATED_COLLECTION_LABELS):
        tags.add("illustrated")

    return [tag for tag in STYLE_ORDER if tag in tags]


def color_family(hue: float) -> str:
    """Assign a qualifying HSV hue (degrees) to the six fixed color families."""
    degrees = hue * 360
    if degrees < 15 or degrees >= 345:
        return "red"  # includes warm red and pink
    if degrees < 45:
        return "orange"
    if degrees < 70:
        return "yellow"
    if degrees < 170:
        return "green"
    if degrees < 260:
        return "blue"
    return "purple"


def color_traits(path: Path) -> tuple[str, list[str], float]:
    """Measure foreground color using white-normalized RGBA source pixels.

    A pixel is visible ink if it is non-white (value <= WHITE_VALUE_MIN) or a
    qualifying saturated color. A color pixel must have HSV value >= 25/255,
    saturation >= .22, and RGB channel spread >= 20. This admits measurable
    dark-blue/black artwork while rejecting very dark colored compression
    noise and low-saturation anti-aliasing. Color-family membership requires
    both MIN_FAMILY_PIXELS and a fraction of visible ink.
    """
    family_pixels: Counter[str] = Counter()
    visible_ink = 0
    colored_ink = 0

    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        for red, green, blue, alpha in rgba.get_flattened_data():
            # Normalize transparency against white before foreground/color tests.
            if alpha != 255:
                inverse_alpha = 255 - alpha
                red = (red * alpha + 255 * inverse_alpha + 127) // 255
                green = (green * alpha + 255 * inverse_alpha + 127) // 255
                blue = (blue * alpha + 255 * inverse_alpha + 127) // 255

            value = max(red, green, blue) / 255
            channel_spread = max(red, green, blue) - min(red, green, blue)
            saturation = 0.0 if value == 0 else channel_spread / max(red, green, blue)
            qualifies_as_color = (
                value >= MIN_COLOR_VALUE
                and saturation >= MIN_COLOR_SATURATION
                and channel_spread >= MIN_CHANNEL_SPREAD
            )
            if value <= WHITE_VALUE_MIN or qualifies_as_color:
                visible_ink += 1
            if qualifies_as_color:
                colored_ink += 1
                hue, _saturation, _value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
                family_pixels[color_family(hue)] += 1

    if visible_ink == 0:
        color_ink_fraction = 0.0
    else:
        color_ink_fraction = round(colored_ink / visible_ink, 6)

    minimum_meaningful_pixels = max(
        MIN_FAMILY_PIXELS,
        math.ceil(visible_ink * MIN_FAMILY_SHARE_OF_VISIBLE_INK),
    )
    meaningful = [
        family for family, pixels in family_pixels.items() if pixels >= minimum_meaningful_pixels
    ]
    order = {family: index for index, family in enumerate(FAMILY_TIE_ORDER)}
    meaningful.sort(key=lambda family: (-family_pixels[family], order[family]))

    if not meaningful:
        color_mix = "monochrome"
    elif set(meaningful) == {"red"}:
        color_mix = "red_accent"
    elif set(meaningful) == {"blue"}:
        color_mix = "blue_accent"
    else:
        color_mix = "mixed_color"
    return color_mix, meaningful, color_ink_fraction


def build_entries(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    entries: dict[str, dict[str, Any]] = {}
    for item in sorted(items, key=lambda value: value["id"]):
        color_mix, families, fraction = color_traits(ASSET_DIR / item["filename"])
        entries[item["id"]] = {
            "artStyles": art_styles(item),
            "colorMix": color_mix,
            "colorFamilies": families,
            "colorInkFraction": fraction,
        }
    if len(entries) != EXPECTED_RECORDS:
        raise AssertionError("Index must have exactly one entry per catalog ID.")
    return entries


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    divider = ["---"] * len(headers)
    return "\n".join(
        "| " + " | ".join(row) + " |" for row in [headers, divider, *rows]
    )


def docs_markdown(
    items: list[dict[str, Any]],
    entries: dict[str, dict[str, Any]],
    pre_hash: str,
    post_hash: str,
) -> str:
    by_id = {item["id"]: item for item in items}
    collection_counts = Counter(item["collection"] for item in items)
    if len(collection_counts) != EXPECTED_COLLECTIONS:
        raise ValueError(f"Expected exactly {EXPECTED_COLLECTIONS} literal collections.")

    mix_counts = Counter(entry["colorMix"] for entry in entries.values())
    family_counts = Counter(
        family for entry in entries.values() for family in entry["colorFamilies"]
    )
    style_counts = Counter(
        style for entry in entries.values() for style in entry["artStyles"]
    )
    tag_columns = list(STYLE_ORDER)
    collection_rows: list[list[str]] = []
    for collection in sorted(collection_counts, key=str.casefold):
        ids = [item["id"] for item in items if item["collection"] == collection]
        per_style = Counter(style for catalog_id in ids for style in entries[catalog_id]["artStyles"])
        unassigned = sum(not entries[catalog_id]["artStyles"] for catalog_id in ids)
        collection_rows.append(
            [collection, str(len(ids)), *[str(per_style[tag]) for tag in tag_columns], str(unassigned)]
        )

    schema = '''```json
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
```'''
    color_rows = [
        ["monochrome", str(mix_counts["monochrome"])],
        ["red_accent", str(mix_counts["red_accent"])],
        ["blue_accent", str(mix_counts["blue_accent"])],
        ["mixed_color", str(mix_counts["mixed_color"])],
    ]
    family_rows = [[family, str(family_counts[family])] for family in FAMILY_TIE_ORDER]
    style_rows = [[style, str(style_counts[style])] for style in STYLE_ORDER]

    return f'''# Catalog trait index

`assets/catalog/inspiration/catalog-traits.json` is a deterministic, **read-only trait index** for the original catalog. It contains **{len(entries)} entries** for the **{len(collection_counts)} literal collections** in `catalog-items.json`; there is exactly one entry for every catalog ID and no extra IDs.

## Exact schema

{schema}

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

PNG pixels are converted to RGBA and composited on white before any test, so fully or partly transparent pixels are white-normalized. A visible-ink pixel is non-white (`HSV value <= {WHITE_VALUE_MIN:.6f}`) or a qualifying saturated color. A qualifying color pixel needs all of: value `>= {MIN_COLOR_VALUE:.6f}` (at least 25/255), saturation `>= {MIN_COLOR_SATURATION:.2f}`, and RGB channel spread `>= {MIN_CHANNEL_SPREAD}`. This preserves measurable dark blue-black ink while rejecting nearly black RGB noise and low-saturation anti-aliasing.

| Constant | Value | Purpose |
| --- | ---: | --- |
| `MIN_FAMILY_PIXELS` | {MIN_FAMILY_PIXELS} | Absolute minimum qualifying pixels for a color family. |
| `MIN_FAMILY_SHARE_OF_VISIBLE_INK` | {MIN_FAMILY_SHARE_OF_VISIBLE_INK:.4f} | Relative minimum; a family needs `max(24, ceil(visibleInk × share))`. |
| Hue bins | red, orange, yellow, green, blue, purple | HSV color families; warm red/pink remains `red`. |

A family is retained only when it meets both the absolute and relative threshold. No retained family means `monochrome`; red alone is `red_accent`; blue alone is `blue_accent`; every other retained configuration (including green alone) is `mixed_color` (the parent UI label is **Other & mixed colors**).

## Result counts

### Color mix

{markdown_table(["Color mix", "Entries"], color_rows)}

### Retained color families

{markdown_table(["HSV family", "Entries containing family"], family_rows)}

### Art-style tags

{markdown_table(["Tag", "Entries tagged"], style_rows)}

## Art-style tags by literal collection

{markdown_table(["Collection", "Items", *tag_columns, "No tag"], collection_rows)}

## Source preservation evidence

The script hashes every referenced PNG before indexing and again after the JSON is written. Its aggregate hashes the stable filename plus each PNG's SHA-256. The script raises an error if they differ.

| Check | Aggregate SHA-256 |
| --- | --- |
| Before indexing ({len(items)} PNGs) | `{pre_hash}` |
| After JSON write ({len(items)} PNGs) | `{post_hash}` |

**Result:** hashes {'match' if pre_hash == post_hash else 'DO NOT MATCH'}; original PNG source bytes were not changed by this run.

## Regeneration

```bash
python3 scripts/index-catalog-traits.py
```

The script writes JSON first, verifies that the source PNG aggregate is unchanged, then writes this document. It uses only Python's standard library and the already-available Pillow package.
'''


def main() -> None:
    items = load_catalog()
    png_paths = [ASSET_DIR / item["filename"] for item in items]
    pre_hash = source_hash_aggregate(png_paths)

    entries = build_entries(items)
    # JSON is intentionally the first generated deliverable.
    payload: dict[str, Any] = {"version": 1, "entries": entries}
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2, sort_keys=False)
        handle.write("\n")

    post_hash = source_hash_aggregate(png_paths)
    if pre_hash != post_hash:
        raise RuntimeError("Source PNG aggregate changed during indexing.")

    documentation = docs_markdown(items, entries, pre_hash, post_hash)
    with DOCS_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(documentation)
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} ({len(entries)} entries).")
    print(f"Verified source PNG aggregate unchanged: {pre_hash}")
    print(f"Wrote {DOCS_PATH.relative_to(ROOT)} ({len(Counter(item['collection'] for item in items))} collections).")


if __name__ == "__main__":
    main()
