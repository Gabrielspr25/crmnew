import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePlanRateFromCatalogRows, resolvePlanRateWithFallback } from '../src/services/planRateCatalog.js';

test('resuelve una renta historica por SOC exacto', () => {
  const result = resolvePlanRateFromCatalogRows('A8842', [
    { soc: 'A8841', monthly_rate: 74.99 },
    { soc: 'A8842', monthly_rate: 74.99 },
  ]);

  assert.deepEqual(result, {
    value: 74.99,
    source: 'catalogo-historico-plan-rates',
    matched_code: 'A8842',
  });
});

test('no convierte una renta cero del catalogo en precio del plan', () => {
  const result = resolvePlanRateFromCatalogRows('CCPRO', [
    { soc: 'CCPRO', monthly_rate: 0 },
  ]);

  assert.deepEqual(result, {
    value: null,
    source: null,
    matched_code: 'CCPRO',
  });
});

test('no elimina el sufijo de un SOC movil al consultar el catalogo', () => {
  const result = resolvePlanRateFromCatalogRows('BREDP2', [
    { soc: 'BREDP', monthly_rate: 65 },
    { soc: 'BREDP2', monthly_rate: 45 },
  ]);

  assert.equal(result.value, 45);
  assert.equal(result.matched_code, 'BREDP2');
});

test('prioriza Tango y solo usa catalogo si Tango no tiene una renta valida', async () => {
  const tango = await resolvePlanRateWithFallback({
    originalCode: 'A8842',
    lookupCode: 'A884',
    resolveTango: async () => ({ value: 80, source: 'tango-api-v2', ambiguous: false }),
    resolveCatalog: async () => ({ value: 74.99, source: 'catalogo-historico-plan-rates', matched_code: 'A8842' }),
  });
  assert.equal(tango.value, 80);
  assert.equal(tango.source, 'tango-api-v2');

  const catalog = await resolvePlanRateWithFallback({
    originalCode: 'A8842',
    lookupCode: 'A884',
    resolveTango: async () => ({ value: null, source: null, ambiguous: false }),
    resolveCatalog: async (codes) => {
      assert.deepEqual(codes, ['A8842', 'A884']);
      return { value: 74.99, source: 'catalogo-historico-plan-rates', matched_code: 'A8842' };
    },
  });
  assert.equal(catalog.value, 74.99);
  assert.equal(catalog.source, 'catalogo-historico-plan-rates');
});
