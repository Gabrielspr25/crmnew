import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

const routePath = resolve(process.cwd(), 'src', 'routes', 'clientsReal.js');

test('Clientes ordena despues de agrupar para evitar errores SQL en produccion', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /grouped_clients AS/);
  assert.match(source, /FROM grouped_clients\s+ORDER BY \$\{clientOrderSql\}/);
  assert.doesNotMatch(source, /GROUP BY client_group_key\s+ORDER BY \$\{clientOrderSql\}/);
});
