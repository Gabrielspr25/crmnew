import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const importRoutes = readFileSync(new URL('../src/routes/importRoutes.js', import.meta.url), 'utf8');
const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');

test('alta manual usa el respaldo de catalogo despues de Tango', () => {
  assert.match(writeRoutes, /resolvePlanRateWithFallback/);
  assert.match(writeRoutes, /originalCode: b\.price_code \|\| b\.plan/);
  assert.match(writeRoutes, /lookupCode: planDefaults\.price_code/);
});

test('importador solo consulta el catalogo para completar renta mensual ausente', () => {
  assert.match(importRoutes, /resolvePlanMonthlyValueFromCatalog/);
  assert.match(importRoutes, /monthly_value == null/);
  assert.match(importRoutes, /currentMonthlyValue == null/);
  assert.match(importRoutes, /desired\.monthly_value = catalogRate\.value/);
});
