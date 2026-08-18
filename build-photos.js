/**
 * Собирает photos.json: список фотографий галереи с размерами кадров.
 * Размеры нужны, чтобы браузер зарезервировал место и страница не дёргалась.
 *
 * Запуск: node build-photos.js
 */
const fs = require('fs');
const path = require('path');

const DIR = 'photos';
const OUT = 'photos.json';

/** Достаёт ширину и высоту из заголовка WebP. Без зависимостей. */
function webpSize(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' ||
      buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('не WebP');
  }
  const chunk = buf.toString('ascii', 12, 16);

  if (chunk === 'VP8 ') {
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return {
      w: (b & 0x3fff) + 1,
      h: ((b >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8X') {
    return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`не WebP: неизвестный чанк ${chunk}`);
}

function build() {
  if (!fs.existsSync(DIR)) {
    throw new Error(`нет папки ${DIR}`);
  }
  const photos = fs.readdirSync(DIR)
    .filter((name) => name.toLowerCase().endsWith('.webp'))
    .sort()
    .map((name) => {
      const file = path.join(DIR, name);
      const { w, h } = webpSize(fs.readFileSync(file));
      return { src: file, w, h };
    });

  fs.writeFileSync(OUT, JSON.stringify(photos, null, 2) + '\n');
  console.log(`${OUT}: ${photos.length} фото`);
}

module.exports = { webpSize, build };

if (require.main === module) {
  build();
}
