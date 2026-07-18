/**
 * EstacionaPro — Panel admin: reservas, ingresos y movimientos.
 */
import { initUI } from '../core/ui.js';
import { api, login, getToken, clearToken } from '../core/api.js';
import { PLAZAS } from '../core/config.js';
import { formatPrice, escapeHTML, formatFechaHora } from '../core/format.js';

initUI();
const $ = s => document.querySelector(s);

const ESTADOS = ['pendiente', 'confirmada', 'completada', 'cancelada'];
const BADGE = { pendiente: 'warn', confirmada: 'info', completada: 'ok', cancelada: 'danger' };

function mostrarPanel() {
  $('[data-gate]').style.display = 'none';
  $('[data-panel]').style.display = 'block';
  cargarTodo();
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

async function cargarResumen() {
  try {
    const r = await api.get('/api/resumen', true);
    $('[data-adm="reservas"]').textContent = r.reservas;
    $('[data-adm="ingresos"]').textContent = formatPrice(r.ingresos);
    $('[data-adm="activos"]').textContent = r.vehiculosActivos;
    $('[data-adm="disponibles"]').textContent = r.plazas.disponible;
  } catch (e) { if (e.status === 401) logout(); }
}

async function cargarReservas() {
  const estado = $('[data-filtro-estado]').value;
  const body = $('[data-reservas-body]');
  try {
    const q = estado ? `?estado=${estado}` : '';
    const rows = await api.get(`/api/reservas${q}`, true);
    if (!rows.length) { body.innerHTML = '<tr><td colspan="7">Sin reservas.</td></tr>'; return; }
    body.innerHTML = rows.map(r => `
      <tr>
        <td><b>${escapeHTML(r.codigo)}</b></td>
        <td>${escapeHTML(r.nombre)}<br><small style="color:var(--text-muted)">${escapeHTML(r.email)}</small></td>
        <td>${escapeHTML(r.placa)}</td>
        <td>${escapeHTML(PLAZAS[r.plazaTipo]?.label || r.plazaTipo)}</td>
        <td>${escapeHTML(r.fecha)}<br><small style="color:var(--text-muted)">${escapeHTML(r.horaEntrada)}</small></td>
        <td>${formatPrice(r.total)}</td>
        <td>
          <select class="select-estado" data-cambio="${escapeHTML(r.codigo)}">
            ${ESTADOS.map(s => `<option value="${s}" ${s === r.estado ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
    body.querySelectorAll('[data-cambio]').forEach(sel =>
      sel.addEventListener('change', () => cambiarEstado(sel.dataset.cambio, sel.value)));
  } catch (e) {
    if (e.status === 401) logout();
    else body.innerHTML = `<tr><td colspan="7">${escapeHTML(e.message)}</td></tr>`;
  }
}

async function cambiarEstado(codigo, estado) {
  try {
    await api.patch(`/api/reservas/${codigo}`, { estado }, true);
    cargarResumen();
  } catch (ex) { alert(ex.message); }
}

async function cargarMovimientos() {
  const body = $('[data-mov-body]');
  try {
    const rows = await api.get('/api/movimientos', true);
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6">Sin movimientos.</td></tr>'; return; }
    body.innerHTML = rows.map(m => `
      <tr>
        <td><b>${escapeHTML(m.plazaId)}</b></td>
        <td>${escapeHTML(m.placa)}</td>
        <td>${formatFechaHora(m.entradaTs)}</td>
        <td>${m.salidaTs ? formatFechaHora(m.salidaTs) : '—'}</td>
        <td>${m.total != null ? formatPrice(m.total) : '—'}</td>
        <td><span class="badge badge--${m.estado === 'activo' ? 'info' : 'ok'}">${escapeHTML(m.estado)}</span></td>
      </tr>`).join('');
  } catch (e) {
    if (e.status === 401) logout();
    else body.innerHTML = `<tr><td colspan="6">${escapeHTML(e.message)}</td></tr>`;
  }
}

function cargarTodo() { cargarResumen(); cargarReservas(); cargarMovimientos(); }
function logout() { clearToken(); location.reload(); }

$('[data-filtro-estado]').addEventListener('change', cargarReservas);
$('[data-refrescar]').addEventListener('click', cargarTodo);
$('[data-logout]').addEventListener('click', logout);

if (getToken()) mostrarPanel();
