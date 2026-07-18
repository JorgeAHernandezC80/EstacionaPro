/**
 * EstacionaPro — Página de contacto: validación del formulario (cliente).
 */
import { initUI } from '../core/ui.js';
initUI();

const form = document.querySelector('[data-contacto-form]');
const ok = document.querySelector('[data-contacto-ok]');

function marcar(input, error) { input.closest('.field')?.classList.toggle('field--error', error); }

form.addEventListener('submit', (e) => {
  e.preventDefault();
  ok.style.display = 'none';
  const nombre = document.getElementById('c-nombre');
  const email = document.getElementById('c-email');
  const mensaje = document.getElementById('c-mensaje');
  const okNombre = nombre.value.trim().length > 0;
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const okMensaje = mensaje.value.trim().length > 0;
  marcar(nombre, !okNombre);
  marcar(email, !okEmail);
  marcar(mensaje, !okMensaje);
  if (okNombre && okEmail && okMensaje) {
    form.reset();
    ok.style.display = 'flex';
    ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
