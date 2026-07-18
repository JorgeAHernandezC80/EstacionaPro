/**
 * EstacionaPro — Core: utilidades de formato.
 */

/** Formatea un número como moneda (USD, 2 decimales). */
export function formatPrice(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

/** Escapa texto antes de interpolarlo en innerHTML. */
export function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** Fecha ISO (YYYY-MM-DD) de hoy en zona local. */
export function hoyISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

/** Formatea un timestamp ISO como fecha/hora legible en español. */
export function formatFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** Duración legible a partir de horas decimales. */
export function formatDuracion(horas) {
  if (!Number.isFinite(horas)) return '—';
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
