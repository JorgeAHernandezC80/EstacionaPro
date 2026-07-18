/**
 * EstacionaPro — Configuración compartida del negocio.
 * Fuente única de verdad: tipos de plaza, capacidad, tarifas y segmentos de cliente.
 * (El frontend replica estos valores en JS/core/config.js para cotizar sin llamadas de red.)
 */

/* Tipos de plaza: precio base por hora y capacidad instalada. */
const PLAZAS = {
  descubierta:   { label: 'Plaza descubierta',  precioHora: 3, capacidad: 24, prefijo: 'A' },
  cubierta:      { label: 'Plaza cubierta',     precioHora: 5, capacidad: 16, prefijo: 'B' },
  electrica:     { label: 'Plaza con cargador', precioHora: 7, capacidad: 6,  prefijo: 'E' },
  discapacitado: { label: 'Plaza accesible',    precioHora: 3, capacidad: 4,  prefijo: 'D' },
};

const TIPOS_VEHICULO = ['automovil', 'camioneta', 'motocicleta', 'electrico'];

/* Segmentos de cliente: descuento sobre la tarifa base. */
const SEGMENTOS = {
  temporal:   { label: 'Temporal',   descuento: 0,    topeDiarioHoras: null },
  permanente: { label: 'Permanente', descuento: 0.15, topeDiarioHoras: 10 },
};

/* Membresía: descuento adicional y cuota mensual (informativa). */
const MEMBRESIA = {
  sin: { label: 'Sin membresía', descuento: 0,    cuotaMensual: 0  },
  con: { label: 'Con membresía', descuento: 0.20, cuotaMensual: 39 },
};

const ESTADOS_PLAZA = ['disponible', 'ocupada', 'reparacion'];

const MAX_DURACION_HORAS = 24;
const MIN_DURACION_HORAS = 1;

module.exports = {
  PLAZAS, TIPOS_VEHICULO, SEGMENTOS, MEMBRESIA, ESTADOS_PLAZA,
  MAX_DURACION_HORAS, MIN_DURACION_HORAS,
};
