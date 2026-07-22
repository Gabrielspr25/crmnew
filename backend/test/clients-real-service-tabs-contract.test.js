import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routePath = resolve(process.cwd(), 'src', 'routes', 'clientsReal.js');
const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

test('Clientes calcula tabs de servicio desde line_kind o PRODUCT_TYPE, nunca desde account_type del BAN', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /const \{ tab, q, service(?:, renewal)? \} = req\.query/);
  assert.match(source, /const SERVICE_CLIENT_SQL =/);
  assert.match(source, /const SERVICE_KIND_SQL = \(subscriberAlias\)/);
  assert.match(source, /WHEN 'G' THEN 'movil'/);
  assert.match(source, /WHEN 'O' THEN 'fijo'/);
  assert.match(source, /WHEN 'T' THEN 'fijo'/);
  assert.match(source, /WHEN 'V' THEN 'fijo'/);
  assert.match(source, /SERVICE_MOBILE_SQL\('s_service'\)/);
  assert.match(source, /ACTIVE_SUB_STATUS\('s_service'\)/);
  assert.match(source, /service_counts/);
  assert.doesNotMatch(source, /NULLIF\(\$\{subscriberAlias\}\.line_kind::text,''\), \$\{banAlias\}\.account_type/);
});

test('Incompletos queda separado de Activos y exige BAN con linea activa sin identidad del cliente', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /const INCOMPLETE_CLIENT_SQL =/);
  assert.match(source, /c\.business_name/);
  assert.match(source, /JOIN subscribers s_incomplete ON s_incomplete\.ban_id = b_incomplete\.id/);
  assert.match(source, /NOT \(\$\{INCOMPLETE_CLIENT_SQL\}\)/);
});

test('Clientes usa los conteos del endpoint y no filtra solo la lista visible', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /const service=cliTab==='active'\?cliServiceFilter:'todas';/);
  assert.match(html, /\/api\/clients-real\?tab=\$\{cliTab\}[^`]*service=\$\{service\}/);
  assert.match(html, /const serviceCounts=st\.service_counts\|\|\{\}/);
  assert.match(html, /serviceCounts\[value\]\?\?0/);
  assert.doesNotMatch(html, /listed\.filter\(c=>cliClientServiceType\(c\)===value\)\.length/);
});

test('Las líneas suspendidas se tratan como activas en el perfil del cliente', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /function cliAct\(s\)\{return \[[^\]]*'suspendido'[^\]]*\]\.includes/);
});

test('El perfil calcula servicio por clasificación de línea y PRODUCT_TYPE', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /function cliLineKind\(subscriber\)\{/);
  assert.match(html, /product_type/);
  assert.doesNotMatch(html, /const banTypes=Object\.fromEntries/);
});
