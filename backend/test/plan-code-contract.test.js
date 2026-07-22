import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyPlanCodeDefaults, planCodeLookupCandidates } from '../src/services/planCode.js';

test('genera candidatos: primero codigo original, luego codigo sin sufijo 1/2 con contrato', () => {
  assert.deepEqual(planCodeLookupCandidates('A1692'), [
    { code: 'A1692', contract_term: null, suffix_stripped: false },
    { code: 'A169', contract_term: 24, suffix_stripped: true },
  ]);
  assert.deepEqual(planCodeLookupCandidates('A8731'), [
    { code: 'A8731', contract_term: null, suffix_stripped: false },
    { code: 'A873', contract_term: 12, suffix_stripped: true },
  ]);
  assert.deepEqual(planCodeLookupCandidates('71081'), [
    { code: '71081', contract_term: null, suffix_stripped: false },
    { code: '7108', contract_term: 12, suffix_stripped: true },
  ]);
  assert.deepEqual(planCodeLookupCandidates('ISP_EMP1'), [
    { code: 'ISP_EMP1', contract_term: null, suffix_stripped: false },
    { code: 'ISP_EMP', contract_term: 12, suffix_stripped: true },
  ]);
});

test('no inventa contrato cuando el codigo no tiene sufijo de contrato', () => {
  assert.deepEqual(planCodeLookupCandidates('A169'), [
    { code: 'A169', contract_term: null, suffix_stripped: false },
  ]);
});

test('conserva el numero final de un SOC movil aunque termine en 1 o 2', () => {
  assert.deepEqual(applyPlanCodeDefaults({
    plan: 'BREDP1',
    price_code: 'BREDP1',
    product_type: 'G',
    line_kind: 'movil',
  }), {
    plan: 'BREDP1',
    price_code: 'BREDP1',
    contract_term: null,
  });
});

test('aplica defaults sin perder el plan original visible', () => {
  assert.deepEqual(applyPlanCodeDefaults({ plan: 'A1692' }), {
    plan: 'A1692',
    price_code: 'A169',
    contract_term: 24,
  });
  assert.deepEqual(applyPlanCodeDefaults({ plan: '71081', price_code: '7108', contract_term: 24 }), {
    plan: '71081',
    price_code: '7108',
    contract_term: 24,
  });
  assert.deepEqual(applyPlanCodeDefaults({ plan: null, price_code: 'ISP_EMP1' }), {
    plan: null,
    price_code: 'ISP_EMP',
    contract_term: 12,
  });
});
