import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const clientsRealSource = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');

test('busqueda de clientes oculta clones vacios si existe el mismo nombre con BAN', () => {
  assert.match(clientsRealSource, /const EMPTY_DUPLICATE_CLIENT_SQL/);
  assert.match(clientsRealSource, /NOT EXISTS \(SELECT 1 FROM bans b_empty WHERE b_empty\.client_id = c\.id\)/);
  assert.match(clientsRealSource, /EXISTS \(SELECT 1 FROM bans b_keep WHERE b_keep\.client_id = c2\.id\)/);
  assert.match(clientsRealSource, /NOT \(\$\{EMPTY_DUPLICATE_CLIENT_SQL\}\)/);
});
