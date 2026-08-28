import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../src/routes/clientsReal.js'), 'utf8');

test('la relacion activa del cliente cierra exactamente EXISTS, la agrupacion y la consulta BAN', () => {
  assert.ok(source.includes("AND ${ACTIVE_SUB_STATUS('s')})))`"));
  assert.ok(!source.includes("AND ${ACTIVE_SUB_STATUS('s')}))))`"));
});

test('el orden por vencimiento se aplica fuera del SELECT que calcula sus alias', () => {
  assert.match(source, /WITH client_rows AS \(\$\{clientRowsSql\}\)/);
  assert.match(source, /GROUP BY client_group_key\s*ORDER BY \$\{clientOrderSql\}/s);
  assert.ok(!source.includes('last_activity DESC NULLS LAST, c.created_at DESC'));
  assert.ok(!source.includes('primary_sale_date ASC NULLS LAST,\n        c.created_at DESC'));
});
