/**
 * EstacionaPro — Backend: Validación de reservas.
 * Nunca confiar en lo que llega del cliente: validar tipo, rango y coherencia.
 */

const {
  PLAZAS, TIPOS_VEHICULO, SEGMENTOS, MEMBRESIA,
  MAX_DURACION_HORAS, MIN_DURACION_HORAS,
} = require('./config');
const { calcularCobro } = require('./pricing');

const MAX_NOMBRE_LEN = 80;
const MAX_EMAIL_LEN = 120;
const CODIGO_RE = /^EP-\d{8}-\d{4}$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACA_RE = /^[A-Z0-9-]{4,10}$/;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Valida el objeto reserva tal como lo arma el frontend.
 * Lanza ValidationError (400) si algo no cumple el esquema.
 * @returns {object} reserva saneada (strings recortados, números normalizados)
 */
function validarReserva(reserva) {
  if (!reserva || typeof reserva !== 'object') {
    throw new ValidationError('Cuerpo de la petición inválido.');
  }

  const {
    codigo, nombre, email, telefono, placa, tipoVehiculo,
    plazaTipo, segmento, membresia, fecha, horaEntrada, duracionHoras, total,
  } = reserva;

  if (typeof codigo !== 'string' || !CODIGO_RE.test(codigo)) {
    throw new ValidationError('Código de reserva inválido o con formato incorrecto.');
  }
  if (typeof nombre !== 'string' || nombre.trim() === '' || nombre.length > MAX_NOMBRE_LEN) {
    throw new ValidationError('Nombre inválido.');
  }
  if (typeof email !== 'string' || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email.trim())) {
    throw new ValidationError('Correo electrónico inválido.');
  }
  const telefonoDigitos = String(telefono ?? '').replace(/\D/g, '');
  if (telefonoDigitos.length < 7 || telefonoDigitos.length > 15) {
    throw new ValidationError('Teléfono inválido.');
  }
  const placaNorm = String(placa ?? '').trim().toUpperCase();
  if (!PLACA_RE.test(placaNorm)) {
    throw new ValidationError('Placa inválida.');
  }
  if (!TIPOS_VEHICULO.includes(tipoVehiculo)) {
    throw new ValidationError('Tipo de vehículo inválido.');
  }
  if (!PLAZAS[plazaTipo]) {
    throw new ValidationError('Tipo de plaza inválido.');
  }
  if (!SEGMENTOS[segmento]) {
    throw new ValidationError('Segmento de cliente inválido.');
  }
  if (!MEMBRESIA[membresia]) {
    throw new ValidationError('Opción de membresía inválida.');
  }
  if (typeof fecha !== 'string' || !FECHA_RE.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    throw new ValidationError('Fecha inválida.');
  }
  if (typeof horaEntrada !== 'string' || !HORA_RE.test(horaEntrada)) {
    throw new ValidationError('Hora de entrada inválida.');
  }
  if (!Number.isInteger(duracionHoras) || duracionHoras < MIN_DURACION_HORAS || duracionHoras > MAX_DURACION_HORAS) {
    throw new ValidationError('Duración inválida.');
  }

  const cobro = calcularCobro({ plazaTipo, segmento, membresia, horas: duracionHoras });
  const totalNum = Number(total);
  if (!Number.isFinite(totalNum) || Math.abs(totalNum - cobro.total) > 0.01) {
    throw new ValidationError('El total no coincide con la tarifa vigente.');
  }

  return {
    codigo,
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    telefono: telefonoDigitos,
    placa: placaNorm,
    tipoVehiculo,
    plazaTipo,
    segmento,
    membresia,
    fecha,
    horaEntrada,
    duracionHoras,
    total: cobro.total,
  };
}

module.exports = { validarReserva, ValidationError };
