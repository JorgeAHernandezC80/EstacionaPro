/**
 * EstacionaPro — Motor de tarifas.
 * Lógica algorítmica de cobro compartida entre reservas y operación (salida de vehículos).
 */

const { PLAZAS, SEGMENTOS, MEMBRESIA } = require('./config');

/**
 * Calcula el cobro de una estadía.
 * total = precioHora(plaza) * horasCobrables * (1 - descSegmento) * (1 - descMembresia)
 * Las horas se redondean hacia arriba (fracción de hora = hora completa).
 * Los clientes permanentes tienen un tope de horas cobrables por día.
 *
 * @param {object} p
 * @param {string} p.plazaTipo   clave en PLAZAS
 * @param {string} p.segmento    clave en SEGMENTOS (temporal|permanente)
 * @param {string} p.membresia   clave en MEMBRESIA (con|sin)
 * @param {number} p.horas       horas transcurridas (puede ser decimal)
 * @returns {{ total:number, horasCobrables:number, precioHora:number, desglose:object }}
 */
function calcularCobro({ plazaTipo, segmento, membresia, horas }) {
  const plaza = PLAZAS[plazaTipo];
  const seg = SEGMENTOS[segmento];
  const mem = MEMBRESIA[membresia];
  if (!plaza) throw new Error(`Tipo de plaza inválido: ${plazaTipo}`);
  if (!seg)   throw new Error(`Segmento inválido: ${segmento}`);
  if (!mem)   throw new Error(`Membresía inválida: ${membresia}`);
  if (!Number.isFinite(horas) || horas < 0) throw new Error('Horas inválidas.');

  let horasCobrables = Math.max(1, Math.ceil(horas));
  if (seg.topeDiarioHoras) {
    const dias = Math.ceil(horasCobrables / 24) || 1;
    horasCobrables = Math.min(horasCobrables, seg.topeDiarioHoras * dias);
  }

  const bruto = plaza.precioHora * horasCobrables;
  const factor = (1 - seg.descuento) * (1 - mem.descuento);
  const total = Number((bruto * factor).toFixed(2));

  return {
    total,
    horasCobrables,
    precioHora: plaza.precioHora,
    desglose: {
      bruto: Number(bruto.toFixed(2)),
      descuentoSegmento: seg.descuento,
      descuentoMembresia: mem.descuento,
    },
  };
}

/**
 * Diferencia en horas (decimal) entre dos timestamps ISO.
 */
function horasEntre(entradaISO, salidaISO) {
  const ms = new Date(salidaISO).getTime() - new Date(entradaISO).getTime();
  return ms / (1000 * 60 * 60);
}

/**
 * Construye la tabla de precios publicable: para cada plaza y cada combinación
 * de segmento × membresía, el precio efectivo por hora.
 */
function tablaPrecios() {
  const filas = [];
  for (const [plazaTipo, plaza] of Object.entries(PLAZAS)) {
    for (const [segKey, seg] of Object.entries(SEGMENTOS)) {
      for (const [memKey, mem] of Object.entries(MEMBRESIA)) {
        const factor = (1 - seg.descuento) * (1 - mem.descuento);
        filas.push({
          plazaTipo,
          plaza: plaza.label,
          segmento: seg.label,
          membresia: mem.label,
          precioHora: Number((plaza.precioHora * factor).toFixed(2)),
          cuotaMensual: mem.cuotaMensual,
        });
      }
    }
  }
  return filas;
}

module.exports = { calcularCobro, horasEntre, tablaPrecios };
