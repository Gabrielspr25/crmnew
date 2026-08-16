import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { archiveFuenteComercialBuffer, deriveFuenteTitulo } from '../services/fuentesComercialesArchive.js';
import { PLANES_FIJOS_COLUMNAS } from '../services/planesOfertasContract.js';
import { diffFilasPlanesFijos } from '../services/planesOfertasDiff.js';
import { buildBasesInformativasPreviews } from '../services/basesInformativasPreview.js';
import { runParser } from '../services/secureParserRunner.js';
import { importarListaEquiposDesdeFuente } from './equiposRoutes.js';

export const fuentesComercialesRouter = Router();
fuentesComercialesRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/fuentes-comerciales');
const UPLOAD_DIR = process.env.FUENTES_COMERCIALES_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
const FAMILIAS = new Set(['equipos', 'fijos', 'moviles', 'inalambrico_iot', 'servicios', 'cloud_sva', 'claro_tv', 'ofertas_moviles', 'ofertas_fijo', 'beneficios']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.xlsx', '.xls'].includes(ext)) return cb(null, true);
    return cb(Object.assign(new Error('tipo_archivo_invalido'), { code: 'tipo_archivo_invalido' }));
  },
});

const uname = (req) => req.user?.nick || req.user?.usuario || req.user?.email || 'admin';
const previews = new Map();
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function gcPreviews() { const now = Date.now(); for (const [id, value] of previews) if (now - value.created > PREVIEW_TTL_MS) previews.delete(id); }

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function resolveFuentePath(row, options = {}) {
  const configuredRoot = options.uploadDir || process.env.FUENTES_COMERCIALES_UPLOAD_DIR || path.resolve(__dirname, '../../uploads/fuentes-comerciales');
  let allowedRoot;
  try {
    allowedRoot = fs.realpathSync(configuredRoot);
  } catch {
    throw Object.assign(new Error('archivo_no_encontrado'), { code: 'archivo_no_encontrado' });
  }

  const relativePath = String(row.ruta_relativa || '').trim();
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw Object.assign(new Error('archivo_fuera_directorio'), { code: 'archivo_fuera_directorio' });
  }

  const resolved = path.resolve(allowedRoot, relativePath);
  let filePath;
  try {
    filePath = fs.realpathSync(resolved);
  } catch {
    if (isPathInside(allowedRoot, resolved)) throw Object.assign(new Error('archivo_no_encontrado'), { code: 'archivo_no_encontrado' });
    throw Object.assign(new Error('archivo_fuera_directorio'), { code: 'archivo_fuera_directorio' });
  }

  if (!isPathInside(allowedRoot, filePath)) {
    throw Object.assign(new Error('archivo_fuera_directorio'), { code: 'archivo_fuera_directorio' });
  }
  if (!fs.statSync(filePath).isFile()) {
    throw Object.assign(new Error('archivo_no_encontrado'), { code: 'archivo_no_encontrado' });
  }
  return filePath;
}
function sourcePath(row) {
  return resolveFuentePath(row);
}
function sourceSummary(row) {
  return { id: row.id, familia: row.familia, nombre_original: row.nombre_original, sha256: row.sha256, ruta_relativa: row.ruta_relativa };
}

function publicFuente(row) {
  return {
    id: row.id,
    familia: row.familia,
    titulo: row.titulo,
    documento_tipo: row.documento_tipo,
    nombre_original: row.nombre_original,
    nombre_archivado: row.nombre_archivado,
    ruta_relativa: row.ruta_relativa,
    sha256: row.sha256,
    mime_type: row.mime_type,
    bytes: Number(row.bytes || 0),
    vigencia_desde: row.vigencia_desde,
    vigencia_hasta: row.vigencia_hasta,
    vigencia_documental: row.vigencia_documental,
    notas: row.notas,
    estado: row.estado,
    subido_por: row.subido_por,
    creado_en: row.creado_en,
  };
}

function publicFuentePreview(row) {
  return {
    id: row.id,
    familia: row.familia,
    titulo: row.titulo,
    documento_tipo: row.documento_tipo,
    nombre_original: row.nombre_original,
    sha256: row.sha256,
    vigencia_desde: row.vigencia_desde,
    vigencia_hasta: row.vigencia_hasta,
    vigencia_documental: row.vigencia_documental,
  };
}

function sanitizeBasePublicacion(row) {
  if (!row) return null;
  return {
    id: row.id,
    numero: row.numero,
    categoria: row.categoria,
    estado: row.estado,
    version_etiqueta: row.version_etiqueta,
    fuente_comercial_id: row.fuente_comercial_id,
    fuente_nombre: row.fuente_nombre,
    fuente_sha256: row.fuente_sha256,
    fecha_actualizacion_base: row.fecha_actualizacion_base,
    candidatos_total: Array.isArray(row.candidatos_publicos) ? row.candidatos_publicos.length : Number(row.candidatos_total || 0),
    modulos_total: Array.isArray(row.modulos_generados) ? row.modulos_generados.length : Number(row.modulos_total || 0),
    validacion: row.validacion || {},
    diferencias: row.diferencias || {},
    observaciones: row.observaciones || null,
    cargada_por: row.cargada_por,
    cargada_en: row.cargada_en,
    validada_por: row.validada_por,
    validada_en: row.validada_en,
    aprobada_por: row.aprobada_por,
    aprobada_en: row.aprobada_en,
    publicada_por: row.publicada_por,
    publicada_en: row.publicada_en,
    reemplazada_en: row.reemplazada_en,
  };
}

function jsonbParam(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function isRealIsoDate(value) {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function fechaActualizacionBase({ body }) {
  const manual = body?.fecha_actualizacion_base;
  if (manual == null || String(manual).trim() === '') {
    throw Object.assign(new Error('fecha_actualizacion_base_requerida'), { code: 'fecha_actualizacion_base_requerida' });
  }
  const value = String(manual).trim();
  if (!isRealIsoDate(value)) {
    throw Object.assign(new Error('fecha_actualizacion_base_invalida'), { code: 'fecha_actualizacion_base_invalida' });
  }
  return { value, origen: 'entrada_manual_confirmada' };
}

function inalambricoVigenciaDesdeNombre(nombre) {
  const normalized = String(nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/1al31ago2026/.test(normalized)) return { desde: '2026-08-01T04:00:00.000Z', hasta: '2026-08-31T04:00:00.000Z' };
  return null;
}

async function applyInalambricoFuenteAutomatica({ fuente, parsed, usuario }) {
  const expected = ['internet_on_the_go', 'claro_oficina', 'iot_telemetria'];
  if (JSON.stringify(parsed?.secciones_detectadas) !== JSON.stringify(expected)) {
    throw Object.assign(new Error('El boletín no contiene Internet On The Go, Claro Oficina e IoT completos. No se reemplazó nada.'), { code: 'secciones_incompletas' });
  }
  const vigencia = inalambricoVigenciaDesdeNombre(fuente.nombre_original);
  if (!vigencia) throw Object.assign(new Error('No se pudo validar la vigencia del boletín inalámbrico. No se reemplazó nada.'), { code: 'vigencia_no_detectada' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: modulos } = await client.query(
      `UPDATE public.planes_modulos
       SET contenido=contenido, vigencia_desde=$1, vigencia_hasta=$2, boletin_ref=$3, updated_by=$4
       WHERE pagina='inalambrico' AND activo=true
       RETURNING id, seccion_key`,
      [vigencia.desde, vigencia.hasta, fuente.nombre_original, usuario]
    );
    if (modulos.length !== 4) throw new Error('La publicación inalámbrica no tiene los cuatro módulos esperados. No se reemplazó nada.');
    await client.query(
      `UPDATE public.fuentes_comerciales
       SET vigencia_desde=$1, vigencia_hasta=$2, vigencia_documental='vigente', estado='activa'
       WHERE id=$3`,
      [vigencia.desde, vigencia.hasta, fuente.id]
    );
    await client.query('COMMIT');
    return { vigencia, modulos: modulos.map(row => row.seccion_key) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

fuentesComercialesRouter.post('/planes-fijos/preview', requireAdmin, async (req, res) => {
  gcPreviews();
  const ids = Array.isArray(req.body?.fuente_ids) ? [...new Set(req.body.fuente_ids.map(String))] : [];
  if (!ids.length) return res.status(400).json({ ok: false, codigo: 'fuentes_requeridas', error: 'Seleccioná los boletines que se usarán.' });
  try {
    const { rows } = await pool.query(
      `SELECT id, familia, titulo, nombre_original, nombre_archivado, ruta_relativa, sha256, documento_tipo,
              vigencia_desde, vigencia_hasta, vigencia_documental
       FROM public.fuentes_comerciales WHERE id = ANY($1::uuid[]) ORDER BY creado_en DESC`, [ids]
    );
    if (rows.length !== ids.length) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    if (rows.some(row => !['ofertas_fijo', 'beneficios'].includes(row.familia))) {
      return res.status(422).json({ ok: false, codigo: 'familia_no_aplicable', error: 'Para esta vista usá fuentes Ofertas fijo o Beneficios.' });
    }
    const warnings = [];
    const combined = {};
    const sourceResults = [];
    for (const row of rows) {
      const filePath = sourcePath(row);
      if (!fs.existsSync(filePath)) { warnings.push(`${row.nombre_original}: archivo archivado no encontrado.`); continue; }
      let parsed = null;
      if (row.documento_tipo === 'pdf') {
        try { parsed = await runParser('parse_planes_fijos_pdf.py', filePath); } catch (error) { warnings.push(`${row.nombre_original}: ${error.message}`); }
      } else warnings.push(`${row.nombre_original}: el parser de planes fijos aún no procesa Excel.`);
      const filas = [];
      for (const [key, mod] of Object.entries(parsed?.modulos || {})) {
        if (!Array.isArray(mod.filas) || !mod.filas.length) continue;
        combined[key] ||= { titulo: mod.titulo, filas: [] };
        combined[key].filas.push(...mod.filas);
        filas.push({ seccion: key, cantidad: mod.filas.length });
      }
      if (!filas.length) warnings.push(`${row.nombre_original}: no se encontraron filas estructuradas para publicar; queda como fuente complementaria.`);
      sourceResults.push({ ...sourceSummary(row), filas });
    }
    const { rows: modulos } = await pool.query(`SELECT id, seccion_key, titulo, contenido FROM public.planes_modulos WHERE pagina='fijos' AND activo=true ORDER BY orden, id`);
    const resumen = [], planAplicacion = [];
    for (const [key, mod] of Object.entries(combined)) {
      const db = modulos.find(item => item.seccion_key === key);
      if (!db) { warnings.push(`${mod.titulo}: no existe módulo activo en Planes Fijos.`); continue; }
      const actuales = db.contenido?.filas || [];
      const diff = diffFilasPlanesFijos(actuales, mod.filas);
      resumen.push({ seccion: mod.titulo, modulo_id: db.id, filas_doc: mod.filas.length, filas_publicadas: actuales.length, nuevos: diff.nuevos.length, ausentes: diff.ausentes.length, modificados: diff.modificados.length, sin_cambio: diff.sin_cambio });
      planAplicacion.push({ modulo_id: db.id, seccion_key: db.seccion_key, filas: mod.filas, contenido: { columnas: PLANES_FIJOS_COLUMNAS, filas: mod.filas } });
    }
    const previewId = crypto.randomUUID();
    previews.set(previewId, { created: Date.now(), rows, sourceResults, resumen, planAplicacion, warnings, usuario: uname(req) });
    res.json({ ok: true, preview_id: previewId, expira_en_min: 30, fuentes: sourceResults, resumen, advertencias: warnings, publicable: planAplicacion.length > 0 });
  } catch (error) { res.status(500).json({ ok: false, codigo: 'preview_error', error: error.message }); }
});

const PARSER_ERROR_CODES = new Set([
  'parser_timeout',
  'parser_output_too_large',
  'parser_process_error',
  'parser_exit_error',
  'parser_json_invalido',
]);

export function createPreviewBaseHandler(options = {}) {
  const dbPool = options.pool || pool;
  const parserRunner = options.runParser || runParser;
  const previewBuilder = options.buildPreviews || buildBasesInformativasPreviews;
  const uploadDir = options.uploadDir;
  const logger = options.logger || console;

  return async function previewBaseHandler(req, res) {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });

  try {
    let fechaBase;
    try {
      fechaBase = fechaActualizacionBase({ body: req.body });
    } catch (error) {
      return res.status(400).json({ ok: false, codigo: error.code || 'fecha_actualizacion_base_invalida' });
    }

    const { rows } = await dbPool.query(
      `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
              vigencia_desde, vigencia_hasta, vigencia_documental, estado
       FROM public.fuentes_comerciales WHERE id=$1 LIMIT 1`,
      [id]
    );
    const fuente = rows[0];
    if (!fuente) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    if (!['fijos', 'claro_tv', 'ofertas_fijo'].includes(fuente.familia) || fuente.documento_tipo !== 'pdf') {
      return res.status(422).json({ ok: false, codigo: 'archivo_incompatible' });
    }

    let filePath;
    try {
      filePath = resolveFuentePath(fuente, { uploadDir });
    } catch (error) {
      if (error.code === 'archivo_fuera_directorio') return res.status(404).json({ ok: false, codigo: 'archivo_fuera_directorio' });
      if (error.code === 'archivo_no_encontrado') return res.status(404).json({ ok: false, codigo: 'archivo_no_encontrado' });
      throw error;
    }

    let parsed;
    try {
      parsed = await parserRunner('parse_planes_fijos_pdf.py', filePath);
    } catch (error) {
      const codigo = PARSER_ERROR_CODES.has(error.code) ? error.code : 'parser_error';
      logger.error?.('[fuentes-comerciales/preview-base/parser]', codigo);
      return res.status(422).json({ ok: false, codigo });
    }

    const preview = previewBuilder({
      parsed,
      fuente: {
        id: fuente.id,
        nombre_original: fuente.nombre_original,
        sha256: fuente.sha256,
        fecha_actualizacion_base: fechaBase.value,
      },
    });
    const previews = Object.fromEntries(preview.previews.map((item) => [item.categoria, {
      categoria: item.categoria,
      pagina: item.pagina,
      estado_sugerido: item.estado_sugerido,
      publicable: item.publicable,
      fuente_comercial_id: item.fuente_comercial_id,
      fuente_nombre: item.fuente_nombre,
      fuente_sha256: item.fuente_sha256,
      fecha_actualizacion_base: item.fecha_actualizacion_base,
      registros_normalizados: item.registros_normalizados,
      candidatos_publicos: item.candidatos_publicos,
      modulos_generados: item.modulos_generados,
      contenido_excluido: item.contenido_excluido,
      auditoria: item.auditoria,
      duplicados: item.duplicados,
      validacion: item.validacion,
      diferencias: item.diferencias,
      resumen: item.resumen,
    }]));

    res.status(200).json({
      ok: true,
      fuente: publicFuentePreview(fuente),
      hash: fuente.sha256,
      fecha_actualizacion_base: fechaBase.value,
      fecha_actualizacion_base_origen: fechaBase.origen,
      previews,
      resumen: {
        fijo: previews.fijo?.candidatos_publicos?.length || 0,
        claro_tv: previews.claro_tv?.candidatos_publicos?.length || 0,
      },
    });
  } catch {
    res.status(500).json({ ok: false, codigo: 'error_interno' });
  }
  };
}

fuentesComercialesRouter.post('/:id/preview-base', requireAdmin, createPreviewBaseHandler());

export function createGuardarBaseBorradoresHandler(options = {}) {
  const dbPool = options.pool || pool;
  const parserRunner = options.runParser || runParser;
  const previewBuilder = options.buildPreviews || buildBasesInformativasPreviews;
  const uploadDir = options.uploadDir;
  const logger = options.logger || console;

  const previewHandler = createPreviewBaseHandler({
    pool: dbPool,
    runParser: parserRunner,
    buildPreviews: previewBuilder,
    uploadDir,
    logger,
  });

  return async function guardarBaseBorradoresHandler(req, res) {
    let previewPayload = null;
    const previewRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { previewPayload = payload; return payload; },
    };
    await previewHandler(req, previewRes);
    if (previewRes.statusCode !== 200 || !previewPayload?.ok) {
      return res.status(previewRes.statusCode).json(previewPayload || { ok: false, codigo: 'preview_error' });
    }

    const usuario = uname(req);
    const previewsToSave = ['fijo', 'claro_tv'].map((categoria) => previewPayload.previews?.[categoria]).filter(Boolean);
    if (previewsToSave.length !== 2) return res.status(422).json({ ok: false, codigo: 'preview_incompleto' });

    try {
      const guardadas = [];
      for (const item of previewsToSave) {
        const { rows } = await dbPool.query(
          `INSERT INTO public.bases_informativas_publicaciones
            (categoria, estado, version_etiqueta, fuente_comercial_id, fuente_nombre, fuente_sha256,
             fecha_actualizacion_base, extraccion_original, registros_normalizados, candidatos_publicos,
             modulos_generados, contenido_excluido, auditoria, duplicados, validacion, diferencias,
             cargada_por, observaciones)
           VALUES ($1,'borrador',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING *`,
          [
            item.categoria,
            `${item.categoria}-${previewPayload.fecha_actualizacion_base}`,
            item.fuente_comercial_id,
            item.fuente_nombre,
            item.fuente_sha256,
            previewPayload.fecha_actualizacion_base,
            jsonbParam(item.auditoria?.original, {}),
            jsonbParam(item.registros_normalizados, []),
            jsonbParam(item.candidatos_publicos, []),
            jsonbParam(item.modulos_generados, []),
            jsonbParam(item.contenido_excluido, []),
            jsonbParam(item.auditoria, {}),
            jsonbParam(item.duplicados, []),
            jsonbParam(item.validacion, {}),
            jsonbParam(item.diferencias, {}),
            usuario,
            req.body?.observaciones || null,
          ]
        );
        guardadas.push(sanitizeBasePublicacion(rows[0]));
      }
      return res.status(201).json({ ok: true, publicaciones: guardadas });
    } catch (error) {
      logger.error?.('[fuentes-comerciales/bases-informativas/borradores]', error.code || 'error');
      return res.status(500).json({ ok: false, codigo: 'error_interno' });
    }
  };
}

fuentesComercialesRouter.post('/:id/preview-base/borradores', requireAdmin, createGuardarBaseBorradoresHandler());

export function createHistorialBasesInformativasHandler(options = {}) {
  const dbPool = options.pool || pool;
  return async function historialBasesInformativasHandler(req, res) {
    const categoria = req.query.categoria ? String(req.query.categoria) : null;
    if (categoria && !['fijo', 'claro_tv', 'movil', 'servicios', 'inalambrico', 'cloud'].includes(categoria)) {
      return res.status(400).json({ ok: false, codigo: 'categoria_invalida' });
    }
    try {
      const params = [];
      let sql = `SELECT id, numero, categoria, estado, version_etiqueta, fuente_comercial_id, fuente_nombre,
          fuente_sha256, fecha_actualizacion_base, validacion, diferencias, observaciones,
          cargada_por, cargada_en, validada_por, validada_en, aprobada_por, aprobada_en,
          publicada_por, publicada_en, reemplazada_en,
          jsonb_array_length(candidatos_publicos) AS candidatos_total,
          jsonb_array_length(modulos_generados) AS modulos_total
        FROM public.bases_informativas_publicaciones`;
      if (categoria) {
        params.push(categoria);
        sql += ` WHERE categoria=$${params.length}`;
      }
      sql += ' ORDER BY categoria, numero DESC LIMIT 100';
      const { rows } = await dbPool.query(sql, params);
      res.json({ ok: true, publicaciones: rows.map(sanitizeBasePublicacion) });
    } catch {
      res.status(500).json({ ok: false, codigo: 'error_interno' });
    }
  };
}

fuentesComercialesRouter.get('/bases-informativas/historial', requireAdmin, createHistorialBasesInformativasHandler());

async function cambiarEstadoBaseInformativa({ req, res, estadoOrigen, estadoDestino, campos, dbPool = pool }) {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const sets = [`estado=$1`, ...campos.map((campo, index) => `${campo}=$${index + 2}`)];
    const values = [estadoDestino, ...campos.map((campo) => (campo.endsWith('_por') ? uname(req) : new Date()))];
    const idIndex = values.length + 1;
    const estadoIndex = values.length + 2;
    const extraWhere = estadoDestino === 'validada'
      ? ` AND COALESCE(jsonb_array_length(validacion->'errores'), 0) = 0
          AND jsonb_array_length(candidatos_publicos) > 0
          AND jsonb_array_length(modulos_generados) > 0`
      : '';
    const { rows } = await dbPool.query(
      `UPDATE public.bases_informativas_publicaciones
         SET ${sets.join(', ')}
       WHERE id=$${idIndex} AND estado=$${estadoIndex}
       ${extraWhere}
       RETURNING *`,
      [...values, id, estadoOrigen]
    );
    if (!rows.length) return res.status(409).json({ ok: false, codigo: 'transicion_invalida' });
    res.json({ ok: true, publicacion: sanitizeBasePublicacion(rows[0]) });
  } catch (error) {
    if (error.message && /congelada/i.test(error.message)) return res.status(409).json({ ok: false, codigo: 'publicacion_congelada' });
    res.status(500).json({ ok: false, codigo: 'error_interno' });
  }
}

export function createCambiarEstadoBaseInformativaHandler({ estadoOrigen, estadoDestino, campos, pool: dbPool = pool }) {
  return async function cambiarEstadoBaseInformativaHandler(req, res) {
    await cambiarEstadoBaseInformativa({ req, res, estadoOrigen, estadoDestino, campos, dbPool });
  };
}

fuentesComercialesRouter.post('/bases-informativas/:id/validar', requireAdmin, createCambiarEstadoBaseInformativaHandler({
  estadoOrigen: 'borrador',
  estadoDestino: 'validada',
  campos: ['validada_por', 'validada_en'],
}));

fuentesComercialesRouter.post('/bases-informativas/:id/aprobar', requireAdmin, createCambiarEstadoBaseInformativaHandler({
  estadoOrigen: 'validada',
  estadoDestino: 'aprobada',
  campos: ['aprobada_por', 'aprobada_en'],
}));

export function createPublicarBaseInformativaHandler(options = {}) {
  const dbPool = options.pool || pool;
  return async function publicarBaseInformativaHandler(req, res) {
    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
    try {
      const { rows } = await dbPool.query('SELECT * FROM public.publicar_base_informativa($1,$2)', [id, uname(req)]);
      res.json({ ok: true, publicacion: sanitizeBasePublicacion(rows[0]) });
    } catch (error) {
      if (/aprobada|estado actual/i.test(error.message || '')) return res.status(409).json({ ok: false, codigo: 'transicion_invalida' });
      res.status(500).json({ ok: false, codigo: 'publicacion_error' });
    }
  };
}

fuentesComercialesRouter.post('/bases-informativas/:id/publicar', requireAdmin, createPublicarBaseInformativaHandler());

fuentesComercialesRouter.post('/planes-fijos/publicar', requireAdmin, async (req, res) => {
  gcPreviews();
  const preview = previews.get(String(req.body?.preview_id || ''));
  if (!preview) return res.status(404).json({ ok: false, codigo: 'preview_expirado', error: 'La vista previa expiró. Volvé a generarla.' });
  if (!preview.planAplicacion.length) return res.status(422).json({ ok: false, codigo: 'sin_cambios_publicables', error: 'No hay filas estructuradas para publicar.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: antes } = await client.query(`SELECT id, pagina, seccion_key, titulo, contenido FROM public.planes_modulos WHERE id = ANY($1)`, [preview.planAplicacion.map(item => item.modulo_id)]);
    const snapshot = path.join(process.env.PLANES_UPLOAD_DIR || path.resolve(__dirname, '../../uploads/pdf-planes'), 'snapshots', `snapshot-fijos-fuentes-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    fs.writeFileSync(snapshot, JSON.stringify({ fecha: new Date().toISOString(), usuario: preview.usuario, fuentes: preview.sourceResults, modulos_antes: antes }, null, 2));
    for (const item of preview.planAplicacion) await client.query(`UPDATE public.planes_modulos SET contenido=$1, boletin_ref=$2, updated_by=$3 WHERE id=$4`, [item.contenido, preview.sourceResults.map(source => source.nombre_original).join(' + '), preview.usuario, item.modulo_id]);
    const principal = preview.sourceResults.find(source => source.familia === 'ofertas_fijo') || preview.sourceResults[0];
    const { rows: publicaciones } = await client.query(
      `INSERT INTO public.planes_fijos_publicaciones (nombre_original, sha256, documento_archivado, titulo_documento, resumen, modulos_aplicados, snapshot_path, publicado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [preview.sourceResults.map(source => source.nombre_original).join(' + '), principal.sha256, JSON.stringify(preview.sourceResults.map(source => source.ruta_relativa)), 'Fuentes comerciales de planes fijos', JSON.stringify({ fuentes: preview.sourceResults, resumen: preview.resumen, advertencias: preview.warnings }), JSON.stringify(preview.planAplicacion.map(item => ({ modulo_id: item.modulo_id, seccion_key: item.seccion_key, filas: item.filas.length }))), snapshot, preview.usuario]
    );
    await client.query('COMMIT');
    previews.delete(String(req.body.preview_id));
    res.json({ ok: true, publicacion: publicaciones[0], aplicado: preview.planAplicacion.map(item => ({ modulo_id: item.modulo_id, seccion_key: item.seccion_key, filas: item.filas.length })) });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ ok: false, codigo: 'publicacion_error', error: error.message }); }
  finally { client.release(); }
});

fuentesComercialesRouter.get('/', async (req, res) => {
  const familia = req.query.familia ? String(req.query.familia) : null;
  if (familia && !FAMILIAS.has(familia)) return res.status(400).json({ ok: false, codigo: 'familia_invalida' });

  try {
    const params = [];
    let sql = `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
        mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
      FROM public.fuentes_comerciales`;
    if (familia) {
      params.push(familia);
      sql += ` WHERE familia = $${params.length}`;
    }
    sql += ' ORDER BY creado_en DESC LIMIT 100';
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, fuentes: rows.map(publicFuente) });
  } catch (e) {
    res.status(500).json({ ok: false, codigo: 'error_interno', error: e.message });
  }
});

fuentesComercialesRouter.post('/', requireAdmin, upload.single('documento'), async (req, res) => {
  const familia = String(req.body.familia || '').trim();

  if (!FAMILIAS.has(familia)) return res.status(400).json({ ok: false, codigo: 'familia_invalida' });
  if (!req.file?.buffer?.length) return res.status(400).json({ ok: false, codigo: 'archivo_requerido' });
  if (familia === 'equipos' && !/\.(xlsx|xls)$/i.test(req.file.originalname)) return res.status(422).json({ ok: false, codigo: 'formato_equipos_invalido', error: 'Lista de Equipos requiere un Excel oficial (.xlsx o .xls).' });

  try {
    const titulo = deriveFuenteTitulo({ originalName: req.file.originalname, familia });
    const archived = await archiveFuenteComercialBuffer({
      rootDir: UPLOAD_DIR,
      familia,
      originalName: req.file.originalname,
      buffer: req.file.buffer,
    });

    const { rows } = await pool.query(
      `INSERT INTO public.fuentes_comerciales
        (familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256, mime_type,
         bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
        mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en`,
      [
        familia,
        titulo,
        archived.documento_tipo,
        req.file.originalname,
        archived.nombre_archivado,
        archived.ruta_relativa,
        archived.sha256,
        req.file.mimetype || null,
        archived.bytes,
        null,
        null,
        'pendiente_confirmacion',
        null,
        uname(req),
      ]
    );
    let publicacion = null;
    if (familia === 'equipos') {
      publicacion = await importarListaEquiposDesdeFuente({
        buffer: req.file.buffer,
        nombreArchivo: req.file.originalname,
        usuario: uname(req),
        notas: `Fuente comercial: ${rows[0].id}`,
        fuenteComercialId: rows[0].id,
      });
      await pool.query(`UPDATE public.fuentes_comerciales SET estado='activa', notas=NULL WHERE id=$1`, [rows[0].id]);
    }
    if (familia === 'inalambrico_iot' && archived.documento_tipo === 'pdf') {
      try {
        const parsed = await runParser('parse_equipos_pdf.py', sourcePath(rows[0]));
        publicacion = await applyInalambricoFuenteAutomatica({ fuente: rows[0], parsed, usuario: uname(req) });
      } catch (error) {
        await pool.query(`UPDATE public.fuentes_comerciales SET notas=$1 WHERE id=$2`, [error.message, rows[0].id]);
        return res.status(422).json({ ok: false, codigo: error.code || 'validacion_inalambrico_fallida', error: error.message, fuente: publicFuente(rows[0]) });
      }
    }
    res.status(201).json({ ok: true, fuente: publicFuente(rows[0]), publicacion });
  } catch (e) {
    if (e.code === '23505') {
      const { rows } = await pool.query(
        `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
          mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
         FROM public.fuentes_comerciales WHERE familia=$1 AND sha256=$2 LIMIT 1`,
        [familia, e.detail?.match(/\(([a-f0-9]{64})\)/i)?.[1] || '']
      ).catch(() => ({ rows: [] }));
      return res.status(409).json({ ok: false, codigo: 'fuente_duplicada', fuente: rows[0] ? publicFuente(rows[0]) : null });
    }
    if (e.code === 'tipo_archivo_invalido' || e.code === 'archivo_requerido') {
      return res.status(400).json({ ok: false, codigo: e.code });
    }
    res.status(500).json({ ok: false, codigo: 'error_interno', error: e.message });
  }
});
