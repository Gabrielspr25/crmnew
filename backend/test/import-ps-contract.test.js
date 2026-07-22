import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('../src/routes/importRoutes.js', import.meta.url), 'utf8');

function autoDetectMap(headers) {
  const detect = eval('(' + appHtml.match(/const IMP_DETECT=\{[\s\S]*?\};/)[0].replace('const IMP_DETECT=', '').replace(/;\s*$/, '') + ')');
  const fields = eval(appHtml.match(/const IMP_FIELDS=\[[\s\S]*?\];/)[0].replace('const IMP_FIELDS=', '').replace(/;\s*$/, ''));
  const map = {}, taken = {};
  fields.forEach((fd) => {
    const key = fd[0];
    for (let i = 0; i < headers.length; i++) {
      if (!taken[i] && detect[key] && detect[key].test(headers[i].toLowerCase())) { map[key] = headers[i]; taken[i] = 1; break; }
    }
  });
  return map;
}

test('auto-deteccion reconoce TODOS los encabezados utiles del formato PS de Claro (formato oficial)', () => {
  const map = autoDetectMap(['BAN', 'SUB', 'ACCTYPE', 'SUB_STATUS', 'SUB_STATUS_DATE', 'SOC', 'PRODUCT_TYPE',
    'COMMIT_START_DATE', 'COMMIT_END_DATE', 'CREDIT_CLASS', 'NO_OF_INSTALL_FROM', 'TOTAL_NO_OF_INSTALL',
    'UNIT_ESN', 'ITEM_ID', 'ITEM_LDESC', 'ITEM_SDESC', 'Email', 'Empresa']);
  assert.equal(map.ban, 'BAN');
  assert.equal(map.sub_phone, 'SUB');
  assert.equal(map.name, 'Empresa');
  assert.equal(map.email, 'Email');
  assert.equal(map.account_type, 'ACCTYPE');
  assert.equal(map.status, 'SUB_STATUS');
  assert.equal(map.activation_date, 'SUB_STATUS_DATE');
  assert.equal(map.contract_start_date, 'COMMIT_START_DATE');
  assert.equal(map.contract_end_date, 'COMMIT_END_DATE');
  assert.equal(map.credit_class, 'CREDIT_CLASS');
  assert.equal(map.soc, 'SOC');
  assert.equal(map.product_type, 'PRODUCT_TYPE');
  assert.equal(map.item_id, 'ITEM_ID');
  assert.equal(map.installment_from, 'NO_OF_INSTALL_FROM');
  assert.equal(map.installment_total, 'TOTAL_NO_OF_INSTALL');
  assert.equal(map.equipment, 'ITEM_LDESC');
  // ITEM_LDESC es el modelo de equipo; ITEM_SDESC sigue fuera porque no tiene columna propia.
  const usados = new Set(Object.values(map));
  assert.ok(!usados.has('ITEM_SDESC'));
  assert.ok(!usados.has('UNIT_ESN'));
});

test('apply recalcula el estado del BAN segun sus lineas (A si queda alguna activa)', () => {
  assert.match(routesSource, /bansTocados/);
  assert.match(routesSource, /WHEN EXISTS \(SELECT 1 FROM public\.subscribers s WHERE s\.ban_id = b\.id AND s\.status = 'activo'\) THEN 'A'/);
  assert.match(routesSource, /ELSE 'C'/);
  assert.match(routesSource, /bans_estado_recalculado/);
});

test('estado del BAN solo usa A o C: suspendido queda activo y bajas quedan canceladas', () => {
  const fn = routesSource.match(/function normBanStatus\(s\) \{[\s\S]*?\n\}/)?.[0] || '';
  const normBanStatus = eval('(' + fn.replace('function normBanStatus', 'function') + ')');
  assert.equal(normBanStatus('A'), 'A');
  assert.equal(normBanStatus('S'), 'A');
  assert.equal(normBanStatus('Suspendido'), 'A');
  assert.equal(normBanStatus('C'), 'C');
  assert.equal(normBanStatus('Inactivo'), 'C');
  assert.doesNotMatch(routesSource, /ELSE 'I'/);
});

test('aplicar importacion es transaccional y revierte ante un error final', () => {
  const applyRoute = routesSource.match(/importRouter\.post\('\/import\/apply',[\s\S]*?\n\}\);\n\n\/\/ POST \/api\/import\/bajas/)?.[0] || '';
  assert.match(applyRoute, /await c\.query\('BEGIN'\)/);
  assert.match(applyRoute, /await c\.query\('COMMIT'\)/);
  assert.match(applyRoute, /await c\.query\('ROLLBACK'\)\.catch/);
});

test('una fila invalida no invalida el resto de la cartera', () => {
  const applyRoute = routesSource.match(/importRouter\.post\('\/import\/apply',[\s\S]*?\n\}\);\n\n\/\/ POST \/api\/import\/bajas/)?.[0] || '';
  assert.match(applyRoute, /SAVEPOINT import_row_\$\{i\}/);
  assert.match(applyRoute, /ROLLBACK TO SAVEPOINT import_row_\$\{i\}/);
  assert.match(applyRoute, /RELEASE SAVEPOINT import_row_\$\{i\}/);
});

test('el archivo reasigna un suscriptor al BAN indicado sin duplicarlo', () => {
  const applyRoute = routesSource.match(/importRouter\.post\('\/import\/apply',[\s\S]*?\n\}\);\n\n\/\/ POST \/api\/import\/bajas/)?.[0] || '';
  assert.match(applyRoute, /subs_reasignados_ban/);
  assert.match(applyRoute, /sets\.push\(`ban_id = \$\$\{vals\.length\}`\)/);
  assert.doesNotMatch(applyRoute, /throw new Error\(`Suscriptor \$\{subPhone\} ya pertenece a otro BAN/);
});

test('el resultado conserva detalle de cada cambio real de importacion', () => {
  assert.match(routesSource, /detalles: \[\]/);
  assert.match(routesSource, /out\.detalles\.push/);
});

test('backend escribe los campos PS: subscriber (product_type, item_id, soc, cuotas, fechas) y ban (credit_class)', () => {
  assert.match(routesSource, /\['product_type', 'product_type'\]/);
  assert.match(routesSource, /\['item_id', 'item_id'\]/);
  assert.match(routesSource, /\['soc', 'price_code'\]/);
  assert.match(routesSource, /\['installment_from', 'payments_made'\]/);
  assert.match(routesSource, /\['installment_total', 'contract_term'\]/);
  assert.match(routesSource, /\['remaining_payments', 'remaining_payments'\]/);
  assert.match(routesSource, /\['line_kind', 'line_kind'\]/);
  assert.doesNotMatch(routesSource, /status_date/);
  assert.match(routesSource, /\['contract_start_date', 'contract_start_date'\]/);
  assert.match(routesSource, /desired\.credit_class = cc/);
  assert.match(routesSource, /account_type, credit_class\)/);
});

test('el frontend reconoce el libro operativo de varias hojas antes del mapeo manual', () => {
  assert.match(appHtml, /src="\/import-workbook\.js"/);
  assert.match(appHtml, /ImportWorkbook\.parseOperationalWorkbook/);
  assert.match(appHtml, /Archivo operativo Claro reconocido/);
});

test('importador trata SOC como plan visible y guarda price_code normalizado para lookup', () => {
  assert.match(routesSource, /applyPlanCodeDefaults/);
  assert.match(routesSource, /plan: txt\(r\.plan\) \|\| txt\(r\.soc\)/);
  assert.match(routesSource, /if \(col === 'plan'\) v = txt\(r\.plan\) \|\| txt\(r\.soc\)/);
  assert.match(routesSource, /if \(col === 'price_code'\) v = defaults\.price_code/);
  assert.match(routesSource, /if \(col === 'contract_term'\) v = txt\(r\.installment_total\) \|\| defaults\.contract_term/);
});

test('auto-deteccion no rompe archivos en espanol (encabezados clasicos)', () => {
  const map = autoDetectMap(['Cliente', 'Empresa', 'Email', 'Teléfono', 'BAN', 'Plan', 'Estado']);
  assert.equal(map.name, 'Cliente');
  assert.equal(map.company, 'Empresa');
  assert.equal(map.ban, 'BAN');
  assert.equal(map.plan, 'Plan');
});

test('normStatus entiende letras sueltas A/C/S del formato PS (suspendido cuenta como activo)', () => {
  const fn = routesSource.match(/function normStatus\(s\) \{[\s\S]*?\n\}/)?.[0] || '';
  const normStatus = eval('(' + fn.replace('function normStatus', 'function') + ')');
  assert.equal(normStatus('A'), 'activo');
  assert.equal(normStatus('C'), 'cancelado');
  assert.equal(normStatus('S'), 'activo'); // regla del negocio: suspendido sigue en cartera
  assert.equal(normStatus('Suspended'), 'activo');
  assert.equal(normStatus('Cancelled'), 'cancelado');
  assert.equal(normStatus(''), null);
});

test('normDate convierte seriales de Excel y fechas dd-Mon-yy', () => {
  const meses = routesSource.match(/const MESES = \{.*?\};/s)?.[0] || '';
  const fn = routesSource.match(/function normDate\(v\) \{[\s\S]*?\n\}/)?.[0] || '';
  const normDate = eval('(() => { ' + meses + ' ' + fn + ' return normDate; })()');
  assert.equal(normDate('44561'), '2021-12-31'); // serial Excel
  assert.equal(normDate(44561), '2021-12-31');
  assert.equal(normDate('30-Dec-21'), '2021-12-30');
  assert.equal(normDate('30-Nov-25'), '2025-11-30');
  assert.equal(normDate('2026-07-01'), '2026-07-01');
  assert.equal(normDate(''), null);
  assert.equal(normDate('sin fecha'), null);
});

test('apply normaliza fechas y enteros del formato PS en update e insert', () => {
  const dates = routesSource.match(/SUB_DATES\.has\(col\)\) v = normDate\(v\)/g) || [];
  const ints = routesSource.match(/SUB_INTS\.has\(col\)\) v = /g) || [];
  assert.equal(dates.length, 1);
  assert.equal(ints.length, 1);
  assert.match(routesSource, /SUB_DATES = new Set\(\['activation_date', 'contract_end_date', 'contract_start_date'\]\)/);
});

test('preview reporta ausentes solo con archivos grandes (cartera completa)', () => {
  assert.match(routesSource, /phones\.length >= 100/);
  assert.match(routesSource, /subs_ausentes/);
  assert.match(routesSource, /bans_ausentes/);
});

test('la vista previa cuenta BAN y clientes únicos, no las filas repetidas de cada BAN', () => {
  assert.match(routesSource, /out\.ban_match = bans\.filter\(ban => exBans\.has\(ban\)\)\.length/);
  assert.match(routesSource, /out\.ban_new = bans\.filter\(ban => !exBans\.has\(ban\)\)\.length/);
  assert.match(routesSource, /out\.cli_match = names\.filter\(name => exNames\.has\(name\)\)\.length/);
  assert.match(routesSource, /out\.cli_new = names\.filter\(name => !exNames\.has\(name\)\)\.length/);
});

test('la vista previa usa el campo canonico phone sin depender de phone_number', () => {
  const previewRoute = routesSource.match(/importRouter\.post\('\/import\/preview',[\s\S]*?\n\}\);\n\n\/\/ POST \/api\/import\/apply/)?.[0] || '';
  assert.match(previewRoute, /s\.phone = ANY\(\$1\)/);
  assert.doesNotMatch(previewRoute, /phone_number/);
});

test('endpoint de bajas existe, exige cartera completa y es transaccional', () => {
  assert.match(routesSource, /importRouter\.post\('\/import\/bajas', requireAuth/);
  assert.match(routesSource, /phones\.length < 100 \|\| bans\.length < 100/);
  assert.match(routesSource, /BEGIN/);
  assert.match(routesSource, /ROLLBACK/);
  assert.match(routesSource, /SET status = 'cancelado'/);
  assert.match(routesSource, /SET status = 'C'/);
});

test('la UI muestra bajas como paso aparte y nunca dentro de Aplicar', () => {
  assert.match(appHtml, /function impBajas\(\)/);
  assert.match(appHtml, /Marcar bajas/);
  assert.match(appHtml, /cartera COMPLETA/);
  const aplicar = appHtml.match(/async function impAplicar\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(aplicar, /bajas/i);
});

test('la UI conserva el importador abierto y entrega el detalle descargable de cambios y errores', () => {
  const aplicar = appHtml.match(/async function impAplicar\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(aplicar, /erroresImport\.slice\(0,5\)/);
  assert.match(aplicar, /Primeros errores reales/);
  assert.match(aplicar, /impMostrarResultado\(\)/);
  assert.match(appHtml, /function impDescargarDetalle\(\)/);
  assert.match(appHtml, /valor anterior y valor nuevo/);
});

test('el resultado deja visible el primer error de importacion con su fila', () => {
  const resultRenderer = appHtml.match(/function impMostrarResultado\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(resultRenderer, /Errores reales/);
  assert.match(resultRenderer, /Fila '\+e\.fila/);
  assert.match(resultRenderer, /e\.error/);
});
