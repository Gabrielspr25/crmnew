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
  assert.match(html, /client\.all_service_types/);
});

test('la ficha del cliente muestra lineas activas y canceladas juntas por BAN', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /const activeRows=renderSubscriberRows\(visibleLines\(active\),/);
  assert.match(html, /const canceledRows=renderSubscriberRows\(visibleLines\(canceled\),/);
  assert.match(html, /subscriber-section active/);
  assert.match(html, /subscriber-section canceled/);
  assert.doesNotMatch(html, /const selected=visibleLines\(cliMSub==='canceladas'\?canceled:active\)/);
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
  assert.match(block, /application\/vnd\.ms-excel/);
  assert.match(block, /downloadTextFile\(/);
  assert.doesNotMatch(block, /book_append_sheet/);
  assert.doesNotMatch(block, /json_to_sheet/);
});
