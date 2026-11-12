#!/usr/bin/env python3
"""Extract approximate tattoo ink swatches from the supplied reference photograph.

This tool reads the supplied source image without changing, copying, or exporting it.  It takes
median RGB values from small foreground patches around the manually supplied swatch centers and
writes only the derived JSON palette. Screen/photo colors are approximate observations under the
reference lighting; they are not calibrated ink-color promises.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median
from typing import Iterable

from PIL import Image

# Manually supplied swatch centers, listed left-to-right in the reference photo.
SWATCHES = (
    ("cool_purple", "Cool Purple", (225, 181)),
    ("purple", "Purple", (319, 184)),
    ("warm_purple", "Warm Purple", (405, 183)),
    ("rose_pink", "Rose Pink", (500, 187)),
    ("red", "Red", (578, 190)),
    ("cherry_red", "Cherry Red", (657, 197)),
    ("deep_red", "Deep Red", (732, 199)),
    ("rust_red", "Rust Red", (824, 202)),
    ("brown", "Brown", (918, 203)),
    ("black", "Black", (1012, 203)),
    ("lemon_yellow", "Lemon Yellow", (224, 337)),
    ("apricot_yellow", "Apricot Yellow", (323, 348)),
    ("orange", "Orange", (398, 350)),
    ("light_green", "Light Green", (483, 359)),
    ("green", "Green", (577, 359)),
    ("dark_green", "Dark Green", (647, 366)),
    ("lake_blue", "Lake Blue", (727, 373)),
    ("sky_blue", "Sky Blue", (799, 375)),
    ("navy_blue", "Navy Blue", (870, 391)),
    ("tattoo_blue", "Tattoo Blue", (952, 393)),
)


def median_patch_rgb(image: Image.Image, center: tuple[int, int], radius: int) -> tuple[int, int, int]:
    """Return the channel-wise median of an in-bounds square foreground patch."""
    x, y = center
    if radius < 0 or x - radius < 0 or y - radius < 0 or x + radius >= image.width or y + radius >= image.height:
        raise ValueError(f"patch around {center!r} is outside source image {image.size!r}")
    pixels = [
        image.getpixel((sample_x, sample_y))[:3]
        for sample_y in range(y - radius, y + radius + 1)
        for sample_x in range(x - radius, x + radius + 1)
    ]
    return tuple(int(median(channel)) for channel in zip(*pixels))  # type: ignore[return-value]


def hex_for(rgb: Iterable[int]) -> str:
    return "#" + "".join(f"{value:02X}" for value in rgb)


def extract_palette(source: Path, radius: int) -> dict[str, object]:
    with Image.open(source) as opened:
        image = opened.convert("RGB")
        inks = []
        for ink_id, name, center in SWATCHES:
            rgb = median_patch_rgb(image, center, radius)
            inks.append(
                {
                    "id": ink_id,
                    "name": name,
                    "hex": hex_for(rgb),
                    "rgb": list(rgb),
                    "sampleCenter": list(center),
                },
            )
    return {
        "source": "User-supplied tattoo ink reference photograph; source image is not copied or modified.",
        "sampling": {
            "method": "channel-wise median RGB of a square foreground patch",
            "patchRadiusPx": radius,
            "colorSpace": "sRGB values decoded by Pillow",
        },
        "disclaimer": "Approximate screen colors observed under the reference lighting; not calibrated ink-color promises.",
        "inks": inks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="User-provided reference image")
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path("assets/event-brand/tattoo-ink-palette.json"),
        help="Derived JSON output (default: assets/event-brand/tattoo-ink-palette.json)",
    )
    parser.add_argument(
        "--patch-radius",
        type=int,
        default=8,
        help="Foreground square-patch radius in pixels (default: 8; 17x17 samples)",
    )
    args = parser.parse_args()
    palette = extract_palette(args.source, args.patch_radius)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(palette, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
