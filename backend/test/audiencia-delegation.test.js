import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { mkdtemp, access as fsAccess } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAudienceAccess } from '../src/services/audienciaAccess.js';
import { createAudienciaStore } from '../src/services/audienciaStore.js';
import { createAudienciaRouter } from '../src/routes/audienciaRoutes.js';
import { createAudienciaDelegation, clampMinutes } from '../src/services/audienciaDelegation.js';

const CRM_SECRET = 'secreto-crm-de-prueba';
const owner = { nick: 'gabriel', nombre: 'Gabriel Sanchez', rol: 'admin' };
const other = { nick: 'otra', nombre: 'Otra Cuenta', rol: 'admin' };
const crm = (user) => ({ Authorization: `Bearer ${jwt.sign(user, CRM_SECRET)}` });

// Réplica fiel del montaje de server.js: gate -> requireAuth -> router.
async function start() {
  const directory = await mkdtemp(path.join(tmpdir(), 'audiencia-deleg-'));
  const store = createAudienciaStore({ directory });
  const accessService = createAudienceAccess({ ownerNick: 'gabriel' });
  const logs = [];
  const delegation = createAudienciaDelegation({ access: accessService, store, log: (line) => logs.push(line) });
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  const requireAuth = (req, res, next) => {
    try { req.user = jwt.verify(String(req.headers.authorization || '').slice(7), CRM_SECRET); next(); } catch { res.status(401).json({ error: 'No autenticado' }); }
  };
  app.use('/api/audiencia', delegation.gate, requireAuth, createAudienciaRouter({ access: accessService, store, delegation }));
  app.get('/api/otra-ruta-crm', requireAuth, (req, res) => res.json({ user: req.user.nick }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (url, options = {}) => fetch(base + url, options);
  return { base, call, server, directory, delegation, logs, store };
}

async function issue(ctx, body = {}) {
  const response = await ctx.call('/api/audiencia/delegations', { method: 'POST', headers: { ...crm(owner), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { response, json: await response.json() };
}

test('el propietario emite una delegación de lectura y Katy lee Audiencia sin sesión CRM ni escribir', async () => {
  const ctx = await start();
  try {
    const { response, json } = await issue(ctx, { minutes: 15 });
    assert.equal(response.status, 201);
    assert.equal(json.scope, 'audiencia:read');
    assert.equal(json.minutes, 15);
    const read = await ctx.call('/api/audiencia/data', { headers: { Authorization: `Bearer ${json.token}` } });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).revision, 0);
    assert.equal(read.headers.get('cache-control'), 'no-store');
    await assert.rejects(fsAccess(path.join(ctx.directory, 'audiencia.json')), 'leer no debe crear archivos');
    assert.ok(ctx.logs.some((line) => /lectura delegada de Katy/.test(line)));
    assert.ok(ctx.logs.every((line) => !line.includes(json.token)), 'el token no se registra en logs');
  } finally { ctx.server.close(); }
});

test('la delegación no permite escribir, consultar otras rutas de Audiencia ni entrar al resto del CRM', async () => {
  const ctx = await start();
  try {
    const { json } = await issue(ctx);
    const katy = { Authorization: `Bearer ${json.token}`, 'Content-Type': 'application/json' };
    const put = await ctx.call('/api/audiencia/data', { method: 'PUT', headers: katy, body: JSON.stringify({ revision: 0 }) });
    assert.equal(put.status, 403);
    assert.equal((await ctx.call('/api/audiencia/access', { headers: katy })).status, 403);
    assert.equal((await ctx.call('/api/audiencia/delegations', { method: 'POST', headers: katy, body: '{}' })).status, 403);
    assert.equal((await ctx.call('/api/otra-ruta-crm', { headers: katy })).status, 401);
    assert.equal((await ctx.store.read()).revision, 0);
  } finally { ctx.server.close(); }
});

test('solo el propietario con sesión CRM puede emitir o revocar; otra cuenta y sin sesión no', async () => {
  const ctx = await start();
  try {
    const bad = await ctx.call('/api/audiencia/delegations', { method: 'POST', headers: { ...crm(other), 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 404);
    assert.equal((await ctx.call('/api/audiencia/delegations', { method: 'POST' })).status, 401);
    assert.equal((await ctx.call('/api/audiencia/delegations', { method: 'DELETE', headers: crm(other) })).status, 404);
    assert.equal(ctx.logs.length, 0);
  } finally { ctx.server.close(); }
});

test('un token falsificado, de otro secreto o con otra audiencia no lee nada', async () => {
  const ctx = await start();
  try {
    const forged = [
      [jwt.sign({ scope: 'audiencia:read', sub: 'katy' }, 'otro-secreto', { audience: 'audiencia-katy', expiresIn: 60 }), 401],
      // Firmado con el secreto del CRM pero sin ser el propietario: pasa requireAuth y Audiencia lo rechaza.
      [jwt.sign({ scope: 'audiencia:read', sub: 'katy' }, CRM_SECRET, { audience: 'audiencia-katy', expiresIn: 60 }), 404],
      // La sesión CRM normal del propietario sigue funcionando por su camino habitual.
      [jwt.sign(owner, CRM_SECRET), 200],
    ];
    for (const [token, expected] of forged) {
      const response = await ctx.call('/api/audiencia/data', { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, expected);
    }
    assert.equal((await ctx.call('/api/audiencia/data')).status, 401);
  } finally { ctx.server.close(); }
});

test('revocar invalida los accesos emitidos y el límite máximo se aplica', async () => {
  const ctx = await start();
  try {
    const { json } = await issue(ctx, { minutes: 9999 });
    assert.equal(json.minutes, 120);
    assert.equal((await ctx.call('/api/audiencia/data', { headers: { Authorization: `Bearer ${json.token}` } })).status, 200);
    const revoke = await ctx.call('/api/audiencia/delegations', { method: 'DELETE', headers: crm(owner) });
    assert.equal(revoke.status, 200);
    assert.equal((await ctx.call('/api/audiencia/data', { headers: { Authorization: `Bearer ${json.token}` } })).status, 401);
    assert.deepEqual([clampMinutes(undefined), clampMinutes('x'), clampMinutes(-5), clampMinutes(0.4), clampMinutes(45)], [30, 30, 30, 1, 45]);
  } finally { ctx.server.close(); }
});

test('una delegación vencida deja de funcionar', async (t) => {
  const ctx = await start();
  try {
    const { json } = await issue(ctx, { minutes: 30 });
    assert.equal(ctx.delegation.claims(json.token)?.sub, 'katy');
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 31 * 60 * 1000 });
    assert.equal(ctx.delegation.claims(json.token), null);
  } finally { t.mock.timers.reset(); ctx.server.close(); }
});
