import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana no lista oportunidades cuyo cliente es un placeholder vacio', () => {
  assert.match(asanaSource, /VALID_ASANA_CLIENT_SQL/);
  assert.match(asanaSource, /LOWER\(TRIM\(COALESCE\(c\.name, c\.business_name, ''\)\)\) NOT IN \('—', '-', 'null', 'sin nombre'\)/);
  assert.match(asanaSource, /WHERE \$\{VALID_ASANA_CLIENT_SQL\}/);
});

test('enviar a seguimiento exige empresa o nombre real del cliente', () => {
  assert.match(asanaSource, /El cliente no tiene empresa ni nombre/);
  assert.doesNotMatch(asanaSource, /NULLIF\(TRIM\(name\),''\), NULLIF\(TRIM\(business_name\),''\), 'Cliente'/);
});

test('la vista Asana no dibuja filas sin cliente identificable', () => {
  assert.match(frontendSource, /function isAsanaClientVisible\(name\)/);
  assert.match(frontendSource, /const data=rawData\.filter\(o=>isAsanaClientVisible\(o\.client_name\)\)/);
});
