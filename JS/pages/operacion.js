/**
 * EstacionaPro — Tablero de operación: entrada/salida y estado de plazas.
 */
import { initUI } from '../core/ui.js';
import { api, login, getToken, clearToken } from '../core/api.js';
import { PLAZAS, TIPOS_VEHICULO, SEGMENTOS, MEMBRESIA } from '../core/config.js';
import { formatPrice, escapeHTML, formatFechaHora, formatDuracion } from '../core/format.js';

initUI();

const $ = s => document.querySelector(s);
let plazasCache = [];

/* ---- Login gate ---- */
function mostrarPanel() {
  $('[data-gate]').style.display = 'none';
  $('[data-panel]').style.display = 'block';
  pintarSelects();
  cargar();
}

$('[data-login-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('[data-login-error]');
  err.style.display = 'none';
  try {
    await login($('[data-login-pass]').value);
    mostrarPanel();
  } catch (ex) {
    err.textContent = ex.message;
    err.style.display = 'flex';
  }
});

/* ---- Selects del formulario de entrada ---- */
function pintarSelects() {
  $('[data-e-vehiculos]').innerHTML = TIPOS_VEHICULO.map(v => `<option value="${v.key}">${escapeHTML(v.label)}</option>`).join('');
  $('[data-e-plazas]').innerHTML = Object.entries(PLAZAS).map(([k, c]) => `<option value="${k}">${escapeHTML(c.label)}</option>`).join('');
  $('[data-e-segmentos]').innerHTML = Object.entries(SEGMENTOS).map(([k, c]) => `<option value="${k}">${escapeHTML(c.label)}</option>`).join('');
  $('[data-e-membresias]').innerHTML = Object.entries(MEMBRESIA).map(([k, c]) => `<option value="${k}">${escapeHTML(c.label)}</option>`).join('');
}

/* ---- Cargar tablero ---- */
async function cargar() {
  try {
    const { plazas, resumen } = await api.get('/api/plazas');
    plazasCache = plazas;
    pintarResumen(resumen);
    pintarBoard(plazas);
  } catch (e) {
    if (e.status === 401) { clearToken(); location.reload(); }
  }
}

function pintarResumen(r) {
  ['total', 'disponible', 'ocupada', 'reparacion'].forEach(k => {
    const el = document.querySelector(`[data-op="${k}"]`);
    if (el) el.textContent = r[k];
  });
}

function pintarBoard(plazas) {
  const board = $('[data-board]');
  board.innerHTML = plazas.map(p => `
    <button class="slot slot--${p.estado}" data-slot="${p.id}" title="${p.estado}${p.placa ? ' · ' + escapeHTML(p.placa) : ''}">
      <span>${escapeHTML(p.id)}</span>
      <small>${p.placa ? escapeHTML(p.placa) : PLAZAS[p.tipo]?.label.split(' ')[1] || ''}</small>
    </button>`).join('');
  board.querySelectorAll('[data-slot]').forEach(btn =>
    btn.addEventListener('click', () => abrirGestion(btn.dataset.slot)));
}

/* ---- Registrar entrada ---- */
$('[data-entrada-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('[data-entrada-error]'), ok = $('[data-entrada-ok]');
  err.style.display = 'none'; ok.style.display = 'none';
  const payload = {
    placa: $('#e-placa').value,
    tipoVehiculo: $('#e-vehiculo').value,
    plazaTipo: $('#e-plaza').value,
    segmento: $('#e-segmento').value,
    membresia: $('#e-membresia').value,
  };
  try {
    const r = await api.post('/api/operacion/entrada', payload, true);
    ok.innerHTML = `<i class="fa-solid fa-circle-check"></i> Ingreso registrado en plaza <b>${escapeHTML(r.plazaId)}</b>.`;
    ok.style.display = 'flex';
    $('#e-placa').value = '';
    cargar();
  } catch (ex) {
    err.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(ex.message)}`;
    err.style.display = 'flex';
  }
});

/* ---- Gestión de una plaza (modal) ---- */
const modal = $('[data-modal]');
function cerrarModal() { modal.classList.remove('is-open'); }
modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });

function abrirGestion(id) {
  const plaza = plazasCache.find(p => p.id === id);
  if (!plaza) return;
  const body = $('[data-modal-body]');

  if (plaza.estado === 'ocupada') {
    body.innerHTML = `
      <div class="ticket">
        <div><span>Plaza</span><span><b>${escapeHTML(plaza.id)}</b></span></div>
        <div><span>Placa</span><span>${escapeHTML(plaza.placa)}</span></div>
        <div><span>Entrada</span><span>${formatFechaHora(plaza.entradaTs)}</span></div>
        <div><span>Cliente</span><span>${escapeHTML(SEGMENTOS[plaza.segmento]?.label || plaza.segmento)} · ${escapeHTML(MEMBRESIA[plaza.membresia]?.label || plaza.membresia)}</span></div>
      </div>
      <button class="btn btn--accent btn--block" data-do-salida><i class="fa-solid fa-right-from-bracket"></i> Registrar salida y cobrar</button>
      <button class="btn btn--ghost btn--block" data-cancelar style="margin-top:.6rem">Cerrar</button>`;
    body.querySelector('[data-do-salida]').addEventListener('click', () => registrarSalida(plaza.id));
  } else if (plaza.estado === 'disponible') {
    body.innerHTML = `
      <p class="lead" style="font-size:.98rem">La plaza <b>${escapeHTML(plaza.id)}</b> está disponible.</p>
      <button class="btn btn--ghost btn--block" data-reparacion style="margin-top:1rem"><i class="fa-solid fa-screwdriver-wrench"></i> Marcar en reparación</button>
      <button class="btn btn--ghost btn--block" data-cancelar style="margin-top:.6rem">Cerrar</button>`;
    body.querySelector('[data-reparacion]').addEventListener('click', () => cambiarEstadoPlaza(plaza.id, 'reparacion'));
  } else {
    body.innerHTML = `
      <p class="lead" style="font-size:.98rem">La plaza <b>${escapeHTML(plaza.id)}</b> está en reparación.</p>
      <button class="btn btn--primary btn--block" data-disponible style="margin-top:1rem"><i class="fa-solid fa-circle-check"></i> Volver a disponible</button>
      <button class="btn btn--ghost btn--block" data-cancelar style="margin-top:.6rem">Cerrar</button>`;
    body.querySelector('[data-disponible]').addEventListener('click', () => cambiarEstadoPlaza(plaza.id, 'disponible'));
  }
  body.querySelector('[data-cancelar]').addEventListener('click', cerrarModal);
  modal.classList.add('is-open');
}

async function registrarSalida(plazaId) {
  try {
    const t = await api.post('/api/operacion/salida', { plazaId }, true);
    $('[data-modal-body]').innerHTML = `
      <div class="alert alert--ok" style="margin-bottom:1rem"><i class="fa-solid fa-circle-check"></i> Salida registrada.</div>
      <div class="ticket">
        <div><span>Placa</span><span>${escapeHTML(t.placa)}</span></div>
        <div><span>Permanencia</span><span>${formatDuracion(t.horas)}</span></div>
        <div><span>Horas cobradas</span><span>${t.horasCobrables} h</span></div>
        <div class="grand"><span>Total a cobrar</span><b>${formatPrice(t.total)}</b></div>
      </div>
      <button class="btn btn--primary btn--block" data-cerrar>Listo</button>`;
    $('[data-modal-body]').querySelector('[data-cerrar]').addEventListener('click', () => { cerrarModal(); cargar(); });
  } catch (ex) {
    alert(ex.message);
  }
}

async function cambiarEstadoPlaza(id, estado) {
  try {
    await api.patch(`/api/plazas/${id}`, { estado }, true);
    cerrarModal();
    cargar();
  } catch (ex) {
    alert(ex.message);
  }
}

/* ---- Init: si ya hay token, saltar el gate ---- */
if (getToken()) {
  api.get('/api/plazas').then(() => {}).catch(() => {});
  mostrarPanel();
}
setInterval(() => { if ($('[data-panel]').style.display !== 'none') cargar(); }, 15000);
