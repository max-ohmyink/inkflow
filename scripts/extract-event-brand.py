#!/usr/bin/env python3
"""Extract the two authorized Page 6 Waterworks artwork crops from the supplied toolkit.

This script copies only pixels from the source PDF's embedded Page 6 raster image.
It does not render, recolor, resize, enhance, or recreate the artwork.
"""
from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

PDF_PATH = Path("/home/ubuntu/upload/1036008_MKTG_EX_BloombergDay_2026_Toolkit(1).pdf")
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "event-brand"
PAGE_INDEX = 5  # Page 6, zero-indexed
ARTWORK_XREF = 28

# Pixel boxes are [left, top, right, bottom) in the 1536 × 707 native embedded
# image. They are the conservative native-pixel mappings of these Page 6 point
# boxes: vertical (166, 99, 302, 329), wide (328, 238, 652, 329).
CROPS = {
    "waterworks-vertical.png": (354, 211, 645, 703),
    "waterworks-wide.png": (699, 507, 1391, 703),
}


def native_image(document: fitz.Document) -> Image.Image:
    page = document[PAGE_INDEX]
    placed_rects = page.get_image_rects(ARTWORK_XREF)
    if not placed_rects:
        raise RuntimeError(f"Image xref {ARTWORK_XREF} is not placed on Page 6")

    pix = fitz.Pixmap(document, ARTWORK_XREF)
    if (pix.width, pix.height) != (1536, 707):
        raise RuntimeError(
            "Unexpected Page 6 Waterworks source dimensions: "
            f"{pix.width} × {pix.height}px"
        )
    if pix.alpha:
        raise RuntimeError("Unexpected alpha channel in Page 6 Waterworks source")
    if pix.n != 3:
        raise RuntimeError(f"Expected RGB source pixels; got {pix.n} components")
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def main() -> None:
    if not PDF_PATH.is_file():
        raise FileNotFoundError(f"Supplied toolkit PDF was not found: {PDF_PATH}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with fitz.open(PDF_PATH) as document:
        source = native_image(document)
        for filename, box in CROPS.items():
            output = source.crop(box)
            output.save(OUTPUT_DIR / filename, format="PNG", optimize=False)
            print(f"Wrote {OUTPUT_DIR / filename}: {output.width} × {output.height}px")


if __name__ == "__main__":
    main()
