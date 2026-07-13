import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const writeRoutesSource = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const importRoutesSource = readFileSync(new URL('../src/routes/importRoutes.js', import.meta.url), 'utf8');

test('nuevo BAN escribe estado compatible con produccion varchar(1)', () => {
  assert.match(writeRoutesSource, /VALUES \(\$1,\$2,'A',\$3\)/);
  assert.doesNotMatch(writeRoutesSource, /INSERT INTO bans \(client_id, ban_number, status, account_type\) VALUES \(\$1,\$2,'activo',\$3\)/);
});

test('importador usa estados cortos para BAN y mantiene estados largos para suscriptores', () => {
  assert.match(importRoutesSource, /function normBanStatus\(s\) \{[\s\S]*return 'I';[\s\S]*return 'S';[\s\S]*return 'A';/);
  assert.match(importRoutesSource, /banStatus \|\| 'A'/);
  assert.match(importRoutesSource, /THEN 'A'/);
  assert.match(importRoutesSource, /ELSE 'I'/);
  assert.match(importRoutesSource, /status IS DISTINCT FROM 'I'/);
  assert.match(importRoutesSource, /SET status = 'I'/);
  assert.match(importRoutesSource, /function normStatus\(s\) \{[\s\S]*return 'activo';/);
});
