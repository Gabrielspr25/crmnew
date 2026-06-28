import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana summary cards expose total, mobile lines, fixed lines, and fixed money', () => {
  assert.match(appHtml, /totalSubs/);
  assert.match(appHtml, /mobileLines/);
  assert.match(appHtml, /fixedLines/);
  assert.match(appHtml, /fixedMoney/);
  assert.match(appHtml, /Total en seguimiento/);
  assert.match(appHtml, /Líneas móviles/);
  assert.match(appHtml, /Líneas fijas/);
  assert.match(appHtml, /Plata fijo/);
});

test('Asana unclassified count subtracts every classified product family', () => {
  assert.match(appHtml, /classifiedSubs/);
  assert.match(appHtml, /prodSubs\(o,'claro_tv'\)/);
  assert.match(appHtml, /prodSubs\(o,'cloud'\)/);
  assert.match(appHtml, /prodSubs\(o,'mpls'\)/);
  assert.match(appHtml, /totalSubs-classifiedSubs/);
});
