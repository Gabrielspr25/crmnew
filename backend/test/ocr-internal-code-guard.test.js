import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');

test('OCR no permite guardar codigos internos 100 aunque se editen manualmente', () => {
  assert.match(appHtml, /if\s*\(\s*\/\^100\/\.test\(ph\)\s*\)\s*\{\s*fail\+\+;\s*continue;\s*\}/);
  assert.match(writeRoutes, /codigo interno 100/);
});

test('OCR y API aceptan solamente suscriptores con prefijo Claro valido', () => {
  assert.match(appHtml, /\^\(787\|939\|989\)\\d\{7\}\$/);
  assert.match(writeRoutes, /El suscriptor debe comenzar con 787, 939 o 989/);
});
