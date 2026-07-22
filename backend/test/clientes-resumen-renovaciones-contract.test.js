import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routePath = resolve(process.cwd(), 'src', 'routes', 'clientsReal.js');
const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

test('Clientes calcula métricas de líneas desde line_kind y publica la alerta de renovaciones', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /const LINE_KIND_SQL =/);
  assert.match(source, /const RENEWAL_CLIENT_SQL =/);
  assert.match(source, /const \{ tab, q, service, renewal \} = req\.query/);
  assert.match(source, /primary_sale_date/);
  assert.match(source, /renewal_alert/);
  assert.match(source, /fixed_monthly_value DESC NULLS LAST/);
  assert.match(source, /active_subscriber_count DESC/);
});

test('Clientes muestra cuatro tarjetas compactas, filtros de servicio visibles y renovaciones', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /let cliTab='active', cliQ='', cliPage=1, cliServiceFilter='todas', cliRenewalFilter='';/);
  assert.match(html, /Renovaciones hoy/);
  assert.match(html, /Clientes activos por servicio/);
  assert.match(html, /Líneas activas/);
  assert.match(html, /Líneas canceladas/);
  assert.doesNotMatch(html, /Total · \$\{CLI_TABS\.find/);
});
