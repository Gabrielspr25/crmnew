import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createAdminControlRouter } from '../src/routes/adminControlRoutes.js';

test('GET modules exige sesion y admin/supervisor; POST no existe', async (t) => {
  const previous = process.env.DEV_LOGIN;
  process.env.DEV_LOGIN = '0';
  t.after(() => { if (previous === undefined) delete process.env.DEV_LOGIN; else process.env.DEV_LOGIN = previous; });
  let reads = 0;
  const db = { query: async () => { reads++; return { rows: [] }; } };
  const app = express();
  app.use('/api/admin-control', createAdminControlRouter({ db }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api/admin-control/modules`;
  const headers = (rol) => ({ authorization: `Bearer ${jwt.sign({ rol }, process.env.JWT_SECRET || 'dev-secret-cambiar')}` });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: headers('vendedor') })).status, 403);
  assert.equal(reads, 0);
  for (const role of ['admin', 'supervisor']) {
    const response = await fetch(url, { headers: headers(role) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['checked_at', 'environment', 'modules']);
    assert.equal(body.modules.length, 10);
  }
  assert.ok(reads > 0);
  assert.equal((await fetch(url, { method: 'POST', headers: headers('admin') })).status, 404);
});

test('fallo de BD mantiene contrato con Sin verificar sin exponer el error', async () => {
  const router = createAdminControlRouter({ db: { query: async () => { throw Error('password=secreto'); } } });
  const handler = router.stack.find((layer) => layer.route?.path === '/modules').route.stack.at(-1).handle;
  let result;
  await handler({}, { json(body) { result = body; } });
  assert.equal(result.modules.length, 10);
  assert.equal(result.modules.find((m) => m.key === 'fijo').verification.status, 'Sin verificar');
  assert.doesNotMatch(JSON.stringify(result), /password|secreto/);
});
