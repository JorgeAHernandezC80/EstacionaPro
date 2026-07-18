/**
 * Pruebas de la API (flujos de datos end-to-end con supertest):
 * reservas, autenticación, seguridad y operación entrada/salida/reparación.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Base de datos aislada por ejecución (antes de requerir db/server).
const TMP_DB = path.join(os.tmpdir(), `ep_test_${process.pid}.db`);
process.env.DB_PATH = TMP_DB;
process.env.ADMIN_TOKEN = 'test-token';

const request = require('supertest');
const { app } = require('../server');
const { calcularCobro } = require('../pricing');

const BEARER = { Authorization: 'Bearer test-token' };

afterAll(() => {
  for (const suf of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(TMP_DB + suf); } catch { /* noop */ }
  }
});

describe('salud y tarifas (público)', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/tarifas devuelve la tabla combinatoria', async () => {
    const res = await request(app).get('/api/tarifas');
    expect(res.status).toBe(200);
    expect(res.body.tabla).toHaveLength(16);
    expect(Object.keys(res.body.plazas)).toEqual(
      expect.arrayContaining(['descubierta', 'cubierta', 'electrica', 'discapacitado']));
  });
});

describe('cabeceras de seguridad', () => {
  test('incluye CSP, nosniff y anti-clickjacking; oculta x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('rechaza escrituras sin Content-Type JSON (415)', async () => {
    const res = await request(app).post('/api/reservas').set('Content-Type', 'text/plain').send('x');
    expect(res.status).toBe(415);
  });
});

describe('reservas online', () => {
  const base = {
    codigo: 'EP-20260801-0001', nombre: 'Ana Ruiz', email: 'ana@example.com',
    telefono: '3001234567', placa: 'ABC123', tipoVehiculo: 'automovil',
    plazaTipo: 'cubierta', segmento: 'permanente', membresia: 'con',
    fecha: '2026-08-01', horaEntrada: '08:00', duracionHoras: 3,
  };
  const total = calcularCobro({ plazaTipo: 'cubierta', segmento: 'permanente', membresia: 'con', horas: 3 }).total;

  test('crea una reserva con total válido', async () => {
    const res = await request(app).post('/api/reservas').send({ ...base, total });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
  });

  test('rechaza un total manipulado (el backend recalcula)', async () => {
    const res = await request(app).post('/api/reservas').send({ ...base, codigo: 'EP-20260801-0002', total: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/total/i);
  });

  test('rechaza código duplicado', async () => {
    const res = await request(app).post('/api/reservas').send({ ...base, total });
    expect(res.status).toBe(409);
  });
});

describe('autenticación', () => {
  test('contraseña incorrecta → 401', async () => {
    const res = await request(app).post('/api/auth').send({ password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('contraseña correcta → token', async () => {
    const res = await request(app).post('/api/auth').send({ password: 'test-token' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('test-token');
  });

  test('endpoint protegido sin token → 401', async () => {
    expect((await request(app).get('/api/resumen')).status).toBe(401);
    expect((await request(app).get('/api/movimientos')).status).toBe(401);
  });
});

describe('operación: entrada → salida → reparación', () => {
  test('entrada asigna la primera plaza disponible y la marca ocupada', async () => {
    const res = await request(app).post('/api/operacion/entrada').set(BEARER)
      .send({ placa: 'XYZ789', tipoVehiculo: 'automovil', plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin' });
    expect(res.status).toBe(201);
    expect(res.body.plazaId).toBe('A-01');

    const plazas = await request(app).get('/api/plazas');
    const a01 = plazas.body.plazas.find(p => p.id === 'A-01');
    expect(a01.estado).toBe('ocupada');
    expect(plazas.body.resumen.ocupada).toBe(1);
  });

  test('rechaza el mismo vehículo dos veces (409)', async () => {
    const res = await request(app).post('/api/operacion/entrada').set(BEARER)
      .send({ placa: 'XYZ789', tipoVehiculo: 'automovil', plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin' });
    expect(res.status).toBe(409);
  });

  test('rechaza enums inválidos (400)', async () => {
    const res = await request(app).post('/api/operacion/entrada').set(BEARER)
      .send({ placa: 'JJJ111', tipoVehiculo: 'tanque', plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin' });
    expect(res.status).toBe(400);
  });

  test('salida por placa calcula el cobro y libera la plaza', async () => {
    const res = await request(app).post('/api/operacion/salida').set(BEARER).send({ placa: 'XYZ789' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
    expect(res.body.horasCobrables).toBeGreaterThanOrEqual(1);

    const plazas = await request(app).get('/api/plazas');
    expect(plazas.body.plazas.find(p => p.id === 'A-01').estado).toBe('disponible');
  });

  test('marca una plaza en reparación y la devuelve a disponible', async () => {
    const rep = await request(app).patch('/api/plazas/A-02').set(BEARER).send({ estado: 'reparacion' });
    expect(rep.status).toBe(200);
    expect(rep.body.estado).toBe('reparacion');

    const back = await request(app).patch('/api/plazas/A-02').set(BEARER).send({ estado: 'disponible' });
    expect(back.status).toBe(200);
  });

  test('no permite reparar una plaza ocupada (409)', async () => {
    await request(app).post('/api/operacion/entrada').set(BEARER)
      .send({ placa: 'OCC111', tipoVehiculo: 'automovil', plazaTipo: 'cubierta', segmento: 'temporal', membresia: 'sin' });
    const plazas = await request(app).get('/api/plazas');
    const ocupada = plazas.body.plazas.find(p => p.estado === 'ocupada' && p.tipo === 'cubierta');
    const res = await request(app).patch(`/api/plazas/${ocupada.id}`).set(BEARER).send({ estado: 'reparacion' });
    expect(res.status).toBe(409);
  });
});
