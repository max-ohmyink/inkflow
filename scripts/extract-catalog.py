#!/usr/bin/env python3
"""Extract the current simple-line catalog edit using the shared robust extractor.

Usage: python3 scripts/extract-catalog.py /absolute/path/to/catalog.pdf
Requires PyMuPDF and Pillow. The private source PDF is never bundled or distributed.
"""
from pathlib import Path
import subprocess
import sys

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    script = Path(__file__).resolve().with_name("extract-inspiration.py")
    subprocess.run([sys.executable, str(script), sys.argv[1]], check=True)
