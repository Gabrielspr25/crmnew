import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('let tareasReglasModules='), html.indexOf('async function viewHistorial()'));

function runtime(modulesError = false) {
  const calls = [];
  const ctx = vm.createContext({
    ofAdminView: 'control',
    esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
    api: async (url, options = {}) => {
      assert.equal(options.method || 'GET', 'GET');
      calls.push(url);
      assert.equal(url, '/api/admin-control/modules');
      if (modulesError) throw Error('SQL privado');
      return { environment: 'Instancia de prueba', modules: [{ key: 'claro_tv', title: 'Claro TV', publication: { label: 'Version 14 publicada' }, pending: { label: 'Sin actualización registrada' }, verification: { status: 'Verificado' } }] };
    },
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}

test('estado compacto muestra un modulo y una accion sin desplegar la auditoria tecnica', async () => {
  const { ctx, calls } = runtime();
  const result = await ctx.viewTareasReglasAdmin();
  for (const value of ['Estado de módulos', 'Claro TV', 'Version 14 publicada', 'Sin actualización registrada', 'Abrir módulo']) assert.ok(result.includes(value), value);
  for (const hidden of ['Checklist de cierre', 'Evidencia', 'Bloqueo', 'Criterio de cierre', 'Portal, Motor Comercial y Constructor']) assert.ok(!result.includes(hidden), hidden);
  assert.deepEqual(calls, ['/api/admin-control/modules']);
});

test('fallo operativo muestra un mensaje simple y no filtra detalles tecnicos', async () => {
  const { ctx } = runtime(true);
  const result = await ctx.viewTareasReglasAdmin();
  assert.match(result, /No se pudo cargar el estado de los módulos/);
  assert.doesNotMatch(result, /SQL privado|Checklist de cierre/);
});
