import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('buscador de clientes busca automaticamente al escribir', () => {
  assert.match(appHtml, /function cliSearchNow\(v\)/);
  assert.match(appHtml, /oninput="cliSearchNow\(this\.value\)"/);
  assert.match(appHtml, /Buscar cliente por empresa, BAN, contacto/);
});
