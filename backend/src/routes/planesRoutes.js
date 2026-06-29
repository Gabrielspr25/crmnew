// Admin de Planes (Constructor de Ofertas) portado del viejo, limpio.
// CRUD de módulos por página (fijos/moviles/inalambrico) + preview/apply de documentos
// (PDF planes fijos / boletín inalámbrico) con diff y snapshot + upload-pdf por módulo.
// El portal de ofertas consume GET /api/planes-modulos/:pagina (público).
import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { PLANES_FIJOS_COLUMNAS, buildDocumentoOfertasArchivePath } from '../services/planesOfertasContract.js';
import { diffFilasPlanesFijos } from '../services/planesOfertasDiff.js';

export const planesRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');
const UPLOAD_DIR = process.env.PLANES_UPLOAD_DIR || path.resolve(__dirname, '../../uploads/pdf-planes');
const SNAPSHOT_DIR = path.join(UPLOAD_DIR, 'snapshots');
const DOCUMENTOS_DIR = path.join(UPLOAD_DIR, 'documentos');
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const PAGINAS_VALIDAS = ['fijos', 'moviles', 'inalambrico'];

const uploadPdf = multer({
  dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') ? cb(null, true) : cb(new Error('Solo se aceptan archivos PDF')),
});
const uploadDoc = multer({
  dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => ['.pdf', '.xlsx', '.xls'].includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Solo se aceptan archivos PDF o Excel')),
});

function runParser(script, filePath) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const proc = spawn(PYTHON, [path.join(SCRIPTS_DIR, script), filePath]);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', e => reject(new Error(`No se pudo ejecutar ${PYTHON}: ${e.message}`)));
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`Parser ${script} falló (exit ${code}): ${stderr.slice(0, 500)}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error(`Parser ${script}: salida no es JSON válido`)); }
    });
  });
}
const uname = (req) => req.user?.nick || req.user?.usuario || req.user?.email || 'admin';

// ─── GET /:pagina  (PÚBLICO — lo lee el portal) ───────────────────────────────
planesRouter.get('/:pagina', async (req, res, next) => {
  const { pagina } = req.params;
  if (pagina === 'admin') return next(); // deja pasar /admin/all
  if (!PAGINAS_VALIDAS.includes(pagina)) return res.status(400).json({ ok: false, error: 'Página inválida. Usa: fijos | moviles | inalambrico' });
  try {
    const { rows } = await pool.query(
      `SELECT id, pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo, contenido, vigencia_desde, vigencia_hasta, boletin_ref, updated_at
       FROM public.planes_modulos WHERE pagina = $1 AND activo = true ORDER BY orden, id`, [pagina]);
    res.json({ ok: true, pagina, modulos: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── GET /admin/all ───────────────────────────────────────────────────────────
planesRouter.get('/admin/all', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo, contenido, vigencia_desde, vigencia_hasta, boletin_ref, updated_at, updated_by
       FROM public.planes_modulos ORDER BY pagina, orden, id`);
    res.json({ ok: true, modulos: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── POST /  (crear) ──────────────────────────────────────────────────────────
planesRouter.post('/', requireAuth, async (req, res) => {
  const { pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo, contenido, vigencia_desde, vigencia_hasta, boletin_ref } = req.body;
  if (!pagina || !seccion_key || !titulo || !tipo || contenido == null) return res.status(400).json({ ok: false, error: 'Campos requeridos: pagina, seccion_key, titulo, tipo, contenido' });
  if (!PAGINAS_VALIDAS.includes(pagina)) return res.status(400).json({ ok: false, error: 'Página inválida' });
  let contenidoJson;
  try { contenidoJson = typeof contenido === 'string' ? JSON.parse(contenido) : contenido; } catch { return res.status(400).json({ ok: false, error: 'contenido debe ser JSON válido' }); }
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.planes_modulos (pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo, contenido, vigencia_desde, vigencia_hasta, boletin_ref, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [pagina, seccion_key, titulo, subtitulo || null, descripcion || null, orden ?? 0, activo !== false, tipo, contenidoJson, vigencia_desde || null, vigencia_hasta || null, boletin_ref || null, uname(req)]);
    res.status(201).json({ ok: true, modulo: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ ok: false, error: `Ya existe un módulo con seccion_key="${seccion_key}" en "${pagina}"` });
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── PUT /:id  (actualizar) ───────────────────────────────────────────────────
planesRouter.put('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const { titulo, subtitulo, descripcion, orden, activo, tipo, contenido, vigencia_desde, vigencia_hasta, boletin_ref } = req.body;
  let contenidoJson;
  if (contenido !== undefined) { try { contenidoJson = typeof contenido === 'string' ? JSON.parse(contenido) : contenido; } catch { return res.status(400).json({ ok: false, error: 'contenido debe ser JSON válido' }); } }
  try {
    const { rows } = await pool.query(
      `UPDATE public.planes_modulos SET
         titulo=COALESCE($1,titulo), subtitulo=COALESCE($2,subtitulo), descripcion=COALESCE($3,descripcion),
         orden=COALESCE($4,orden), activo=COALESCE($5,activo), tipo=COALESCE($6,tipo), contenido=COALESCE($7,contenido),
         vigencia_desde=COALESCE($8,vigencia_desde), vigencia_hasta=COALESCE($9,vigencia_hasta), boletin_ref=COALESCE($10,boletin_ref), updated_by=$11
       WHERE id=$12 RETURNING *`,
      [titulo ?? null, subtitulo ?? null, descripcion ?? null, orden ?? null, activo !== undefined ? activo : null, tipo ?? null, contenidoJson ?? null, vigencia_desde ?? null, vigencia_hasta ?? null, boletin_ref ?? null, uname(req), id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado' });
    res.json({ ok: true, modulo: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── DELETE /:id  (soft delete) ───────────────────────────────────────────────
planesRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  try {
    const { rows } = await pool.query(`UPDATE public.planes_modulos SET activo=false, updated_by=$1 WHERE id=$2 RETURNING id, seccion_key, pagina`, [uname(req), id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado' });
    res.json({ ok: true, desactivado: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── POST /:id/upload-pdf  (parsea PDF de equipos y reemplaza contenido) ───────
planesRouter.post('/:id/upload-pdf', requireAuth, uploadPdf.single('pdf'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo PDF' });
  const pdfPath = req.file.path;
  try {
    const contenidoJson = await runParser('parse_equipos_pdf.py', pdfPath);
    try { fs.unlinkSync(pdfPath); } catch {}
    if (contenidoJson.error) return res.status(500).json({ ok: false, error: contenidoJson.error });
    const seccionesCount = Array.isArray(contenidoJson.secciones) ? contenidoJson.secciones.length : 0;
    if (seccionesCount === 0) return res.status(422).json({ ok: false, warning: true, error: 'El parser no encontró tablas de precios en este PDF. El contenido no fue modificado.' });
    const { rows } = await pool.query(`UPDATE public.planes_modulos SET contenido=$1, updated_by=$2 WHERE id=$3 RETURNING id, seccion_key, pagina`, [contenidoJson, uname(req), id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado' });
    res.json({ ok: true, modulo: rows[0], secciones: seccionesCount });
  } catch (e) { try { fs.unlinkSync(pdfPath); } catch {} res.status(500).json({ ok: false, error: e.message }); }
});

// ─── Constructor de Ofertas: preview + apply ──────────────────────────────────
const previews = new Map();
const PREVIEW_TTL_MS = 30 * 60 * 1000;
function gcPreviews() { const now = Date.now(); for (const [id, p] of previews) if (now - p.created > PREVIEW_TTL_MS) previews.delete(id); }
const normTitulo = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function archiveDoc(filePath, originalName) { fs.mkdirSync(DOCUMENTOS_DIR, { recursive: true }); const dest = buildDocumentoOfertasArchivePath(DOCUMENTOS_DIR, originalName); fs.renameSync(filePath, dest); return dest; }

planesRouter.post('/preview', requireAuth, uploadDoc.single('documento'), async (req, res) => {
  gcPreviews();
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo' });
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const cleanup = () => { try { fs.unlinkSync(filePath); } catch {} };
  try {
    let parsed = null, tipo = null, pagina = null;
    if (ext === '.pdf') {
      try { const r = await runParser('parse_planes_fijos_pdf.py', filePath); if (!r.error && (r.total_filas || 0) > 0) { parsed = r; tipo = 'planes_fijos'; pagina = 'fijos'; } } catch {}
      if (!parsed) { try { const r = await runParser('parse_equipos_pdf.py', filePath); if (!r.error && Array.isArray(r.secciones) && r.secciones.length > 0) { parsed = r; tipo = 'equipos_inalambrico'; pagina = 'inalambrico'; } } catch {} }
    } else if (ext === '.xlsx' || ext === '.xls') {
      cleanup();
      return res.status(422).json({ ok: false, error: 'Excel (lista de precios móviles): parser aún no implementado.' });
    }
    if (!parsed) { cleanup(); return res.status(422).json({ ok: false, error: 'Documento no reconocido por ningún parser. No se modificó nada.' }); }

    const documentoArchivado = archiveDoc(filePath, req.file.originalname);
    const { rows: modulosDb } = await pool.query(`SELECT id, seccion_key, titulo, contenido FROM public.planes_modulos WHERE pagina=$1 AND activo=true ORDER BY orden, id`, [pagina]);
    const resumen = [], planAplicacion = [];
    if (tipo === 'planes_fijos') {
      for (const [key, mod] of Object.entries(parsed.modulos || {})) {
        const db = modulosDb.find(m => m.seccion_key === key || normTitulo(m.titulo) === normTitulo(mod.titulo));
        if (!db) { resumen.push({ seccion: mod.titulo, estado: 'SIN_MODULO_EN_PORTAL', filas_doc: mod.filas.length }); continue; }
        const actuales = db.contenido?.filas || [];
        const d = diffFilasPlanesFijos(actuales, mod.filas);
        resumen.push({ seccion: mod.titulo, modulo_id: db.id, filas_doc: mod.filas.length, filas_publicadas: actuales.length, nuevos: d.nuevos.length, ausentes: d.ausentes.length, modificados: d.modificados.length, sin_cambio: d.sin_cambio, detalle: d });
        planAplicacion.push({ modulo_id: db.id, seccion_key: db.seccion_key, filas: mod.filas, contenido: { columnas: PLANES_FIJOS_COLUMNAS, filas: mod.filas } });
      }
    } else {
      resumen.push({ seccion: 'inalambrico', estado: 'REEMPLAZO_COMPLETO', secciones_doc: parsed.secciones.length, nota: 'Usá el upload-pdf por módulo para inalámbrico.' });
    }
    const previewId = crypto.randomUUID();
    previews.set(previewId, { created: Date.now(), tipo, pagina, parsed, planAplicacion, archivo: req.file.originalname, documentoArchivado, usuario: uname(req) });
    res.json({ ok: true, preview_id: previewId, expira_en_min: 30, tipo_detectado: tipo, pagina, rev: parsed.rev || null, version_doc: parsed.version_doc || null, archivo: req.file.originalname, resumen, no_publicados: Array.isArray(parsed.no_publicados) ? parsed.no_publicados.length : 0 });
  } catch (e) { cleanup(); res.status(500).json({ ok: false, error: e.message }); }
});

planesRouter.post('/apply/:previewId', requireAuth, async (req, res) => {
  gcPreviews();
  const p = previews.get(req.params.previewId);
  if (!p) return res.status(404).json({ ok: false, error: 'Preview no encontrado o expirado (30 min). Volvé a subir el documento.' });
  if (!p.planAplicacion.length) return res.status(422).json({ ok: false, error: 'Este preview no tiene cambios aplicables.' });
  const usuario = uname(req);
  const client = await pool.connect();
  try {
    const ids = p.planAplicacion.map(x => x.modulo_id);
    const { rows: antes } = await client.query(`SELECT id, pagina, seccion_key, titulo, contenido FROM public.planes_modulos WHERE id = ANY($1)`, [ids]);
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const snapFile = path.join(SNAPSHOT_DIR, `snapshot-${p.pagina}-${Date.now()}.json`);
    fs.writeFileSync(snapFile, JSON.stringify({ fecha: new Date().toISOString(), usuario, archivo: p.archivo, tipo: p.tipo, modulos_antes: antes }, null, 2));
    await client.query('BEGIN');
    for (const item of p.planAplicacion) await client.query(`UPDATE public.planes_modulos SET contenido=$1, boletin_ref=$2, updated_by=$3 WHERE id=$4`, [item.contenido, p.archivo, usuario, item.modulo_id]);
    await client.query('COMMIT');
    previews.delete(req.params.previewId);
    res.json({ ok: true, aplicado: p.planAplicacion.map(x => ({ modulo_id: x.modulo_id, seccion_key: x.seccion_key, filas: x.filas?.length })), snapshot: snapFile, archivo: p.archivo });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ ok: false, error: e.message }); }
  finally { client.release(); }
});
