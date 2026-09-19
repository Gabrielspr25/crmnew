import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');
const routeBlock = source.slice(
  source.indexOf("clientsRealRouter.get('/clients-real'"),
  source.indexOf('const whereClause =')
);

test('Clientes evita recalcular clasificacion completa al cargar Todos o busqueda global', () => {
  assert.match(source, /const CLIENT_GROUP_KEY_SQL =/);
  assert.match(source, /const ALL_LIST_CLIENT_SQL = `NOT \(\$\{EMPTY_DUPLICATE_CLIENT_SQL\}\)`;/);
  assert.match(source, /const useFastGlobalList = \(hasSearch \|\| tab === 'all'\)/);
  assert.match(source, /selected_groups AS/);
  assert.match(source, /JOIN selected_groups sg ON sg\.client_group_key = \$\{CLIENT_GROUP_KEY_SQL\}/);
  assert.match(routeBlock, /if \(hasSearch\) \{\s*conds\.push\(ALL_LIST_CLIENT_SQL\)/);
  assert.match(routeBlock, /else if \(tab === 'all'\) \{\s*conds\.push\(ALL_LIST_CLIENT_SQL\);/);
  assert.doesNotMatch(routeBlock, /conds\.push\(ALL_CLIENT_SQL\)/);
});
