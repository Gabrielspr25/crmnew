import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('frontend centraliza formato visible de telefonos sin tocar BANs', () => {
  assert.match(appHtml, /function normalizePhone\(value\)/);
  assert.match(appHtml, /function fmtPhone\(value\)/);
  assert.match(appHtml, /digits\.slice\(0,3\)\s*\+\s*'-'\s*\+\s*digits\.slice\(3,6\)\s*\+\s*'-'\s*\+\s*digits\.slice\(6\)/);
  assert.match(appHtml, /const formatContactValue=\(label,value\)=>\/Tel\.|Celular\/\.test\(label\)\?fmtPhone\(value\):value;/);
});

test('clientes y suscriptores muestran telefonos con guiones', () => {
  assert.match(appHtml, /value:fmtPhone\(s\.phone\|\|''\)/);
  assert.match(appHtml, /value:fmtPhone\(c\.phone\)/);
  assert.match(appHtml, /value:fmtPhone\(c\.additional_phone\)/);
  assert.match(appHtml, /value:fmtPhone\(c\.cellular\)/);
  assert.match(appHtml, /<span class="subscriber-phone">\$\{fmtPhone\(s\.phone\)\|\|'—'\}<\/span>/);
  assert.match(appHtml, /<b>\$\{fmtPhone\(s\.phone\)\|\|'—'\}<\/b>/);
  assert.match(appHtml, /row\('Tel\. principal',c\.phone\)/);
});

test('ventas comisiones comparativas reportes y prospectos formatean telefonos visibles', () => {
  assert.match(appHtml, /<td>\$\{fmtPhone\(x\.phone\)\|\|'—'\}<\/td>/);
  assert.match(appHtml, /<td>\$\{fmtPhone\(s\.phone\)\|\|'—'\}<\/td>/);
  assert.match(appHtml, /<td>\$\{fmtPhone\(l\.phone\)\|\|'—'\}<\/td>/);
  assert.match(appHtml, /fmtPhone\(p\.phone\)\|\|'—'/);
  assert.match(appHtml, /fmtPhone\(r\.sub_phone\)\|\|r\.sub_phone/);
});

test('guardado de clientes y suscriptores envia telefonos normalizados', () => {
  assert.match(appHtml, /function cliNormalizeClientPayload\(v\)/);
  assert.match(appHtml, /v\.phone=normalizePhone\(v\.phone\);/);
  assert.match(appHtml, /v\.additional_phone=normalizePhone\(v\.additional_phone\);/);
  assert.match(appHtml, /v\.cellular=normalizePhone\(v\.cellular\);/);
  assert.match(appHtml, /phone:fmtPhone\(x\.subscriber\|\|''\)/);
  assert.match(appHtml, /var ph=normalizePhone\(r\.phone\);/);
  assert.match(appHtml, /subscriber:normalizePhone\(\$\(\'vz_sub\'\)\.value\)/);
  assert.match(appHtml, /phone:normalizePhone\(r\.phone\)/);
});
