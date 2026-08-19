/**
 * Проверяет карточку ссылки (Open Graph).
 *
 * Первая версия сайта отдавала og:image относительным путём — краулер
 * Telegram картинку не нашёл и закэшировал пустое превью. Кэш мессенджера
 * чистится только вручную, поэтому такую ошибку важно ловить до выкладки.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Достаёт content указанного мета-тега. */
function meta(property) {
  const attr = property.startsWith('og:') ? 'property' : 'name';
  const re = new RegExp(
    `<meta\\s+${attr}="${property}"\\s+content="([^"]*)"`, 'i');
  const match = html.match(re);
  assert.ok(match, `в index.html нет мета-тега ${property}`);
  return match[1];
}

/** Читает размеры JPEG из маркера SOF. Без зависимостей. */
function jpegSize(buf) {
  assert.strictEqual(buf.readUInt16BE(0), 0xffd8, 'не JPEG');
  let i = 2;
  while (i < buf.length) {
    assert.strictEqual(buf[i], 0xff, `повреждённый JPEG на байте ${i}`);
    const marker = buf[i + 1];
    const length = buf.readUInt16BE(i + 2);
    // SOF0..SOF15, кроме DHT (c4), JPG (c8) и DAC (cc) — они не про размер
    if (marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error('в JPEG нет маркера SOF');
}

test('og:image и og:url абсолютные', () => {
  for (const tag of ['og:image', 'og:url', 'twitter:image']) {
    assert.match(meta(tag), /^https:\/\//,
      `${tag} должен быть полным адресом, иначе мессенджер не найдёт картинку`);
  }
});

test('файл обложки лежит на месте', () => {
  const file = path.join(ROOT, new URL(meta('og:image')).pathname.slice(1));
  assert.ok(fs.existsSync(file), `нет файла обложки ${file}`);
});

test('заявленные размеры обложки совпадают с реальными', () => {
  const file = path.join(ROOT, new URL(meta('og:image')).pathname.slice(1));
  const { w, h } = jpegSize(fs.readFileSync(file));
  assert.strictEqual(w, Number(meta('og:image:width')));
  assert.strictEqual(h, Number(meta('og:image:height')));
});

test('обложка вписывается в лимиты мессенджеров', () => {
  const file = path.join(ROOT, new URL(meta('og:image')).pathname.slice(1));
  const { w, h } = jpegSize(fs.readFileSync(file));
  const kb = fs.statSync(file).size / 1024;
  /* WhatsApp отбрасывает обложки тяжелее 300 KB, Telegram — тяжелее 5 MB.
     Соотношение около 1.91 (1200x630) — та пропорция, под которую
     свёрстана большая карточка во всех мессенджерах. */
  assert.ok(kb < 300, `обложка ${kb.toFixed(0)} KB, WhatsApp не покажет тяжелее 300 KB`);
  assert.ok(Math.abs(w / h - 1.91) < 0.05,
    `соотношение ${(w / h).toFixed(2)}, ожидается около 1.91`);
});
