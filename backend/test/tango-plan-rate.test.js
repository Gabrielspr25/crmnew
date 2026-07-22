import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePlanRateFromTangoRows } from '../src/tango.js';

test('resuelve A884 desde codigovoz de Tango aunque incluya el precio', () => {
  const result = resolvePlanRateFromTangoRows('A884', [
    {
      codigovoz: 'A884 74.99',
      nombre: 'GPON BUS PRUS ILIM + 300MB',
      rate: 74.99,
      tipo: 'fijo',
      activo: true,
    },
  ]);

  assert.deepEqual(result, {
    value: 74.99,
    source: 'tango-api-v2',
    ambiguous: false,
  });
});

test('no elige un precio cuando Tango devuelve tarifas distintas para el mismo codigo', () => {
  const result = resolvePlanRateFromTangoRows('A884', [
    { codigovoz: 'A884 74.99', rate: 74.99, activo: true },
    { codigovoz: 'A884 99.99', rate: 99.99, activo: true },
  ]);

  assert.deepEqual(result, {
    value: null,
    source: null,
    ambiguous: true,
  });
});
