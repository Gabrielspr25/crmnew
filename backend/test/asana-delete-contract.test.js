import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana permite eliminar oportunidad de seguimiento y devolver al pool', () => {
  assert.match(asanaSource, /async function closeOpportunityToPool/);
  assert.match(asanaSource, /asanaRealRouter\.delete\('\/asana-real\/:id'/);
  assert.match(asanaSource, /status='cerrada_no_trabajar'/);
  assert.match(asanaSource, /archived_at=now\(\)/);
  assert.match(asanaSource, /salesperson_id = NULL/);
  assert.match(appHtml, /Eliminar de seguimiento/);
  assert.match(appHtml, /method:'DELETE'/);
  assert.match(appHtml, /No se pudo eliminar de seguimiento/);
});
