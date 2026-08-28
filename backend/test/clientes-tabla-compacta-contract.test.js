import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');

test('Clientes conserva las columnas de oportunidades de Comisiones', () => {
  assert.match(html, /const CLIENT_OPPORTUNITY_COLS=\[\['fixed_ren_count','Fijo Ren'\],\['fixed_new_count','Fijo New'\],\['mobile_new_count','Móvil New'\],\['mobile_ren_count','Móvil Ren'\],\['claro_tv_count','Claro TV'\]\]/);
  assert.match(html, /<th>Empresa<\/th><th>Tipo de BAN<\/th><th>Vendedor<\/th>\$\{CLIENT_OPPORTUNITY_COLS\.map/);
  assert.doesNotMatch(html, /<th>Fecha vencimiento<\/th>/);
  const clientTableHelpers = html.slice(html.indexOf('function cliClientServiceType'), html.indexOf('function fmtDate'));
  assert.doesNotMatch(clientTableHelpers, /sin_clasificar|Sin clasificar/);
  assert.match(clientTableHelpers, /mobile_new_count/);
  assert.match(clientTableHelpers, /fixed_new_count/);
  assert.match(clientTableHelpers, /claro_tv_count/);
  assert.match(clientTableHelpers, /cloud_count/);
  assert.match(clientTableHelpers, /mpls_count/);
  assert.match(clientTableHelpers, /\[movil,fijo,claroTv,cloud\]\.filter\(Boolean\)\.length/);
  assert.match(clientTableHelpers, /if\(activeFamilies>1\)return 'convergente';/);
  assert.match(route, /active_opportunity_count/);
  assert.doesNotMatch(route, /s_mpls.*product_type/);
});

test('Clientes muestra cuando una fila agrupa varios registros y varios BAN', () => {
  assert.match(html, /function cliBanSummary\(c\)/);
  assert.match(html, /client_record_count/);
  assert.match(html, /ban_numbers/);
  assert.match(html, /varios registros/);
  assert.match(html, /BAN \$\{esc\(cliBanSummary\(c\)\)\}/);
});
