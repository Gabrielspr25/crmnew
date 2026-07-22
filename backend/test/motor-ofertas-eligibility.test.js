import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findEligibleEquipment } from '../src/services/motorOfertasEligibility.js';

function offer(overrides = {}) {
  return {
    id: 'oferta-gratis-35',
    estado_comercial: 'confirmada',
    vigencia_documental: 'vigente',
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21' },
    tipo_linea: 'individual',
    plan: { min: 35, max: 35 },
    eventos: ['linea_nueva', 'portabilidad', 'renovacion'],
    trade_in: { renovacion_requerido: false },
    limite_ban: { aplica: false },
    equipos: [{
      id: 'moto-g-play-2024',
      modelo_oficial: 'Motorola Moto G Play 2024',
      coincidencia: 'exacta',
      precio_regular: 129.99,
      plazos: [{ meses: 24, pago_mensual: 5.42 }],
    }],
    beneficio: { tipo: 'gratis' },
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    linea: {
      id: 'linea-1',
      tipo: 'individual',
      plan: { codigo: 'RED3535', monto: 35 },
      evento: 'linea_nueva',
      convergente: false,
      trade_in: { estado: 'no_requiere', validado: false },
    },
    contexto_ban: { posicion_en_ban: 1, beneficios_usados_por_oferta: {} },
    ...overrides,
  };
}

test('devuelve solo el equipo de la oferta exacta para Individual $35', () => {
  const result = findEligibleEquipment({ offers: [offer()], request: request(), version: { estado: 'vigente' } });
  assert.equal(result.equipos.length, 1);
  assert.equal(result.equipos[0].equipo.id, 'moto-g-play-2024');
  assert.equal(result.equipos[0].beneficio.tipo, 'gratis');
});

test('renovacion con trade-in requerido no aplica hasta validarlo', () => {
  const result = findEligibleEquipment({
    offers: [offer({ trade_in: { renovacion_requerido: true } })],
    request: request({ linea: { ...request().linea, evento: 'renovacion', trade_in: { estado: 'pendiente', validado: false } } }),
    version: { estado: 'vigente' },
  });
  assert.equal(result.equipos.length, 0);
  assert.ok(result.validaciones.some((item) => item.codigo === 'trade_in_requerido'));
});

test('limite BAN cambia beneficio sin ocultar el equipo', () => {
  const result = findEligibleEquipment({
    offers: [offer({ limite_ban: { aplica: true, cantidad: 4, fuera_limite: 'financiado_si_fuente_lo_permite' } })],
    request: request({ contexto_ban: { posicion_en_ban: 5, beneficios_usados_por_oferta: { 'oferta-gratis-35': 4 } } }),
    version: { estado: 'vigente' },
  });
  assert.equal(result.equipos.length, 1);
  assert.equal(result.equipos[0].beneficio.tipo, 'financiado');
  assert.ok(result.equipos[0].validaciones.some((item) => item.codigo === 'limite_ban_excedido'));
});

test('una fuente vencida se muestra con advertencia y bloquea aplicacion automatica', () => {
  const result = findEligibleEquipment({
    offers: [offer({ vigencia_documental: 'vencida_pendiente_reemplazo' })],
    request: request(),
    version: { estado: 'vigente' },
  });
  assert.equal(result.equipos.length, 1);
  assert.equal(result.equipos[0].aplicacion_automatica, false);
  assert.ok(result.equipos[0].validaciones.some((item) => item.codigo === 'fuente_vencida'));
});

test('Business RED no se habilita usando una oferta individual del mismo monto', () => {
  const result = findEligibleEquipment({
    offers: [offer()],
    request: request({ linea: {
      ...request().linea,
      tipo: 'multilinea_business_red',
      familia_business_red: 'business_red_plus',
      plan: { codigo: 'BRPLUS', monto: 65 },
    } }),
    version: { estado: 'vigente' },
  });
  assert.equal(result.equipos.length, 0);
});
