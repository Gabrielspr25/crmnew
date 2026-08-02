import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana summary cards expose total, mobile lines, fixed lines, and fixed money', () => {
  assert.match(appHtml, /totalSubs/);
  assert.match(appHtml, /trackedLines=data\.reduce\(\(a,o\)=>a\+rowProductTotal\(o\),0\)/);
  assert.match(appHtml, /mobileLines/);
  assert.match(appHtml, /fixedLines/);
  assert.match(appHtml, /fixedMoney/);
  assert.match(appHtml, /\.asana-kpis\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);/);
  assert.match(appHtml, /Clientes en seguimiento/);
  assert.match(appHtml, /Líneas móviles/);
  assert.match(appHtml, /Líneas fijas/);
  assert.match(appHtml, /Plata fijo/);
});

test('Asana seguimiento muestra acceso directo a reporte inteligente', () => {
  assert.match(appHtml, /Asana · Seguimiento/);
  assert.match(appHtml, /<button class="btn green" onclick="mostrarInfoReportes\(\)">📊 Reporte inteligente<\/button>/);
});

test('Asana unclassified count subtracts every classified product family', () => {
  assert.match(appHtml, /classifiedSubs/);
  assert.match(appHtml, /prodSubs\(o,'claro_tv'\)/);
  assert.match(appHtml, /prodSubs\(o,'cloud'\)/);
  assert.match(appHtml, /prodSubs\(o,'mpls'\)/);
  assert.match(appHtml, /totalSubs-classifiedSubs/);
});
