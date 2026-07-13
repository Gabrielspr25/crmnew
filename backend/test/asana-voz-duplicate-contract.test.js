import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Cliente Voz no crea cliente nuevo si ya existe en CRM', () => {
  assert.match(asanaSource, /SELECT c\.id, c\.name, c\.business_name/);
  assert.match(asanaSource, /LOWER\(TRIM\(COALESCE\(c\.name,''\)\)\) = LOWER\(TRIM\(\$1\)\)/);
  assert.match(asanaSource, /return res\.status\(409\)\.json/);
  assert.match(asanaSource, /Cliente ya existe/);
  assert.match(appHtml, /if\(r&&r\.error\)/);
  assert.match(appHtml, /r\.client_id/);
  assert.match(appHtml, /abrirCliente\(r\.client_id\)/);
});
