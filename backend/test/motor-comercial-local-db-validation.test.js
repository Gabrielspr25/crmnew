import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import pg from 'pg';
import {
  persistCompositeRulesVersion,
  publishApprovedCompositeRulesVersion,
  readCurrentPublishedCompositeRules,
} from '../src/services/motorComercialReglasCompuestasPersistence.js';

const { Pool } = pg;

function loadBackendEnv() {
  const env = {};
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (_error) {}
  return env;
}

function adminConfig() {
  const env = { ...loadBackendEnv(), ...process.env };
  return {
    host: env.PGHOST || 'localhost',
    port: Number(env.PGPORT || 5432),
    user: env.PGUSER || 'postgres',
    password: env.PGPASSWORD || undefined,
    database: 'postgres',
  };
}

function localDbConfig() {
  const env = { ...loadBackendEnv(), ...process.env };
  return { ...adminConfig(), database: env.PGDATABASE || 'crm_pro' };
}

function fuente() {
  return {
    id: 'beneficios-local-db',
    familia: 'beneficios',
    nombre_original: '2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf',
    sha256: 'c'.repeat(64),
    ruta_relativa: 'documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf',
    vigencia_documental: 'vigente',
    pagina_inicio: 1,
    pagina_fin: 35,
  };
}

function sampleRule(tipo, product = 'movil', extra = {}) {
  return {
    beneficio_regla_id: `beneficio-${tipo}`,
    beneficio: { tipo, nombre: tipo, monto: extra.monto ?? null },
    producto: { familia: product },
    productos_afectados: [product],
    condiciones: {
      convergencia: 'requerida',
      eventos: extra.eventos || ['portabilidad'],
      plan_minimo: extra.plan_minimo || 60,
      compatibilidad: extra.compatibilidad || 'acumula',
      limite: extra.limite || null,
    },
    terminos_vinculados: [
      {
        llave_comercial: `termino-${tipo}`,
        codigo: `T-${tipo}`,
        nombre: `Termino oficial ${tipo}`,
        pagina: 3,
        estado_confianza: 'confirmado',
        condiciones: {},
      },
    ],
    estado_confianza: extra.estado_confianza || 'confirmado',
    vigencia_desde: '2026-07-23',
    vigencia_hasta: null,
    traza: {
      fuente: fuente(),
      beneficio: { pagina: 3, seccion: 'Beneficios Claro Full PYMES' },
    },
  };
}

async function relationExists(db, name) {
  const result = await db.query('SELECT to_regclass($1) AS relation', [name]);
  return Boolean(result.rows[0]?.relation);
}

async function countIfExists(db, relation) {
  if (!await relationExists(db, relation)) return null;
  const result = await db.query(`SELECT count(*)::int AS total FROM ${relation}`);
  return result.rows[0].total;
}

async function migrationState(db) {
  const tables = await db.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema='public'
       AND table_name LIKE 'motor_comercial_reglas_%'
     ORDER BY table_name`
  );
  return {
    tables: tables.rows.map((row) => row.table_name),
    existing: {
      clients: await countIfExists(db, 'public.clients'),
      planes_modulos: await countIfExists(db, 'public.planes_modulos'),
    },
  };
}

async function applyMigration(db) {
  const sql = await readFile(new URL('../../backend/migrations/2026-08-29-motor-comercial-reglas-compuestas.sql', import.meta.url), 'utf8');
  await db.query(sql);
}

function transactionDb(client) {
  let savepoint = 0;
  return {
    async query(sql, params) {
      return client.query(sql, params);
    },
    async connect() {
      const prefix = `sp_motor_${++savepoint}`;
      return {
        async query(sql, params) {
          const text = String(sql).trim().toUpperCase();
          if (text === 'BEGIN') return client.query(`SAVEPOINT ${prefix}`);
          if (text === 'COMMIT') return client.query(`RELEASE SAVEPOINT ${prefix}`);
          if (text === 'ROLLBACK') return client.query(`ROLLBACK TO SAVEPOINT ${prefix}`);
          return client.query(sql, params);
        },
        release() {},
      };
    },
  };
}

function rollbackFailingDb(db) {
  return {
    async connect() {
      const client = await db.connect();
      let shouldFail = false;
      return {
        async query(sql, params) {
          const text = String(sql);
          if (/UPDATE public\.motor_comercial_reglas_versiones[\s\S]*estado_publicacion='reemplazada'/.test(text)) {
            shouldFail = true;
          }
          if (shouldFail && /INSERT INTO public\.motor_comercial_reglas_historial/.test(text)) {
            throw new Error('fallo_publicacion_inyectado');
          }
          return client.query(sql, params);
        },
        release() {
          client.release();
        },
      };
    },
  };
}

async function loadConstructorEvaluator() {
  const loader = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');
  const context = {
    window: {},
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    localStorage: { getItem: () => 'token-local' },
  };
  context.window = context;
  vm.runInNewContext(loader, context);
  return context.window.ConstructorPublications;
}

test('valida migracion persistencia publicacion lectura y simulacion contra PostgreSQL local equivalente', async () => {
  const testDomain = 'local_db_validation';
  const pool = new Pool(localDbConfig());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txDb = transactionDb(client);
    const before = await migrationState(txDb);

    await applyMigration(txDb);
    const after = await migrationState(txDb);
    assert.deepEqual(after.existing, before.existing);
    assert.deepEqual(after.tables, [
      'motor_comercial_reglas_compuestas',
      'motor_comercial_reglas_fuentes',
      'motor_comercial_reglas_historial',
      'motor_comercial_reglas_terminos',
      'motor_comercial_reglas_versiones',
    ]);

  const primera = await persistCompositeRulesVersion({
    db: txDb,
    dominio: testDomain,
    estadoPublicacion: 'aprobada',
    normalizadorVersion: 'local-db-validation-v1',
    actor: 'codex-local',
    fuentes: [fuente()],
    reglasCompuestas: [
      sampleRule('bono_streaming', 'fijo', { compatibilidad: 'no_acumula', limite: { cantidad: 1, unidad: 'BAN' } }),
      sampleRule('bono_portabilidad', 'movil'),
    ],
  });
  assert.equal(primera.reglas.length, 2);

  const publicada = await publishApprovedCompositeRulesVersion({
    db: txDb,
    dominio: testDomain,
    versionId: primera.version.id,
    actor: 'codex-local',
  });
  assert.equal(publicada.version.estado_publicacion, 'vigente');
  assert.ok(publicada.reglas.every((rule) => rule.autoaplica === false));

  const noAprobada = await persistCompositeRulesVersion({
    db: txDb,
    dominio: testDomain,
    estadoPublicacion: 'validada',
    normalizadorVersion: 'local-db-validation-v1-no-aprobada',
    actor: 'codex-local',
    fuentes: [fuente()],
    reglasCompuestas: [sampleRule('doble_data', 'movil')],
  });
  await assert.rejects(
    publishApprovedCompositeRulesVersion({ db: txDb, dominio: testDomain, versionId: noAprobada.version.id, actor: 'codex-local' }),
    /version_no_aprobada/
  );

  await assert.rejects(
    persistCompositeRulesVersion({
      db: txDb,
      dominio: testDomain,
      estadoPublicacion: 'aprobada',
      normalizadorVersion: 'local-db-validation-v1-bloqueada',
      actor: 'codex-local',
      fuentes: [fuente()],
      reglasCompuestas: [sampleRule('descuento_affinity', 'fijo', { estado_confianza: 'requiere_revision' })],
    }),
    /reglas_no_confirmadas/
  );

  const segunda = await persistCompositeRulesVersion({
    db: txDb,
    dominio: testDomain,
    estadoPublicacion: 'aprobada',
    normalizadorVersion: 'local-db-validation-v2',
    actor: 'codex-local',
    fuentes: [fuente()],
    reglasCompuestas: [
      sampleRule('bono_streaming', 'fijo', { monto: 10, compatibilidad: 'no_acumula', limite: { cantidad: 1, unidad: 'BAN' } }),
      sampleRule('bono_portabilidad', 'movil'),
      sampleRule('pago_penalidad', 'fijo'),
    ],
  });

  await assert.rejects(
    publishApprovedCompositeRulesVersion({ db: rollbackFailingDb(txDb), dominio: testDomain, versionId: segunda.version.id, actor: 'codex-local' }),
    /fallo_publicacion_inyectado/
  );
  let state = await txDb.query(
    `SELECT id, estado_publicacion FROM public.motor_comercial_reglas_versiones WHERE id = ANY($1::uuid[]) ORDER BY id`,
    [[primera.version.id, segunda.version.id]]
  );
  assert.deepEqual(new Map(state.rows.map((row) => [row.id, row.estado_publicacion])), new Map([
    [primera.version.id, 'vigente'],
    [segunda.version.id, 'aprobada'],
  ]));

  const reemplazo = await publishApprovedCompositeRulesVersion({
    db: txDb,
    dominio: testDomain,
    versionId: segunda.version.id,
    actor: 'codex-local',
  });
  assert.equal(reemplazo.version.estado_publicacion, 'vigente');
  assert.equal(reemplazo.version_anterior.id, primera.version.id);

  const consumidor = await readCurrentPublishedCompositeRules({ db: txDb, dominio: testDomain });
  assert.equal(consumidor.version.id, segunda.version.id);
  assert.equal(consumidor.reglas.length, 3);
  assert.ok(consumidor.reglas.every((rule) => rule.estado_confianza === 'confirmado'));
  assert.ok(consumidor.reglas.every((rule) => rule.estado_publicacion === 'vigente'));
  assert.ok(consumidor.reglas.every((rule) => rule.autoaplica === false));
  assert.ok(consumidor.reglas.every((rule) => rule.terminos.length >= 1));
  assert.ok(consumidor.reglas.every((rule) => rule.contrato.fuente.nombre_original.includes('Boletin-Beneficios')));

  const history = await txDb.query('SELECT count(*)::int AS total FROM public.motor_comercial_reglas_historial');
  assert.ok(history.rows[0].total >= 7);

  const publications = await loadConstructorEvaluator();
  const simulation = publications.evaluateCommercialRulesSimulation({
    version: consumidor.version,
    rules: consumidor.reglas,
    context: {
      cliente: { convergente: true, ban: 'BAN-001' },
      lineas: [{ linea: 1, evento: 'portabilidad', producto: 'movil', plan_monto: 65 }],
      productos: ['movil', 'fijo'],
    },
  });
  assert.equal(simulation.recibidas, consumidor.reglas.length);
  assert.equal(simulation.recomendacion.modo, 'simulacion');
  assert.ok(simulation.elegibles.length >= 1);
  assert.ok(simulation.elegibles.every((rule) => rule.autoaplica === false));
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
});
