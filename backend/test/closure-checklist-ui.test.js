import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('let tareasReglasModules='), html.indexOf('async function viewHistorial()'));

function runtime() {
  const calls = [];
  const ctx = vm.createContext({
    ofAdminView: 'control',
    router: () => {},
    esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
    api: async url => { calls.push(url); throw Error('No debe consultar estado'); },
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}

test('reglas por boletin muestra sus modulos de impacto sin desplegar la auditoria tecnica', async () => {
  const { ctx, calls } = runtime();
  const result = await ctx.viewTareasReglasAdmin();
  for (const value of ['Reglas por boletín', 'Boletín Fijo / Claro TV', 'Boletín de Planes Móviles']) assert.ok(result.includes(value), value);
  assert.match(result, /data-role="rule-source"/);
  assert.match(result, /class="tra-rule-node/);
  for (const hidden of ['Checklist de cierre', 'Evidencia', 'Bloqueo', 'Criterio de cierre', 'Estado por confirmar']) assert.ok(!result.includes(hidden), hidden);
  assert.deepEqual(calls, ['/api/admin-control/modules']);
});

test('al elegir un boletin, solo quedan visibles su fuente y los modulos que impacta', async () => {
  const { ctx } = runtime();
  await ctx.viewTareasReglasAdmin();
  await ctx.tareasReglasSeleccionar('fijo_tv');
  const result = await ctx.viewTareasReglasAdmin();
  assert.match(result, /Boletín Fijo \/ Claro TV/);
  assert.match(result, /Planes Fijos/);
  assert.match(result, /Claro TV/);
  assert.doesNotMatch(result, /Boletín de Planes Móviles/);
});

test('reglas por boletin mantiene los impactos visibles aunque no haya respuesta de estado', async () => {
  const { ctx } = runtime();
  await ctx.tareasReglasSeleccionar('lista_precios');
  const result = await ctx.viewTareasReglasAdmin();
  assert.match(result, /Lista de Equipos y Precios/);
  assert.match(result, /Lista de Precios/);
  assert.doesNotMatch(result, /Sin verificar|No se pudo cargar/);
});
