/**
 * EstacionaPro — Página de reserva: cotización en vivo y envío al backend.
 */
import { initUI } from '../core/ui.js';
import { api } from '../core/api.js';
import {
  PLAZAS, TIPOS_VEHICULO, SEGMENTOS, MEMBRESIA, calcularCobro,
} from '../core/config.js';
import { formatPrice, escapeHTML, hoyISO, formatDuracion } from '../core/format.js';

initUI();

const form = document.querySelector('[data-reserva-form]');
const $ = sel => document.querySelector(sel);
let disponibilidad = {};

/* ---- Construir opciones dinámicas ---- */
function pintarPlazas() {
  const cont = $('[data-plaza-options]');
  cont.innerHTML = Object.entries(PLAZAS).map(([key, cfg], i) => {
    const info = disponibilidad[key];
    const libres = info ? info.disponibles : cfg.capacidad;
    const agotado = libres <= 0;
    return `<label class="plaza-opt">
      <input type="radio" name="plazaTipo" value="${key}" ${i === 0 ? 'checked' : ''} ${agotado ? 'disabled' : ''} />
      <i class="fa-solid ${cfg.icon}"></i>
      <div class="name">${escapeHTML(cfg.label)}</div>
      <div class="rate">${formatPrice(cfg.precioHora)}/h</div>
      <div class="avail" style="color:${agotado ? 'var(--danger-500)' : 'var(--ok-500)'}">${agotado ? 'Agotado' : libres + ' libres'}</div>
    </label>`;
  }).join('');
  cont.querySelectorAll('input').forEach(el => el.addEventListener('change', actualizarResumen));
}

function pintarVehiculos() {
  $('[data-vehiculos]').innerHTML = TIPOS_VEHICULO
    .map(v => `<option value="${v.key}">${escapeHTML(v.label)}</option>`).join('');
}

function pintarChoices(cont, obj, name, checkedKey) {
  cont.innerHTML = Object.entries(obj).map(([key, cfg]) => `
    <label class="choice">
      <input type="radio" name="${name}" value="${key}" ${key === checkedKey ? 'checked' : ''} />
      <div class="choice__title">${escapeHTML(cfg.label)}</div>
      <div class="choice__desc">${escapeHTML(cfg.desc)}</div>
    </label>`).join('');
  cont.querySelectorAll('input').forEach(el => el.addEventListener('change', actualizarResumen));
}

/* ---- Resumen en vivo ---- */
function leerSeleccion() {
  const plazaTipo = form.plazaTipo?.value || 'descubierta';
  const segmento = form.segmento?.value || 'temporal';
  const membresia = form.membresia?.value || 'sin';
  const duracionHoras = Number(form.duracionHoras.value);
  return { plazaTipo, segmento, membresia, duracionHoras };
}

function actualizarResumen() {
  const { plazaTipo, segmento, membresia, duracionHoras } = leerSeleccion();
  $('[data-dur-label]').textContent = duracionHoras;
  const cobro = calcularCobro({ plazaTipo, segmento, membresia, horas: duracionHoras });
  const precioHoraEfectivo = duracionHoras ? cobro.total / cobro.horasCobrables : 0;
  $('[data-sum-plaza]').textContent = PLAZAS[plazaTipo]?.label || '—';
  $('[data-sum-segmento]').textContent = SEGMENTOS[segmento]?.label || '—';
  $('[data-sum-membresia]').textContent = MEMBRESIA[membresia]?.label || '—';
  $('[data-sum-duracion]').textContent = `${duracionHoras} h`;
  $('[data-sum-precio]').textContent = formatPrice(precioHoraEfectivo);
  $('[data-sum-total]').textContent = formatPrice(cobro.total);
}

/* ---- Validación de campos ---- */
function marcarError(input, hayError) {
  input.closest('.field')?.classList.toggle('field--error', hayError);
}
function validar() {
  let ok = true;
  const nombre = form.nombre.value.trim();
  const email = form.email.value.trim();
  const tel = form.telefono.value.replace(/\D/g, '');
  const placa = form.placa.value.trim().toUpperCase();
  const okNombre = nombre.length > 0 && nombre.length <= 80;
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const okTel = tel.length >= 7 && tel.length <= 15;
  const okPlaca = /^[A-Z0-9-]{4,10}$/.test(placa);
  marcarError(form.nombre, !okNombre);
  marcarError(form.email, !okEmail);
  marcarError(form.telefono, !okTel);
  marcarError(form.placa, !okPlaca);
  ok = okNombre && okEmail && okTel && okPlaca;
  return ok;
}

/* ---- Código de reserva EP-YYYYMMDD-XXXX ---- */
function generarCodigo(fecha) {
  const ymd = fecha.replace(/-/g, '');
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  return `EP-${ymd}-${rnd}`;
}

/* ---- Envío ---- */
async function enviar(e) {
  e.preventDefault();
  const errBox = $('[data-form-error]');
  errBox.style.display = 'none';
  if (!validar()) {
    errBox.textContent = 'Revisa los campos marcados en rojo.';
    errBox.style.display = 'flex';
    return;
  }
  const { plazaTipo, segmento, membresia, duracionHoras } = leerSeleccion();
  const cobro = calcularCobro({ plazaTipo, segmento, membresia, horas: duracionHoras });
  const fecha = form.fecha.value;
  const reserva = {
    codigo: generarCodigo(fecha),
    nombre: form.nombre.value.trim(),
    email: form.email.value.trim(),
    telefono: form.telefono.value,
    placa: form.placa.value.trim().toUpperCase(),
    tipoVehiculo: form.tipoVehiculo.value,
    plazaTipo, segmento, membresia,
    fecha,
    horaEntrada: form.horaEntrada.value,
    duracionHoras,
    total: cobro.total,
  };

  const btn = $('[data-submit]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…';
  try {
    const creada = await api.post('/api/reservas', reserva);
    mostrarConfirmacion(creada);
  } catch (err) {
    errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(err.message)}`;
    errBox.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Confirmar reserva';
  }
}

function mostrarConfirmacion(r) {
  $('[data-reserva-view]').style.display = 'none';
  const view = $('[data-confirm-view]');
  view.style.display = 'block';
  $('[data-confirm-code]').textContent = r.codigo;
  $('[data-confirm-details]').innerHTML = `
    <div><span>Plaza</span><span>${escapeHTML(PLAZAS[r.plazaTipo].label)}</span></div>
    <div><span>Fecha</span><span>${escapeHTML(r.fecha)} · ${escapeHTML(r.horaEntrada)}</span></div>
    <div><span>Duración</span><span>${r.duracionHoras} h</span></div>
    <div><span>Placa</span><span>${escapeHTML(r.placa)}</span></div>
    <div><span>Total estimado</span><span><b>${formatPrice(r.total)}</b></span></div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cargarDisponibilidad() {
  const fecha = form.fecha.value || hoyISO();
  try {
    const data = await api.get(`/api/disponibilidad?fecha=${fecha}`);
    disponibilidad = data.disponibilidad || {};
  } catch {
    disponibilidad = {};
  }
  pintarPlazas();
  actualizarResumen();
}

/* ---- Init ---- */
function init() {
  const fechaInput = form.fecha;
  fechaInput.min = hoyISO();
  fechaInput.value = hoyISO();
  pintarVehiculos();
  pintarChoices($('[data-segmentos]'), SEGMENTOS, 'segmento', 'temporal');
  pintarChoices($('[data-membresias]'), MEMBRESIA, 'membresia', 'sin');
  form.duracionHoras.addEventListener('input', actualizarResumen);
  fechaInput.addEventListener('change', cargarDisponibilidad);
  form.addEventListener('submit', enviar);
  $('[data-nueva-reserva]').addEventListener('click', () => {
    $('[data-confirm-view]').style.display = 'none';
    $('[data-reserva-view]').style.display = 'grid';
    form.reset();
    init2();
  });
  cargarDisponibilidad();
}
function init2() {
  form.fecha.value = hoyISO();
  form.horaEntrada.value = '08:00';
  form.duracionHoras.value = 2;
  pintarChoices($('[data-segmentos]'), SEGMENTOS, 'segmento', 'temporal');
  pintarChoices($('[data-membresias]'), MEMBRESIA, 'membresia', 'sin');
  cargarDisponibilidad();
}

init();
