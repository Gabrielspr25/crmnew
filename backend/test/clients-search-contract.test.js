import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const clientsRealSource = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');
const clientRowsDefinition = clientsRealSource.slice(
  clientsRealSource.indexOf('const clientRowsSql ='),
  clientsRealSource.indexOf('const conn = await pool.connect();')
);
const listQueryBlock = clientsRealSource.slice(
  clientsRealSource.indexOf('const clients = await conn.query'),
  clientsRealSource.indexOf('const stats = includeStats')
);

test('busqueda de clientes incluye nombre, empresa, BAN, telefono y email', () => {
  assert.match(clientsRealSource, /const hasSearch = Boolean\(q && q\.trim\(\)\)/);
  assert.match(clientsRealSource, /const page = Math\.max\(1, parseInt\(String\(req\.query\.page \|\| '1'\), 10\) \|\| 1\)/);
  assert.match(clientsRealSource, /const per = Math\.min\(100, Math\.max\(1, parseInt\(String\(req\.query\.per \|\| '50'\), 10\) \|\| 50\)\)/);
  assert.match(clientsRealSource, /const offset = \(page - 1\) \* per/);
  assert.match(clientsRealSource, /const ALL_CLIENT_SQL = `\(\(\$\{ACTIVE_CLIENT_SQL\}\) OR \(\$\{CANCELLED_CLIENT_SQL\}\) OR \(\$\{FOLLOWING_CLIENT_SQL\}\) OR \(\$\{INCOMPLETE_CLIENT_SQL\}\)\)`;/);
  assert.match(clientsRealSource, /if \(hasSearch\) \{/);
  assert.match(clientsRealSource, /conds\.push\(ALL_CLIENT_SQL\)/);
  assert.match(clientsRealSource, /else if \(tab === 'all'\) \{\s*conds\.push\(ALL_CLIENT_SQL\);/);
  assert.match(clientsRealSource, /else if \(tab === 'cancelled'\) \{\s*conds\.push\(CANCELLED_CLIENT_SQL\);/);
  assert.match(clientsRealSource, /if \(!hasSearch && SERVICE_CLIENT_SQL\[service\]\) conds\.push\(SERVICE_CLIENT_SQL\[service\]\)/);
  assert.match(clientsRealSource, /if \(!hasSearch && tab !== 'cancelled' && RENEWAL_CLIENT_SQL\[renewal\]\)/);
  assert.match(clientsRealSource, /EXISTS \(SELECT 1 FROM bans bq WHERE bq\.client_id = c\.id AND CAST\(bq\.ban_number AS text\) ILIKE/);
  assert.match(clientsRealSource, /EXISTS \(SELECT 1 FROM subscribers sq JOIN bans bqs ON sq\.ban_id = bqs\.id WHERE bqs\.client_id = c\.id AND CAST\(sq\.phone AS text\) ILIKE/);
  assert.match(clientsRealSource, /c\.business_name ILIKE/);
  assert.match(clientsRealSource, /c\.email ILIKE/);
  assert.match(clientRowsDefinition, /SELECT c\.id, c\.name, c\.business_name, c\.business_name AS company,\s*c\.email,/);
  assert.match(listQueryBlock, /ORDER BY \$\{clientOrderSql\}\s+LIMIT \$\$\{params\.length \+ 1\} OFFSET \$\$\{params\.length \+ 2\}/);
  assert.match(clientsRealSource, /const total = await conn\.query\(\s*`WITH client_rows AS \(\$\{clientRowsSql\}\)/);
  assert.match(clientsRealSource, /res\.json\(\{ clients: clients\.rows, total: total\.rows\[0\]\?\.total \|\| 0, page, per, stats:/);
}
);

test('listado de clientes expone conteos reales por producto para columnas visuales', () => {
  assert.match(listQueryBlock, /mobile_new_count/);
  assert.match(listQueryBlock, /mobile_ren_count/);
  assert.match(listQueryBlock, /fixed_new_count/);
  assert.match(listQueryBlock, /fixed_ren_count/);
  assert.match(listQueryBlock, /claro_tv_count/);
  assert.match(listQueryBlock, /cloud_count/);
  assert.match(listQueryBlock, /mpls_count/);
});

test('listado consolida registros del mismo cliente por nombre y detalla varios BAN', () => {
  assert.match(listQueryBlock, /client_group_key/);
  assert.match(listQueryBlock, /GROUP BY client_group_key/);
  assert.match(listQueryBlock, /array_agg\(id ORDER BY created_at DESC\) AS client_ids/);
  assert.match(listQueryBlock, /COUNT\(\*\)::int AS client_record_count/);
  assert.match(listQueryBlock, /SUM\(ban_count\)::int AS ban_count/);
  assert.match(listQueryBlock, /string_agg\(ban_numbers, ', ' ORDER BY created_at DESC\) AS ban_numbers/);
  assert.match(clientsRealSource, /SELECT COUNT\(\*\)::int AS total FROM \(SELECT client_group_key FROM client_rows GROUP BY client_group_key\) grouped_total/);
});
