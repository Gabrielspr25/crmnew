import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLineaMovil } from '../src/services/motorOfertasContract.js';

function linea(overrides = {}) {
  return {
    id: 'linea-1',
    tipo: 'individual',
    plan: { codigo: 'RED3535', monto: 35 },
    evento: 'linea_nueva',
    convergente: false,
    trade_in: { estado: 'no_requiere', validado: false },
    ...overrides,
  };
}

test('acepta una linea individual con plan y evento propios', () => {
  const result = validateLineaMovil(linea());
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('exige familia Business RED para una linea multilinea', () => {
  const result = validateLineaMovil(linea({
    tipo: 'multilinea_business_red',
    plan: { codigo: 'BRPLUS', monto: 65 },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.codigo === 'familia_business_red_requerida'));
});

test('no acepta un monto individual como sustituto de una familia Business RED', () => {
  const result = validateLineaMovil(linea({
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    plan: { codigo: 'RED4560', monto: 45 },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.codigo === 'plan_business_red_invalido'));
});

test('renovacion conserva el estado de trade-in para que elegibilidad lo evalúe', () => {
  const result = validateLineaMovil(linea({
    evento: 'renovacion',
    trade_in: { estado: 'pendiente', validado: false },
  }));

  assert.deepEqual(result, { ok: true, errors: [] });
});

test('BYOP es modalidad de linea Business RED y no tipo de linea separado', () => {
  const result = validateLineaMovil(linea({
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    modalidad_linea: 'byop',
    account_type: 'Business BYOP Corporate',
    plan: { codigo: 'BRPLUS', nombre: 'Business Red Plus BYOP-BAN', monto: 65 },
    evento: 'portabilidad',
  }));

  assert.deepEqual(result, { ok: true, errors: [] });
});

test('rechaza modalidad BYOP heredada como tipo de linea', () => {
  const result = validateLineaMovil(linea({
    tipo: 'multilinea_business_red_byop_ban',
    modalidad_linea: 'byop',
    plan: { codigo: 'BRPLUS', monto: 65 },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.codigo === 'tipo_linea_invalido'));
});

test('accountType no sustituye ni decide la modalidad de linea', () => {
  const result = validateLineaMovil(linea({
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    modalidad_linea: 'financiamiento',
    account_type: 'Business BYOP Corporate',
    plan: { codigo: 'BRPLUS', nombre: 'Business Red Plus', monto: 65 },
  }));

  assert.deepEqual(result, { ok: true, errors: [] });
});

test('rechaza modalidad de linea desconocida', () => {
  const result = validateLineaMovil(linea({
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    modalidad_linea: 'modo_no_oficial',
    plan: { codigo: 'BRPLUS', monto: 65 },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.codigo === 'modalidad_linea_invalida'));
});
