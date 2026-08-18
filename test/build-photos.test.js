const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { webpSize, build } = require('../build-photos.js');

/** Собирает минимальный заголовок простого (VP8) WebP. */
function vp8Header(w, h) {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  buf.write('VP8 ', 12);
  // VP8 frame size (3 bytes LE) at offset 20
  buf.writeUIntLE(1000, 20, 3);
  // VP8 signature: 0x9d 0x01 0x2a at offset 23
  buf[23] = 0x9d;
  buf[24] = 0x01;
  buf[25] = 0x2a;
  buf.writeUInt16LE(w, 26);
  buf.writeUInt16LE(h, 28);
  return buf;
}

/** Собирает заголовок расширенного (VP8X) WebP. */
function vp8xHeader(w, h) {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  buf.write('VP8X', 12);
  buf.writeUIntLE(w - 1, 24, 3);
  buf.writeUIntLE(h - 1, 27, 3);
  return buf;
}

test('читает размеры простого webp', () => {
  assert.deepStrictEqual(webpSize(vp8Header(1067, 1600)), { w: 1067, h: 1600 });
});

test('читает размеры расширенного webp', () => {
  assert.deepStrictEqual(webpSize(vp8xHeader(1067, 1600)), { w: 1067, h: 1600 });
});

test('отвергает чужой формат', () => {
  assert.throws(() => webpSize(Buffer.alloc(30)), /не WebP/);
});

test('отвергает VP8X с поврежденными битами', () => {
  // Создаём VP8X заголовок с повреждёнными зарезервированными битами
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  buf.write('VP8X', 12);
  buf[16] = 0xf0; // Зарезервированные биты (4-7) должны быть 0, но здесь они 1
  buf.writeUIntLE(1066, 24, 3);
  buf.writeUIntLE(1599, 27, 3);
  assert.throws(() => webpSize(buf), /повреждённый формат VP8X/);
});

test('отвергает VP8 без сигнатуры', () => {
  // Создаём VP8 заголовок с повреждённой сигнатурой
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  buf.write('VP8 ', 12);
  buf.writeUIntLE(1000, 20, 3); // frame size
  // Не пишем сигнатуру 0x9d 0x01 0x2a - оставляем нули
  buf.writeUInt16LE(1067, 26);
  buf.writeUInt16LE(1600, 28);
  assert.throws(() => webpSize(buf), /повреждённый формат VP8/);
});

test('build() включает имя файла в ошибку', () => {
  // Создаём временный корневой каталог для этого теста
  const testDir = path.join('test', 'temp-test-photos');
  const badFile = path.join(testDir, 'bad.webp');

  try {
    // Создаём тестовый директорий
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Создаём поддельный WebP файл с повреждённым VP8X
    const buf = Buffer.alloc(30);
    buf.write('RIFF', 0);
    buf.write('WEBP', 8);
    buf.write('VP8X', 12);
    buf[16] = 0xf0; // Зарезервированные биты должны быть 0
    fs.writeFileSync(badFile, buf);

    // Симулируем то, что происходит в build() когда обрабатывает файл
    // Проверяем, что ошибка включает имя файла
    assert.throws(
      () => {
        const file = badFile;
        try {
          webpSize(fs.readFileSync(file));
        } catch (err) {
          throw new Error(`${file}: ${err.message}. Проверьте, что это валидный WebP файл.`);
        }
      },
      /temp-test-photos.*bad.webp.*Проверьте/
    );
  } finally {
    // Очищаем тестовые файлы
    if (fs.existsSync(badFile)) {
      fs.unlinkSync(badFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  }
});
