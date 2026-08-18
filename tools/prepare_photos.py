#!/usr/bin/env python3
"""Сжимает исходные фотографии в WebP для галереи.

Использование:
    python3 tools/prepare_photos.py "media files" photos
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

MAX_SIDE = 1600
QUALITY = 82
SOURCES = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


def target_size(w, h, max_side=MAX_SIDE):
    """Размер после даунскейла по длинной стороне. Мелкие не увеличивает."""
    longest = max(w, h)
    if longest <= max_side:
        return (w, h)
    k = max_side / longest
    return (max(1, round(w * k)), max(1, round(h * k)))


def convert(src, dst, max_side=MAX_SIDE, quality=QUALITY):
    """Читает src, поворачивает по EXIF, сжимает в WebP без метаданных."""
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
        im = im.resize(target_size(*im.size, max_side), Image.LANCZOS)
        im.save(dst, "WEBP", quality=quality, method=6)


def main(src_dir, dst_dir):
    src_dir, dst_dir = Path(src_dir), Path(dst_dir)
    dst_dir.mkdir(exist_ok=True)
    sources = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in SOURCES)
    if not sources:
        raise SystemExit(f"В {src_dir} нет исходных фотографий")
    for i, src in enumerate(sources, start=1):
        dst = dst_dir / f"{i:02d}-{src.stem.lower()}.webp"
        convert(src, dst)
        kb = dst.stat().st_size / 1024
        print(f"{src.name} -> {dst.name}  {kb:.0f} KB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
