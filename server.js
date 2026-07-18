/**
 * EstacionaPro — Backend: Servidor
 * Express + better-sqlite3. Sirve el frontend estático y expone:
 *   - API de reservas online
 *   - API de operación en tiempo real (entrada/salida, tablero de plazas)
 *   - API de tarifas y panel admin
 */

const express = require('express');
const db = require('./db');
const {
  PLAZAS, TIPOS_VEHICULO, SEGMENTOS, MEMBRESIA,
} = require('./config');
const { calcularCobro, horasEntre, tablaPrecios } = require('./pricing');
const { validarReserva, ValidationError } = require('./validation');

const PORT = process.env.PORT || 3000;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'estaciona-admin';
if (!process.env.ADMIN_TOKEN) {
  console.warn('[server] ADVERTENCIA: usando ADMIN_TOKEN por defecto. Configúralo en producción.');
}

const app = express();
app.disable('x-powered-by');

/* ---- Cabeceras de seguridad (defensa en profundidad) ----
 * Mitiga XSS, clickjacking, sniffing de MIME y fuga de referrer.
 * La CSP restringe de dónde se pueden cargar scripts/estilos/recursos. */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "connect-src 'self'",
  "frame-src https://www.openstreetmap.org",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '50kb' }));

/* Exige Content-Type JSON en escrituras: bloquea CSRF por formularios simples
 * y payloads con tipos inesperados. */
function requireJson(req, res, next) {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type debe ser application/json.' });
    }
  }
  next();
}
app.use('/api', requireJson);

app.use(express.static(__dirname, { extensions: ['html'] }));

/* ---- Autenticación admin/operador ---- */
const crypto = require('crypto');
function tokenValido(token) {
  const expected = Buffer.from(ADMIN_TOKEN);
  const received = Buffer.from(String(token || '').slice(0, 200));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tokenValido(token)) return res.status(401).json({ error: 'No autorizado.' });
  next();
}

/* ---- Rate limiting por IP (ventana deslizante simple) ----
 * `makeRateLimit(max, ventanaMs, bucket)` limita solicitudes por IP para
 * frenar abuso y ataques de fuerza bruta. Cada bucket es independiente. */
function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
}
function makeRateLimit(max, ventanaMs, bucket) {
  const mapa = new Map();
  return (req, res, next) => {
    const ip = `${bucket}:${ipDe(req)}`;
    const ahora = Date.now();
    const registro = mapa.get(ip) || { count: 0, desde: ahora };
    if (ahora - registro.desde > ventanaMs) { registro.count = 0; registro.desde = ahora; }
    registro.count++;
    mapa.set(ip, registro);
    if (registro.count > max) {
      const espera = Math.ceil((registro.desde + ventanaMs - ahora) / 1000);
      res.setHeader('Retry-After', Math.max(1, espera));
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
    }
    next();
  };
}
const rateLimit = makeRateLimit(40, 15 * 60 * 1000, 'reservas');
const authRateLimit = makeRateLimit(10, 15 * 60 * 1000, 'auth');
const opRateLimit = makeRateLimit(120, 60 * 1000, 'operacion');

/* =====================================================================
   TARIFAS
   ===================================================================== */
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('/api/tarifas', (req, res) => {
  res.json({ plazas: PLAZAS, segmentos: SEGMENTOS, membresia: MEMBRESIA, tabla: tablaPrecios() });
});

/* =====================================================================
   RESERVAS ONLINE
   ===================================================================== */
const ESTADOS_RESERVA = ['pendiente', 'confirmada', 'completada', 'cancelada'];

function reservasActivasPorFecha(fecha) {
  const rows = db.prepare(`
    SELECT plaza_tipo, COUNT(*) AS n FROM reservas
    WHERE fecha = ? AND estado IN ('pendiente','confirmada')
    GROUP BY plaza_tipo
  `).all(fecha);
  const mapa = {};
  rows.forEach(r => { mapa[r.plaza_tipo] = r.n; });
  return mapa;
}

app.get('/api/disponibilidad', (req, res) => {
  const { fecha } = req.query;
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Parámetro fecha inválido (YYYY-MM-DD).' });
  }
  const reservadas = reservasActivasPorFecha(fecha);
  const disponibilidad = {};
  for (const [tipo, cfg] of Object.entries(PLAZAS)) {
    const ocupadas = reservadas[tipo] || 0;
    disponibilidad[tipo] = {
      label: cfg.label, precioHora: cfg.precioHora, capacidad: cfg.capacidad,
      ocupadas, disponibles: Math.max(0, cfg.capacidad - ocupadas),
    };
  }
  res.json({ fecha, disponibilidad });
});

app.post('/api/reservas', rateLimit, (req, res) => {
  let reserva;
  try {
    reserva = validarReserva(req.body);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    throw err;
  }
  const reservadas = reservasActivasPorFecha(reserva.fecha);
  if ((reservadas[reserva.plazaTipo] || 0) >= PLAZAS[reserva.plazaTipo].capacidad) {
    return res.status(409).json({ error: 'No hay plazas disponibles de ese tipo para la fecha elegida.' });
  }
  try {
    db.prepare(`
      INSERT INTO reservas
        (codigo, nombre, email, telefono, placa, tipo_vehiculo, plaza_tipo, segmento, membresia, fecha, hora_entrada, duracion_horas, total)
      VALUES (@codigo,@nombre,@email,@telefono,@placa,@tipoVehiculo,@plazaTipo,@segmento,@membresia,@fecha,@horaEntrada,@duracionHoras,@total)
    `).run(reserva);
    res.status(201).json({ ...reserva, estado: 'pendiente' });
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err.message || '')) {
      return res.status(409).json({ error: 'Ya existe una reserva con ese código.' });
    }
    console.error('[POST /api/reservas]', err.message);
    res.status(500).json({ error: 'Error al guardar la reserva.' });
  }
});

app.get('/api/reservas', requireAuth, (req, res) => {
  const { fecha, estado } = req.query;
  let sql = 'SELECT * FROM reservas WHERE 1=1';
  const params = [];
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) { sql += ' AND fecha = ?'; params.push(fecha); }
  if (estado && ESTADOS_RESERVA.includes(estado)) { sql += ' AND estado = ?'; params.push(estado); }
  sql += ' ORDER BY fecha DESC, hora_entrada ASC LIMIT 300';
  res.json(db.prepare(sql).all(...params).map(mapReserva));
});

app.patch('/api/reservas/:codigo', requireAuth, (req, res) => {
  const { codigo } = req.params;
  const { estado } = req.body ?? {};
  if (!/^EP-\d{8}-\d{4}$/.test(codigo)) return res.status(400).json({ error: 'Código de reserva inválido.' });
  if (!ESTADOS_RESERVA.includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const info = db.prepare('UPDATE reservas SET estado = ? WHERE codigo = ?').run(estado, codigo);
  if (info.changes === 0) return res.status(404).json({ error: 'Reserva no encontrada.' });
  res.json({ codigo, estado });
});

/* =====================================================================
   OPERACIÓN EN TIEMPO REAL — entrada / salida / tablero de plazas
   ===================================================================== */

/** Resumen del estado del parqueadero (público, para el tablero). */
function resumenPlazas() {
  const porEstado = db.prepare('SELECT estado, COUNT(*) AS n FROM plazas GROUP BY estado').all();
  const base = { disponible: 0, ocupada: 0, reparacion: 0 };
  porEstado.forEach(r => { base[r.estado] = r.n; });
  const total = base.disponible + base.ocupada + base.reparacion;
  return { total, ...base, ocupacionPct: total ? Math.round((base.ocupada / total) * 100) : 0 };
}

app.get('/api/plazas', (req, res) => {
  const plazas = db.prepare(`
    SELECT p.id, p.tipo, p.estado, m.placa AS placa, m.entrada_ts AS entradaTs,
           m.segmento AS segmento, m.membresia AS membresia
    FROM plazas p
    LEFT JOIN movimientos m ON m.plaza_id = p.id AND m.estado = 'activo'
    ORDER BY p.id
  `).all();
  res.json({ resumen: resumenPlazas(), plazas });
});

/** POST /api/operacion/entrada — registra el ingreso de un vehículo. */
app.post('/api/operacion/entrada', opRateLimit, requireAuth, (req, res) => {
  const { placa, tipoVehiculo, plazaTipo, segmento, membresia } = req.body ?? {};
  const placaNorm = String(placa ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,10}$/.test(placaNorm)) return res.status(400).json({ error: 'Placa inválida.' });
  if (!TIPOS_VEHICULO.includes(tipoVehiculo)) return res.status(400).json({ error: 'Tipo de vehículo inválido.' });
  if (!PLAZAS[plazaTipo]) return res.status(400).json({ error: 'Tipo de plaza inválido.' });
  if (!SEGMENTOS[segmento]) return res.status(400).json({ error: 'Segmento inválido.' });
  if (!MEMBRESIA[membresia]) return res.status(400).json({ error: 'Membresía inválida.' });

  const yaAdentro = db.prepare("SELECT id FROM movimientos WHERE placa = ? AND estado = 'activo'").get(placaNorm);
  if (yaAdentro) return res.status(409).json({ error: 'Ese vehículo ya se encuentra dentro del parqueadero.' });

  const plaza = db.prepare("SELECT id FROM plazas WHERE tipo = ? AND estado = 'disponible' ORDER BY id LIMIT 1").get(plazaTipo);
  if (!plaza) return res.status(409).json({ error: 'No hay plazas disponibles de ese tipo.' });

  const entradaTs = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("UPDATE plazas SET estado = 'ocupada' WHERE id = ?").run(plaza.id);
    const info = db.prepare(`
      INSERT INTO movimientos (plaza_id, plaza_tipo, placa, tipo_vehiculo, segmento, membresia, entrada_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(plaza.id, plazaTipo, placaNorm, tipoVehiculo, segmento, membresia, entradaTs);
    return info.lastInsertRowid;
  });
  const id = tx();
  res.status(201).json({ id, plazaId: plaza.id, plazaTipo, placa: placaNorm, entradaTs, estado: 'activo' });
});

/** POST /api/operacion/salida — registra la salida y calcula el cobro. */
app.post('/api/operacion/salida', opRateLimit, requireAuth, (req, res) => {
  const { plazaId, placa } = req.body ?? {};
  let mov;
  if (plazaId) {
    mov = db.prepare("SELECT * FROM movimientos WHERE plaza_id = ? AND estado = 'activo'").get(String(plazaId));
  } else if (placa) {
    mov = db.prepare("SELECT * FROM movimientos WHERE placa = ? AND estado = 'activo'").get(String(placa).trim().toUpperCase());
  } else {
    return res.status(400).json({ error: 'Indica plazaId o placa.' });
  }
  if (!mov) return res.status(404).json({ error: 'No hay un vehículo activo en esa plaza/placa.' });

  const salidaTs = new Date().toISOString();
  const horas = horasEntre(mov.entrada_ts, salidaTs);
  const cobro = calcularCobro({
    plazaTipo: mov.plaza_tipo, segmento: mov.segmento, membresia: mov.membresia, horas,
  });

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE movimientos SET salida_ts = ?, horas = ?, total = ?, estado = 'finalizado' WHERE id = ?
    `).run(salidaTs, Number(horas.toFixed(2)), cobro.total, mov.id);
    db.prepare("UPDATE plazas SET estado = 'disponible' WHERE id = ?").run(mov.plaza_id);
  });
  tx();

  res.json({
    id: mov.id, plazaId: mov.plaza_id, placa: mov.placa,
    entradaTs: mov.entrada_ts, salidaTs,
    horas: Number(horas.toFixed(2)), horasCobrables: cobro.horasCobrables,
    total: cobro.total, desglose: cobro.desglose,
    segmento: mov.segmento, membresia: mov.membresia,
  });
});

/** PATCH /api/plazas/:id — poner una plaza en reparación o devolverla a disponible. */
app.patch('/api/plazas/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { estado } = req.body ?? {};
  if (!['disponible', 'reparacion'].includes(estado)) {
    return res.status(400).json({ error: "Estado permitido: 'disponible' o 'reparacion'." });
  }
  const plaza = db.prepare('SELECT * FROM plazas WHERE id = ?').get(id);
  if (!plaza) return res.status(404).json({ error: 'Plaza no encontrada.' });
  if (plaza.estado === 'ocupada') {
    return res.status(409).json({ error: 'La plaza está ocupada; registra la salida del vehículo primero.' });
  }
  db.prepare('UPDATE plazas SET estado = ? WHERE id = ?').run(estado, id);
  res.json({ id, estado, resumen: resumenPlazas() });
});

/** GET /api/movimientos — historial reciente (admin). */
app.get('/api/movimientos', requireAuth, (req, res) => {
  const { estado } = req.query;
  let sql = 'SELECT * FROM movimientos WHERE 1=1';
  const params = [];
  if (estado && ['activo', 'finalizado'].includes(estado)) { sql += ' AND estado = ?'; params.push(estado); }
  sql += ' ORDER BY id DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params).map(mapMovimiento));
});

/* =====================================================================
   PANEL ADMIN — auth y resumen
   ===================================================================== */
app.post('/api/auth', authRateLimit, (req, res) => {
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') return res.status(400).json({ error: 'Falta la contraseña.' });
  if (!tokenValido(password)) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  res.json({ token: ADMIN_TOKEN });
});

app.get('/api/resumen', requireAuth, (req, res) => {
  const reservas = db.prepare('SELECT COUNT(*) AS n FROM reservas').get().n;
  const ingresosReservas = db.prepare(
    "SELECT COALESCE(SUM(total),0) AS s FROM reservas WHERE estado IN ('confirmada','completada')"
  ).get().s;
  const ingresosOperacion = db.prepare(
    "SELECT COALESCE(SUM(total),0) AS s FROM movimientos WHERE estado = 'finalizado'"
  ).get().s;
  const activos = db.prepare("SELECT COUNT(*) AS n FROM movimientos WHERE estado = 'activo'").get().n;
  res.json({
    reservas,
    ingresos: Number((ingresosReservas + ingresosOperacion).toFixed(2)),
    vehiculosActivos: activos,
    plazas: resumenPlazas(),
  });
});

/* ---- Normalizadores ---- */
function mapReserva(r) {
  return {
    codigo: r.codigo, nombre: r.nombre, email: r.email, telefono: r.telefono,
    placa: r.placa, tipoVehiculo: r.tipo_vehiculo, plazaTipo: r.plaza_tipo,
    segmento: r.segmento, membresia: r.membresia, fecha: r.fecha, horaEntrada: r.hora_entrada,
    duracionHoras: r.duracion_horas, total: r.total, estado: r.estado, creadoEn: r.creado_en,
  };
}
function mapMovimiento(m) {
  return {
    id: m.id, plazaId: m.plaza_id, plazaTipo: m.plaza_tipo, placa: m.placa,
    tipoVehiculo: m.tipo_vehiculo, segmento: m.segmento, membresia: m.membresia,
    entradaTs: m.entrada_ts, salidaTs: m.salida_ts, horas: m.horas, total: m.total, estado: m.estado,
  };
}

/* ---- 404 API y manejador de errores ---- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`[server] EstacionaPro escuchando en http://localhost:${PORT}`));
}

module.exports = { app };
