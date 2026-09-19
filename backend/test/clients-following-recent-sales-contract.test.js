import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const clientsRealSource = await readFile(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');

test('Clientes Seguimiento usa la misma regla de venta reciente que Asana', () => {
  assert.match(clientsRealSource, /CURRENT_DATE - INTERVAL '6 months'/);
  assert.match(clientsRealSource, /ventaspro_nuevo\.sales/);
  assert.match(clientsRealSource, /FROM subscriber_reports sr/);
  assert.match(clientsRealSource, /RECENT_COMPLETE_SALE_FILTER_SQL/);
  assert.match(clientsRealSource, /AND NOT \$\{RECENT_COMPLETE_SALE_FILTER_SQL\('so'\)\}/);
  assert.match(clientsRealSource, /const FOLLOWING_CLIENT_SQL = `\(\$\{ACTIVE_FOLLOW_UP_EXISTS_SQL\} AND NOT \(\$\{INCOMPLETE_CLIENT_SQL\}\)\)`;/);
});
