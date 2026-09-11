import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('../backend/node_modules/dotenv');
const pg = require('../backend/node_modules/pg');

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'auditoria-publicaciones-plan-maestro.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'auditoria-publicaciones-plan-maestro.md');
const INVENTORY_JSON = path.join(ROOT, 'docs', 'constructor', 'inventario-fuentes-plan-maestro.json');

dotenv.config({ path: path.join(ROOT, 'backend', '.env') });

const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 3,
  idleTimeoutMillis: 5000,
  options: `-c search_path=${String(process.env.DB_SCHEMA || 'public').replace(/[^a-zA-Z0-9_]/g, '')},public`,
});

async function tableExists(tableName) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1
     ) AS exists`,
    [tableName]
  );
  return Boolean(rows[0]?.exists);
}

async function safeQuery(tableName, sql, params = []) {
  if (!await tableExists(tableName)) return { table: tableName, exists: false, rows: [] };
  const result = await pool.query(sql, params);
  return { table: tableName, exists: true, rows: result.rows };
}

function normalizeHash(value) {
  return String(value || '').toUpperCase();
}

function matchInventoryByHash(inventory, hash) {
  const normalized = normalizeHash(hash);
  return (inventory.fuentes || []).filter(item => normalizeHash(item.sha256) === normalized);
}

function sourceStatus(item, audit) {
  const hash = normalizeHash(item.sha256);
  const stored = audit.fuentes_comerciales.rows.filter(row => normalizeHash(row.sha256) === hash);
  const basePublications = audit.bases_informativas_publicaciones.rows.filter(row => normalizeHash(row.fuente_sha256) === hash);
  const mobilePublications = audit.ofertas_movil_versiones.rows.filter(row => normalizeHash(row.archivo_sha256) === hash || JSON.stringify(row.fuentes || []).toUpperCase().includes(hash));
  const composedSources = audit.motor_comercial_reglas_fuentes.rows.filter(row => normalizeHash(row.sha256) === hash);
  return {
    sha256: item.sha256,
    nombre: item.nombre,
    dominio_inferido: item.dominio_inferido,
    origen: item.origen,
    guardada_fuentes_comerciales: stored.length > 0,
    fuentes_comerciales: stored.map(row => ({
      id: row.id,
      familia: row.familia,
      estado: row.estado,
      vigencia_documental: row.vigencia_documental,
      vigencia_desde: row.vigencia_desde,
      vigencia_hasta: row.vigencia_hasta,
    })),
    publicada_base_informativa: basePublications.some(row => row.estado === 'publicada'),
    publicaciones_base: basePublications.map(row => ({
      numero: row.numero,
      categoria: row.categoria,
      estado: row.estado,
      fecha_actualizacion_base: row.fecha_actualizacion_base,
      modulos: Array.isArray(row.modulos_generados) ? row.modulos_generados.length : null,
    })),
    publicada_movil: mobilePublications.some(row => row.estado === 'vigente'),
    publicaciones_movil: mobilePublications.map(row => ({
      numero: row.numero,
      estado: row.estado,
      vigencia_desde: row.vigencia_desde,
      vigencia_hasta: row.vigencia_hasta,
      ofertas: Array.isArray(row.datos) ? row.datos.length : null,
      business_red_plus: Boolean(row.resumen?.business_red_plus),
    })),
    publicada_reglas_compuestas: composedSources.length > 0,
    reglas_compuestas_fuentes: composedSources.map(row => ({
      version_id: row.version_id,
      familia: row.familia,
      vigencia_documental: row.vigencia_documental,
      vigencia_desde: row.vigencia_desde,
      vigencia_hasta: row.vigencia_hasta,
    })),
  };
}

function summarize(audit) {
  const byDomain = {};
  const storedByDomain = {};
  const publishedByDomain = {};
  for (const item of audit.cruce_inventario_publicacion) {
    byDomain[item.dominio_inferido] = (byDomain[item.dominio_inferido] || 0) + 1;
    if (item.guardada_fuentes_comerciales) storedByDomain[item.dominio_inferido] = (storedByDomain[item.dominio_inferido] || 0) + 1;
    if (item.publicada_base_informativa || item.publicada_movil || item.publicada_reglas_compuestas) {
      publishedByDomain[item.dominio_inferido] = (publishedByDomain[item.dominio_inferido] || 0) + 1;
    }
  }
  return {
    por_dominio: byDomain,
    guardadas_por_dominio: storedByDomain,
    publicadas_por_dominio: publishedByDomain,
    fuentes_disponibles_no_guardadas: audit.cruce_inventario_publicacion.filter(item => !item.guardada_fuentes_comerciales).length,
    fuentes_guardadas_no_publicadas: audit.cruce_inventario_publicacion.filter(item => item.guardada_fuentes_comerciales && !item.publicada_base_informativa && !item.publicada_movil && !item.publicada_reglas_compuestas).length,
  };
}

function markdown(audit) {
  const lines = [
    '# Auditoria de publicaciones - Plan Maestro Constructor',
    '',
    `Generado: ${audit.generated_at}`,
    '',
    'Consulta de solo lectura contra la base local. No ejecuta migraciones, no publica y no cambia datos comerciales.',
    '',
    '## Estado De Tablas',
    '',
    '| Tabla | Existe | Filas auditadas |',
    '| --- | --- | ---: |',
    `| fuentes_comerciales | ${audit.fuentes_comerciales.exists ? 'si' : 'no'} | ${audit.fuentes_comerciales.rows.length} |`,
    `| bases_informativas_publicaciones | ${audit.bases_informativas_publicaciones.exists ? 'si' : 'no'} | ${audit.bases_informativas_publicaciones.rows.length} |`,
    `| ofertas_movil_versiones | ${audit.ofertas_movil_versiones.exists ? 'si' : 'no'} | ${audit.ofertas_movil_versiones.rows.length} |`,
    `| motor_comercial_reglas_versiones | ${audit.motor_comercial_reglas_versiones.exists ? 'si' : 'no'} | ${audit.motor_comercial_reglas_versiones.rows.length} |`,
    `| motor_comercial_reglas_compuestas | ${audit.motor_comercial_reglas_compuestas.exists ? 'si' : 'no'} | ${audit.motor_comercial_reglas_compuestas.rows.length} |`,
    '',
    '## Resumen',
    '',
    `- Fuentes disponibles no guardadas: ${audit.resumen.fuentes_disponibles_no_guardadas}`,
    `- Fuentes guardadas sin publicacion detectada: ${audit.resumen.fuentes_guardadas_no_publicadas}`,
    '',
    '## Cruce Por Fuente',
    '',
    '| Dominio | Fuente | Guardada | Publicada | SHA-256 |',
    '| --- | --- | --- | --- | --- |',
    ...audit.cruce_inventario_publicacion.map(item => {
      const published = item.publicada_base_informativa || item.publicada_movil || item.publicada_reglas_compuestas;
      return `| ${item.dominio_inferido} | ${item.nombre.replace(/\|/g, '/')} | ${item.guardada_fuentes_comerciales ? 'si' : 'no'} | ${published ? 'si' : 'no'} | ${item.sha256} |`;
    }),
    '',
    '## Riesgos',
    '',
    '- El cruce por hash no reemplaza la validacion del parser ni el preview/diff de cada dominio.',
    '- Las fuentes no guardadas deben entrar por el flujo de Fuentes Comerciales antes de considerarse publicables.',
    '- Las fuentes guardadas sin publicacion detectada requieren revisar si son borrador, fallidas o pendientes de aprobacion.',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  if (!existsSync(INVENTORY_JSON)) throw new Error('Primero ejecuta scripts/inventariar-fuentes-plan-maestro.mjs');
  const inventory = JSON.parse(await readFile(INVENTORY_JSON, 'utf8'));
  const audit = {
    generated_at: new Date().toISOString(),
    database: {
      host: process.env.PGHOST || null,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || null,
      schema: process.env.DB_SCHEMA || 'public',
    },
    fuentes_comerciales: await safeQuery(
      'fuentes_comerciales',
      `SELECT id, familia, titulo, nombre_original, sha256, vigencia_desde, vigencia_hasta,
              vigencia_documental, estado, creado_en
         FROM public.fuentes_comerciales
        ORDER BY creado_en DESC`
    ),
    bases_informativas_publicaciones: await safeQuery(
      'bases_informativas_publicaciones',
      `SELECT id, numero, categoria, estado, fuente_comercial_id, fuente_nombre, fuente_sha256,
              fecha_actualizacion_base, modulos_generados, publicada_en, cargada_en
         FROM public.bases_informativas_publicaciones
        ORDER BY numero DESC`
    ),
    ofertas_movil_versiones: await safeQuery(
      'ofertas_movil_versiones',
      `SELECT id, numero, estado, vigencia_desde, vigencia_hasta, archivo_nombre, archivo_sha256,
              fuentes, datos, resumen, creada_en, publicada_en
         FROM public.ofertas_movil_versiones
        ORDER BY numero DESC`
    ),
    motor_comercial_reglas_versiones: await safeQuery(
      'motor_comercial_reglas_versiones',
      `SELECT id, numero, dominio, estado_publicacion, normalizador_version,
              fuentes_manifest_sha256, reglas_manifest_sha256, resumen, creada_en, publicada_en
         FROM public.motor_comercial_reglas_versiones
        ORDER BY numero DESC`
    ),
    motor_comercial_reglas_fuentes: await safeQuery(
      'motor_comercial_reglas_fuentes',
      `SELECT id, version_id, fuente_comercial_id, familia, nombre_original, sha256,
              vigencia_desde, vigencia_hasta, vigencia_documental
         FROM public.motor_comercial_reglas_fuentes`
    ),
    motor_comercial_reglas_compuestas: await safeQuery(
      'motor_comercial_reglas_compuestas',
      `SELECT id, version_id, identidad_comercial, estado_confianza, estado_publicacion,
              autoaplica, fuente_sha256
         FROM public.motor_comercial_reglas_compuestas`
    ),
  };
  audit.cruce_inventario_publicacion = (inventory.fuentes || []).map(item => sourceStatus(item, audit));
  audit.hashes_publicados_no_inventariados = [
    ...audit.bases_informativas_publicaciones.rows.map(row => row.fuente_sha256),
    ...audit.ofertas_movil_versiones.rows.map(row => row.archivo_sha256),
    ...audit.motor_comercial_reglas_fuentes.rows.map(row => row.sha256),
  ].filter(Boolean)
    .map(normalizeHash)
    .filter((hash, index, values) => values.indexOf(hash) === index)
    .filter(hash => !matchInventoryByHash(inventory, hash).length);
  audit.resumen = summarize(audit);

  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, markdown(audit), 'utf8');
  console.log(JSON.stringify({ ok: true, json: OUTPUT_JSON, md: OUTPUT_MD, fuentes: audit.cruce_inventario_publicacion.length }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
