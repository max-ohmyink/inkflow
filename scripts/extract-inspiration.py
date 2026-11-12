#!/usr/bin/env python3
"""Extract 12 authorized temporary-tattoo inspiration assets from the supplied catalog PDF.

This script intentionally reads only PDF image objects (with their soft alpha masks) and
PDF text/image geometry. It does not render, redraw, generate, copy, or distribute the
source PDF. Artwork is associated with the caption immediately below it, then normalized
only by trimming fully transparent outer pixels, centered on white square canvas, and
optionally downscaled to a 720-pixel maximum side.

Usage:
    python3 scripts/extract-inspiration.py /absolute/path/to/catalog.pdf
    python3 scripts/extract-inspiration.py /absolute/path/to/catalog.pdf --diagnose

Requires PyMuPDF and Pillow.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz
from PIL import Image


@dataclass(frozen=True)
class Selection:
    id: str
    title: str
    category: str
    collection: str
    page: int  # Physical (one-indexed) PDF page.
    concept: str
    style: str
    keywords: tuple[str, ...]


KONG_STRONG = "Kong Strong Collection"
ABOVE_SKY = "Above The Sky | Sun, Moon & Angel"
HAPPY_ARCADE = "Happy Arcade | Smileys & Toys"
SACRED_GEOMETRY = "Sacred Geometry | Mandala"
METAMORPHOSIS = "Metamorphosis | Butterfly"
SACRED_PULSE = "Sacred Pulse | Hearts"
PETAL_VINE = "Petal & Vine | Fine Line Flowers & Leafs"
HERITAGE_INK = "Heritage Ink | Old School"
ARTIST_TJ = "The Living Gallery | Artist TJ"

SELECTIONS: tuple[Selection, ...] = (
    Selection("fine-line-tulip", "Fine Line Tulip", "florals", PETAL_VINE, 35,
              "Simplified outline of a fine-line tulip with few curves; no texture, shading, or creases.",
              "fine_line", ("fine_line", "tulip", "florals")),
    Selection("fine-line-flower", "Fine Line Flower", "florals", PETAL_VINE, 34,
              "Simplified outline of a fine-line flower with few curves; no texture, shading, or creases.",
              "fine_line", ("fine_line", "flower", "florals")),
    Selection("fine-line-rose-1", "Fine Line Rose 1", "florals", PETAL_VINE, 34,
              "Simplified outline of a fine-line rose with few curves; no texture, shading, or creases.",
              "fine_line", ("fine_line", "rose", "florals")),
    Selection("fine-line-rose-2", "Fine Line Rose 2", "florals", PETAL_VINE, 34,
              "Simplified outline of a fine-line rose with few curves; no texture, shading, or creases.",
              "fine_line", ("fine_line", "rose", "florals")),

    Selection("heart-with-arrow", "Heart with Arrow", "hearts", SACRED_PULSE, 23,
              "Simplified outline of a heart with arrow using few curves; no texture, shading, or creases.",
              "traditional", ("heart", "arrow", "hearts")),
    Selection("heart-shaped-clip", "Heart-shaped Clip", "hearts", SACRED_PULSE, 23,
              "Simplified outline of a heart-shaped clip using few curves; no texture, shading, or creases.",
              "geometric", ("heart", "clip", "hearts")),

    Selection("melted-smile", "Melted Smile", "playful", HAPPY_ARCADE, 26,
              "Simplified outline of a melted smile using few curves; no texture, shading, or creases.",
              "traditional", ("melted", "smile", "playful")),
    Selection("melted-smile-1", "Melted Smile 1", "playful", HAPPY_ARCADE, 26,
              "Simplified outline of a melted smile using few curves; no texture, shading, or creases.",
              "traditional", ("melted", "smile", "playful")),
    Selection("smile-daisy", "Smile Daisy", "playful", HAPPY_ARCADE, 26,
              "Simplified outline of a smile daisy using few curves; no texture, shading, or creases.",
              "traditional", ("smile", "daisy", "playful")),
    Selection("ribbon", "Ribbon", "playful", HAPPY_ARCADE, 26,
              "Simplified outline of a ribbon using few curves; no texture, shading, or creases.",
              "cyber", ("ribbon", "playful")),

    Selection("moon-with-leaf", "Moon with Leaf", "symbols", ABOVE_SKY, 20,
              "Simplified outline of a moon with leaf using few curves; no texture, shading, or creases.",
              "fine_line", ("moon", "leaf", "symbols")),
    Selection("dog-balloon", "Dog Balloon", "symbols", HAPPY_ARCADE, 25,
              "Simplified outline of a dog balloon using few curves; no texture, shading, or creases.",
              "geometric", ("dog", "balloon", "symbols")),
)


def normalized(text: str) -> str:
    """Normalize catalog text for robust exact caption matching."""
    return re.sub(r"\s+", " ", text).strip().casefold()


def text_lines(page: fitz.Page) -> list[tuple[str, fitz.Rect]]:
    """Read PDF text boxes at line level, preserving caption geometry."""
    result: list[tuple[str, fitz.Rect]] = []
    page_dict = page.get_text("dict")
    for block in page_dict["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = "".join(span.get("text", "") for span in spans)
            if text.strip():
                result.append((text, fitz.Rect(line["bbox"])))
    return result


def caption_rect(page: fitz.Page, expected: str) -> fitz.Rect:
    """Find one exact catalog caption from PDF text boxes; reject ambiguity."""
    found = [rect for text, rect in text_lines(page) if normalized(text) == normalized(expected)]
    if len(found) != 1:
        matches = [(text, tuple(round(v, 1) for v in rect)) for text, rect in text_lines(page)
                   if normalized(expected) in normalized(text)]
        raise RuntimeError(
            f"Expected one exact caption {expected!r} on page {page.number + 1}; "
            f"found {len(found)}. Related text: {matches}"
        )
    return found[0]


def image_rects(page: fitz.Page) -> Iterable[tuple[tuple, fitz.Rect]]:
    """Yield source image object rows and their on-page rectangles once each."""
    seen: set[tuple[int, float, float, float, float]] = set()
    for item in page.get_images(full=True):
        xref = item[0]
        for rect in page.get_image_rects(xref):
            key = (xref, round(rect.x0, 3), round(rect.y0, 3), round(rect.x1, 3), round(rect.y1, 3))
            if key not in seen:
                seen.add(key)
                yield item, rect


def visible_art_rect(pdf: fitz.Document, item: tuple, placement: fitz.Rect) -> fitz.Rect | None:
    """Map the source object's alpha-bounded visible pixels into PDF page coordinates."""
    image = source_image(pdf, item)
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return None
    x0, y0, x1, y1 = bbox
    return fitz.Rect(
        placement.x0 + placement.width * x0 / image.width,
        placement.y0 + placement.height * y0 / image.height,
        placement.x0 + placement.width * x1 / image.width,
        placement.y0 + placement.height * y1 / image.height,
    )


def select_artwork_object(pdf: fitz.Document, page: fitz.Page, expected: str) -> tuple[tuple, fitz.Rect, fitz.Rect]:
    """Associate art immediately above a caption while excluding page-scale decoration."""
    caption = caption_rect(page, expected)
    candidates: list[tuple[float, tuple, fitz.Rect]] = []
    for item, placement in image_rects(page):
        # Source objects have generous transparent canvases. Match the caption to the
        # alpha-bounded artwork inside that canvas rather than its placement rectangle.
        rect = visible_art_rect(pdf, item, placement)
        if rect is None:
            continue
        # Artwork needs to sit above its own caption. This rejects page backgrounds,
        # logos, and footer objects that encompass text or are page-scale decoration.
        if rect.y0 >= caption.y0 or rect.y1 > caption.y1 + 8:
            continue
        if rect.width > page.rect.width * 0.46 or rect.height > page.rect.height * 0.38:
            continue
        if rect.get_area() < 12:
            continue
        horizontal = abs(rect.x0 + rect.width / 2 - (caption.x0 + caption.width / 2))
        vertical_gap = max(0, caption.y0 - rect.y1)
        # Favor aligned compact art directly above its caption. A small horizontal
        # component avoids choosing nearby designs in adjacent grid cells.
        score = horizontal * 2.4 + vertical_gap + abs(rect.width - max(caption.width * 2.0, 45)) * 0.05
        candidates.append((score, item, rect))
    if not candidates:
        objects = [
            f"xref={item[0]} visible={visible_art_rect(pdf, item, placement)}"
            for item, placement in image_rects(page)
        ]
        raise RuntimeError(
            f"No compact image object above caption {expected!r} on page {page.number + 1}; "
            f"caption={caption}; objects={objects}"
        )
    candidates.sort(key=lambda candidate: candidate[0])
    score, item, rect = candidates[0]
    # An unusually distant closest candidate signals that a layout change needs an explicit update.
    if abs(rect.x0 + rect.width / 2 - (caption.x0 + caption.width / 2)) > 80 or caption.y0 - rect.y1 > 145:
        raise RuntimeError(
            f"Ambiguous geometry for {expected!r}: selected xref {item[0]} at {rect}, "
            f"caption {caption}, score {score:.1f}"
        )
    return item, rect, caption


def source_image(pdf: fitz.Document, item: tuple) -> Image.Image:
    """Extract a source object and apply its catalog soft-mask alpha when present."""
    pix = fitz.Pixmap(pdf, item[0])
    smask_xref = item[1]
    if smask_xref:
        mask = fitz.Pixmap(pdf, smask_xref)
        pix = fitz.Pixmap(pix, mask)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")


def normalized_square(image: Image.Image) -> Image.Image:
    """Trim transparent-only margins and center existing pixels on a white square canvas."""
    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise RuntimeError("Selected source object has no visible pixels after alpha-mask extraction")
    image = image.crop(alpha_bbox)
    side = math.ceil(max(image.size) * 1.18)
    if side > 720:
        scale = 720 / side
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
        side = 720
    canvas = Image.new("RGBA", (side, side), "white")
    canvas.alpha_composite(image, ((side - image.width) // 2, (side - image.height) // 2))
    return canvas


def write_typescript(output: Path, records: list[dict]) -> None:
    lines = [
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "export const CATALOG_ARTWORK: Record<string, ImageSourcePropType> = {",
    ]
    lines.extend(f"  {record['id']!r}: require('./{record['filename']}')," for record in records)
    lines.extend(["};", ""])
    output.write_text("\n".join(lines), encoding="utf-8")


def write_provenance(output: Path, sources: list[tuple[Selection, int]]) -> None:
    rows = [
        "# Catalog inspiration provenance",
        "",
        "These 12 PNG assets were deterministically extracted from the user-authorized private "
        "catalog at the supplied local path. The original confidential PDF is **not copied, included, "
        "or distributed** with these assets.",
        "",
        "The image pixels remain copyrighted catalog material and are included only under the user's "
        "authorization for this requested product-inspiration purpose.",
        "",
        "## Method",
        "",
        "`scripts/extract-inspiration.py` reads PDF text boxes and image rectangles, matches each named "
        "caption, and selects the compact source image object immediately above that caption. It filters "
        "page-scale backgrounds, logos, and footer objects. The source image's soft alpha mask is applied; "
        "only fully transparent outer margins are removed. Each image is then centered unchanged on a white "
        "square canvas and downscaled only when its normalized canvas would exceed 720 px.",
        "",
        "No source PDF pages are rendered into the app assets, and this archive excludes the full PDF.",
        "",
        "## Source-object register",
        "",
        "| Title | Category | Physical PDF page | Source image xref |",
        "|---|---|---:|---:|",
    ]
    rows.extend(f"| {selection.title} | {selection.category} | {selection.page} | {xref} |"
                for selection, xref in sources)
    rows.append("")
    output.write_text("\n".join(rows), encoding="utf-8")


def validate_selections() -> None:
    if len(SELECTIONS) != 12:
        raise RuntimeError(f"Expected exactly 12 selections, got {len(SELECTIONS)}")
    ids = [selection.id for selection in SELECTIONS]
    if len(ids) != len(set(ids)) or any(not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value) for value in ids):
        raise RuntimeError("Selection IDs must be unique ASCII slugs")
    counts = {category: sum(selection.category == category for selection in SELECTIONS)
              for category in {selection.category for selection in SELECTIONS}}
    if counts != {"florals": 4, "hearts": 2, "playful": 4, "symbols": 2}:
        raise RuntimeError(f"Unexpected category counts; expected florals=4, hearts=2, playful=4, symbols=2: {counts}")
    allowed_styles = {"fine_line", "traditional", "geometric", "cyber"}
    if any(selection.style not in allowed_styles for selection in SELECTIONS):
        raise RuntimeError(f"Unexpected style ID in selections: {sorted({selection.style for selection in SELECTIONS})}")


def diagnose(pdf: fitz.Document) -> None:
    """Print caption/object associations for review without writing app outputs."""
    for selection in SELECTIONS:
        page = pdf[selection.page - 1]
        item, rect, caption = select_artwork_object(pdf, page, selection.title)
        print(
            f"{selection.id}: page={selection.page} xref={item[0]} smask={item[1]} "
            f"image=({rect.x0:.1f},{rect.y0:.1f},{rect.x1:.1f},{rect.y1:.1f}) "
            f"caption=({caption.x0:.1f},{caption.y0:.1f},{caption.x1:.1f},{caption.y1:.1f})"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Local authorized catalog PDF")
    parser.add_argument("--diagnose", action="store_true", help="Print associations without writing outputs")
    args = parser.parse_args()

    validate_selections()
    if not args.pdf.is_file():
        raise FileNotFoundError(f"Catalog PDF not found: {args.pdf}")
    root = Path(__file__).resolve().parent.parent
    output = root / "assets" / "catalog" / "inspiration"
    docs = root / "docs"

    with fitz.open(args.pdf) as pdf:
        if args.diagnose:
            diagnose(pdf)
            return

        output.mkdir(parents=True, exist_ok=True)
        docs.mkdir(parents=True, exist_ok=True)
        records: list[dict] = []
        sources: list[tuple[Selection, int]] = []
        source_uses: dict[tuple[int, int], str] = {}
        for selection in SELECTIONS:
            page = pdf[selection.page - 1]
            item, _, _ = select_artwork_object(pdf, page, selection.title)
            source_key = (selection.page, item[0])
            if source_key in source_uses:
                raise RuntimeError(
                    f"Duplicate source object xref {item[0]} on page {selection.page}: "
                    f"{source_uses[source_key]} and {selection.id}"
                )
            source_uses[source_key] = selection.id
            square = normalized_square(source_image(pdf, item))
            filename = f"{selection.id}.png"
            square.save(output / filename, format="PNG")
            records.append({
                "id": selection.id,
                "title": selection.title,
                "category": selection.category,
                "collection": selection.collection,
                "page": selection.page,
                "filename": filename,
                "concept": selection.concept,
                "style": selection.style,
                "keywords": list(selection.keywords),
            })
            sources.append((selection, item[0]))
            print(f"{selection.id}: page {selection.page}, xref {item[0]}, {square.size}")

    (output / "catalog-items.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    write_typescript(output / "artwork.ts", records)
    write_provenance(docs / "inspiration-provenance.md", sources)
    print(f"Wrote {len(records)} PNG assets and metadata to {output}")


if __name__ == "__main__":
    main()
