/**
 * EstacionaPro — Página de tarifas: tarjetas de plan y tabla comparativa.
 */
import { initUI } from '../core/ui.js';
import { PLAZAS, SEGMENTOS, MEMBRESIA, calcularCobro } from '../core/config.js';
import { formatPrice, escapeHTML } from '../core/format.js';

initUI();

/* Tarjetas destacadas por combinación de plan. */
function pintarPlanes() {
  const cont = document.querySelector('[data-plan-cards]');
  if (!cont) return;
  const planes = [
    { seg: 'temporal',   mem: 'sin', destacado: false },
    { seg: 'permanente', mem: 'sin', destacado: false },
    { seg: 'permanente', mem: 'con', destacado: true },
  ];
  cont.innerHTML = planes.map(({ seg, mem, destacado }) => {
    const s = SEGMENTOS[seg], m = MEMBRESIA[mem];
    const ref = calcularCobro({ plazaTipo: 'cubierta', segmento: seg, membresia: mem, horas: 1 });
    const ahorro = Math.round((s.descuento + m.descuento - s.descuento * m.descuento) * 100);
    return `<article class="price-card ${destacado ? 'price-card--featured' : ''}">
      <h3>${escapeHTML(s.label)} ${mem === 'con' ? '+ Membresía' : ''}</h3>
      <div class="price">${formatPrice(ref.total)}<small>/h plaza cubierta</small></div>
      <ul>
        <li><i class="fa-solid fa-check"></i> ${escapeHTML(s.desc)}</li>
        <li><i class="fa-solid fa-check"></i> ${ahorro > 0 ? `Ahorras ${ahorro}% sobre la tarifa base` : 'Tarifa base estándar'}</li>
        <li><i class="fa-solid fa-check"></i> ${mem === 'con' ? `Membresía ${formatPrice(m.cuotaMensual)}/mes` : 'Sin cuota mensual'}</li>
        <li><i class="fa-solid fa-check"></i> Acceso a los 4 tipos de plaza</li>
      </ul>
      <a href="reservar.html" class="btn ${destacado ? 'btn--accent' : 'btn--ghost'} btn--block">Reservar</a>
    </article>`;
  }).join('');
}

/* Tabla comparativa con pestañas por plan. */
let planActual = { seg: 'temporal', mem: 'sin' };

function pintarTabs() {
  const cont = document.querySelector('[data-pricing-tabs]');
  if (!cont) return;
  const combos = [
    { seg: 'temporal',   mem: 'sin', label: 'Temporal' },
    { seg: 'temporal',   mem: 'con', label: 'Temporal + Membresía' },
    { seg: 'permanente', mem: 'sin', label: 'Permanente' },
    { seg: 'permanente', mem: 'con', label: 'Permanente + Membresía' },
  ];
  cont.innerHTML = combos.map((c, i) =>
    `<button data-seg="${c.seg}" data-mem="${c.mem}" class="${i === 0 ? 'is-active' : ''}">${escapeHTML(c.label)}</button>`
  ).join('');
  cont.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      cont.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      planActual = { seg: btn.dataset.seg, mem: btn.dataset.mem };
      pintarTabla();
    });
  });
}

function pintarTabla() {
  const body = document.querySelector('[data-pricing-body]');
  if (!body) return;
  const { seg, mem } = planActual;
  body.innerHTML = Object.entries(PLAZAS).map(([key, cfg]) => {
    const c = calcularCobro({ plazaTipo: key, segmento: seg, membresia: mem, horas: 1 });
    const ahorro = cfg.precioHora - c.total;
    return `<tr>
      <td><i class="fa-solid ${cfg.icon}" style="color:var(--brand-500);margin-right:.5rem"></i>${escapeHTML(cfg.label)}</td>
      <td>${formatPrice(cfg.precioHora)}</td>
      <td><b>${formatPrice(c.total)}</b></td>
      <td>${ahorro > 0 ? formatPrice(ahorro) : '—'}</td>
    </tr>`;
  }).join('');
}

pintarPlanes();
pintarTabs();
pintarTabla();
