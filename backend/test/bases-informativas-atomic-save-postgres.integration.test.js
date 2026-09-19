import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {
  createGuardarBaseBorradoresHandler,
  createPreviewBaseHandler,
} from '../src/routes/fuentesComercialesRoutes.js';

const { Pool } = pg;

// Guarda de seguridad: la prueba hace DROP/CREATE sobre nombres de tabla reales.
// Debe rechazar cualquier destino que parezca produccion antes de tocar el schema.
export function assertIsolatedDatabase(currentDatabase, { appDatabase } = {}) {
  const name = String(currentDatabase || '').trim();
  if (!name) throw new Error('CC-04: no se pudo determinar la base de datos destino');
  const forbidden = new Set(['crm_pro', String(appDatabase || '').trim()].filter(Boolean));
  if (forbidden.has(name)) {
    throw new Error(`CC-04: destino "${name}" parece produccion; use una base aislada dedicada`);
  }
  return name;
}

const integrationConfig = process.env.CC04_PGHOST ? {
  host: process.env.CC04_PGHOST,
  port: Number(process.env.CC04_PGPORT || 5432),
  user: process.env.CC04_PGUSER || 'cc04_test',
  database: process.env.CC04_PGDATABASE || 'postgres',
} : null;
const integrationTest = integrationConfig ? test : test.skip;
const sourceId = '11111111-1111-4111-8111-111111111111';
const categories = ['fijo', 'claro_tv'];

let pool;
let uploadDir;
let originalPath;
let source;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function previewItem(categoria, currentSource) {
  const row = { categoria, codigo: `CC04-${categoria}`, descripcion: 'Dato sintetico de integracion' };
  return {
    categoria,
    pagina: categoria === 'fijo' ? 'fijos' : 'claro_tv',
    estado_sugerido: 'borrador',
    publicable: true,
    fuente_comercial_id: currentSource.id,
    fuente_nombre: currentSource.nombre_original,
    fuente_sha256: currentSource.sha256,
    fecha_actualizacion_base: '2026-09-19',
    registros_normalizados: [row],
    candidatos_publicos: [row],
    modulos_generados: [{ seccion_key: `${categoria}_cc04`, contenido: { filas: [row] } }],
    contenido_excluido: [],
    duplicados: [],
    validacion: { errores: [], advertencias: [] },
    auditoria: { original: { cc04: true }, fuentes: [{ id: currentSource.id, sha256: currentSource.sha256 }] },
    diferencias: { registros: { nuevos: [row.codigo], eliminados: [] } },
    resumen: { total_candidatos: 1 },
  };
}

function res() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

function handlerDependencies() {
  return {
    pool,
    uploadDir,
    runParser: async () => ({ cc04: true }),
    buildPreviews: ({ fuente }) => ({ previews: categories.map((categoria) => previewItem(categoria, fuente)) }),
    logger: { error() {} },
  };
}

function request(fingerprint) {
  return {
    params: { id: sourceId },
    user: { nick: 'cc04-integracion' },
    body: {
      fecha_actualizacion_base: '2026-09-19',
      ...(fingerprint ? { preview_fingerprint: fingerprint } : {}),
    },
  };
}

async function makePreview() {
  const response = res();
  await createPreviewBaseHandler(handlerDependencies())(request(), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  return response.payload.preview_fingerprint;
}

async function save(fingerprint) {
  const response = res();
  await createGuardarBaseBorradoresHandler(handlerDependencies())(request(fingerprint), response);
  return response;
}

async function publications() {
  const result = await pool.query(
    `SELECT id, numero, categoria, estado, fuente_comercial_id, cargada_por,
            auditoria->>'preview_fingerprint' AS preview_fingerprint
       FROM public.bases_informativas_publicaciones
      ORDER BY numero`
  );
  return result.rows;
}

async function resetScenario() {
  await pool.query('TRUNCATE public.bases_informativas_publicaciones, public.fuentes_comerciales RESTART IDENTITY');
  await pool.query('UPDATE public.cc04_control SET fail_second_insert=false WHERE singleton=true');
  const original = Buffer.from(`CC04 original ${randomUUID()}`);
  await writeFile(originalPath, original);
  source = {
    id: sourceId,
    familia: 'fijos',
    documento_tipo: 'pdf',
    nombre_original: 'cc04-original.pdf',
    nombre_archivado: 'cc04-original.pdf',
    ruta_relativa: 'cc04-original.pdf',
    sha256: hash(original),
  };
  await pool.query(
    `INSERT INTO public.fuentes_comerciales
      (id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
       bytes, vigencia_documental, estado, subido_por)
     VALUES ($1,$2,'CC-04 fuente aislada',$3,$4,$5,$6,$7,$8,'vigente','activa','cc04-test')`,
    [source.id, source.familia, source.documento_tipo, source.nombre_original, source.nombre_archivado,
      source.ruta_relativa, source.sha256, original.length]
  );
  for (const categoria of categories) {
    await pool.query(
      `INSERT INTO public.bases_informativas_publicaciones
        (categoria, estado, version_etiqueta, fuente_comercial_id, fuente_nombre, fuente_sha256,
         fecha_actualizacion_base, cargada_por, auditoria, validacion, diferencias)
       VALUES ($1,'publicada',$2,$3,$4,$5,'2026-09-01','publicacion-anterior','{}','{}','{}')`,
      [categoria, `${categoria}-anterior`, source.id, source.nombre_original, source.sha256]
    );
  }
}

test.before(async () => {
  if (!integrationConfig) return;
  pool = new Pool(integrationConfig);
  const { rows: [{ current_database: dbName }] } = await pool.query('SELECT current_database()');
  assertIsolatedDatabase(dbName, { appDatabase: process.env.PGDATABASE });
  uploadDir = await mkdtemp(path.join(tmpdir(), 'newcrm-cc04-'));
  originalPath = path.join(uploadDir, 'cc04-original.pdf');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query('DROP TABLE IF EXISTS public.bases_informativas_publicaciones CASCADE');
  await pool.query('DROP TABLE IF EXISTS public.fuentes_comerciales CASCADE');
  await pool.query('DROP TABLE IF EXISTS public.cc04_control CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS public.cc04_fail_second_insert()');
  await pool.query(`CREATE TABLE public.fuentes_comerciales (
    id UUID PRIMARY KEY, familia TEXT NOT NULL, titulo TEXT NOT NULL, documento_tipo TEXT NOT NULL,
    nombre_original TEXT NOT NULL, nombre_archivado TEXT NOT NULL, ruta_relativa TEXT NOT NULL,
    sha256 CHAR(64) NOT NULL, bytes BIGINT NOT NULL, vigencia_desde DATE, vigencia_hasta DATE,
    vigencia_documental TEXT NOT NULL, estado TEXT NOT NULL, subido_por TEXT NOT NULL
  )`);
  await pool.query(`CREATE TABLE public.bases_informativas_publicaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), numero BIGSERIAL UNIQUE NOT NULL,
    categoria TEXT NOT NULL, estado TEXT NOT NULL, version_etiqueta TEXT, fuente_comercial_id UUID NOT NULL,
    fuente_nombre TEXT NOT NULL, fuente_sha256 CHAR(64) NOT NULL, fecha_actualizacion_base DATE NOT NULL,
    extraccion_original JSONB NOT NULL DEFAULT '{}'::jsonb, registros_normalizados JSONB NOT NULL DEFAULT '[]'::jsonb,
    candidatos_publicos JSONB NOT NULL DEFAULT '[]'::jsonb, modulos_generados JSONB NOT NULL DEFAULT '[]'::jsonb,
    contenido_excluido JSONB NOT NULL DEFAULT '[]'::jsonb, auditoria JSONB NOT NULL DEFAULT '{}'::jsonb,
    duplicados JSONB NOT NULL DEFAULT '[]'::jsonb, validacion JSONB NOT NULL DEFAULT '{}'::jsonb,
    diferencias JSONB NOT NULL DEFAULT '{}'::jsonb, cargada_por TEXT NOT NULL,
    cargada_en TIMESTAMPTZ NOT NULL DEFAULT now(), validada_por TEXT, validada_en TIMESTAMPTZ,
    aprobada_por TEXT, aprobada_en TIMESTAMPTZ, publicada_por TEXT, publicada_en TIMESTAMPTZ,
    reemplazada_en TIMESTAMPTZ, observaciones TEXT
  )`);
  await pool.query('CREATE TABLE public.cc04_control (singleton BOOLEAN PRIMARY KEY DEFAULT true, fail_second_insert BOOLEAN NOT NULL DEFAULT false)');
  await pool.query('INSERT INTO public.cc04_control (singleton) VALUES (true)');
  await pool.query(`CREATE FUNCTION public.cc04_fail_second_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.categoria = 'claro_tv' AND (SELECT fail_second_insert FROM public.cc04_control WHERE singleton=true) THEN
        RAISE EXCEPTION 'CC04 fallo deliberado entre categorias' USING ERRCODE='P0001';
      END IF;
      RETURN NEW;
    END;
  $$`);
  await pool.query(`CREATE TRIGGER cc04_fail_second_insert
    BEFORE INSERT ON public.bases_informativas_publicaciones
    FOR EACH ROW EXECUTE FUNCTION public.cc04_fail_second_insert()`);
});

test.after(async () => {
  if (!integrationConfig) return;
  await pool.end();
  await rm(uploadDir, { recursive: true, force: true });
});

integrationTest('PostgreSQL aislado: guarda todas las categorias y conserva publicaciones anteriores', async () => {
  await resetScenario();
  const previous = await publications();
  const saved = await save(await makePreview());

  assert.equal(saved.statusCode, 201);
  assert.equal(saved.payload.publicaciones.length, 2);
  const rows = await publications();
  assert.deepEqual(rows.filter((row) => row.estado === 'publicada'), previous);
  assert.deepEqual(rows.filter((row) => row.estado === 'borrador').map((row) => row.categoria).sort(), [...categories].sort());
});

integrationTest('PostgreSQL aislado: fallo entre categorias revierte, y el reintento no duplica', async () => {
  await resetScenario();
  const fingerprint = await makePreview();
  const previous = await publications();
  await pool.query('UPDATE public.cc04_control SET fail_second_insert=true WHERE singleton=true');
  const failed = await save(fingerprint);

  assert.equal(failed.statusCode, 500);
  assert.deepEqual(await publications(), previous, 'ROLLBACK elimina la primera escritura del lote');

  await pool.query('UPDATE public.cc04_control SET fail_second_insert=false WHERE singleton=true');
  const retried = await save(fingerprint);
  assert.equal(retried.statusCode, 201);
  const repeated = await save(fingerprint);
  assert.equal(repeated.statusCode, 200);
  assert.deepEqual(repeated.payload.publicaciones.map((row) => row.id).sort(), retried.payload.publicaciones.map((row) => row.id).sort());
  assert.equal((await publications()).filter((row) => row.estado === 'borrador').length, 2);
});

integrationTest('PostgreSQL aislado: solicitudes concurrentes reutilizan las mismas dos versiones', async () => {
  await resetScenario();
  const fingerprint = await makePreview();
  const results = await Promise.all([save(fingerprint), save(fingerprint), save(fingerprint)]);

  assert.ok(results.every((result) => [200, 201].includes(result.statusCode) && result.payload.ok));
  const expectedIds = results[0].payload.publicaciones.map((row) => row.id).sort();
  for (const result of results) assert.deepEqual(result.payload.publicaciones.map((row) => row.id).sort(), expectedIds);
  assert.equal((await publications()).filter((row) => row.estado === 'borrador').length, 2);
});

integrationTest('PostgreSQL aislado: el original cambiado invalida el preview antes de escribir', async () => {
  await resetScenario();
  const fingerprint = await makePreview();
  const previous = await publications();
  await writeFile(originalPath, Buffer.from(`CC04 original alterado ${randomUUID()}`));
  const stale = await save(fingerprint);

  assert.equal(stale.statusCode, 409);
  assert.deepEqual(stale.payload, { ok: false, codigo: 'preview_desactualizado' });
  assert.deepEqual(await publications(), previous);
});

// Corre siempre (sin BD): la guarda impide que un destino de produccion sea
// destruido por el DROP/CREATE de la preparacion.
test('la guarda de aislamiento rechaza destinos de produccion y acepta una base dedicada', () => {
  assert.throws(() => assertIsolatedDatabase('crm_pro'), /parece produccion/);
  assert.throws(() => assertIsolatedDatabase('mi_app', { appDatabase: 'mi_app' }), /parece produccion/);
  assert.throws(() => assertIsolatedDatabase(''), /no se pudo determinar/);
  assert.equal(assertIsolatedDatabase('cc04_isolated', { appDatabase: 'crm_pro' }), 'cc04_isolated');
});
