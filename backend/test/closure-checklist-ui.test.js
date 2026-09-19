import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('let tareasReglasModules='), html.indexOf('async function viewHistorial()'));
function data() {
  return { updated_at: '2026-09-17', items: [{ id: 'TEST-1', step: 'Paso unico', module: 'Modulo unico', status: 'terminado', environment: 'local', status_label: 'Comprobado localmente', environment_label: 'Local', evidence: ['Prueba registrada'], blocker: null, next_action: 'Revision final', closure_criterion: 'Cierre trazable', checked_at: '2026-09-17T12:00:00Z' }] };
}
function runtime(checklist = data(), modulesError = false) {
  const calls = [];
  const ctx = vm.createContext({
    esc: v => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
    api: async (url, options = {}) => {
      assert.equal(options.method || 'GET', 'GET'); calls.push(url);
      if (url.endsWith('/closure-checklist')) { if (checklist instanceof Error) throw checklist; return checklist; }
      assert.equal(url, '/api/admin-control/modules');
      if (modulesError) throw Error('SQL privado');
      return { environment: 'Instancia de prueba', modules: [{ key: 'claro_tv', title: 'Claro TV', publication: { label: 'Version 14 publicada' }, verification: { status: 'Sin verificar' } }] };
    },
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}

test('checklist compacto muestra criterio de cierre y fecha al corte sin cambiar publicaciones', async () => {
  const { ctx, calls } = runtime();
  const result = await ctx.viewTareasReglasAdmin();
  for (const value of ['Checklist de cierre', '2026-09-17', 'Paso unico', 'Modulo unico', 'Comprobado localmente', 'Local', 'Prueba registrada', 'Revision final', 'Cierre trazable', 'Version 14 publicada']) assert.ok(result.includes(value), value);
  for (const field of ['Paso', 'Modulo', 'Estado', 'Ambiente', 'Evidencia', 'Bloqueo', 'Siguiente accion', 'Criterio de cierre']) assert.ok(result.includes(`>${field}</th>`), field);
  assert.equal((result.match(/Paso unico/g) || []).length, 1);
  assert.ok(calls.includes('/api/admin-control/closure-checklist'));
  assert.doesNotMatch(block, /Comprobado localmente|Comprobado en produccion|CC-0[1-6]/);
});

test('cada columna del checklist tiene ancho propio y los anchos suman 100%', async () => {
  const result = await runtime().ctx.viewTareasReglasAdmin();
  const header = result.slice(result.indexOf('<thead>'), result.indexOf('</thead>'));
  const columns = (header.match(/<th>/g) || []).length;
  const widths = [...html.matchAll(/\.tra-closure th:nth-child\((\d+)\)\{width:(\d+)%;\}/g)].map(([, n, w]) => [Number(n), Number(w)]);
  assert.deepEqual(widths.map(([n]) => n), Array.from({ length: columns }, (_, i) => i + 1));
  assert.equal(widths.reduce((sum, [, w]) => sum + w, 0), 100);
});

test('etiquetas por ambiente provienen del endpoint y todos los textos se escapan', async () => {
  const current = data();
  current.items[0] = { ...current.items[0], environment: 'produccion', environment_label: 'Produccion', status_label: 'Comprobado en produccion' };
  for (const field of ['step', 'module', 'next_action']) current.items[0][field] = '<img src=x onerror=alert(1)>"';
  current.items[0].evidence = ['<script>alert(1)</script>', '[enlace](javascript:alert(1))'];
  const { ctx } = runtime(current);
  const result = await ctx.viewTareasReglasAdmin();
  assert.match(result, /Comprobado en produccion/);
  assert.doesNotMatch(result, /Comprobado localmente|<img|<script|href="javascript:/);
  assert.match(result, /&lt;img/);
});

for (const [name, value] of [
  ['ausente', null], ['error', new Error('secret.json password=secreto')],
  ['malformado', { updated_at: '2026-09-17', items: [null] }],
  ['sin fecha', { ...data(), updated_at: null }],
  ['duplicados', { ...data(), items: [data().items[0], data().items[0]] }],
  ['evidencia malformada', { ...data(), items: [{ ...data().items[0], evidence: 'Prueba' }] }],
  ['sin etiqueta derivada', { ...data(), items: [{ ...data().items[0], status_label: null }] }],
  ['sin criterio de cierre', { ...data(), items: [{ ...data().items[0], closure_criterion: null }] }],
  ['fecha imposible', { ...data(), updated_at: '2026-02-30' }],
]) {
  test(`checklist ${name} falla cerrado sin perder panel operativo`, async () => {
    const { ctx } = runtime(value);
    const result = await ctx.viewTareasReglasAdmin();
    assert.match(result, /Version 14 publicada/);
    assert.match(result, /Checklist de cierre[\s\S]*Sin verificar/);
    assert.doesNotMatch(result, /Comprobado localmente|Paso unico|password|secret\.json/);
  });
}

test('fallo operativo no oculta el checklist ni sus propios datos de corte', async () => {
  const { ctx } = runtime(data(), true);
  const result = await ctx.viewTareasReglasAdmin();
  assert.match(result, /Sin verificar/);
  assert.match(result, /Paso unico/);
  assert.doesNotMatch(result, /SQL privado/);
});

test('checklist vacio no inventa pasos y los campos de bloqueo y etiquetas son texto', async () => {
  const empty = runtime({ ...data(), items: [] });
  const output = await empty.ctx.viewTareasReglasAdmin();
  assert.match(output, /2026-09-17/);
  assert.match(output, /Sin pasos registrados/);
  assert.doesNotMatch(output, /Paso unico|Comprobado localmente/);
  const current = data();
  Object.assign(current.items[0], { status: 'bloqueado', status_label: '<b>Bloqueado</b>', blocker: '<img src=x>', environment_label: '<script>local</script>' });
  const escaped = await runtime(current).ctx.viewTareasReglasAdmin();
  assert.doesNotMatch(escaped, /<img|<script|<b>Bloqueado/);
  assert.match(escaped, /&lt;img/);
});
