import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('buscador de correos permite buscar por nombre o email', () => {
  assert.match(appHtml, /placeholder="Buscar cliente o email/);
  assert.match(appHtml, /\(c\.email\|\|''\)\.toLowerCase\(\)\.includes\(s\)/);
});
