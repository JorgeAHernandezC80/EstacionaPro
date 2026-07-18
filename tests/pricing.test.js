/**
 * Pruebas del motor de tarifas (lógica algorítmica de cobro).
 */
const { calcularCobro, horasEntre, tablaPrecios } = require('../pricing');

describe('calcularCobro', () => {
  test('tarifa base (temporal, sin membresía) = precioHora × horas', () => {
    const r = calcularCobro({ plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin', horas: 2 });
    expect(r.total).toBe(6);
    expect(r.horasCobrables).toBe(2);
    expect(r.precioHora).toBe(3);
  });

  test('aplica descuentos de segmento y membresía de forma multiplicativa', () => {
    // 5 × 3 × (1-0.15) × (1-0.20) = 10.2
    const r = calcularCobro({ plazaTipo: 'cubierta', segmento: 'permanente', membresia: 'con', horas: 3 });
    expect(r.total).toBe(10.2);
    expect(r.desglose).toEqual({ bruto: 15, descuentoSegmento: 0.15, descuentoMembresia: 0.2 });
  });

  test('redondea las fracciones de hora hacia arriba (mínimo 1 hora)', () => {
    expect(calcularCobro({ plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin', horas: 0 }).horasCobrables).toBe(1);
    expect(calcularCobro({ plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin', horas: 1.1 }).horasCobrables).toBe(2);
    expect(calcularCobro({ plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin', horas: 2.0 }).horasCobrables).toBe(2);
  });

  test('el cliente permanente tiene tope de horas cobrables por día', () => {
    // 30h reales → 2 días → tope 10×2 = 20 horas cobrables
    const r = calcularCobro({ plazaTipo: 'descubierta', segmento: 'permanente', membresia: 'sin', horas: 30 });
    expect(r.horasCobrables).toBe(20);
  });

  test('el cliente temporal no tiene tope', () => {
    const r = calcularCobro({ plazaTipo: 'descubierta', segmento: 'temporal', membresia: 'sin', horas: 30 });
    expect(r.horasCobrables).toBe(30);
  });

  test('rechaza parámetros inválidos', () => {
    expect(() => calcularCobro({ plazaTipo: 'x', segmento: 'temporal', membresia: 'sin', horas: 1 })).toThrow(/plaza/i);
    expect(() => calcularCobro({ plazaTipo: 'cubierta', segmento: 'x', membresia: 'sin', horas: 1 })).toThrow(/segmento/i);
    expect(() => calcularCobro({ plazaTipo: 'cubierta', segmento: 'temporal', membresia: 'x', horas: 1 })).toThrow(/membres/i);
    expect(() => calcularCobro({ plazaTipo: 'cubierta', segmento: 'temporal', membresia: 'sin', horas: -1 })).toThrow(/horas/i);
    expect(() => calcularCobro({ plazaTipo: 'cubierta', segmento: 'temporal', membresia: 'sin', horas: NaN })).toThrow(/horas/i);
  });
});

describe('horasEntre', () => {
  test('calcula la diferencia decimal en horas', () => {
    expect(horasEntre('2026-01-01T08:00:00Z', '2026-01-01T10:30:00Z')).toBeCloseTo(2.5, 5);
  });
});

describe('tablaPrecios', () => {
  test('genera una fila por plaza × segmento × membresía (4×2×2 = 16)', () => {
    const filas = tablaPrecios();
    expect(filas).toHaveLength(16);
  });

  test('el precio efectivo aplica ambos descuentos', () => {
    const fila = tablaPrecios().find(f =>
      f.plazaTipo === 'cubierta' && f.segmento === 'Permanente' && f.membresia === 'Con membresía');
    expect(fila.precioHora).toBe(3.4); // 5 × 0.85 × 0.8
  });
});
