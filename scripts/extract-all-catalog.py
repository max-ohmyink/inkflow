#!/usr/bin/env python3
"""Deterministically import genuine design image objects from the private catalog PDF.

This importer deliberately uses only PDF text/image geometry and source image alpha masks.
It does not render PDF pages, classify artwork with an AI/LLM, redraw any catalog material, or
copy the source PDF.  It works by looping PDF image objects on physical pages 5–54, rejecting
only reusable page decoration by configured visible-bound geometry, and associating remaining
objects with a nearby, actual PDF caption.  The listed Mandala exclusions are text/geometry
rules, not visual inference.

Usage:
    python3 scripts/extract-all-catalog.py /absolute/path/to/catalog.pdf
    python3 scripts/extract-all-catalog.py /absolute/path/to/catalog.pdf --diagnose

Requires PyMuPDF and Pillow.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import re
import shutil
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz
from PIL import Image


# The template's true page frame is the full visible 640×800 source object at approximately
# (14, 72)–(583, 783). The colored background sits beyond all A4 edges. These bounds are
# deliberately loose enough that large catalog designs are retained: they only reject the
# repeated template frame/background, a tiny header logo, and objects wholly below the footer.
PAGE_WIDTH = 595.5
PAGE_HEIGHT = 842.25
CONTENT_Y_MIN = 108.0
CONTENT_Y_MAX = 790.0
MANDALA_TERMS = ("mandala", "曼陀羅", "曼荼羅")
KNOWN_VISUALLY_MANDALA_LIKE = {(32, "line art design v.5")}

# Existing source-pair identities remain stable so saved style references keep resolving.
# The keys include the physical PDF page and caption text; xref is validated when encountered.
EXISTING_COMPATIBILITY: dict[tuple[int, str], dict[str, str]] = {
    (35, "fine line tulip"): {"id": "fine-line-tulip", "filename": "fine-line-tulip.png", "style": "fine_line"},
    (34, "fine line flower"): {"id": "fine-line-flower", "filename": "fine-line-flower.png", "style": "fine_line"},
    (34, "fine line rose 1"): {"id": "fine-line-rose-1", "filename": "fine-line-rose-1.png", "style": "fine_line"},
    (34, "fine line rose 2"): {"id": "fine-line-rose-2", "filename": "fine-line-rose-2.png", "style": "fine_line"},
    (23, "heart with arrow"): {"id": "heart-with-arrow", "filename": "heart-with-arrow.png", "style": "traditional"},
    (23, "heart-shaped clip"): {"id": "heart-shaped-clip", "filename": "heart-shaped-clip.png", "style": "geometric"},
    (26, "melted smile"): {"id": "melted-smile", "filename": "melted-smile.png", "style": "traditional"},
    (26, "melted smile 1"): {"id": "melted-smile-1", "filename": "melted-smile-1.png", "style": "traditional"},
    (26, "smile daisy"): {"id": "smile-daisy", "filename": "smile-daisy.png", "style": "traditional"},
    (26, "ribbon"): {"id": "ribbon", "filename": "ribbon.png", "style": "cyber"},
    (20, "moon with leaf"): {"id": "moon-with-leaf", "filename": "moon-with-leaf.png", "style": "fine_line"},
    (25, "dog balloon"): {"id": "dog-balloon", "filename": "dog-balloon.png", "style": "geometric"},
}
EXISTING_EXPECTED_XREF = {
    "fine-line-tulip": 2394, "fine-line-flower": 2383, "fine-line-rose-1": 2379,
    "fine-line-rose-2": 2380, "heart-with-arrow": 2197, "heart-shaped-clip": 2198,
    "melted-smile": 2241, "melted-smile-1": 2242, "smile-daisy": 2245,
    "ribbon": 2237, "moon-with-leaf": 2149, "dog-balloon": 2223,
}


@dataclass(frozen=True)
class TextLine:
    text: str
    rect: fitz.Rect


@dataclass(frozen=True)
class SourceBounds:
    width: int
    height: int
    alpha_bbox: tuple[int, int, int, int] | None


@dataclass(frozen=True)
class ImagePlacement:
    item: tuple
    placement: fitz.Rect
    visible: fitz.Rect


@dataclass
class Candidate:
    page: int
    header: str
    category: str
    item: tuple
    placement: fitz.Rect
    visible: fitz.Rect
    caption: TextLine | None
    score: float | None


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def slugify(value: str) -> str:
    # ASCII slugs are stable in JSON/filenames while the original caption remains in title/concept.
    folded = value.casefold().replace("&", " and ")
    ascii_value = folded.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return slug or "catalog-design"


def markdown_escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def text_lines(page: fitz.Page) -> list[TextLine]:
    result: list[TextLine] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = re.sub(r"\s+", " ", "".join(span.get("text", "") for span in line.get("spans", ""))).strip()
            if text:
                result.append(TextLine(text, fitz.Rect(line["bbox"])))
    return result


def collection_header(lines: list[TextLine], page_number: int) -> str:
    """Use the actual top-of-page catalog header, never a made-up collection title."""
    headers = [
        line for line in lines
        if line.rect.y0 < 115
        and not normalized(line.text).startswith("available in")
        and not normalized(line.text).startswith("#seebeforeyouink")
    ]
    if len(headers) != 1:
        raise RuntimeError(
            f"Expected exactly one source collection header on page {page_number}; "
            f"found {[line.text for line in headers]}"
        )
    return headers[0].text


def body_captions(lines: list[TextLine]) -> list[TextLine]:
    captions: list[TextLine] = []
    for line in lines:
        key = normalized(line.text)
        if line.rect.y0 < CONTENT_Y_MIN or line.rect.y0 > CONTENT_Y_MAX:
            continue
        if key.startswith("available in") or key.startswith("#seebeforeyouink"):
            continue
        captions.append(line)
    return captions


def source_image(pdf: fitz.Document, item: tuple) -> Image.Image:
    """Extract the genuine PDF source object and apply its soft alpha mask, if any."""
    pix = fitz.Pixmap(pdf, item[0])
    smask_xref = item[1]
    if smask_xref:
        pix = fitz.Pixmap(pix, fitz.Pixmap(pdf, smask_xref))
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")


def cached_bounds(pdf: fitz.Document, item: tuple, cache: dict[int, SourceBounds]) -> SourceBounds:
    """Decode each source xref only once during page geometry scanning (large PDF objects included)."""
    xref = item[0]
    prior = cache.get(xref)
    if prior is not None:
        return prior
    image = source_image(pdf, item)
    bbox = image.getchannel("A").getbbox()
    entry = SourceBounds(image.width, image.height, bbox)
    cache[xref] = entry
    return entry


def image_rects(pdf: fitz.Document, page: fitz.Page, bounds_cache: dict[int, SourceBounds]) -> Iterable[ImagePlacement]:
    seen: set[tuple[int, float, float, float, float]] = set()
    for item in page.get_images(full=True):
        source = cached_bounds(pdf, item, bounds_cache)
        if source.alpha_bbox is None:
            continue
        x0, y0, x1, y1 = source.alpha_bbox
        for placement in page.get_image_rects(item[0]):
            key = (item[0], round(placement.x0, 3), round(placement.y0, 3), round(placement.x1, 3), round(placement.y1, 3))
            if key in seen:
                continue
            seen.add(key)
            visible = fitz.Rect(
                placement.x0 + placement.width * x0 / source.width,
                placement.y0 + placement.height * y0 / source.height,
                placement.x0 + placement.width * x1 / source.width,
                placement.y0 + placement.height * y1 / source.height,
            )
            yield ImagePlacement(item, placement, visible)


def is_page_decoration(candidate: ImagePlacement) -> bool:
    """Reject only non-design template imagery using its alpha-bounded page geometry."""
    rect = candidate.visible
    # Canva background extends through all page edges.
    if rect.x0 <= 1 and rect.y0 <= 1 and rect.x1 >= PAGE_WIDTH - 1 and rect.y1 >= PAGE_HEIGHT - 1:
        return True
    # Repeated #SEEBEFOREYOUINK page-frame object: full content slab, not artwork.
    if rect.x0 <= 20 and 60 <= rect.y0 <= 85 and rect.x1 >= PAGE_WIDTH - 15 and 760 <= rect.y1 <= 795:
        return True
    # Header logo and footer-only decorations. Art is intentionally not width/height limited.
    if rect.y1 < 120 and rect.width < 120 and rect.height < 90:
        return True
    if rect.y0 > 790:
        return True
    # Guard against remaining edge-cap texture that spans most of both page dimensions.
    if rect.width > PAGE_WIDTH * 0.92 and rect.height > PAGE_HEIGHT * 0.78:
        return True
    return False


def is_fallback_collection(header: str) -> bool:
    return header.startswith("Fluffy Friends:") or header in {"The Beautiful Game", "The 7s Game"}


def caption_match(placement: ImagePlacement, captions: list[TextLine]) -> tuple[TextLine | None, float | None]:
    """Associate a text caption by on-page geometry, favoring the label under the source art."""
    best: tuple[float, TextLine] | None = None
    contained: tuple[float, TextLine] | None = None
    cx = (placement.visible.x0 + placement.visible.x1) / 2
    for caption in captions:
        ccx = (caption.rect.x0 + caption.rect.x1) / 2
        ccy = (caption.rect.y0 + caption.rect.y1) / 2
        dx = abs(cx - ccx)
        # A few catalog layouts place the PDF text label over its large source object.
        # This is still a pure geometry association and takes precedence over the next
        # caption below; 15 pt tolerance covers font/alpha-bound differences only.
        outside_x = max(placement.visible.x0 - ccx, 0, ccx - placement.visible.x1)
        outside_y = max(placement.visible.y0 - ccy, 0, ccy - placement.visible.y1)
        if outside_x <= 15 and outside_y <= 15:
            score = outside_x * 4 + outside_y * 4 + dx * 0.01
            if contained is None or score < contained[0]:
                contained = (score, caption)
            continue
        dy = caption.rect.y0 - placement.visible.y1
        # Captions normally sit below artwork. Small overlap covers intended label overlays only.
        if dy < -42 or dy > 238:
            continue
        allowed_dx = max(150.0, (placement.visible.width + caption.rect.width) / 2 + 70.0)
        if dx > allowed_dx:
            continue
        score = dx * 2.2 + max(dy, 0) + max(-dy, 0) * 4.0
        if best is None or score < best[0]:
            best = (score, caption)
    if contained is not None:
        return contained[1], contained[0]
    return (best[1], best[0]) if best else (None, None)


def keep_best_placement_per_xref(candidates: list[Candidate]) -> list[Candidate]:
    """A repeated PDF xref has identical source pixels; retain its strongest geometric occurrence once."""
    per_xref: dict[int, Candidate] = {}
    for candidate in candidates:
        xref = candidate.item[0]
        current = per_xref.get(xref)
        rank = (
            0 if candidate.caption is not None else 1,
            candidate.score if candidate.score is not None else float("inf"),
            candidate.visible.y0,
            candidate.visible.x0,
        )
        if current is None:
            per_xref[xref] = candidate
            continue
        current_rank = (
            0 if current.caption is not None else 1,
            current.score if current.score is not None else float("inf"),
            current.visible.y0,
            current.visible.x0,
        )
        if rank < current_rank:
            per_xref[xref] = candidate
    return sorted(per_xref.values(), key=lambda c: (c.visible.y0, c.visible.x0, c.item[0]))


def contains_mandala(value: str) -> bool:
    value = value.casefold()
    return any(term in value for term in MANDALA_TERMS)


def normalized_square(image: Image.Image) -> Image.Image:
    """Trim only alpha-empty margins, center authentic pixels on white square, downscale if needed."""
    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise RuntimeError("Selected source object has no visible pixels after alpha-mask extraction")
    trimmed = image.crop(alpha_bbox)
    side = math.ceil(max(trimmed.size) * 1.18)
    if side > 720:
        scale = 720 / side
        trimmed = trimmed.resize(
            (max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale))),
            Image.Resampling.LANCZOS,
        )
        side = 720
    canvas = Image.new("RGBA", (side, side), "white")
    canvas.alpha_composite(trimmed, ((side - trimmed.width) // 2, (side - trimmed.height) // 2))
    return canvas


def keywords_for(title: str, collection: str, category: str, existing_id: str | None) -> list[str]:
    if existing_id:
        # Preserve prior useful keyword vocabulary for saved style references, plus collection category.
        legacy = {
            "fine-line-tulip": ["fine_line", "tulip", "florals"],
            "fine-line-flower": ["fine_line", "flower", "florals"],
            "fine-line-rose-1": ["fine_line", "rose", "florals"],
            "fine-line-rose-2": ["fine_line", "rose", "florals"],
            "heart-with-arrow": ["heart", "arrow", "hearts"],
            "heart-shaped-clip": ["heart", "clip", "hearts"],
            "melted-smile": ["melted", "smile", "playful"],
            "melted-smile-1": ["melted", "smile", "playful"],
            "smile-daisy": ["smile", "daisy", "playful"],
            "ribbon": ["ribbon", "playful"],
            "moon-with-leaf": ["moon", "leaf", "symbols"],
            "dog-balloon": ["dog", "balloon", "symbols"],
        }
        return legacy[existing_id] + [category]
    tokens = re.findall(r"[a-z0-9]+", f"{title} {collection}".casefold())
    return list(dict.fromkeys([category, *tokens]))


def unique_id(base: str, page: int, xref: int, used: set[str]) -> str:
    value = base
    if value in used:
        value = f"{base}-p{page}-x{xref}"
    while value in used:
        value = f"{value}-x{xref}"
    used.add(value)
    return value


def write_typescript(path: Path, records: list[dict]) -> None:
    lines = [
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "export const CATALOG_ARTWORK: Record<string, ImageSourcePropType> = {",
    ]
    lines.extend(f"  {record['id']!r}: require('./{record['filename']}')," for record in records)
    lines.extend(["};", ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def page_summary(page_states: dict[int, dict], records: list[dict]) -> list[dict]:
    by_page: dict[int, list[dict]] = defaultdict(list)
    for record in records:
        by_page[record["page"]].append(record)
    summaries = []
    for page in range(5, 55):
        state = page_states[page]
        items = by_page[page]
        summaries.append({
            "page": page,
            "collection": state["header"],
            "status": state["status"],
            "reason": state.get("reason"),
            "records": len(items),
            "captioned": sum(not item.get("titleIsGenerated", False) for item in items),
            "unlabeled": sum(item.get("titleIsGenerated", False) for item in items),
            "excluded": state.get("excluded", 0),
        })
    return summaries


def write_provenance(path: Path, source_pdf: Path, records: list[dict], summaries: list[dict]) -> None:
    rows = [
        "# Catalog inspiration provenance",
        "",
        "All assets in `assets/catalog/inspiration/` were deterministically extracted from the "
        "user-authorized private PDF named below. The confidential PDF is **not copied, included, "
        "or distributed** by this import.",
        "",
        f"- **Authorized local source:** `{source_pdf}`",
        "- **Importer:** `scripts/extract-all-catalog.py`",
        "- **Source scope:** physical PDF pages 5–54; whole page 21 and every `mandala` / "
        "`曼陀羅` / `曼荼羅` header or caption are excluded; page 32 `Line Art Design v.5` is also excluded.",
        "",
        "## Pixel-preserving method",
        "",
        "The importer loops PDF image objects and uses only PDF text/image geometry. It caches alpha "
        "bounds per xref, applies each source soft mask, rejects the full-page background, repeated "
        "template frame, header logo, footer-only objects, and edge-cap texture by visible bounds. "
        "It does **not** render pages, use an LLM/AI classifier, redraw, screenshot, or synthesize art. "
        "For each retained source object, it trims alpha-empty outer margins, centers the unchanged "
        "pixels on a white square canvas, and downscales only when needed to a 720 px maximum side.",
        "",
        "Titles/concepts are exact PDF captions when one is geometrically associated. Uncaptioned "
        "Fluffy Friends and sports source objects retain an explicit `Collection · Design N` fallback "
        "and `titleIsGenerated: true`; no invented source caption is claimed.",
        "",
        "## Page coverage",
        "",
        "| PDF page | Collection header from PDF | Status | Records | Captioned | Unlabeled fallback | Reason |",
        "|---:|---|---|---:|---:|---:|---|",
    ]
    for summary in summaries:
        rows.append(
            f"| {summary['page']} | {markdown_escape(summary['collection'])} | {summary['status']} | "
            f"{summary['records']} | {summary['captioned']} | {summary['unlabeled']} | "
            f"{markdown_escape(summary.get('reason') or '')} |"
        )
    rows.extend([
        "",
        "## Source-object register",
        "",
        "| ID | Exact title / transparent fallback | Collection | Page | Source image xref | Generated title? |",
        "|---|---|---|---:|---:|---|",
    ])
    for record in records:
        rows.append(
            f"| `{record['id']}` | {markdown_escape(record['title'])} | "
            f"{markdown_escape(record['collection'])} | {record['page']} | {record['sourceXref']} | "
            f"{'yes' if record.get('titleIsGenerated') else 'no'} |"
        )
    rows.append("")
    path.write_text("\n".join(rows), encoding="utf-8")


def write_import_report(path: Path, source_pdf: Path, records: list[dict], summaries: list[dict]) -> None:
    by_collection: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        by_collection[record["collection"]].append(record)
    source_xrefs = sorted({record["sourceXref"] for record in records})
    excluded_pages = [summary for summary in summaries if summary["status"] == "excluded"]
    rows = [
        "# Catalog import report",
        "",
        "## Result",
        "",
        f"- **Imported records:** {len(records)}",
        f"- **PNG assets:** {len(records)}",
        f"- **Unique source image xrefs:** {len(source_xrefs)}",
        f"- **Captioned records:** {sum(not record.get('titleIsGenerated', False) for record in records)}",
        f"- **Generated transparent fallback titles:** {sum(record.get('titleIsGenerated', False) for record in records)}",
        f"- **Source file excluded from output:** `{source_pdf}` (private PDF; no copy is shipped)",
        "",
        "## Collection coverage and counts",
        "",
        "| Collection header from PDF | Stable category slug | Pages | Records | Captioned | Unlabeled fallback | Unique xrefs |",
        "|---|---|---|---:|---:|---:|---:|",
    ]
    for collection, items in sorted(by_collection.items(), key=lambda pair: min(item["page"] for item in pair[1])):
        pages = sorted({item["page"] for item in items})
        rows.append(
            f"| {markdown_escape(collection)} | `{items[0]['category']}` | "
            f"{', '.join(map(str, pages))} | {len(items)} | "
            f"{sum(not item.get('titleIsGenerated', False) for item in items)} | "
            f"{sum(item.get('titleIsGenerated', False) for item in items)} | "
            f"{len({item['sourceXref'] for item in items})} |"
        )
    rows.extend([
        "",
        "## Page coverage / explicit exclusions",
        "",
        "| Page | Collection | Status | Imported | Excluded source objects | Reason / issue |",
        "|---:|---|---|---:|---:|---|",
    ])
    for summary in summaries:
        rows.append(
            f"| {summary['page']} | {markdown_escape(summary['collection'])} | {summary['status']} | "
            f"{summary['records']} | {summary['excluded']} | {markdown_escape(summary.get('reason') or '')} |"
        )
    rows.extend([
        "",
        "## Excluded source files and source objects",
        "",
        f"- **Source PDF:** `{source_pdf}` — excluded from app assets and reports other than this provenance pointer.",
        "- **Page 21:** whole `Sacred Geometry | Mandala` collection excluded.",
        "- **Text exclusion:** any source object whose actual collection header or associated caption contains "
        "`mandala`, `曼陀羅`, or `曼荼羅` is excluded.",
        "- **Known visual exception:** page 32 caption `Line Art Design v.5` is excluded as specified.",
        "- **Template decoration:** full-page background, repeated page frame/footer, small header logo, footer-only "
        "objects, and page-edge background texture are rejected by visible bounds; no page screenshots are used.",
        "",
        "## Source-xref register",
        "",
        "The full per-record source mapping is in `docs/inspiration-provenance.md`. This is the unique xref ID set "
        "represented in the app metadata:",
        "",
        "```text",
        ", ".join(map(str, source_xrefs)),
        "```",
        "",
    ])
    path.write_text("\n".join(rows), encoding="utf-8")


def stage_and_replace(output: Path, docs: Path, records: list[dict], pdf: fitz.Document,
                      selected: list[Candidate], source_pdf: Path, summaries: list[dict]) -> None:
    """Stage every new PNG/map/report first; only then replace maps and assets in safe order."""
    output.mkdir(parents=True, exist_ok=True)
    docs.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".catalog-stage-", dir=output))
    staged_assets = stage / "assets"
    staged_docs = stage / "docs"
    staged_assets.mkdir()
    staged_docs.mkdir()
    by_key = {(candidate.page, candidate.item[0]): candidate for candidate in selected}
    try:
        for record in records:
            candidate = by_key[(record["page"], record["sourceXref"])]
            square = normalized_square(source_image(pdf, candidate.item))
            square.save(staged_assets / record["filename"], format="PNG")
        (staged_assets / "catalog-items.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        write_typescript(staged_assets / "artwork.ts", records)
        write_provenance(staged_docs / "inspiration-provenance.md", source_pdf, records, summaries)
        write_import_report(staged_docs / "catalog-import-report.md", source_pdf, records, summaries)

        expected = {record["filename"] for record in records} | {"catalog-items.json", "artwork.ts"}
        staged = {path.name for path in staged_assets.iterdir()}
        if staged != expected:
            raise RuntimeError(f"Staged asset set mismatch: expected {len(expected)}, got {len(staged)}")
        if len({record["id"] for record in records}) != len(records):
            raise RuntimeError("Record IDs are not unique")
        if len({(record["page"], record["sourceXref"]) for record in records}) != len(records):
            raise RuntimeError("More than one record points to the same page/xref source pair")

        # PNGs first: old artwork.ts always resolves through the whole swap. Then atomically replace
        # metadata/map; never remove current PNGs while Metro could still read its old import map.
        for filename in sorted(record["filename"] for record in records):
            os.replace(staged_assets / filename, output / filename)
        os.replace(staged_assets / "catalog-items.json", output / "catalog-items.json")
        os.replace(staged_assets / "artwork.ts", output / "artwork.ts")
        os.replace(staged_docs / "inspiration-provenance.md", docs / "inspiration-provenance.md")
        os.replace(staged_docs / "catalog-import-report.md", docs / "catalog-import-report.md")
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def import_catalog(pdf_path: Path, *, diagnose: bool) -> tuple[list[dict], list[Candidate], list[dict]]:
    bounds_cache: dict[int, SourceBounds] = {}
    records: list[dict] = []
    selected: list[Candidate] = []
    page_states: dict[int, dict] = {}
    used_ids: set[str] = set()

    with fitz.open(pdf_path) as pdf:
        if pdf.page_count < 54:
            raise RuntimeError(f"Expected at least 54 PDF pages, found {pdf.page_count}")
        for page_number in range(5, 55):
            page = pdf[page_number - 1]
            lines = text_lines(page)
            header = collection_header(lines, page_number)
            category = slugify(header)
            page_states[page_number] = {"header": header, "status": "covered", "excluded": 0}

            if page_number == 21:
                page_states[page_number].update({
                    "status": "excluded",
                    "reason": "Whole Mandala collection excluded by instruction.",
                })
                continue
            if contains_mandala(header):
                page_states[page_number].update({
                    "status": "excluded",
                    "reason": "Collection header contains a Mandala exclusion term.",
                })
                continue

            captions = body_captions(lines)
            raw: list[Candidate] = []
            for placement in image_rects(pdf, page, bounds_cache):
                if is_page_decoration(placement):
                    continue
                caption, score = caption_match(placement, captions)
                # Text rule is applied before any record gets a fallback. Captions use exact PDF text.
                if caption and contains_mandala(caption.text):
                    page_states[page_number]["excluded"] += 1
                    continue
                if caption and (page_number, normalized(caption.text)) in KNOWN_VISUALLY_MANDALA_LIKE:
                    page_states[page_number]["excluded"] += 1
                    continue
                raw.append(Candidate(page_number, header, category, placement.item, placement.placement,
                                     placement.visible, caption, score))

            fallback = is_fallback_collection(header)
            if not fallback:
                # Ordinary collections never receive made-up labels. PDF compositions can include
                # uncaptioned companion layers; only the alpha-bounded source object geometrically
                # tied to an actual catalog caption becomes a standalone design record. The named
                # Fluffy Friends/sports exception below instead retains all real object sources.
                raw = [candidate for candidate in raw if candidate.caption is not None]
            candidates = keep_best_placement_per_xref(raw)
            if not candidates:
                raise RuntimeError(f"No genuine source-art objects retained on covered page {page_number} ({header!r})")

            for sequence, candidate in enumerate(candidates, start=1):
                title_is_generated = fallback
                if fallback:
                    title = f"{header} · Design {sequence}"
                else:
                    assert candidate.caption is not None
                    title = candidate.caption.text
                key = (page_number, normalized(title))
                compat = EXISTING_COMPATIBILITY.get(key)
                if compat:
                    record_id = compat["id"]
                    expected_xref = EXISTING_EXPECTED_XREF[record_id]
                    if candidate.item[0] != expected_xref:
                        raise RuntimeError(
                            f"Compatibility source pair changed for {record_id}: expected xref {expected_xref}, "
                            f"got {candidate.item[0]} on page {page_number}"
                        )
                    if record_id in used_ids:
                        raise RuntimeError(f"Compatibility ID collision for {record_id}")
                    used_ids.add(record_id)
                    filename = compat["filename"]
                    style = compat["style"]
                else:
                    record_id = unique_id(slugify(title), page_number, candidate.item[0], used_ids)
                    filename = f"{record_id}.png"
                    style = "fine_line"
                record = {
                    "id": record_id,
                    "title": title,
                    "category": category,
                    "collection": header,
                    "page": page_number,
                    "filename": filename,
                    "concept": title,
                    "style": style,
                    "keywords": keywords_for(title, header, category, compat["id"] if compat else None),
                    "sourceXref": candidate.item[0],
                }
                if title_is_generated:
                    record["titleIsGenerated"] = True
                records.append(record)
                selected.append(candidate)

        # All old stable identities must still be found in their original PDF source pair.
        missing_compat = sorted(set(EXISTING_EXPECTED_XREF) - {record["id"] for record in records})
        if missing_compat:
            raise RuntimeError(f"Missing compatibility records: {missing_compat}")
        summaries = page_summary(page_states, records)
        covered_problems = [summary for summary in summaries if summary["status"] == "covered" and summary["records"] == 0]
        if covered_problems:
            raise RuntimeError(f"Missing page coverage: {covered_problems}")

        if diagnose:
            for summary in summaries:
                print(
                    f"page={summary['page']} status={summary['status']} records={summary['records']} "
                    f"captioned={summary['captioned']} unlabeled={summary['unlabeled']} "
                    f"collection={summary['collection']!r} reason={summary.get('reason') or ''}"
                )
            print(f"records={len(records)} unique_xrefs={len({r['sourceXref'] for r in records})} bounds_cache={len(bounds_cache)}")
            return records, selected, summaries

        root = Path(__file__).resolve().parent.parent
        stage_and_replace(root / "assets" / "catalog" / "inspiration", root / "docs", records, pdf,
                          selected, pdf_path, summaries)
        print(f"Imported {len(records)} records ({len({r['sourceXref'] for r in records})} unique xrefs).")
        print(f"Assets: {root / 'assets' / 'catalog' / 'inspiration'}")
        print(f"Reports: {root / 'docs' / 'inspiration-provenance.md'}, {root / 'docs' / 'catalog-import-report.md'}")
        return records, selected, summaries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Authorized local catalog PDF")
    parser.add_argument("--diagnose", action="store_true", help="Validate/print coverage without writing outputs")
    args = parser.parse_args()
    if not args.pdf.is_file():
        raise FileNotFoundError(f"Catalog PDF not found: {args.pdf}")
    import_catalog(args.pdf, diagnose=args.diagnose)


if __name__ == "__main__":
    main()
