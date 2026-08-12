import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { archiveFuenteComercialBuffer, deriveFuenteTitulo } from '../services/fuentesComercialesArchive.js';
import { PLANES_FIJOS_COLUMNAS } from '../services/planesOfertasContract.js';
import { diffFilasPlanesFijos } from '../services/planesOfertasDiff.js';

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
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');
function gcPreviews() { const now = Date.now(); for (const [id, value] of previews) if (now - value.created > PREVIEW_TTL_MS) previews.delete(id); }
function runParser(script, filePath) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const child = spawn(PYTHON, [path.join(SCRIPTS_DIR, script), filePath]);
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`Parser ${script} falló (exit ${code}): ${stderr.slice(0, 400)}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error(`Parser ${script}: salida no es JSON válido`)); }
    });
  });
}
function sourcePath(row) {
  const root = process.env.FUENTES_COMERCIALES_UPLOAD_DIR || path.resolve(__dirname, '../../uploads/fuentes-comerciales');
  return path.resolve(root, row.ruta_relativa);
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
    res.status(201).json({ ok: true, fuente: publicFuente(rows[0]) });
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
