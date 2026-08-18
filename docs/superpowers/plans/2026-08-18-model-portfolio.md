# Сайт-портфолио модели — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одностраничный сайт-портфолио модели: видео-баннер, галерея с лайтбоксом, компкарт, кнопка Telegram — опубликованный на Netlify.

**Architecture:** Статика без сборщиков и фреймворков. Четыре файла в браузере (`index.html`, `style.css`, `app.js`, `content.js`), два инструмента для подготовки медиа (Python + Pillow, системный `avconvert`) и один генератор `photos.json`, запускаемый Netlify при сборке.

**Tech Stack:** HTML, CSS, vanilla JS (ESM), Node 24 (только для `build-photos.js` и тестов), Python 3 + Pillow 11.3, `avconvert` и `qlmanage` из macOS, Netlify.

## Global Constraints

- Язык всего контента сайта — **только английский**
- Контакты — **только Telegram**, телефон не публикуется
- Видео: H.264 MP4, **≤6 МБ**, длительность ≤15 с, без звука на слух (`muted`)
- Фото: WebP, длинная сторона 1600 px, качество 82, ожидаемо 200–400 КБ
- Никаких сторонних библиотек в браузере и никаких npm-зависимостей
- Mobile-first: обязательная проверка в окне шириной **375 px**
- Тёмная editorial-палитра: почти чёрный фон, много воздуха
- Одна правка = один коммит с осмысленным сообщением
- Исходники в `media files/` — вне репозитория (`.gitignore`), в публикацию идут только сжатые версии
- Порядок фото задаётся числовым префиксом имени: `NN-имя.webp`

## Файловая структура

| Файл | Ответственность |
|---|---|
| `tools/prepare_photos.py` | Исходники JPEG → WebP в `photos/` |
| `tools/prepare_video.sh` | Исходник MP4 → `video/hero.mp4` + `video/poster.webp` |
| `build-photos.js` | Обход `photos/` → `photos.json` с размерами кадров |
| `test/build-photos.test.js` | Юнит-тесты разбора заголовка WebP |
| `content.js` | Все данные модели: имя, город, компкарт, Telegram |
| `index.html` | Разметка пяти секций |
| `style.css` | Палитра, типографика, сетки, анимации |
| `app.js` | Masonry, лайтбокс, свайп, Intersection Observer |
| `netlify.toml` | Команда сборки |

---

### Task 1: Сжатие фотографий

**Files:**
- Create: `tools/prepare_photos.py`
- Create: `tools/test_prepare_photos.py`
- Output: `photos/01-*.webp` … `photos/07-*.webp`

**Interfaces:**
- Produces: `target_size(w, h, max_side=1600) -> (int, int)` — размер после даунскейла; `convert(src: Path, dst: Path) -> None`

- [ ] **Step 1: Написать падающий тест**

Создать `tools/test_prepare_photos.py`:

```python
import unittest
from prepare_photos import target_size


class TargetSizeTest(unittest.TestCase):
    def test_downscales_by_longest_side(self):
        self.assertEqual(target_size(3000, 4500), (1067, 1600))

    def test_keeps_small_images_untouched(self):
        self.assertEqual(target_size(800, 1200), (800, 1200))

    def test_handles_landscape(self):
        self.assertEqual(target_size(6000, 4000), (1600, 1067))

    def test_never_returns_zero(self):
        self.assertEqual(target_size(1, 4000), (1, 1600))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd tools && python3 -m unittest test_prepare_photos -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'prepare_photos'`

- [ ] **Step 3: Написать инструмент**

Создать `tools/prepare_photos.py`:

```python
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
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd tools && python3 -m unittest test_prepare_photos -v`
Expected: PASS, 4 теста

- [ ] **Step 5: Прогнать на реальных фото**

Run: `python3 tools/prepare_photos.py "media files" photos`
Expected: семь строк вида `IMG_3916.JPG -> 01-img_3916.webp  280 KB`

- [ ] **Step 6: Проверить вес и размеры**

Run: `ls -la photos/ && python3 -c "
from PIL import Image
import glob
for f in sorted(glob.glob('photos/*.webp')):
    im = Image.open(f)
    status = 'EXIF PRESENT' if im.info.get('exif') else 'EXIF cleared'
    print(f, im.size, status)
"`
Expected: семь файлов, каждый ≤400 КБ, длинная сторона 1600, у всех `EXIF cleared`

Если какой-то файл вышел за 400 КБ — понизить `QUALITY` до 78 и перегенерировать.

- [ ] **Step 7: Коммит**

```bash
git add tools/prepare_photos.py tools/test_prepare_photos.py photos/
git commit -m "feat: add photo compression tool and generate gallery webp"
```

---

### Task 2: Сжатие видео и постер-кадр

**Files:**
- Create: `tools/prepare_video.sh`
- Output: `video/hero.mp4`, `video/poster.webp`

**Interfaces:**
- Produces: `video/hero.mp4` (1080×1920, ≤6 МБ), `video/poster.webp` (первый кадр, 1080×1920)

Здесь нет юнит-тестов: инструмент — обёртка над системными утилитами, проверка идёт по факту размера и разрешения выходных файлов.

- [ ] **Step 1: Написать скрипт**

Создать `tools/prepare_video.sh`:

```bash
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
```

- [ ] **Step 2: Запустить**

Run: `bash tools/prepare_video.sh "media files/showreel.mp4"`
Expected: `video/hero.mp4` и `video/poster.webp` созданы, размер видео выведен в мегабайтах

- [ ] **Step 3: Проверить результат**

Run: `mdls -name kMDItemPixelWidth -name kMDItemPixelHeight -name kMDItemDurationSeconds video/hero.mp4 && ls -la video/`
Expected: 1080×1920 (или 720×1280 при откате), длительность ~15,8 с, `hero.mp4` ≤ 6 МБ, `poster.webp` существует

- [ ] **Step 4: Посмотреть постер глазами**

Run: `open video/poster.webp`
Expected: осмысленный кадр с моделью, не чёрный и не смазанный. Если кадр неудачный — открыть видео в QuickTime, встать на нужную секунду, `⌘C`, вставить в Просмотр, сохранить PNG и перегнать в WebP тем же однострочником на Pillow.

- [ ] **Step 5: Коммит**

```bash
git add tools/prepare_video.sh video/
git commit -m "feat: add video compression tool and generate hero media"
```

---

### Task 3: Генератор photos.json

**Files:**
- Create: `build-photos.js`
- Create: `test/build-photos.test.js`
- Output: `photos.json`

**Interfaces:**
- Produces: `webpSize(buffer) -> {w, h}` (экспорт из `build-photos.js`), файл `photos.json` вида `[{"src":"photos/01-x.webp","w":1067,"h":1600}]`

- [ ] **Step 1: Написать падающие тесты**

Создать `test/build-photos.test.js`:

```js
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
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `node --test test/`
Expected: FAIL — `Cannot find module '../build-photos.js'`

- [ ] **Step 3: Написать генератор**

Создать `build-photos.js`:

```js
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
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `node --test test/`
Expected: PASS, 3 теста

- [ ] **Step 5: Собрать photos.json на реальных фото**

Run: `node build-photos.js && cat photos.json`
Expected: `photos.json: 7 фото`, в файле семь объектов с `w: 1067, h: 1600`

- [ ] **Step 6: Коммит**

```bash
git add build-photos.js test/ photos.json
git commit -m "feat: generate photos.json with frame sizes"
```

---

### Task 4: Каркас страницы, палитра и шрифты

**Files:**
- Create: `index.html`, `style.css`, `content.js`, `fonts/`
- Create: `fonts/README.md` (источник и лицензия шрифтов)

**Interfaces:**
- Produces: `content.js` экспортирует `content` со свойствами `name`, `city`, `telegram`, `booking`, `compCard` (массив пар `[label, value]`)
- Produces: CSS-переменные `--font-display`, `--font-body`, `--bg`, `--fg`, `--muted`

- [ ] **Step 1: Скачать шрифты-кандидаты**

Имя латиницей, поэтому нужен только latin-сабсет.

```bash
mkdir -p fonts
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
for FAM in "Cormorant+Garamond:wght@300" "Playfair+Display:wght@400" "Prata" "Tenor+Sans"; do
  URL=$(curl -sL -A "$UA" "https://fonts.googleapis.com/css2?family=${FAM}&display=swap" \
        | awk '/^\/\* latin \*\//{f=1} f && /src:/{print; exit}' \
        | grep -o 'https://[^)]*\.woff2')
  NAME=$(echo "$FAM" | cut -d: -f1 | tr '+' '-' | tr 'A-Z' 'a-z')
  curl -sL -o "fonts/${NAME}.woff2" "$URL"
done
ls -la fonts/
```

Expected: четыре `.woff2`, каждый 20–60 КБ. Все четыре — под Open Font License, самохостинг разрешён.

Если Google Fonts недоступен — взять те же семейства с `fontsource.org` или из зеркала; при полном провале сайт остаётся читаемым на системном `Georgia, serif`, но задачу нужно довести до конца позже.

- [ ] **Step 2: Создать content.js с данными**

**Значения ниже — заглушки.** Реальные данные подставляются в Task 10; до тех пор сайт собирается и проверяется на них.

```js
export const content = {
  name: 'MODEL NAME',
  city: 'Moscow',
  telegram: 'https://t.me/username',
  booking: 'Available for editorial, commercial, runway and lookbook work.',
  compCard: [
    ['Height', '178 cm'],
    ['Bust', '84 cm'],
    ['Waist', '60 cm'],
    ['Hips', '89 cm'],
    ['Dress', 'EU 36'],
    ['Shoes', 'EU 39'],
    ['Hair', 'Brown'],
    ['Eyes', 'Green'],
  ],
};
```

- [ ] **Step 3: Создать index.html**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Model Portfolio</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<section class="hero">
  <video class="hero__video" autoplay muted loop playsinline
         preload="metadata" poster="video/poster.webp">
    <source src="video/hero.mp4" type="video/mp4">
  </video>
  <div class="hero__overlay"></div>
  <div class="hero__caption">
    <h1 class="hero__name" data-content="name">&nbsp;</h1>
    <p class="hero__city" data-content="city">&nbsp;</p>
  </div>
</section>

<main>
  <section class="gallery reveal" id="gallery"></section>

  <section class="comp reveal" id="comp">
    <h2 class="section-title">Measurements</h2>
    <dl class="comp__list" id="comp-list"></dl>
  </section>

  <section class="booking reveal" id="booking">
    <h2 class="section-title">Booking</h2>
    <p class="booking__line" data-content="booking">&nbsp;</p>
    <a class="booking__button" id="telegram-link" href="#" rel="noopener">
      Message on Telegram
    </a>
  </section>
</main>

<footer class="footer">
  <p data-content="name">&nbsp;</p>
</footer>

<script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Создать style.css с палитрой, шрифтами и hero**

```css
/* --- Шрифты ------------------------------------------------------------ */
@font-face {
  font-family: 'Display';
  src: url('fonts/cormorant-garamond.woff2') format('woff2');
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: 'Body';
  src: url('fonts/tenor-sans.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

/* --- Палитра ----------------------------------------------------------- */
:root {
  --bg: #0a0a0a;
  --fg: #f2f0ec;
  --muted: #8a8580;
  --line: #232323;
  --font-display: 'Display', Georgia, serif;
  --font-body: 'Body', system-ui, sans-serif;
  --gap: 12px;
  --pad: 24px;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* --- Hero -------------------------------------------------------------- */
.hero {
  position: relative;
  height: 100svh;
  min-height: 480px;
  overflow: hidden;
}
.hero__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
}
.hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.1) 45%, rgba(10,10,10,.85) 100%);
}
.hero__caption {
  position: absolute;
  inset: auto 0 12vh 0;
  text-align: center;
  padding: 0 var(--pad);
}
.hero__name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(2.75rem, 13vw, 7rem);
  letter-spacing: .12em;
  text-transform: uppercase;
  line-height: 1.05;
}
.hero__city {
  margin: 1.1em 0 0;
  font-size: .72rem;
  letter-spacing: .38em;
  text-transform: uppercase;
  color: var(--muted);
}

/* --- Общее для секций -------------------------------------------------- */
main { padding: 0 var(--pad); max-width: 1400px; margin: 0 auto; }
.section-title {
  font-family: var(--font-body);
  font-size: .72rem;
  font-weight: 400;
  letter-spacing: .38em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: center;
  margin: 0 0 2.5rem;
}
section { padding: clamp(4rem, 12vh, 8rem) 0; }
.footer {
  padding: 3rem var(--pad) 4rem;
  text-align: center;
  color: var(--muted);
  font-size: .68rem;
  letter-spacing: .38em;
  text-transform: uppercase;
  border-top: 1px solid var(--line);
}
```

- [ ] **Step 5: Создать app.js — подстановка контента**

```js
import { content } from './content.js';

/** Расставляет тексты из content.js по элементам с data-content. */
function fillContent() {
  document.querySelectorAll('[data-content]').forEach((el) => {
    el.textContent = content[el.dataset.content];
  });
  document.title = `${content.name} — Model Portfolio`;
  document.getElementById('telegram-link').href = content.telegram;
}

fillContent();
```

- [ ] **Step 6: Проверить в браузере**

Run: `python3 -m http.server 8000` и открыть `http://localhost:8000`
Expected: видео играет на весь экран, имя из `content.js` поверх, город под ним, тёмный фон. Проверить в окне 375 px и на десктопе: лицо модели не уходит за границу кадра — если уходит, подобрать `object-position` (например `center 20%`).

- [ ] **Step 7: Выбрать шрифт для имени**

Открыть страницу и по очереди подменить `src` в `@font-face` для `Display` на каждый из четырёх скачанных файлов, каждый раз глядя на имя в баннере. Зафиксировать понравившийся. Удалить неиспользованные `.woff2`, оставив два — дисплейный и текстовый.

- [ ] **Step 8: Записать источник шрифтов**

Создать `fonts/README.md` с названием семейств, ссылкой на Google Fonts и строкой «SIL Open Font License 1.1 — самохостинг разрешён».

- [ ] **Step 9: Коммит**

```bash
git add index.html style.css app.js content.js fonts/
git commit -m "feat: add page skeleton, dark palette and hero banner"
```

---

### Task 5: Галерея masonry

**Files:**
- Modify: `app.js`, `style.css`

**Interfaces:**
- Consumes: `photos.json` из Task 3
- Produces: функция `renderGallery(photos, columns)` в `app.js`; DOM-структура `.gallery__col > figure > img`

- [ ] **Step 1: Добавить раскладку в app.js**

Дописать в `app.js`:

```js
const BREAKPOINTS = [
  { min: 1200, columns: 4 },
  { min: 768, columns: 3 },
  { min: 0, columns: 2 },
];

/** Сколько колонок при текущей ширине окна. */
function columnCount(width = window.innerWidth) {
  return BREAKPOINTS.find((b) => width >= b.min).columns;
}

/**
 * Раскладывает фото по колонкам: каждое следующее уходит в самую короткую.
 * Порядок слева направо сохраняется, нижняя кромка выравнивается сама.
 */
function renderGallery(photos, columns) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';

  const heights = new Array(columns).fill(0);
  const cols = Array.from({ length: columns }, () => {
    const div = document.createElement('div');
    div.className = 'gallery__col';
    gallery.append(div);
    return div;
  });

  photos.forEach((photo, i) => {
    const shortest = heights.indexOf(Math.min(...heights));
    heights[shortest] += photo.h / photo.w;

    const figure = document.createElement('figure');
    figure.className = 'gallery__item';
    figure.dataset.index = i;

    const img = document.createElement('img');
    img.src = photo.src;
    img.width = photo.w;
    img.height = photo.h;
    img.alt = `${content.name} — photo ${i + 1}`;
    img.loading = i < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';

    figure.append(img);
    cols[shortest].append(figure);
  });
}

let photos = [];

/** Перерисовывает галерею, только если число колонок изменилось. */
function setupGallery() {
  let current = columnCount();
  renderGallery(photos, current);

  window.addEventListener('resize', () => {
    const next = columnCount();
    if (next !== current) {
      current = next;
      renderGallery(photos, current);
    }
  });
}

const response = await fetch('photos.json');
photos = await response.json();
setupGallery();
```

- [ ] **Step 2: Добавить стили галереи**

Дописать в `style.css`:

```css
.gallery {
  display: flex;
  gap: var(--gap);
  align-items: flex-start;
}
.gallery__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  min-width: 0;
}
.gallery__item { margin: 0; cursor: zoom-in; }
.gallery__item img {
  display: block;
  width: 100%;
  height: auto;
  background: #141414;
  transition: opacity .4s ease;
}
.gallery__item:hover img { opacity: .82; }
```

- [ ] **Step 3: Проверить в браузере**

Run: `python3 -m http.server 8000`
Expected: семь фото в две колонки при 375 px, в три при 900 px, в четыре при 1400 px. При перезагрузке с медленной сетью (DevTools → Slow 3G) страница **не дёргается**: место под фото зарезервировано.

- [ ] **Step 4: Проверить порядок**

Expected: `01-…` — первое фото в левой колонке сверху, порядок идёт слева направо.

- [ ] **Step 5: Коммит**

```bash
git add app.js style.css
git commit -m "feat: add masonry gallery with reserved image space"
```

---

### Task 6: Лайтбокс со свайпом

**Files:**
- Modify: `app.js`, `style.css`, `index.html`

**Interfaces:**
- Consumes: `photos` и разметку галереи из Task 5
- Produces: `openLightbox(index)`, `closeLightbox()`, `showPhoto(index)`

- [ ] **Step 1: Добавить разметку лайтбокса**

Перед `<script>` в `index.html`:

```html
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" hidden>
  <button class="lightbox__close" id="lightbox-close" aria-label="Close">&times;</button>
  <img class="lightbox__img" id="lightbox-img" alt="">
  <p class="lightbox__counter" id="lightbox-counter"></p>
</div>
```

- [ ] **Step 2: Добавить логику**

Дописать в `app.js`:

```js
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCounter = document.getElementById('lightbox-counter');
let currentIndex = 0;
let lastFocused = null;

function showPhoto(index) {
  currentIndex = (index + photos.length) % photos.length;
  const photo = photos[currentIndex];
  lightboxImg.src = photo.src;
  lightboxImg.alt = `${content.name} — photo ${currentIndex + 1}`;
  lightboxCounter.textContent = `${currentIndex + 1} / ${photos.length}`;
}

function openLightbox(index) {
  lastFocused = document.activeElement;
  showPhoto(index);
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('lightbox-close').focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

document.getElementById('gallery').addEventListener('click', (event) => {
  const figure = event.target.closest('.gallery__item');
  if (figure) openLightbox(Number(figure.dataset.index));
});

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (event) => {
  if (lightbox.hidden) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowRight') showPhoto(currentIndex + 1);
  if (event.key === 'ArrowLeft') showPhoto(currentIndex - 1);
});

/* Свайп: порог 50 px, всё что меньше — считается тапом. */
const SWIPE = 50;
let startX = 0;
let startY = 0;

lightbox.addEventListener('touchstart', (event) => {
  startX = event.changedTouches[0].clientX;
  startY = event.changedTouches[0].clientY;
}, { passive: true });

lightbox.addEventListener('touchend', (event) => {
  const dx = event.changedTouches[0].clientX - startX;
  const dy = event.changedTouches[0].clientY - startY;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE) {
    showPhoto(currentIndex + (dx < 0 ? 1 : -1));
  } else if (dy > SWIPE) {
    closeLightbox();
  }
}, { passive: true });
```

- [ ] **Step 3: Добавить стили**

```css
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(6, 6, 6, .97);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 2vw;
}
.lightbox[hidden] { display: none; }
.lightbox__img {
  max-width: 100%;
  max-height: 92vh;
  object-fit: contain;
}
.lightbox__close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: 0;
  color: var(--fg);
  font-size: 2.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 8px 12px;
}
.lightbox__counter {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--muted);
  font-size: .68rem;
  letter-spacing: .3em;
  margin: 0;
}
```

- [ ] **Step 4: Проверить на десктопе**

Expected: клик открывает фото, стрелки листают, счётчик меняется, Esc закрывает, фокус возвращается на исходное фото, фон под лайтбоксом не скроллится.

- [ ] **Step 5: Проверить свайп**

Run: DevTools → режим устройства (iPhone) → открыть фото
Expected: свайп влево-вправо листает по кругу, свайп вниз закрывает, короткое движение ничего не ломает.

- [ ] **Step 6: Коммит**

```bash
git add index.html app.js style.css
git commit -m "feat: add lightbox with swipe and keyboard navigation"
```

---

### Task 7: Компкарт и блок бронирования

**Files:**
- Modify: `app.js`, `style.css`

**Interfaces:**
- Consumes: `content.compCard`, `content.booking`, `content.telegram` из Task 4

- [ ] **Step 1: Отрисовать компкарт**

Дописать в `app.js` отдельной функцией, рядом с `fillContent`:

```js
/** Строит список параметров из content.compCard. */
function renderCompCard() {
  const list = document.getElementById('comp-list');
  list.innerHTML = '';
  content.compCard.forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    list.append(dt, dd);
  });
}

renderCompCard();
```

- [ ] **Step 2: Добавить стили**

```css
.comp__list {
  max-width: 420px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0;
}
.comp__list dt,
.comp__list dd {
  margin: 0;
  padding: .85rem 0;
  border-bottom: 1px solid var(--line);
}
.comp__list dt {
  color: var(--muted);
  font-size: .72rem;
  letter-spacing: .22em;
  text-transform: uppercase;
}
.comp__list dd {
  text-align: right;
  font-family: var(--font-display);
  font-size: 1.25rem;
}

.booking { text-align: center; }
.booking__line {
  max-width: 30ch;
  margin: 0 auto 2.5rem;
  color: var(--muted);
  font-size: 1rem;
}
.booking__button {
  display: inline-block;
  padding: 1.1rem 2.6rem;
  border: 1px solid var(--fg);
  color: var(--fg);
  text-decoration: none;
  font-size: .72rem;
  letter-spacing: .3em;
  text-transform: uppercase;
  transition: background .3s ease, color .3s ease;
}
.booking__button:hover,
.booking__button:focus-visible {
  background: var(--fg);
  color: var(--bg);
}
```

- [ ] **Step 3: Проверить**

Expected: восемь строк параметров ровными рядами, строка про booking, кнопка ведёт по адресу из `content.telegram`. При 375 px список не переносится и не расползается.

- [ ] **Step 4: Коммит**

```bash
git add app.js style.css
git commit -m "feat: add comp card and booking section"
```

---

### Task 8: Анимации появления

**Files:**
- Modify: `app.js`, `style.css`

**Interfaces:**
- Consumes: класс `.reveal` на секциях из Task 4
- Produces: класс `.is-visible`, добавляемый Intersection Observer

- [ ] **Step 1: Добавить стили**

```css
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity .6s ease, transform .6s ease;
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  .gallery__item img { transition: none; }
  .booking__button { transition: none; }
}
```

- [ ] **Step 2: Добавить наблюдатель**

```js
/** Проявляет секции при попадании в кадр. Срабатывает один раз. */
function setupReveal() {
  const sections = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    sections.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  sections.forEach((el) => observer.observe(el));
}

setupReveal();
```

- [ ] **Step 3: Проверить**

Expected: секции всплывают при прокрутке, каждая один раз. В macOS: Системные настройки → Универсальный доступ → Монитор → Уменьшить движение — после включения секции видны сразу, без анимации.

- [ ] **Step 4: Коммит**

```bash
git add app.js style.css
git commit -m "feat: add scroll reveal animations with reduced-motion support"
```

---

### Task 9: Метаданные, фавикон и OpenGraph

**Files:**
- Modify: `index.html`
- Create: `og.jpg`, `favicon.svg`

**Interfaces:**
- Consumes: `photos/01-*.webp` из Task 1

- [ ] **Step 1: Собрать превью-картинку**

OpenGraph не понимает WebP надёжно, поэтому превью — JPEG 1200×630 из первого фото.

```bash
python3 -c "
from PIL import Image
import glob
src = sorted(glob.glob('photos/*.webp'))[0]
im = Image.open(src).convert('RGB')
target = (1200, 630)
scale = max(target[0] / im.width, target[1] / im.height)
im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
left = (im.width - target[0]) // 2
top = int((im.height - target[1]) * 0.25)
im.crop((left, top, left + target[0], top + target[1])).save('og.jpg', quality=86)
print('og.jpg готов')
"
```

Expected: `og.jpg` 1200×630, лицо в кадре. Если кадрирование неудачное — поменять `0.25` на другую долю высоты.

- [ ] **Step 2: Создать фавикон**

Создать `favicon.svg` — монограмма на тёмном фоне (буквы заменить на инициалы модели в Task 10):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0a0a0a"/>
  <text x="32" y="44" text-anchor="middle" fill="#f2f0ec"
        font-family="Georgia, serif" font-size="34" letter-spacing="1">MN</text>
</svg>
```

- [ ] **Step 3: Добавить теги в head**

Заменить `<title>` в `index.html` на блок (`MODEL NAME` и адрес правятся в Task 10):

```html
<title>MODEL NAME — Model Portfolio</title>
<meta name="description" content="Portfolio of MODEL NAME — measurements, photos and booking contact.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">

<meta property="og:type" content="website">
<meta property="og:title" content="MODEL NAME">
<meta property="og:description" content="Model portfolio — photos, measurements and booking.">
<meta property="og:image" content="og.jpg">
<meta name="twitter:card" content="summary_large_image">
```

- [ ] **Step 4: Проверить**

Run: открыть страницу, посмотреть вкладку браузера
Expected: имя во вкладке, фавикон виден. Полноценная проверка превью — после деплоя, отправкой ссылки самой себе в Telegram.

- [ ] **Step 5: Коммит**

```bash
git add index.html og.jpg favicon.svg
git commit -m "feat: add page metadata, favicon and opengraph preview"
```

---

### Task 10: Реальные данные модели

**Files:**
- Modify: `content.js`, `index.html`, `favicon.svg`

**Данные запрашиваются у владельца сайта перед началом задачи.** Без них задача не выполняется — заглушки в продакшен не публикуются.

- [ ] **Step 1: Собрать данные**

Нужны: имя латиницей, город, ник в Telegram, рост, обхваты груди/талии/бёдер, размер одежды, размер обуви (EU), цвет волос, цвет глаз.

- [ ] **Step 2: Подставить в content.js**

Заменить все восемь значений `compCard`, `name`, `city`, `telegram`. Формат значений сохранить: числа с единицами (`178 cm`), размеры с префиксом `EU`.

- [ ] **Step 3: Подставить в index.html и favicon.svg**

Заменить `MODEL NAME` в `<title>`, `description` и трёх og-тегах. В `favicon.svg` заменить `MN` на инициалы.

- [ ] **Step 4: Проверить**

Expected: нигде на странице не осталось строки `MODEL NAME` или `username`.

Run: `grep -rn "MODEL NAME\|t.me/username\|>MN<" --include='*.html' --include='*.js' --include='*.svg' .`
Expected: пусто

- [ ] **Step 5: Коммит**

```bash
git add content.js index.html favicon.svg
git commit -m "feat: add real model data"
```

---

### Task 11: Публикация на Netlify

**Files:**
- Create: `netlify.toml`, `README.md`

- [ ] **Step 1: Создать netlify.toml**

```toml
[build]
  command = "node build-photos.js"
  publish = "."

[[headers]]
  for = "/photos/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/video/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

- [ ] **Step 2: Написать README.md**

```markdown
# Сайт-портфолио

Публичная ссылка: https://<имя-сайта>.netlify.app

## Добавить фотографию

1. Сжать: `python3 tools/prepare_photos.py "media files" photos`
   (или загрузить готовый WebP шириной до 1600 px)
2. Назвать файл `NN-имя.webp`, где `NN` — двузначный номер. Номер задаёт
   порядок в галерее: `01-` идёт первым.
3. Положить в папку `photos/` — через веб-интерфейс GitHub с телефона это
   Add file → Upload files.
4. Сайт пересоберётся сам за пару минут.

## Поменять параметры или контакт

Всё лежит в `content.js`: имя, город, ссылка на Telegram, восемь строк
компкарта. Править прямо в GitHub, кнопкой с карандашом.

## Откатить неудачную правку

На странице коммита в GitHub нажать Revert. Сайт вернётся к предыдущему
состоянию автоматически.

## Пересобрать медиа локально

```bash
python3 tools/prepare_photos.py "media files" photos   # фото
bash tools/prepare_video.sh "media files/showreel.mp4" # видео и постер
node build-photos.js                                   # список фото
python3 -m http.server 8000                            # посмотреть локально
```
```

- [ ] **Step 3: Создать репозиторий на GitHub**

```bash
git remote add origin https://github.com/IvaNova-Anna/<repo>.git
git push -u origin main
```

- [ ] **Step 4: Подключить Netlify**

В интерфейсе Netlify: Add new site → Import from GitHub → выбрать репозиторий. Команда сборки и папка публикации подхватятся из `netlify.toml`. Задать имя сайта — оно станет поддоменом `<имя>.netlify.app`.

- [ ] **Step 5: Проверить живой сайт по чек-листу**

Открыть публичную ссылку **с телефона** и пройти:

1. Баннер играет, имя читается
2. Галерея открывается, фото не прыгают
3. Свайп листает, свайп вниз закрывает
4. Компкарт читается
5. Кнопка Telegram открывает нужный чат
6. Ссылка, отправленная себе в Telegram, разворачивается в карточку с фото

- [ ] **Step 6: Коммит**

```bash
git add netlify.toml README.md
git commit -m "chore: add netlify config and update instructions"
git push
```

---

## Проверка после каждой правки

Прогонять шесть пунктов из Task 11, Step 5. Правки проверяются на deploy preview (пуш в ветку, не в `main`) до публикации.
