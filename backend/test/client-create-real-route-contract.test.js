import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const writeRoutes = await readFile(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Nuevo cliente usa la ruta real y permite asignar vendedor sin romper el alta', () => {
  assert.match(writeRoutes, /writeRouter\.post\('\/clients-real'/);
  assert.match(writeRoutes, /INSERT INTO clients/);
  assert.match(writeRoutes, /salesperson_id/);
  assert.match(writeRoutes, /SELECT id FROM salespeople WHERE id = \$1/);

  assert.match(app, /async function nuevoCliente\(\)/);
  assert.match(app, /Nuevo cliente/);
  assert.match(app, /Asignar vendedor/);
  assert.match(app, /api\('\/api\/clients-real',\{method:'POST'/);
  assert.doesNotMatch(app, /api\('\/api\/clients',\{method:'POST'/);
});
