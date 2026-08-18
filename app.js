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
