#!/bin/bash
# Готовит hero-видео и постер-кадр из исходника.
# Использование: bash tools/prepare_video.sh "media files/showreel.mp4"
set -euo pipefail

SRC="${1:?укажите путь к исходному видео}"
OUT_DIR="video"
FFMPEG="tools/bin/ffmpeg"
TARGET_MB=6
BITRATE_K=1400        # 15,8 с при 1400 кбит/с ≈ 2,7 МБ
FPS=25                # исходник 50 к/с; для фонового зацикленного ролика это
                      # вдвое больше нужного, а битрейт съедает ровно вдвое

if [ ! -x "$FFMPEG" ]; then
  echo "Нет $FFMPEG. Скачать: curl -L -o f.zip https://evermeet.cx/ffmpeg/getrelease/zip"
  exit 1
fi

mkdir -p "$OUT_DIR"
PASSLOG=$(mktemp -t ffpass)
TMP=""
trap 'rm -f "${PASSLOG}"*; [ -n "$TMP" ] && rm -rf "$TMP"' EXIT

encode() {
  local rate="$1"
  "$FFMPEG" -y -loglevel error -i "$SRC" -an \
    -r "$FPS" -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p \
    -b:v "${rate}k" -passlogfile "$PASSLOG" -pass 1 -f mp4 /dev/null
  "$FFMPEG" -y -loglevel error -i "$SRC" -an \
    -r "$FPS" -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p \
    -b:v "${rate}k" -passlogfile "$PASSLOG" -pass 2 \
    -movflags +faststart "$OUT_DIR/hero.mp4"
}

size_mb() {
  awk -v b="$1" 'BEGIN { printf "%.1f", b / 1024 / 1024 }'
}

echo "Кодирую при ${BITRATE_K} кбит/с, два прохода..."
encode "$BITRATE_K"
SIZE=$(stat -f%z "$OUT_DIR/hero.mp4")

# Если промахнулись мимо бюджета — пересчитать битрейт по факту и повторить.
if [ "$SIZE" -gt $((TARGET_MB * 1024 * 1024)) ]; then
  NEW=$((BITRATE_K * TARGET_MB * 1024 * 1024 / SIZE * 95 / 100))
  echo "Вышло $(size_mb "$SIZE") МБ, повторяю при ${NEW} кбит/с..."
  encode "$NEW"
  SIZE=$(stat -f%z "$OUT_DIR/hero.mp4")
fi

if [ "$SIZE" -gt $((TARGET_MB * 1024 * 1024)) ]; then
  echo "ОШИБКА: итог $(size_mb "$SIZE") МБ — превышает бюджет ${TARGET_MB} МБ" >&2
  exit 1
fi
echo "Итог: $(size_mb "$SIZE") МБ"

echo "Достаю постер-кадр с 4-й секунды..."
TMP=$(mktemp -d)
"$FFMPEG" -y -loglevel error -ss 4 -i "$OUT_DIR/hero.mp4" -frames:v 1 "$TMP/frame.png"
python3 -c "
from PIL import Image
Image.open('$TMP/frame.png').convert('RGB').save(
    '$OUT_DIR/poster.webp', 'WEBP', quality=80, method=6)
"

ls -la "$OUT_DIR"
