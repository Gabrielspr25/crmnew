import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('buscador de clientes busca automaticamente al escribir', () => {
  assert.match(appHtml, /function cliSearchNow\(v,el\)/);
  assert.match(appHtml, /oninput="cliSearchNow\(this\.value,this\)"/);
  assert.match(appHtml, /Buscar cliente por empresa, BAN, contacto/);
});

test('buscador de clientes conserva el foco despues de refrescar resultados', () => {
  assert.match(appHtml, /id="cliSearchInput"/);
  assert.match(appHtml, /function cliRestoreSearchFocus\(/);
  assert.match(appHtml, /el\.selectionStart/);
  assert.match(appHtml, /cliSearchVersion\+\+/);
  assert.match(appHtml, /if\(version!==cliSearchVersion\)return;/);
  assert.match(appHtml, /cliRestoreSearchFocus\(\);/);
});

test('Clientes muestra productos en columnas separadas en el listado', () => {
  assert.match(appHtml, /const CLIENT_OPPORTUNITY_COLS=/);
  assert.match(appHtml, /CLIENT_OPPORTUNITY_COLS\.map\(\(\[key\]\)=>`<td class="c">/);
  assert.doesNotMatch(appHtml, /<th>Productos<\/th>/);
});
