import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routePath = resolve(process.cwd(), 'src', 'routes', 'clientsReal.js');
const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

test('Clientes calcula metricas de lineas desde line_kind y publica la alerta de renovaciones', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /const LINE_KIND_SQL =/);
  assert.match(source, /const RENEWAL_CLIENT_SQL =/);
  assert.match(source, /const \{ tab, q, service, renewal \} = req\.query/);
  assert.match(source, /primary_sale_date/);
  assert.match(source, /renewal_alert/);
  assert.match(source, /active_opportunity_value DESC NULLS LAST/);
  assert.match(source, /WHEN primary_contract_end_date < CURRENT_DATE THEN 0/);
  assert.match(source, /FROM sales_opportunities so/);
  assert.match(source, /fixed_monthly_value DESC NULLS LAST/);
  assert.match(source, /active_subscriber_count DESC/);
});

test('Clientes muestra Todos como vista global y mantiene filtros de activos separados', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /let cliTab='all', cliQ='', cliPage=1, cliServiceFilter='todas', cliRenewalFilter='', cliSearchTimer=null, cliStatsCache=null, cliStatsLoading=false;/);
  assert.match(html, /const CLI_TABS=\[\['all','Todos'\],\['active','Activos'\],\['cancelled','Cancelados'\],\['following','Seguimiento'\],\['incomplete','Incompletos'\]\];/);
  assert.match(html, /function setCliTab\(t\)\{ clearTimeout\(cliSearchTimer\); cliTab=t; cliQ=''; cliRenewalFilter='';/);
  assert.match(html, /const searchScope=cliQ\?'all':cliTab;/);
  assert.match(html, /const service=\(cliTab==='active'\|\|cliTab==='all'\|\|cliQ\)\?cliServiceFilter:'todas';/);
  assert.match(html, /const per=50;/);
  assert.match(html, /tab=\$\{searchScope\}/);
  assert.match(html, /page=\$\{cliPage\}&per=\$\{per\}/);
  assert.match(html, /const totalRows=Number\(d\.total\?\?all\.length\)/);
  assert.match(html, /rows=all;/);
  assert.doesNotMatch(html, /rows=all\.slice\(from,from\+per\)/);
  assert.match(html, /const totalClients=/);
  assert.match(html, /\['all','Todos',totalClients,'Todo el CRM'/);
  assert.match(html, /Busqueda global/);
  assert.match(html, /Alerta de renovaciones/);
  assert.match(html, /Vencidas primero; dentro de cada grupo, oportunidad mayor/);
  assert.match(html, /const serviceFilterLabel=\(cliTab==='all'\|\|cliQ\)\?'Filtrar resultados por servicio':'Clientes activos por servicio';/);
  assert.match(html, /serviceFilterLabel/);
  assert.match(html, /Clientes activos por servicio/);
  assert.match(html, /Filtrar resultados por servicio/);
  assert.match(html, /neas activas/);
  assert.match(html, /neas canceladas/);
  assert.doesNotMatch(html, /Total . \$\{CLI_TABS\.find/);
});

test('Clientes carga tabla primero y solicita el resumen pesado por separado', async () => {
  const source = await readFile(routePath, 'utf8');
  const html = await readFile(appPath, 'utf8');

  assert.match(source, /clientsRealRouter\.get\('\/clients-real\/stats'/);
  assert.match(html, /async function cliLoadStats\(/);
  assert.match(html, /summary=0/);
  assert.match(html, /\/api\/clients-real\/stats/);
});
