import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salesRoute = fs.readFileSync(path.join(root, 'src/routes/sales.js'), 'utf8');
const comisionesRoute = fs.readFileSync(path.join(root, 'src/routes/comisionesReal.js'), 'utf8');
const tangoClient = fs.readFileSync(path.join(root, 'src/tango.js'), 'utf8');
const frontend = fs.readFileSync(path.join(root, '../frontend/app.html'), 'utf8');

test('la sincronizacion consulta ventas y comisiones de Tango V2', () => {
  assert.match(tangoClient, /export async function fetchComisiones/);
  assert.match(salesRoute, /fetchVentas\(\{ desde, hasta \}\)/);
  assert.match(salesRoute, /fetchComisiones\(\{ desde, hasta \}\)/);
});

test('la sincronizacion escribe CRM canonico y reportes sin limpieza destructiva', () => {
  assert.match(salesRoute, /public\.clients/);
  assert.match(salesRoute, /public\.bans/);
  assert.match(salesRoute, /public\.subscribers/);
  assert.match(salesRoute, /public\.subscriber_reports/);
  assert.match(salesRoute, /BEGIN/);
  assert.match(salesRoute, /ROLLBACK/);
  assert.doesNotMatch(salesRoute, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(salesRoute, /\bTRUNCATE\b/i);
});

test('la sincronizacion usa las columnas reales del CRM para clientes, BANs y suscriptores', () => {
  assert.match(salesRoute, /COALESCE\(business_name, ''\)/);
  assert.match(salesRoute, /\(name, business_name, salesperson_id, source, pendiente_validacion\)/);
  assert.match(salesRoute, /WHERE b\.ban_number = \$1/);
  assert.match(salesRoute, /\(client_id, ban_number, status, account_type, source\)/);
  assert.match(salesRoute, /VALUES \(\$1, \$2, 'A', \$3, 'tango_v2'\)/);
  assert.match(salesRoute, /COALESCE\(phone, ''\)/);
  assert.match(salesRoute, /\(ban_id, phone, phone_norm, status, tango_ventaid,/);
  assert.match(salesRoute, /LEFT JOIN public\.bans b ON b\.ban_number = s\.ban_number/);
  assert.doesNotMatch(salesRoute, /b\.number/);
  assert.doesNotMatch(salesRoute, /phone_number/);
});

test('la creacion de suscriptores no reutiliza el parametro telefono para phone y phone_norm', () => {
  assert.match(
    salesRoute,
    /\(ban_id, phone, phone_norm, status, tango_ventaid,[\s\S]*?VALUES \(\$1,\$2,\$3,'activo',\$4,\$5,\$5,\$6,\$7,\$8,\$9,\$9\)/
  );
});

test('Comisiones ofrece sincronizar Tango para los roles administrativos de Tango', () => {
  assert.match(frontend, /Sincronizar Tango/);
  assert.match(frontend, /syncTangoComisiones/);
  assert.match(frontend, /await api\('\/api\/me'\)/);
  assert.match(frontend, /\['admin','administrador','administrator','super admin','super_admin','superadmin','supervisor'\]/);
});

test('Comisiones tiene vista responsive sin desbordar la pagina', () => {
  assert.match(frontend, /html,body\{[^}]*overflow-x:hidden/);
  assert.match(frontend, /\.content\{[^}]*overflow:auto/);
  assert.match(frontend, /\.com-desktop-table/);
  assert.match(frontend, /\.com-mobile-list/);
  assert.match(frontend, /@media\(max-width:760px\)[\s\S]*\.com-desktop-table\{display:none/);
  assert.match(frontend, /@media\(max-width:760px\)[\s\S]*\.com-mobile-list\{display:flex/);
  assert.match(frontend, /let mobileCards=/);
  assert.match(frontend, /com-mobile-products/);
});

test('Comisiones muestra productos en columnas separadas de escritorio', () => {
  assert.match(frontend, /let pcells=''; COLS\.forEach\(k=>\{/);
  assert.match(frontend, /COLS\.forEach\(k=>head\+='<th class="c">'\+PN\[k\]\+'<\/th>'\)/);
  assert.doesNotMatch(frontend, /<th>Productos<\/th>/);
  assert.doesNotMatch(frontend, /<td class="com-products-cell">'\+productPills\+'<\/td>/);
  assert.match(frontend, /min-width:'\+tableMin\+'px/);
});

test('Comisiones alinea tarjeta, columna y balance con vendor_commission', () => {
  assert.match(frontend, /const ven=rows\.reduce\(\(a,x\)=>a\+n\(x\.vendor_commission\),0\)/);
  assert.match(frontend, /const comc=lines\.reduce\(\(a,l\)=>a\+n\(l\.vendor_commission\),0\)/);
  assert.match(frontend, /<td class="r">'\+money\(comc\)\+'<\/td>/);
  assert.match(frontend, /<span>Comisi[oó]n<\/span><b>'\+money\(comc\)\+'<\/b>/);
  assert.match(frontend, /Balance pendiente[\s\S]*money\(ven-pag\)/);
  assert.doesNotMatch(frontend, /money\(emp-pag\)/);
  assert.doesNotMatch(frontend, /comc\?money\(comc\)/);
});

test('Comisiones muestra el vendedor de Tango cuando el cliente no tiene vendedor asignado', () => {
  assert.match(comisionesRoute, /LEFT JOIN ventaspro_nuevo\.sales vs ON vs\.tango_venta_id::text = sr\.external_sale_id::text/);
  assert.match(comisionesRoute, /COALESCE\(sp\.name, vs\.vendor_name, '—'\) AS vendedor/);
  assert.match(comisionesRoute, /COALESCE\(sp\.name, vs\.vendor_name\) ILIKE \$2/);
  assert.match(comisionesRoute, /SELECT DISTINCT COALESCE\(sp\.name, vs\.vendor_name\) AS name/);
  assert.match(comisionesRoute, /ORDER BY name/);
});

test('Comisiones permite filtrar por producto movil sin cambiar la fuente de datos', () => {
  assert.match(frontend, /let comMonth=null, comFilter='todos', comProductFilter='todos'/);
  assert.match(frontend, /COM_PRODUCT_FILTERS=\[\['todos','Todos'\],\['movil','Móvil'\],\['fijo','Fijo'\],\['otros','Otros'\]\]/);
  assert.match(frontend, /function setComProductFilter\(f\)/);
  assert.match(frontend, /const PROD_FIL=/);
  assert.match(frontend, /movil_new\|movil_ren/);
  assert.match(frontend, /rows=rows\.filter\(PROD_FIL\[comProductFilter\]\|\|PROD_FIL\.todos\)/);
});
