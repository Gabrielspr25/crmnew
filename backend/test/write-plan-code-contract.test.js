import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const writeRoutesSource = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');

test('agregar y editar suscriptor aplican defaults de plan, price_code y contrato', () => {
  assert.match(writeRoutesSource, /import \{ applyPlanCodeDefaults \} from '..\/services\/planCode\.js'/);
  assert.match(writeRoutesSource, /const planDefaults = applyPlanCodeDefaults\(\{\s+plan: b\.plan,\s+price_code: b\.price_code,\s+contract_term: b\.contract_term,\s+\}\)/);
  assert.match(writeRoutesSource, /planDefaults\.plan \|\| null/);
  assert.match(writeRoutesSource, /planDefaults\.price_code \|\| null/);
  assert.match(writeRoutesSource, /planDefaults\.contract_term \|\| null/);
  assert.match(writeRoutesSource, /if \('plan' in body \|\| 'price_code' in body \|\| 'contract_term' in body\)/);
  assert.match(writeRoutesSource, /body\.price_code = planDefaults\.price_code/);
  assert.match(writeRoutesSource, /body\.contract_term = planDefaults\.contract_term/);
});

test('alta de suscriptor consulta Tango cuando llega un plan sin mensualidad', () => {
  assert.match(writeRoutesSource, /import \{ resolvePlanMonthlyValueFromTango \} from '..\/tango\.js'/);
  assert.match(writeRoutesSource, /await resolvePlanMonthlyValueFromTango\(planDefaults\.price_code\)/);
  assert.match(writeRoutesSource, /tangoPlanRate\.value/);
});
