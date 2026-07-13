import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const clientsSource = readFileSync(new URL('../src/routes/clients.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('nuevo cliente no inserta duplicado si ya existe por nombre o empresa', () => {
  assert.match(clientsSource, /SELECT c\.id, c\.name, c\.business_name/);
  assert.match(clientsSource, /LOWER\(TRIM\(COALESCE\(c\.name,''\)\)\) = LOWER\(TRIM\(\$1\)\)/);
  assert.match(clientsSource, /return res\.status\(409\)\.json/);
  assert.match(clientsSource, /Cliente ya existe/);
  assert.match(appHtml, /async function nuevoCliente\(\)/);
  assert.match(appHtml, /if\(r&&r\.error\)/);
  assert.match(appHtml, /abrirCliente\(r\.client_id\)/);
});
