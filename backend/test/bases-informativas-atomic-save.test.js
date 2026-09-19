import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createGuardarBaseBorradoresHandler,
  createPreviewBaseHandler,
} from '../src/routes/fuentesComercialesRoutes.js';

const uploadDir = fileURLToPath(new URL('../../Planes para web/Estructura de planes/planes/', import.meta.url));
const originalName = 'LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf';
const source = {
  id: '11111111-1111-4111-8111-111111111111', familia: 'fijos', documento_tipo: 'pdf',
  nombre_original: originalName, ruta_relativa: originalName,
  sha256: createHash('sha256').update(readFileSync(new URL(originalName, new URL('../../Planes para web/Estructura de planes/planes/', import.meta.url)))).digest('hex'),
};
const categories = ['fijo', 'claro_tv'];
const jsonColumns = new Set(['extraccion_original', 'registros_normalizados', 'candidatos_publicos', 'modulos_generados', 'contenido_excluido', 'auditoria', 'duplicados', 'validacion', 'diferencias']);

// Datos sinteticos: el original solo satisface custodia/hash; no se ejecuta ningun parser.
function previewItem(categoria) {
  const row = { categoria, codigo: `TEST-${categoria}`, descripcion: 'Solo prueba de persistencia' };
  return {
    categoria, pagina: categoria === 'fijo' ? 'fijos' : 'claro_tv', estado_sugerido: 'borrador', publicable: true,
    fuente_comercial_id: source.id, fuente_nombre: source.nombre_original, fuente_sha256: source.sha256,
    fecha_actualizacion_base: '2026-03-30', registros_normalizados: [row], candidatos_publicos: [row],
    modulos_generados: [{ seccion_key: `${categoria}_test`, contenido: { filas: [row] } }],
    contenido_excluido: [], duplicados: [], validacion: { errores: [], advertencias: [] },
    auditoria: { original: { fixture: true }, fuentes: [{ id: source.id, sha256: source.sha256 }] },
    diferencias: { registros: { nuevos: [row.codigo], eliminados: ['TEST-ANTERIOR'] } },
    resumen: { total_candidatos: 1 },
  };
}

function previousHistory() {
  return [
    ...categories.map((categoria, index) => ({
      ...previewItem(categoria), id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      numero: index + 1, estado: 'publicada', publicada_en: '2026-08-20T17:00:00.000Z',
    })),
    { ...previewItem('fijo'), id: '33333333-3333-4333-8333-333333333333', numero: 3, estado: 'reemplazada', reemplazada_en: '2026-08-20T17:00:00.000Z' },
    { ...previewItem('claro_tv'), id: '44444444-4444-4444-8444-444444444444', numero: 4, estado: 'borrador', auditoria: { preview_fingerprint: '0'.repeat(64) } },
  ];
}

function transactionalPool({ failSecondInsert = false, failCommit = false, failRollback = false, failConnect = false } = {}) {
  let committed = previousHistory();
  let sequence = committed.length;
  let attempts = 0;
  let connections = 0;
  const events = [];
  const unsupported = [];
  const locks = new Map();
  const unlock = (session) => session.unlocks.splice(0).forEach((release) => release());

  async function query(session, sql, params = []) {
    const text = sql.trim().replace(/\s+/g, ' ').replace(/;$/, '');
    const scope = session ? 'client' : 'pool';
    events.push({ scope, sql: text });
    if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(text)) {
      assert.ok(session, 'La transaccion debe usar un cliente dedicado');
      if (/^BEGIN\b/i.test(text)) {
        assert.equal(session.rows, null);
        session.rows = [];
      } else if (/^ROLLBACK\b/i.test(text)) {
        if (failRollback) throw Object.assign(new Error('rollback simulado falla'), { code: '08006' });
        session.rows = null;
        session.aborted = false;
        unlock(session);
      } else {
        assert.ok(session.rows && !session.aborted, 'No confirmar una transaccion abortada');
        if (failCommit) throw Object.assign(new Error('commit simulado falla'), { code: '40001' });
        committed.push(...session.rows);
        session.rows = null;
        unlock(session);
      }
      return { rows: [] };
    }
    if (session?.aborted) throw Object.assign(new Error('transaccion abortada simulada'), { code: '25P02' });
    // READ COMMITTED: cada SELECT ve los commits anteriores y las escrituras propias.
    const visible = [...committed, ...(session?.rows || [])];
    if (/^SELECT pg_advisory_xact_lock\(hashtext\(\$1\)\)/i.test(text)) {
      assert.ok(session?.rows, 'El lock pertenece a la transaccion');
      const key = params[0];
      const previous = locks.get(key) || Promise.resolve();
      if (locks.has(key)) events.push({ scope, waitingForLock: true });
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      locks.set(key, gate);
      await previous;
      session.unlocks.push(() => { if (locks.get(key) === gate) locks.delete(key); release(); });
      return { rows: [{}] };
    }
    if (/^SELECT .*FROM public\.fuentes_comerciales WHERE id=\$1/i.test(text)) return { rows: [structuredClone(source)] };
    if (/^SELECT DISTINCT ON \(categoria\)/i.test(text)) return { rows: structuredClone(visible.filter((row) => row.estado === 'publicada')) };
    if (/^SELECT .*FROM public\.bases_informativas_publicaciones/i.test(text) && /preview_fingerprint/.test(text)) {
      const fingerprint = params.find((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value));
      assert.ok(fingerprint, 'Consulta idempotente parametrizada por huella');
      const userParameter = text.match(/cargada_por\s*=\s*\$(\d+)/i);
      const sourceParameter = text.match(/fuente_comercial_id\s*=\s*\$(\d+)/i);
      assert.ok(userParameter && sourceParameter, 'Idempotencia restringida a usuario y fuente');
      return { rows: structuredClone(visible.filter((row) => row.fuente_comercial_id === params[Number(sourceParameter[1]) - 1]
        && row.cargada_por === params[Number(userParameter[1]) - 1] && row.auditoria?.preview_fingerprint === fingerprint)) };
    }
    const insert = text.match(/^INSERT INTO public\.bases_informativas_publicaciones\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*RETURNING \*$/i);
    if (insert) {
      attempts++;
      if (failSecondInsert && attempts === 2) {
        if (session?.rows) session.aborted = true;
        events.push({ scope, failure: 'second_insert' });
        throw Object.assign(new Error('segundo INSERT falla deliberadamente'), { code: 'XX001' });
      }
      const columns = insert[1].split(',').map((value) => value.trim());
      const values = insert[2].split(',').map((value) => value.trim());
      assert.equal(columns.length, values.length);
      const row = Object.fromEntries(columns.map((column, index) => {
        const token = values[index];
        const value = token.startsWith('$') ? params[Number(token.slice(1)) - 1] : token.replace(/^'|'$/g, '');
        return [column, jsonColumns.has(column) ? JSON.parse(value) : value];
      }));
      row.numero = ++sequence;
      row.id = `55555555-5555-4555-8555-${String(sequence).padStart(12, '0')}`;
      row.cargada_en = '2026-09-17T20:00:00.000Z';
      (session?.rows || committed).push(row);
      return { rows: [structuredClone(row)] };
    }
    unsupported.push(text);
    throw new Error(`SQL no soportado por fakeDB: ${text}`);
  }

  return {
    events, unsupported,
    get rows() { return structuredClone(committed); },
    get connections() { return connections; },
    seed(rows) { committed.push(...structuredClone(rows)); },
    query(sql, params) { return query(null, sql, params); },
    async connect() {
      connections++;
      if (failConnect) throw Object.assign(new Error('conexion simulada falla'), { code: '08006' });
      const session = { rows: null, aborted: false, released: false, unlocks: [] };
      return {
        query(sql, params) {
          assert.equal(session.released, false, 'No usar un cliente liberado');
          return query(session, sql, params);
        },
        release(error) {
          assert.equal(session.released, false, 'Liberar el cliente una sola vez');
          session.released = true;
          session.rows = null;
          unlock(session);
          events.push({ scope: 'client', sql: 'RELEASE', discarded: Boolean(error) });
        },
      };
    },
  };
}

function response(pool) {
  return {
    statusCode: 200, deliveries: [],
    status(code) { this.statusCode = code; return this; },
    json(payload) {
      this.payload = payload;
      this.deliveries.push({ status: this.statusCode, payload, committed: pool.rows });
      return payload;
    },
  };
}

async function scenario(options = {}) {
  const pool = transactionalPool(options);
  const before = pool.rows;
  const logs = [];
  const dependencies = {
    pool, uploadDir, runParser: async () => ({ fixture: true }),
    buildPreviews: () => ({ previews: categories.map(previewItem) }),
    logger: { error(...args) { logs.push(args); } },
  };
  const req = { params: { id: source.id }, user: { nick: 'test-atomic-save' }, body: { fecha_actualizacion_base: '2026-03-30' } };
  const preview = response(pool);
  await createPreviewBaseHandler(dependencies)(req, preview);
  assert.equal(preview.statusCode, 200, 'El preview debe funcionar antes de probar persistencia');
  assert.match(preview.payload.preview_fingerprint, /^[0-9a-f]{64}$/);
  req.body.preview_fingerprint = preview.payload.preview_fingerprint;
  const handler = createGuardarBaseBorradoresHandler(dependencies);
  return {
    pool, before, logs, fingerprint: req.body.preview_fingerprint,
    async save({ user = req.user.nick, omitFingerprint = false } = {}) {
      const res = response(pool);
      const request = structuredClone(req);
      request.user.nick = user;
      if (omitFingerprint) delete request.body.preview_fingerprint;
      await handler(request, res);
      assert.deepEqual(pool.unsupported, [], 'Un SQL no modelado no debe simular el fallo buscado');
      return res;
    },
    drafts() { return pool.rows.filter((row) => !before.some((old) => old.id === row.id)); },
  };
}

test('fallo en segunda categoria revierte por completo el lote y libera el cliente', async () => {
  const s = await scenario({ failSecondInsert: true });
  const res = await s.save();
  assert.equal(res.statusCode, 500);
  assert.ok(s.pool.events.some((event) => event.failure === 'second_insert'));
  assert.deepEqual(s.drafts().map((row) => row.categoria), [], 'No debe quedar la primera categoria guardada');
  assert.deepEqual(s.pool.rows, s.before);
  assert.equal(s.pool.connections, 1);
  assert.ok(s.pool.events.some((event) => event.scope === 'client' && event.sql === 'ROLLBACK'));
  assert.equal(s.pool.events.at(-1).sql, 'RELEASE');
});

test('fallo parcial responde 500 una sola vez, sin publicaciones ni exito aparente', async () => {
  const s = await scenario({ failSecondInsert: true });
  const res = await s.save();
  assert.ok(s.pool.events.some((event) => event.failure === 'second_insert'));
  assert.equal(res.deliveries.length, 1);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, { ok: false, codigo: 'error_interno' });
  assert.equal(Object.hasOwn(res.payload, 'publicaciones'), false);
});

test('reintento del mismo preview despues del fallo guarda una sola fila por categoria', async () => {
  const s = await scenario({ failSecondInsert: true });
  assert.equal((await s.save()).statusCode, 500);
  const retry = await s.save();
  assert.ok([200, 201].includes(retry.statusCode));
  assert.equal(retry.payload.ok, true);
  assert.deepEqual(s.drafts().map((row) => row.categoria).sort(), [...categories].sort(), 'El primer intento no debe dejar una fila duplicada al reintentar');
  assert.equal(retry.payload.publicaciones.length, 2);
});

test('repetir un guardado exitoso de la misma huella conserva IDs sin crear duplicados', async () => {
  const s = await scenario();
  const first = await s.save();
  assert.equal(first.statusCode, 201);
  const repeated = await s.save();
  assert.ok([200, 201].includes(repeated.statusCode));
  assert.equal(repeated.payload.ok, true);
  assert.equal(s.drafts().length, 2, 'Dos categorias, no cuatro borradores para el mismo preview');
  assert.deepEqual(repeated.payload.publicaciones.map((row) => row.id).sort(), first.payload.publicaciones.map((row) => row.id).sort());
});

test('guardado conserva fingerprint en auditoria existente y preserva diff y fuentes', async () => {
  const s = await scenario();
  assert.equal((await s.save()).statusCode, 201);
  for (const row of s.drafts()) {
    assert.equal(row.auditoria.preview_fingerprint, s.fingerprint);
    assert.deepEqual(row.auditoria.fuentes, previewItem(row.categoria).auditoria.fuentes);
    assert.deepEqual(row.diferencias, previewItem(row.categoria).diferencias);
    assert.equal(row.estado, 'borrador');
  }
});

test('lote exitoso se confirma entero antes de responder usando un cliente dedicado', async () => {
  const s = await scenario();
  const res = await s.save();
  assert.equal(res.statusCode, 201);
  assert.equal(s.pool.connections, 1, 'Usar pool.connect, no INSERTs autocommit independientes');
  const writes = s.pool.events.filter((event) => /^INSERT/.test(event.sql || ''));
  assert.equal(writes.length, 2);
  assert.ok(writes.every((event) => event.scope === 'client'));
  assert.ok(s.pool.events.some((event) => event.sql === 'BEGIN ISOLATION LEVEL READ COMMITTED'));
  assert.ok(s.pool.events.some((event) => event.sql === 'COMMIT'));
  assert.equal(s.pool.events.at(-1).sql, 'RELEASE');
  assert.deepEqual(res.deliveries[0].committed, s.pool.rows, 'La respuesta refleja filas ya confirmadas');
});

test('historial previo publicado, reemplazado y borrador queda intacto tras error y reintentos', async () => {
  const s = await scenario({ failSecondInsert: true });
  for (const expectedStatus of [500, 201, 201]) {
    const res = await s.save();
    assert.ok(expectedStatus === 500 ? res.statusCode === 500 : [200, 201].includes(res.statusCode));
    assert.deepEqual(s.pool.rows.filter((row) => s.before.some((old) => old.id === row.id)), s.before);
  }
  assert.ok(s.pool.events.every((event) => !/\b(?:UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|publicar_base_informativa)\b/i.test(event.sql || '')));
});

test('reintentos concurrentes esperan el lock y devuelven los mismos IDs', async () => {
  const s = await scenario();
  const responses = await Promise.all([s.save(), s.save(), s.save()]);
  assert.ok(responses.every((res) => [200, 201].includes(res.statusCode) && res.payload.ok));
  assert.equal(s.drafts().length, 2);
  const ids = responses[0].payload.publicaciones.map((row) => row.id).sort();
  for (const res of responses) assert.deepEqual(res.payload.publicaciones.map((row) => row.id).sort(), ids);
  assert.ok(s.pool.events.some((event) => event.waitingForLock));
  assert.equal(s.pool.events.filter((event) => event.sql === 'RELEASE').length, 3);
});

for (const savedCategories of [['fijo'], ['fijo', 'fijo'], ['fijo', 'claro_tv', 'movil']]) {
  test(`juego previo inconsistente (${savedCategories.join(',')}) se rechaza sin reparar ni devolver exito parcial`, async () => {
    const s = await scenario();
    s.pool.seed(savedCategories.map((categoria, i) => ({
      ...previewItem(categoria), id: `66666666-6666-4666-8666-${String(i + 1).padStart(12, '0')}`,
      numero: 100 + i, estado: 'borrador', cargada_por: 'test-atomic-save', auditoria: { preview_fingerprint: s.fingerprint },
    })));
    const before = s.pool.rows;
    const res = await s.save();
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.payload, { ok: false, codigo: 'borradores_inconsistentes' });
    assert.deepEqual(s.pool.rows, before);
    assert.ok(s.pool.events.some((event) => event.sql === 'ROLLBACK'));
    assert.equal(s.pool.events.some((event) => /^INSERT/.test(event.sql || '')), false);
  });
}

test('idempotencia separa usuarios y conserva la huella opcional de clientes anteriores', async () => {
  const s = await scenario();
  const first = await s.save({ omitFingerprint: true });
  assert.equal(first.statusCode, 201);
  assert.equal(s.drafts()[0].auditoria.preview_fingerprint, s.fingerprint);
  const repeated = await s.save();
  assert.deepEqual(repeated.payload.publicaciones.map((row) => row.id), first.payload.publicaciones.map((row) => row.id));
  const other = await s.save({ user: 'otro-admin', omitFingerprint: true });
  assert.equal(other.statusCode, 201);
  assert.equal(s.drafts().length, 4);
  assert.ok(other.payload.publicaciones.every((row) => !first.payload.publicaciones.some((old) => old.id === row.id)));
});

test('error de COMMIT revierte todo y no responde ok true', async () => {
  const s = await scenario({ failCommit: true });
  const res = await s.save();
  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.ok, false);
  assert.equal(res.payload.publicaciones, undefined);
  assert.deepEqual(s.pool.rows, s.before);
  assert.ok(s.pool.events.some((event) => event.sql === 'ROLLBACK'));
  assert.equal(s.pool.events.at(-1).sql, 'RELEASE');
});

test('error durante ROLLBACK conserva respuesta de error y descarta el cliente', async () => {
  const s = await scenario({ failSecondInsert: true, failRollback: true });
  const res = await s.save();
  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.ok, false);
  assert.deepEqual(s.pool.rows, s.before);
  assert.equal(s.pool.events.at(-1).discarded, true);
});

test('sin connect o con fallo de conexion no usa INSERTs autocommit', async () => {
  for (const missing of [false, true]) {
    const s = await scenario({ failConnect: !missing });
    if (missing) delete s.pool.connect;
    const res = await s.save();
    assert.equal(res.statusCode, 500);
    assert.equal(res.payload.ok, false);
    assert.equal(s.pool.events.some((event) => /^INSERT/.test(event.sql || '')), false);
    assert.deepEqual(s.pool.rows, s.before);
  }
});
