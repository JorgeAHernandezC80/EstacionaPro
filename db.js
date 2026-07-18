/**
 * EstacionaPro — Backend: Base de datos
 * better-sqlite3: API síncrona, ideal para despliegues en Linux (Render/Railway).
 */

const Database = require('better-sqlite3');
const path = require('path');
const { PLAZAS } = require('./config');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'estacionapro.db');

const db = new Database(DB_PATH);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/* ---- Reservas (online) ---- */
db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    codigo         TEXT PRIMARY KEY,
    nombre         TEXT NOT NULL,
    email          TEXT NOT NULL,
    telefono       TEXT NOT NULL,
    placa          TEXT NOT NULL,
    tipo_vehiculo  TEXT NOT NULL,
    plaza_tipo     TEXT NOT NULL,
    segmento       TEXT NOT NULL DEFAULT 'temporal',
    membresia      TEXT NOT NULL DEFAULT 'sin',
    fecha          TEXT NOT NULL,
    hora_entrada   TEXT NOT NULL,
    duracion_horas INTEGER NOT NULL,
    total          REAL NOT NULL,
    estado         TEXT NOT NULL DEFAULT 'pendiente',
    creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_reservas_fecha  ON reservas(fecha)');
db.exec('CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado)');

/* ---- Plazas físicas (tablero de operación) ---- */
db.exec(`
  CREATE TABLE IF NOT EXISTS plazas (
    id      TEXT PRIMARY KEY,
    tipo    TEXT NOT NULL,
    estado  TEXT NOT NULL DEFAULT 'disponible'
  )
`);

/* ---- Movimientos: entradas y salidas de vehículos ---- */
db.exec(`
  CREATE TABLE IF NOT EXISTS movimientos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    plaza_id     TEXT NOT NULL,
    plaza_tipo   TEXT NOT NULL,
    placa        TEXT NOT NULL,
    tipo_vehiculo TEXT NOT NULL,
    segmento     TEXT NOT NULL,
    membresia    TEXT NOT NULL,
    entrada_ts   TEXT NOT NULL,
    salida_ts    TEXT,
    horas        REAL,
    total        REAL,
    estado       TEXT NOT NULL DEFAULT 'activo',
    FOREIGN KEY (plaza_id) REFERENCES plazas(id)
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_mov_estado ON movimientos(estado)');
db.exec('CREATE INDEX IF NOT EXISTS idx_mov_placa  ON movimientos(placa)');

/* ---- Sembrar plazas físicas a partir de la capacidad configurada ---- */
function seedPlazas() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM plazas').get().n;
  if (count > 0) return;
  const insert = db.prepare('INSERT INTO plazas (id, tipo, estado) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    for (const [tipo, cfg] of Object.entries(PLAZAS)) {
      for (let i = 1; i <= cfg.capacidad; i++) {
        const id = `${cfg.prefijo}-${String(i).padStart(2, '0')}`;
        insert.run(id, tipo, 'disponible');
      }
    }
  });
  tx();
}
seedPlazas();

module.exports = db;
