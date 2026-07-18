/**
 * EstacionaPro — Core: configuración de negocio (réplica frontend).
 * Permite cotizar tarifas sin llamadas de red. Debe mantenerse en sync con /config.js.
 */

export const PLAZAS = {
  descubierta:   { label: 'Plaza descubierta',  icon: 'fa-car',           precioHora: 3, capacidad: 24 },
  cubierta:      { label: 'Plaza cubierta',     icon: 'fa-warehouse',     precioHora: 5, capacidad: 16 },
  electrica:     { label: 'Plaza con cargador', icon: 'fa-charging-station', precioHora: 7, capacidad: 6 },
  discapacitado: { label: 'Plaza accesible',    icon: 'fa-wheelchair',    precioHora: 3, capacidad: 4 },
};

export const TIPOS_VEHICULO = [
  { key: 'automovil',   label: 'Automóvil' },
  { key: 'camioneta',   label: 'Camioneta / SUV' },
  { key: 'motocicleta', label: 'Motocicleta' },
  { key: 'electrico',   label: 'Vehículo eléctrico' },
];

export const SEGMENTOS = {
  temporal:   { label: 'Temporal',   desc: 'Pagas por horas de uso.',                 descuento: 0,    topeDiarioHoras: null },
  permanente: { label: 'Permanente', desc: 'Clientes frecuentes con tarifa reducida.', descuento: 0.15, topeDiarioHoras: 10 },
};

export const MEMBRESIA = {
  sin: { label: 'Sin membresía', desc: 'Tarifa estándar.',                    descuento: 0,    cuotaMensual: 0  },
  con: { label: 'Con membresía', desc: 'Ahorra 20% en cada estadía.',         descuento: 0.20, cuotaMensual: 39 },
};

export const MAX_DURACION_HORAS = 24;
export const MIN_DURACION_HORAS = 1;

/**
 * Calcula el cobro de una estadía (misma fórmula que el backend).
 * @returns {{ total:number, horasCobrables:number, bruto:number }}
 */
export function calcularCobro({ plazaTipo, segmento, membresia, horas }) {
  const plaza = PLAZAS[plazaTipo];
  const seg = SEGMENTOS[segmento];
  const mem = MEMBRESIA[membresia];
  if (!plaza || !seg || !mem || !Number.isFinite(horas) || horas < 0) {
    return { total: 0, horasCobrables: 0, bruto: 0 };
  }
  let horasCobrables = Math.max(1, Math.ceil(horas));
  if (seg.topeDiarioHoras) {
    const dias = Math.ceil(horasCobrables / 24) || 1;
    horasCobrables = Math.min(horasCobrables, seg.topeDiarioHoras * dias);
  }
  const bruto = plaza.precioHora * horasCobrables;
  const factor = (1 - seg.descuento) * (1 - mem.descuento);
  return {
    total: Number((bruto * factor).toFixed(2)),
    horasCobrables,
    bruto: Number(bruto.toFixed(2)),
  };
}

/** Tabla de precios completa (plaza × segmento × membresía). */
export function tablaPrecios() {
  const filas = [];
  for (const [plazaTipo, plaza] of Object.entries(PLAZAS)) {
    for (const [segKey, seg] of Object.entries(SEGMENTOS)) {
      for (const [memKey, mem] of Object.entries(MEMBRESIA)) {
        const factor = (1 - seg.descuento) * (1 - mem.descuento);
        filas.push({
          plazaTipo, plaza: plaza.label, segmento: seg.label, segKey,
          membresia: mem.label, memKey,
          precioHora: Number((plaza.precioHora * factor).toFixed(2)),
          cuotaMensual: mem.cuotaMensual,
        });
      }
    }
  }
  return filas;
}
