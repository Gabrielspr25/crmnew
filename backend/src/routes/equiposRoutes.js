// Admin de Equipos (Lista de Precios PYMES/CORP). Sube el Excel (4 tabs),
// lo parsea y hace upsert versionado en equipos_lista/_mensualidades/_pospago/_uploads.
// El portal de ofertas consume estos datos; acá vive solo el ADMIN.
import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { buscarYDescargarImagenEquipo } from '../services/equiposImagenesService.js';
import { archiveOfferSource } from '../services/motorOfertasSourceArchive.js';

export const equiposRouter = Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const MOTOR_OFERTAS_UPLOAD_ROOT = process.env.MOTOR_OFERTAS_UPLOAD_DIR
  || path.resolve(__dir, '../../uploads/motor-ofertas');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos Excel (.xlsx / .xls)'));
  },
});

// ─── Parser (portado de equiposListaController) ───────────────────────────────
const PLANES_POSPAGO = [0, 9.99, 14.99, 19.99, 29.99, 39.99, 49.99, 59.99, 69.99, 79.99, 99.99];

function detectarMarca(modelo = '') {
  const m = modelo.toUpperCase();
  if (m.includes('SAMSUNG') || m.includes('GXY') || m.includes('GALAXY')) return 'samsung';
  if (m.includes('IPH') || m.includes('IPHONE') || m.includes('AIRPODS') || m.includes('APPLE') ||
      m.includes('HOMEPOD') || m.includes('AIRTAG') || m.includes('MAGSAFE') || m.includes('MAGIC KEYBOARD') ||
      m.includes('SMART KEYBOARD') || m.includes('SMART FOLIO') || m.includes('PENCIL')) return 'apple';
  if (m.includes('MOTO') || m.includes('MOTOROLA')) return 'motorola';
  if (m.includes('JBL')) return 'jbl';
  if (m.includes('BEATS')) return 'beats';
  if (m.includes('SONOS')) return 'sonos';
  if (m.includes('ARGOM')) return 'argom';
  if (m.includes('NUXOR')) return 'nuxor';
  if (m.includes('AIRLINK')) return 'airlink';
  if (m.includes('ZIPKORD')) return 'zipkord';
  if (m.includes('MOPHIE')) return 'mophie';
  if (m.includes('FRANKLIN') || m.includes('PCD')) return 'modem';
  if (m.includes('NETGEAR') || m.includes('ASUS') || m.includes('TP-LINK')) return 'router';
  return 'otro';
}
function parsePrecio(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}
const isItemCode = (v) => Boolean(String(v || '').trim().match(/^\d{5}H$/i));
function findSheet(wb, patterns) {
  return wb.SheetNames.find((name) => { const n = name.toLowerCase(); return patterns.some((p) => n.includes(p)); });
}
function mergeItems(items) {
  const byCode = new Map();
  for (const item of items) {
    if (!item?.item_code) continue;
    const code = String(item.item_code).trim().toUpperCase();
    const existing = byCode.get(code);
    if (!existing) { byCode.set(code, { ...item, item_code: code, mensualidades: item.mensualidades || [], pospago_precios: item.pospago_precios || [] }); continue; }
    existing.sap_code = existing.sap_code || item.sap_code;
    existing.modelo = existing.modelo || item.modelo;
    existing.marca = existing.marca === 'otro' ? item.marca : existing.marca || item.marca;
    existing.categoria = existing.categoria === 'pospago' ? item.categoria : existing.categoria || item.categoria;
    existing.precio_regular = existing.precio_regular ?? item.precio_regular;
    existing.fuera_portafolio = Boolean(existing.fuera_portafolio || item.fuera_portafolio);
    if (item.mensualidades?.length) {
      const monthly = new Map(existing.mensualidades.map((m) => [Number(m.meses), m]));
      item.mensualidades.forEach((m) => monthly.set(Number(m.meses), m));
      existing.mensualidades = [...monthly.values()].sort((a, b) => Number(a.meses) - Number(b.meses));
    }
    if (item.pospago_precios?.length) {
      const pospago = new Map(existing.pospago_precios.map((p) => [Number(p.plan_precio), p]));
      item.pospago_precios.forEach((p) => pospago.set(Number(p.plan_precio), p));
      existing.pospago_precios = [...pospago.values()].sort((a, b) => Number(a.plan_precio) - Number(b.plan_precio));
    }
  }
  return [...byCode.values()];
}
function parseTab1(sheet) { // Celulares: Item|SAP|Modelo|Precio|20|24|30|36
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }); const items = [];
  for (const row of rows) {
    const code = String(row[0] || '').trim(); if (!isItemCode(code)) continue;
    const modelo = String(row[2] || '').trim(); if (!modelo) continue;
    const mens = [{ meses: 20, monto: parsePrecio(row[4]) }, { meses: 24, monto: parsePrecio(row[5]) }, { meses: 30, monto: parsePrecio(row[6]) }, { meses: 36, monto: parsePrecio(row[7]) }].filter((m) => m.monto !== null);
    items.push({ item_code: code.toUpperCase(), sap_code: String(row[1] || '').trim(), modelo, marca: detectarMarca(modelo), categoria: 'celular', precio_regular: parsePrecio(row[3]), fuera_portafolio: modelo.includes('*'), mensualidades: mens });
  }
  return items;
}
function parseTab2(sheet) { // Modems/Tablets: Item|SAP|Modelo|Precio|12|24|30|36
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }); const items = [];
  for (const row of rows) {
    const code = String(row[0] || '').trim(); if (!isItemCode(code)) continue;
    const modelo = String(row[2] || '').trim(); if (!modelo) continue;
    const off = parsePrecio(row[4]) !== null ? 1 : 0;
    const mens = [{ meses: 12, monto: parsePrecio(row[4 + off]) }, { meses: 24, monto: parsePrecio(row[5 + off]) }, { meses: 30, monto: parsePrecio(row[6 + off]) }, { meses: 36, monto: parsePrecio(row[7 + off]) }].filter((m) => m.monto !== null);
    const mu = modelo.toUpperCase(); let categoria = 'modem';
    if (mu.includes('IPAD') || mu.includes('TABLET') || mu.includes('TAB ')) categoria = 'tablet';
    items.push({ item_code: code.toUpperCase(), sap_code: String(row[1] || '').trim(), modelo, marca: detectarMarca(modelo), categoria, precio_regular: parsePrecio(row[3 + off]), fuera_portafolio: modelo.includes('*'), mensualidades: mens });
  }
  return items;
}
function parseTab3(sheet) { // Pospago 2 años: Item|SAP|Modelo|SinContrato|$9.99...$99.99
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }); const items = [];
  for (const row of rows) {
    const ci = [0, 1, 2].find((i) => isItemCode(row[i])); if (ci === undefined) continue;
    const code = String(row[ci] || '').trim();
    const modelo = String(row[ci + 2] || row[ci + 1] || '').trim(); if (!modelo) continue;
    const pospago = PLANES_POSPAGO.map((plan, i) => ({ plan_precio: plan, monto: parsePrecio(row[ci + 3 + i]) ?? 0 }));
    items.push({ item_code: code.toUpperCase(), sap_code: String(row[ci + 1] || '').trim(), modelo, marca: detectarMarca(modelo), categoria: 'pospago', precio_regular: parsePrecio(row[ci + 3]), fuera_portafolio: false, pospago_precios: pospago });
  }
  return items;
}
function parseTab4(sheet) { // Accesorios: Item|SAP|Modelo|Precio|3|6|12|24
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }); const items = [];
  for (const row of rows) {
    const code = String(row[0] || '').trim(); if (!isItemCode(code)) continue;
    const modelo = String(row[2] || '').trim(); if (!modelo) continue;
    const mens = [{ meses: 3, monto: parsePrecio(row[4]) }, { meses: 6, monto: parsePrecio(row[5]) }, { meses: 12, monto: parsePrecio(row[6]) }, { meses: 24, monto: parsePrecio(row[7]) }].filter((m) => m.monto !== null);
    items.push({ item_code: code.toUpperCase(), sap_code: String(row[1] || '').trim(), modelo, marca: detectarMarca(modelo), categoria: 'accesorio', precio_regular: parsePrecio(row[3]), fuera_portafolio: false, mensualidades: mens });
  }
  return items;
}
function parsearExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const celulares = findSheet(wb, ['finan equipos']);
  const modems = findSheet(wb, ['finan modems']);
  const accesorios = findSheet(wb, ['accesorios']);
  const pospagoSheets = wb.SheetNames.filter((name) => {
    const n = name.toLowerCase();
    return n.includes('ofertas tablets') || n.includes('precios modems') || n.includes('planes familiares') || n.includes('planes fam otros');
  });
  const items = mergeItems([
    ...(celulares ? parseTab1(wb.Sheets[celulares]) : []),
    ...(modems ? parseTab2(wb.Sheets[modems]) : []),
    ...(accesorios ? parseTab4(wb.Sheets[accesorios]) : []),
    ...pospagoSheets.flatMap((s) => parseTab3(wb.Sheets[s])),
  ]);
  return { items, sheetNames: wb.SheetNames };
}

// ─── Endpoints ────────────────────────────────────────────────────────────────
// GET /api/equipos-lista  — equipos vigentes (con filtros)
equiposRouter.get('/equipos-lista', requireAuth, async (req, res) => {
  try {
    const { categoria, marca, search } = req.query;
    let sql = `SELECT * FROM public.v_equipos_vigentes WHERE 1=1`; const params = [];
    if (categoria) { params.push(categoria); sql += ` AND categoria = $${params.length}`; }
    if (marca) { params.push(marca); sql += ` AND marca = $${params.length}`; }
    if (search) { params.push(`%${String(search).toLowerCase()}%`); sql += ` AND (LOWER(modelo) LIKE $${params.length} OR item_code ILIKE $${params.length})`; }
    const r = await pool.query(sql, params);
    res.json({ ok: true, total: r.rows.length, data: r.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/equipos-lista/uploads — historial
equiposRouter.get('/equipos-lista/uploads', requireAuth, async (_req, res) => {
  try { const r = await pool.query(`SELECT * FROM public.equipos_uploads ORDER BY fecha_subida DESC LIMIT 20`); res.json({ ok: true, data: r.rows }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/equipos-lista/:id/foto/buscar — busca en sitios oficiales y guarda copia local
equiposRouter.post('/equipos-lista/:id/foto/buscar', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido.' });
    const r = await pool.query(`SELECT id, item_code, modelo, marca FROM public.equipos_lista WHERE id=$1 LIMIT 1`, [id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Equipo no encontrado.' });
    const found = await buscarYDescargarImagenEquipo(r.rows[0]);
    await pool.query(
      `UPDATE public.equipos_lista
       SET image_url=$1, image_source_url=$2, image_status='ok', image_updated_at=NOW(), actualizado_en=NOW()
       WHERE id=$3`,
      [found.image_url, found.image_source_url, id]
    );
    res.json({ ok: true, equipo_id: id, ...found });
  } catch (e) {
    try {
      await pool.query(
        `UPDATE public.equipos_lista SET image_status='error', image_updated_at=NOW() WHERE id=$1`,
        [Number(req.params.id) || 0]
      );
    } catch {}
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/equipos-lista/preview — parsear sin guardar
equiposRouter.post('/equipos-lista/preview', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo.' });
    const { items, sheetNames } = parsearExcel(req.file.buffer);
    const resumen = { total: items.length, por_categoria: {} };
    for (const it of items) resumen.por_categoria[it.categoria] = (resumen.por_categoria[it.categoria] || 0) + 1;
    res.json({ ok: true, sheetNames, resumen, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/equipos-lista/upload — parsear y hacer upsert (desactiva todo y reactiva lo del archivo)
equiposRouter.post('/equipos-lista/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo.' });
  const { vigencia_inicio, vigencia_fin, notas } = req.body;
  const username = req.user?.nick || req.user?.usuario || 'admin';
  let source;
  try {
    source = await archiveOfferSource({
      rootDir: MOTOR_OFERTAS_UPLOAD_ROOT,
      type: 'lista_precios',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
    });
  } catch {
    return res.status(422).json({ ok: false, error: 'No se pudo archivar la lista oficial.' });
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const up = await c.query(
      `INSERT INTO public.equipos_uploads (
        nombre_archivo, subido_por, vigencia_inicio, vigencia_fin, notas,
        nombre_archivado, ruta_archivada, sha256, mime_type, bytes, vigencia_documental
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        req.file.originalname,
        username,
        vigencia_inicio || null,
        vigencia_fin || null,
        notas || null,
        source.archivedName,
        source.relativePath,
        source.sha256,
        source.mimeType,
        req.file.size,
        vigencia_inicio && vigencia_fin ? 'vigente' : 'pendiente_confirmacion',
      ]);
    const uploadId = up.rows[0].id;
    const { items } = parsearExcel(req.file.buffer);
    await c.query(`UPDATE public.equipos_lista SET activo = FALSE`);
    let insertados = 0, actualizados = 0;
    for (const item of items) {
      const ex = await c.query(`SELECT id FROM public.equipos_lista WHERE item_code = $1 LIMIT 1`, [item.item_code]);
      let equipoId;
      if (ex.rows.length) {
        equipoId = ex.rows[0].id;
        await c.query(`UPDATE public.equipos_lista SET upload_id=$1, sap_code=$2, modelo=$3, marca=$4, categoria=$5, precio_regular=$6, fuera_portafolio=$7, activo=TRUE, actualizado_en=NOW() WHERE id=$8`,
          [uploadId, item.sap_code, item.modelo, item.marca, item.categoria, item.precio_regular, item.fuera_portafolio, equipoId]);
        actualizados++;
      } else {
        const ins = await c.query(`INSERT INTO public.equipos_lista (upload_id, item_code, sap_code, modelo, marca, categoria, precio_regular, fuera_portafolio, activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING id`,
          [uploadId, item.item_code, item.sap_code, item.modelo, item.marca, item.categoria, item.precio_regular, item.fuera_portafolio]);
        equipoId = ins.rows[0].id; insertados++;
      }
      await c.query(`DELETE FROM public.equipos_mensualidades WHERE equipo_id=$1`, [equipoId]);
      for (const m of (item.mensualidades || [])) await c.query(`INSERT INTO public.equipos_mensualidades (equipo_id, meses, monto) VALUES ($1,$2,$3)`, [equipoId, m.meses, m.monto]);
      await c.query(`DELETE FROM public.equipos_pospago WHERE equipo_id=$1`, [equipoId]);
      for (const p of (item.pospago_precios || [])) await c.query(`INSERT INTO public.equipos_pospago (equipo_id, plan_precio, monto) VALUES ($1,$2,$3)`, [equipoId, p.plan_precio, p.monto]);
    }
    await c.query(`UPDATE public.equipos_uploads SET total_items=$1 WHERE id=$2`, [items.length, uploadId]);
    await c.query('COMMIT');
    res.json({ ok: true, upload_id: uploadId, total: items.length, insertados, actualizados, message: `Lista actualizada: ${insertados} nuevos, ${actualizados} actualizados.` });
  } catch (e) { try { await c.query('ROLLBACK'); } catch {} res.status(500).json({ ok: false, error: e.message }); }
  finally { c.release(); }
});
