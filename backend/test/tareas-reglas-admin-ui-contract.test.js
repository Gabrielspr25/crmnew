import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('let tareasReglasModules='), html.indexOf('async function viewHistorial()'));
function runtime(modules = []) {
  const calls = [];
  const context = vm.createContext({
    esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    api: async url => {
      calls.push(url);
      if (url === '/api/admin-control/closure-checklist') return null;
      assert.equal(url, '/api/admin-control/modules');
      return { environment: 'Local de prueba', checked_at: '2026-09-17T12:00:00Z', modules };
    },
    location: { hash: '#/tareas-reglas-admin' },
    OF_TABS: [['claro_tv', 'Claro TV'], ['affinity', 'Affinity'], ['benefits', 'Beneficios']],
    ofAbrirDetallePublicacion: async (...args) => calls.push(args),
    ofAbrirDocumentoFuente: (...args) => calls.push(args),
    window: { open: (...args) => calls.push(args) },
    alert: message => calls.push(message),
    ofTab: '',
    router: async () => calls.push('router'),
    console,
  });
  vm.runInContext(block, context);
  return { context, calls, run: code => vm.runInContext(code, context) };
}
const tv = {
  key: 'claro_tv', title: 'Claro TV', provides: ['Planes y complementos'], consumers: [],
  constructor_step: 'Previsto: seleccion de servicio. Sin consumidor conectado.',
  publication: { label: 'Version 14 publicada', validity: 'Sin verificar', detail: '9 registros' },
  pending: { label: 'Documento nuevo recibido', detail: 'Analisis fallido; conserva version 14', source_id: 'new-source' },
  stages: [{ label: 'Documento', status: 'Recibido', detail: 'Solo recepcion' }, { label: 'Analisis', status: 'Sin verificar' }],
  verification: { status: 'Sin verificar', detail: 'No se comprobo el navegador' },
  documents: [{ id: 'published-source', name: '<original.pdf>', role: 'Publicada' }],
  alerts: [{ what: 'Falta analisis', why: 'Documento nuevo', how: 'Generar vista previa' }],
  actions: [{ kind: 'flow', tab: 'claro_tv', label: 'Revisar fuente' }, { kind: 'draft', tab: 'claro_tv', id: 'draft-id', label: 'Revisar borrador' }],
};
test('panel conserva publicada y pendiente simultaneas sin copiar estados del plan', async () => {
  const r = runtime([tv]);
  const overview = await r.run('viewTareasReglasAdmin()');
  assert.match(overview, /Version 14 publicada/);
  assert.match(overview, /Documento nuevo recibido/);
  assert.match(overview, /Local de prueba/);
  const detail = r.run('tareasReglasDetalleHtml(0)');
  for (const value of ['Analisis fallido', 'Previsto:', 'Sin verificar', 'Falta analisis', 'Documento nuevo', 'Generar vista previa', '&lt;original.pdf>']) assert.ok(detail.includes(value), value);
  assert.doesNotMatch(block, /production_status|local_status|Al d[ií]a/);
  assert.match(html, /href="#\/tareas-reglas-admin"/);
});
test('sin evidencia nunca significa que no existe publicacion', async () => {
  const r = runtime([{ ...tv, publication: null, pending: null }]);
  const output = await r.run('viewTareasReglasAdmin()');
  assert.match(output, /Sin verificar/);
  assert.doesNotMatch(output, /No (?:hay|existe) publicaci[oó]n/);
});
test('acciones de revision conservan modulo fuente y borrador; no escriben datos', async () => {
  const r = runtime([tv]);
  await r.run('viewTareasReglasAdmin()');
  await r.run('tareasReglasAccion(0,1)');
  assert.equal(r.context.location.hash, '#/ofertas/claro_tv');
  assert.equal(r.run('tareasReglasFlowTarget.source_id'), 'new-source');
  assert.equal(r.run('tareasReglasFlowTarget.draft_id'), 'draft-id');
  assert.doesNotMatch(block, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/);
});
test('documentos utilizan el acceso autenticado y destinos restringidos al portal', async () => {
  const r = runtime([tv]);
  await r.run('viewTareasReglasAdmin()');
  await r.run('tareasReglasDocumento(0,0)');
  assert.equal(r.calls.at(-1)[0], 'published-source');
  assert.equal(r.run("tareasReglasDestinoSeguro('javascript:alert(1)')"), false);
  assert.equal(r.run("tareasReglasDestinoSeguro('/constructor/claro-tv.html')"), true);
  assert.equal(r.run("tareasReglasDestinoSeguro('//evil.example')"), false);
});
