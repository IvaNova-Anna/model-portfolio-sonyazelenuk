const test = require('node:test');
const assert = require('node:assert');
const { webpSize } = require('../build-photos.js');

/** Собирает минимальный заголовок простого (VP8) WebP. */
function vp8Header(w, h) {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  buf.write('VP8 ', 12);
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
