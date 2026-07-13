import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const clientsRealSource = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');

test('busqueda de clientes incluye nombre, empresa, BAN, telefono y email', () => {
  assert.match(clientsRealSource, /const hasSearch = Boolean\(q && q\.trim\(\)\)/);
  assert.match(clientsRealSource, /if \(!hasSearch\) \{/);
  assert.match(clientsRealSource, /EXISTS \(SELECT 1 FROM bans bq WHERE bq\.client_id = c\.id AND CAST\(bq\.ban_number AS text\) ILIKE/);
  assert.match(clientsRealSource, /EXISTS \(SELECT 1 FROM subscribers sq JOIN bans bqs ON sq\.ban_id = bqs\.id WHERE bqs\.client_id = c\.id AND CAST\(sq\.phone AS text\) ILIKE/);
  assert.match(clientsRealSource, /c\.business_name ILIKE/);
  assert.match(clientsRealSource, /c\.email ILIKE/);
}
);
