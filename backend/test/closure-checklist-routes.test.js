import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { readFile } from 'node:fs/promises';
import { createAdminControlRouter } from '../src/routes/adminControlRoutes.js';

function checklist() {
  return { updated_at: '2026-09-17', items: ['local', 'produccion'].map((environment, i) => ({ id: `TEST-${i}`, step: 'Comprobar', module: 'Prueba', status: 'terminado', environment, evidence: ['Evidencia de prueba'], blocker: null, next_action: 'Revision', checked_at: '2026-09-17T12:00:00Z' })) };
}
async function request(router, role) {
  const route = router.stack.find(layer => layer.route?.path === '/closure-checklist')?.route;
  assert.ok(route, 'Falta GET /closure-checklist');
  assert.deepEqual(Object.keys(route.methods), ['get']);
  const req = { headers: role ? { authorization: `Bearer ${jwt.sign({ rol: role }, process.env.JWT_SECRET || 'dev-secret-cambiar')}` } : {} };
  const res = { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  for (const layer of route.stack) {
    let advance = false;
    await layer.handle(req, res, error => { if (error) throw error; advance = true; });
    if (!advance) break;
  }
  return res;
}

test('checklist autentica admin/supervisor antes de cargar Plan y nunca consulta SQL', async t => {
  const previous = process.env.DEV_LOGIN;
  process.env.DEV_LOGIN = '0';
  t.after(() => { if (previous === undefined) delete process.env.DEV_LOGIN; else process.env.DEV_LOGIN = previous; });
  let loads = 0, queries = 0;
  const data = checklist();
  const router = createAdminControlRouter({ loadPlan: async () => { loads++; return { closure_checklist: data }; }, db: { query() { queries++; throw Error('SQL prohibido'); } } });
  assert.equal((await request(router)).code, 401);
  assert.equal((await request(router, 'vendedor')).code, 403);
  assert.equal(loads, 0);
  for (const role of ['admin', 'supervisor']) {
    const response = await request(router, role);
    assert.equal(response.code, 200);
    assert.equal(response.body.updated_at, data.updated_at);
    assert.equal(response.body.items[0].status_label, 'Comprobado localmente');
    assert.equal(response.body.items[1].status_label, 'Comprobado en produccion');
    assert.deepEqual(response.body.items.map(({ status_label, environment_label, ...raw }) => raw), data.items);
  }
  assert.equal(loads, 2);
  assert.equal(queries, 0);
  assert.deepEqual(data, checklist(), 'No se agregan campos derivados al Plan');
});

for (const kind of ['missing', 'invalid', 'exception']) {
  test(`checklist ${kind}: Sin verificar sin filas ni mensajes privados`, async () => {
    let queries = 0;
    const router = createAdminControlRouter({
      db: { query() { queries++; throw Error('No SQL'); } },
      loadPlan: async () => {
        if (kind === 'exception') throw Error('C:/privado/secret.json password=secreto');
        if (kind === 'missing') return {};
        const data = checklist(); data.items[0].checked_at = null;
        return { closure_checklist: data };
      },
    });
    const response = await request(router, 'admin');
    assert.equal(response.code, 503);
    assert.deepEqual(response.body, { error: 'Sin verificar' });
    assert.equal(queries, 0);
  });
}

test('ruta por defecto usa el checklist del Plan real sin duplicar items', async () => {
  const router = createAdminControlRouter({ db: { query() { assert.fail('No SQL'); } } });
  const response = await request(router, 'admin');
  const plan = JSON.parse(await readFile(new URL('../../docs/constructor/plan-maestro-constructor.json', import.meta.url), 'utf8'));
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.items.map(({ status_label, environment_label, ...raw }) => raw), plan.closure_checklist.items);
});

test('cada consulta lee el Plan y deriva las etiquetas sin heredar labels ni filas anteriores', async () => {
  const data = checklist();
  const router = createAdminControlRouter({ loadPlan: async () => ({ closure_checklist: data }), db: { query() { assert.fail('No SQL'); } } });
  assert.equal((await request(router, 'admin')).body.items.length, 2);
  data.items[0] = { ...data.items[0], status: 'bloqueado_seguridad', status_label: 'Comprobado en produccion', environment_label: 'Produccion', blocker: 'Revisar evidencia' };
  const response = await request(router, 'admin');
  assert.equal(response.body.items[0].status_label, 'Bloqueado seguridad');
  assert.equal(response.body.items[0].environment_label, 'Local');
  data.items = [];
  assert.deepEqual((await request(router, 'admin')).body, { updated_at: data.updated_at, items: [] });
});
