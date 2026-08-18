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
