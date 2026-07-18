/**
 * EstacionaPro — Core: comportamiento compartido de la interfaz.
 *   - Menú móvil, header con scroll, animación de aparición, año del footer,
 *     y resaltado del enlace activo del nav.
 */
import { initTheme } from './theme.js';

function initMobileMenu() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  const overlay = document.querySelector('[data-overlay]');
  if (!toggle || !nav) return;

  const open = () => {
    nav.classList.add('is-open');
    overlay?.classList.add('is-visible');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    nav.classList.remove('is-open');
    overlay?.classList.remove('is-visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  toggle.addEventListener('click', () =>
    toggle.getAttribute('aria-expanded') === 'true' ? close() : open());
  overlay?.addEventListener('click', close);
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
}

function initHeaderScroll() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('header--scrolled', window.scrollY > 8);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

function initActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll(`[data-nav] a[data-page-link="${page}"]`)
    .forEach(a => a.classList.add('is-active'));
}

function initYear() {
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
}

/** Punto de entrada — llamar una vez por página. */
export function initUI() {
  initTheme();
  initMobileMenu();
  initHeaderScroll();
  initReveal();
  initActiveNav();
  initYear();
}
