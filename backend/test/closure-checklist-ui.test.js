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
    esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
    api: async url => { calls.push(url); throw Error('No debe consultar estado'); },
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}

test('reglas por boletin muestra sus modulos de impacto sin desplegar la auditoria tecnica', async () => {
  const { ctx, calls } = runtime();
  const result = await ctx.viewTareasReglasAdmin();
  for (const value of ['Reglas por boletín', 'Boletín Fijo / Claro TV', 'Planes Fijos', 'Claro TV']) assert.ok(result.includes(value), value);
  for (const hidden of ['Checklist de cierre', 'Evidencia', 'Bloqueo', 'Criterio de cierre', 'Estado por confirmar']) assert.ok(!result.includes(hidden), hidden);
  assert.deepEqual(calls, ['/api/admin-control/modules']);
});

test('reglas por boletin mantiene los impactos visibles aunque no haya respuesta de estado', async () => {
  const { ctx } = runtime();
  const result = await ctx.viewTareasReglasAdmin();
  assert.match(result, /Lista de Equipos y Precios/);
  assert.match(result, /Lista de Precios/);
  assert.doesNotMatch(result, /Sin verificar|No se pudo cargar/);
});
