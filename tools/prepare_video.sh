#!/bin/bash
# Готовит hero-видео и постер-кадр из исходника.
# Использование: bash tools/prepare_video.sh "media files/showreel.mp4"
set -euo pipefail

SRC="${1:?укажите путь к исходному видео}"
OUT_DIR="video"
FFMPEG="tools/bin/ffmpeg"
TARGET_MB=6
BITRATE_K=2900        # 15,8 с при 2900 кбит/с ≈ 5,7 МБ

if [ ! -x "$FFMPEG" ]; then
  echo "Нет $FFMPEG. Скачать: curl -L -o f.zip https://evermeet.cx/ffmpeg/getrelease/zip"
  exit 1
fi

mkdir -p "$OUT_DIR"
PASSLOG=$(mktemp -t ffpass)

encode() {
  local rate="$1"
  "$FFMPEG" -y -loglevel error -i "$SRC" -an \
    -c:v libx264 -preset slow -profile:v high -level 4.0 -pix_fmt yuv420p \
    -b:v "${rate}k" -passlogfile "$PASSLOG" -pass 1 -f mp4 /dev/null
  "$FFMPEG" -y -loglevel error -i "$SRC" -an \
    -c:v libx264 -preset slow -profile:v high -level 4.0 -pix_fmt yuv420p \
    -b:v "${rate}k" -passlogfile "$PASSLOG" -pass 2 \
    -movflags +faststart "$OUT_DIR/hero.mp4"
}

echo "Кодирую при ${BITRATE_K} кбит/с, два прохода..."
encode "$BITRATE_K"
SIZE=$(stat -f%z "$OUT_DIR/hero.mp4")

# Если промахнулись мимо бюджета — пересчитать битрейт по факту и повторить.
if [ "$SIZE" -gt $((TARGET_MB * 1024 * 1024)) ]; then
  NEW=$((BITRATE_K * TARGET_MB * 1024 * 1024 / SIZE * 95 / 100))
  echo "Вышло $((SIZE / 1024 / 1024)) МБ, повторяю при ${NEW} кбит/с..."
  encode "$NEW"
  SIZE=$(stat -f%z "$OUT_DIR/hero.mp4")
fi

rm -f "${PASSLOG}"*
echo "Итог: $((SIZE / 1024 / 1024)) МБ"

echo "Достаю постер-кадр с 4-й секунды..."
TMP=$(mktemp -d)
"$FFMPEG" -y -loglevel error -ss 4 -i "$OUT_DIR/hero.mp4" -frames:v 1 "$TMP/frame.png"
python3 -c "
from PIL import Image
Image.open('$TMP/frame.png').convert('RGB').save(
    '$OUT_DIR/poster.webp', 'WEBP', quality=80, method=6)
"
rm -rf "$TMP"

ls -la "$OUT_DIR"
