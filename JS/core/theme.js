/**
 * EstacionaPro — Core: tema claro / oscuro.
 * Persiste en localStorage ('ep_theme') y aplica data-theme en <html>.
 */
const STORAGE_KEY = 'ep_theme';

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const html = document.documentElement;
  const icon = document.querySelector('[data-theme-icon]');
  const btn = document.querySelector('[data-theme-toggle]');

  if (theme === 'dark') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');

  if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro');

  localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
  applyTheme(getSavedTheme());
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem(STORAGE_KEY)) applyTheme(e.matches ? 'dark' : 'light');
  });
}
