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
  assert.equal(map.contract_start_date, 'COMMIT_START_DATE');
  assert.equal(map.contract_end_date, 'COMMIT_END_DATE');
  assert.equal(map.credit_class, 'CREDIT_CLASS');
  assert.equal(map.soc, 'SOC');
  assert.equal(map.product_type, 'PRODUCT_TYPE');
  assert.equal(map.item_id, 'ITEM_ID');
  assert.equal(map.installment_from, 'NO_OF_INSTALL_FROM');
  assert.equal(map.installment_total, 'TOTAL_NO_OF_INSTALL');
  // Columnas excluidas a pedido del usuario: no se importan nunca
  const usados = new Set(Object.values(map));
  assert.ok(!usados.has('ITEM_LDESC'));
  assert.ok(!usados.has('ITEM_SDESC'));
  assert.ok(!usados.has('SUB_STATUS_DATE'));
  assert.ok(!usados.has('UNIT_ESN'));
});

test('apply recalcula el estado del BAN segun sus lineas (activo si queda alguna activa)', () => {
  assert.match(routesSource, /bansTocados/);
  assert.match(routesSource, /WHEN EXISTS \(SELECT 1 FROM public\.subscribers s WHERE s\.ban_id = b\.id AND s\.status = 'activo'\) THEN 'activo'/);
  assert.match(routesSource, /ELSE 'inactivo'/);
  assert.match(routesSource, /bans_estado_recalculado/);
});

test('backend escribe los campos PS: subscriber (product_type, item_id, soc, cuotas, fechas) y ban (credit_class)', () => {
  assert.match(routesSource, /\['product_type', 'product_type'\]/);
  assert.match(routesSource, /\['item_id', 'item_id'\]/);
  assert.match(routesSource, /\['soc', 'price_code'\]/);
  assert.match(routesSource, /\['installment_from', 'payments_made'\]/);
  assert.match(routesSource, /\['installment_total', 'contract_term'\]/);
  assert.doesNotMatch(routesSource, /status_date/);
  assert.match(routesSource, /\['contract_start_date', 'contract_start_date'\]/);
  assert.match(routesSource, /credit_class = \$/);
  assert.match(routesSource, /account_type, credit_class\)/);
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
  assert.equal(dates.length, 2);
  assert.equal(ints.length, 2);
  assert.match(routesSource, /SUB_DATES = new Set\(\['activation_date', 'contract_end_date', 'contract_start_date'\]\)/);
});

test('preview reporta ausentes solo con archivos grandes (cartera completa)', () => {
  assert.match(routesSource, /phones\.length >= 100/);
  assert.match(routesSource, /subs_ausentes/);
  assert.match(routesSource, /bans_ausentes/);
});

test('endpoint de bajas existe, exige cartera completa y es transaccional', () => {
  assert.match(routesSource, /importRouter\.post\('\/import\/bajas', requireAuth/);
  assert.match(routesSource, /phones\.length < 100 \|\| bans\.length < 100/);
  assert.match(routesSource, /BEGIN/);
  assert.match(routesSource, /ROLLBACK/);
  assert.match(routesSource, /SET status = 'cancelado'/);
  assert.match(routesSource, /SET status = 'inactivo'/);
});

test('la UI muestra bajas como paso aparte y nunca dentro de Aplicar', () => {
  assert.match(appHtml, /function impBajas\(\)/);
  assert.match(appHtml, /Marcar bajas/);
  assert.match(appHtml, /cartera COMPLETA/);
  const aplicar = appHtml.match(/async function impAplicar\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(aplicar, /bajas/i);
});
