import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('buscador de clientes busca automaticamente al escribir', () => {
  assert.match(appHtml, /function cliSearchNow\(v\)/);
  assert.match(appHtml, /oninput="cliSearchNow\(this\.value\)"/);
  assert.match(appHtml, /Buscar cliente por empresa, BAN, contacto/);
});

test('Clientes muestra productos en columnas separadas en el listado', () => {
  assert.match(appHtml, /const CLIENT_PRODUCT_COLS=/);
  assert.match(appHtml, /CLIENT_PRODUCT_COLS\.map\(p=>`<th class="c">\$\{p\[1\]\}<\/th>`\)\.join\(''\)/);
  assert.match(appHtml, /clientProductCells\(c\)/);
  assert.doesNotMatch(appHtml, /<th>Productos<\/th>/);
});
