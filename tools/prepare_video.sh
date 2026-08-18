#!/bin/bash
# Готовит hero-видео и постер-кадр из исходника.
# Использование: bash tools/prepare_video.sh "media files/showreel.mp4"
set -euo pipefail

SRC="${1:?укажите путь к исходному видео}"
OUT_DIR="video"
LIMIT_BYTES=$((6 * 1024 * 1024))

mkdir -p "$OUT_DIR"

echo "Кодирую 1080p, двухпроходно..."
avconvert --source "$SRC" --output "$OUT_DIR/hero.mp4" \
  --preset Preset1920x1080 --multiPass --replace --progress

SIZE=$(stat -f%z "$OUT_DIR/hero.mp4")
echo "Размер: $((SIZE / 1024 / 1024)) MB"

if [ "$SIZE" -gt "$LIMIT_BYTES" ]; then
  echo "Больше 6 МБ — пересобираю в 720p..."
  avconvert --source "$SRC" --output "$OUT_DIR/hero.mp4" \
    --preset Preset1280x720 --multiPass --replace --progress
  SIZE=$(stat -f%z "$OUT_DIR/hero.mp4")
  echo "Размер: $((SIZE / 1024 / 1024)) MB"
fi

echo "Достаю постер-кадр..."
TMP=$(mktemp -d)
qlmanage -t -s 1920 -o "$TMP" "$OUT_DIR/hero.mp4" >/dev/null 2>&1
python3 -c "
import glob, sys
from PIL import Image
src = glob.glob('$TMP/*.png')
if not src:
    sys.exit('qlmanage не отдал кадр — сними стоп-кадр вручную в QuickTime')
Image.open(src[0]).convert('RGB').save('$OUT_DIR/poster.webp', 'WEBP', quality=80, method=6)
"
rm -rf "$TMP"

ls -la "$OUT_DIR"
