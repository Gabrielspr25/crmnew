import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const clientsSource = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('enviar un cliente a seguimiento carga sus líneas activas como renovaciones sin duplicarlas', () => {
  assert.match(asanaSource, /async function seedClientActiveLines/);
  assert.match(asanaSource, /existente_renovar/);
  assert.match(asanaSource, /ACTIVE_OR_SUSPENDED_SUB_SQL\('s'\)/);
  assert.match(asanaSource, /ol\.subscriber_id = portfolio\.subscriber_id/);
  assert.match(asanaSource, /await seedClientActiveLines\(c, ex\.rows\[0\]\.id, client_id\)/);
  assert.match(asanaSource, /await seedClientActiveLines\(c, opp\.rows\[0\]\.id, client_id\)/);
  assert.match(frontendSource, /onclick="enviarSeguimientoCli\('\$\{c\.id\}'\)"/);
});

test('la búsqueda de Clientes no recalcula las tarjetas globales por cada término escrito', () => {
  assert.match(clientsSource, /const includeStats = String\(req\.query\.summary \|\| '1'\) !== '0'/);
  assert.match(clientsSource, /stats: includeStats \? stats\.rows\[0\] : null/);
  assert.match(frontendSource, /cliSearchTimer=null/);
  assert.match(frontendSource, /clearTimeout\(cliSearchTimer\)/);
  assert.match(frontendSource, /setTimeout\(\(\) => reClientes\(\), 220\)/);
  assert.match(frontendSource, /summary=\$\{cliQ\?'0':'1'\}/);
});
