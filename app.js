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
  }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

  sections.forEach((el) => observer.observe(el));
}

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
    figure.tabIndex = 0;
    figure.setAttribute('role', 'button');

    const img = document.createElement('img');
    img.src = photo.src;
    img.width = photo.w;
    img.height = photo.h;
    img.alt = `${content.name} — photo ${i + 1}`;
    img.loading = i < columns ? 'eager' : 'lazy';
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

/* 5 с максимум на запрос: зависшая раздача (плохая мобильная сеть) не должна
   держать страницу без галереи, ревила и слушателей лайтбокса бесконечно —
   таймаут переводит зависание в ту же ветку catch, что и обычную ошибку. */
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const response = await fetch('photos.json', { signal: controller.signal });
  if (!response.ok) {
    throw new Error(`photos.json: HTTP ${response.status}`);
  }
  photos = await response.json();
} catch (err) {
  console.error('Failed to load photos.json — gallery will be empty.', err);
} finally {
  clearTimeout(timeout);
}
setupGallery();

/* Наблюдатель ставится только теперь, когда галерея уже получила реальную
   высоту: если поставить его раньше (пока #gallery ещё пустой), первый же
   синхронный замер IntersectionObserver может застать документ короче
   финального и по ошибке проявить comp/booking, которые ещё не попадали
   в кадр — а снять наблюдение он успевает раньше, чем фото лягут в разметку. */
setupReveal();

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCounter = document.getElementById('lightbox-counter');
let currentIndex = 0;
let lastFocusedIndex = null;

function showPhoto(index) {
  currentIndex = (index + photos.length) % photos.length;
  const photo = photos[currentIndex];
  lightboxImg.src = photo.src;
  lightboxImg.alt = `${content.name} — photo ${currentIndex + 1}`;
  lightboxCounter.textContent = `${currentIndex + 1} / ${photos.length}`;
}

function openLightbox(index) {
  /* Индекс, а не сам DOM-узел: renderGallery пересоздаёт все figure при смене
     числа колонок, и узел, сохранённый на момент открытия, к моменту закрытия
     может быть уже отсоединён от документа. */
  lastFocusedIndex = index;
  showPhoto(index);
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('lightbox-close').focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  if (lastFocusedIndex !== null) {
    const gallery = document.getElementById('gallery');
    const figure = gallery.querySelector(`[data-index="${lastFocusedIndex}"]`);
    if (figure) figure.focus();
  }
}

document.getElementById('gallery').addEventListener('click', (event) => {
  const figure = event.target.closest('.gallery__item');
  if (figure) openLightbox(Number(figure.dataset.index));
});

document.getElementById('gallery').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const figure = event.target.closest('.gallery__item');
  if (!figure) return;
  /* preventDefault для обоих клавиш: Space иначе прокрутит страницу, а Enter
     иначе доиграет своё "нажатие" уже на кнопке закрытия (фокус на неё
     переходит внутри openLightbox), закрыв лайтбокс тем же кликом. */
  event.preventDefault();
  openLightbox(Number(figure.dataset.index));
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
  if (event.key === 'Tab') {
    /* Единственный интерактивный элемент внутри — кнопка закрытия,
       поэтому фокус просто удерживается на ней. */
    event.preventDefault();
    document.getElementById('lightbox-close').focus();
  }
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

/* iOS Safari продолжает "резиновый" скролл страницы под фиксированным
   оверлеем даже при overflow:hidden на body — блокируем его явно. Но только
   для одного пальца: пинч-зум (два пальца и более) должен работать, это
   единственный способ рассмотреть лицо на фото. */
lightbox.addEventListener('touchmove', (event) => {
  if (!lightbox.hidden && event.touches.length === 1) event.preventDefault();
}, { passive: false });
