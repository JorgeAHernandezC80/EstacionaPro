/**
 * EstacionaPro — Página de inicio: disponibilidad en vivo + estadísticas.
 */
import { initUI } from '../core/ui.js';
import { api } from '../core/api.js';
import { PLAZAS } from '../core/config.js';
import { escapeHTML } from '../core/format.js';

initUI();

function pintarDisponibilidad(plazas, resumen) {
  const cont = document.querySelector('[data-live-availability]');
  if (cont) {
    const porTipo = {};
    for (const key of Object.keys(PLAZAS)) porTipo[key] = 0;
    plazas.forEach(p => { if (p.estado === 'disponible') porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1; });

    cont.innerHTML = Object.entries(PLAZAS).map(([key, cfg]) => {
      const libres = porTipo[key] || 0;
      const cls = libres === 0 ? 'none' : libres <= 3 ? 'low' : '';
      const texto = libres === 0 ? 'Lleno' : `${libres} libres`;
      return `<div class="live-row">
        <span><i class="fa-solid ${cfg.icon}"></i> ${escapeHTML(cfg.label)}</span>
        <span class="avail ${cls}">${texto}</span>
      </div>`;
    }).join('');
  }

  const set = (k, v) => { const el = document.querySelector(`[data-stat="${k}"]`); if (el) el.childNodes[0].nodeValue = v; };
  const setPct = (v) => { const el = document.querySelector('[data-stat="ocupacion"]'); if (el) el.childNodes[0].nodeValue = v; };
  if (resumen) {
    set('disponibles', resumen.disponible);
    set('ocupadas', resumen.ocupada);
    set('reparacion', resumen.reparacion);
    setPct(resumen.ocupacionPct);
  }
}

async function cargar() {
  try {
    const { plazas, resumen } = await api.get('/api/plazas');
    pintarDisponibilidad(plazas, resumen);
  } catch {
    const cont = document.querySelector('[data-live-availability]');
    if (cont) cont.innerHTML = '<div class="live-row"><span>No se pudo cargar la disponibilidad.</span></div>';
  }
}

cargar();
setInterval(cargar, 20000);
