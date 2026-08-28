import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

test('el perfil del cliente ofrece filtros de lineas por movil, fijo y convergente', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /function cliLineKind\(subscriber\)/);
  assert.match(html, /function cliServiceProfile\(subscribers,bans=\[\]\)/);
  assert.match(html, /\['movil','Movil',profile\.movil\.length\]/);
  assert.match(html, /\['fijo','Fijo',profile\.fijo\.length\]/);
  assert.match(html, /\['convergente','Convergente',profile\.convergente/);
  assert.match(html, /data-client-line-tab="\$\{value\}"/);
  assert.match(html, /Movil/);
  assert.match(html, /Convergente/);
});

test('el perfil calcula convergente solo cuando existen lineas moviles y fijas', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /movil\.length\s*&&\s*fijo\.length/);
  assert.match(html, /subscriber\.line_kind/);
  assert.match(html, /function cliLineMonthly\(value\)/);
});

test('el perfil usa line_kind y PRODUCT_TYPE, sin inferir el servicio por el tipo del BAN', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /const productType=String\(subscriber&&subscriber\.product_type\|\|'\'\)\.toUpperCase\(\)/);
  assert.match(html, /if\(productType==='G'\)return 'movil';/);
  assert.match(html, /if\(\['O','T','V'\]\.includes\(productType\)\)return 'fijo';/);
  assert.doesNotMatch(html, /banTypes\[subscriber&&subscriber\.ban_number\]/);
  assert.match(html, /function cliServiceProfile\(subscribers,bans=\[\]\)/);
  assert.match(html, /const serviceProfile=cliServiceProfile\(c\.subscribers\|\|\[\],c\.bans\|\|\[\]\)/);
});

test('Clientes permite filtrar el listado por movil, fijo y convergente sin cambiar la fuente', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /cliServiceFilter='todas'/);
  assert.match(html, /function cliClientServiceType\(client\)/);
  assert.match(html, /data-client-service-tab="\$\{value\}"/);
  assert.match(html, /\['convergente','Convergente'\]/);
  assert.match(html, /mobile_new_count/);
  assert.match(html, /&service=\$\{service\}/);
});

test('la ficha del cliente separa lineas activas y canceladas en tabs por BAN', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /const activeRows=renderSubscriberRows\(visibleLines\(active\),/);
  assert.match(html, /const canceledRows=renderSubscriberRows\(visibleLines\(canceled\),/);
  assert.match(html, /const statusTabs=/);
  assert.match(html, /onclick="setCliMSub\('activas'\)"/);
  assert.match(html, /onclick="setCliMSub\('canceladas'\)"/);
  assert.match(html, /const selectedRows=cliMSub==='canceladas'\?canceledRows:activeRows/);
  assert.doesNotMatch(html, /subscriber-section canceled/);
});

test('la pestaña Comparativas del cliente ofrece HTML/PDF además del constructor', async () => {
  const html = await readFile(appPath, 'utf8');
  const start = html.indexOf('function tabComp(c)');
  const end = html.indexOf('function abrirConstructorCliente', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = html.slice(start, end);

  assert.match(block, /onclick="abrirComparativa\('\$\{c\.id\}'\)"/);
  assert.match(block, /Comparativa HTML\/PDF/);
  assert.match(block, /onclick="abrirConstructorCliente\('\$\{c\.id\}'\)"/);
  assert.match(block, /Abrir constructor de ofertas/);
});

test('la comparativa exporta un formulario Excel en una sola hoja visual', async () => {
  const html = await readFile(appPath, 'utf8');
  const start = html.indexOf('function compExcel()');
  const end = html.indexOf('function compPDF()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = html.slice(start, end);

  assert.match(block, /Comparativa de Planes/);
  assert.match(block, /Plan actual del cliente/);
  assert.match(block, /Oferta propuesta/);
  assert.match(block, /Total actual/);
  assert.match(block, /Total oferta/);
  assert.match(block, /Diferencia/);
  assert.match(block, /XLSX\.utils\.book_new\(\)/);
  assert.match(block, /XLSX\.utils\.aoa_to_sheet/);
  assert.match(block, /XLSX\.utils\.book_append_sheet/);
  assert.match(block, /XLSX\.writeFile/);
  assert.match(block, /\.xlsx/);
});

test('la comparativa usa fecha fin real en vencimiento y separa cuentas BAN', async () => {
  const html = await readFile(appPath, 'utf8');
  const start = html.indexOf('// ---- Comparativa de Planes');
  const end = html.indexOf('async function viewCliente', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = html.slice(start, end);

  assert.match(block, /function compEndDate\(s\)/);
  assert.match(block, /function compDateOnly\(value\)/);
  assert.match(block, /function compTodayOnly\(\)/);
  assert.match(block, /return d<compTodayOnly\(\)\?'Vencido':fmtDate\(raw\)/);
  assert.match(block, /function compBanCount\(rows\)/);
  assert.match(block, /function compBanDisplay\(s,order\)/);
  assert.match(block, /compEndDate\(s\)/);
  assert.match(block, /compBanDisplay\(s,banOrder\)/);
  assert.match(block, /cuentas:compBanCount\(current\)/);
  assert.doesNotMatch(block, /cliVenc\(s\.contract_end_date\)/);

  const template = await readFile(new URL('../../frontend/propuesta-template.html', import.meta.url), 'utf8');
  assert.match(template, /function currentBanCount\(\)/);
  assert.match(template, /function currentAccountsLabel\(\)/);
  assert.match(template, /\$\{currentAccountsLabel\(\)\}/);
  assert.doesNotMatch(template, /Actual 2 cuentas/);
});

test('la propuesta interactiva usa campos comerciales editables de oferta', async () => {
  const html = await readFile(appPath, 'utf8');
  const start = html.indexOf('function generarPropuesta(pdf)');
  const end = html.indexOf('async function compSave', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = html.slice(start, end);

  assert.match(block, /compReadOffer\(\)/);
  assert.match(block, /const offerRows=compOffer\.length\?compOffer:act\.map\(s=>\(\{ban:compBanDisplay\(s,banOrder\),phone:s\.phone\|\|'',plan:'',cost:'',notes:''\}\)\)/);
  assert.match(block, /const proposal=offerRows\.map\(r=>\[r\.ban\|\|'', r\.phone\|\|'', r\.plan\|\|'', r\.cost\|\|'', 0, '', r\.notes\|\|''\]\)/);

  const template = await readFile(new URL('../../frontend/propuesta-template.html', import.meta.url), 'utf8');
  assert.match(template, /--flow-gap:clamp\(4px,\.65vw,8px\)/);
  assert.match(template, /--panel-pad:clamp\(7px,\.8vw,11px\)/);
  assert.match(template, /\.section\{[^}]*padding:var\(--panel-pad\)[^}]*margin:var\(--flow-gap\) 0/);
  assert.match(template, /th\{[^}]*padding:7px 8px/);
  assert.match(template, /td\{[^}]*padding:5px 7px/);
  assert.match(template, /class="compactHeader"/);
  assert.match(template, /class="summaryBar"/);
  assert.match(template, /<table class="proposal" id="proposalTable"><thead><tr><th>BAN<\/th><th>Suscriptor<\/th><th>Plan<\/th><th>Costo<\/th><th>Plazos<\/th><th>Equipo a ofrecer<\/th><th>Notas<\/th><\/tr><\/thead>/);
  assert.match(template, /proposal\[\$\{i\}\]\[3\]=parseFloat\(this\.value\|\|0\);calc\(\)/);
  assert.match(template, /proposal\[\$\{i\}\]\[4\]=this\.value/);
  assert.match(template, /proposal\[\$\{i\}\]\[5\]=this\.value/);
  assert.match(template, /proposal\[\$\{i\}\]\[6\]=this\.value/);
  assert.doesNotMatch(template, /Quitar/);
  assert.doesNotMatch(template, /class="hero"/);
  assert.doesNotMatch(template, /class="cards"/);
  assert.doesNotMatch(template, /<th>Vencimiento<\/th><th>Equipo<\/th><th><\/th>/);
});
