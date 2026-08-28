import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireAdmin, requireAuth } from '../auth.js';
import { pool, query } from '../db.js';
import { normalizeOfferWorkbooks, parseBusinessRedPlusWorkbook } from '../services/motorOfertasNormalizer.js';
import { diffBusinessRedMultilinea, parseBusinessRedMultilineaText } from '../services/businessRedMultilineaPdf.js';
import { findBusinessRedPlusEligible } from '../services/businessRedPlusEligibility.js';

export const motorOfertasRouter = Router();

// La versión publicada es la única que puede consumir el portal móvil.
// Las fuentes temporales autorizadas quedan identificadas por su vigencia.
async function versionVigente(_req, res) {
  const r = await query(`SELECT id, numero, estado, vigencia_desde, vigencia_hasta,
      archivo_nombre, fuentes, datos, resumen, advertencias, creada_en, publicada_por, publicada_en
    FROM public.ofertas_movil_versiones WHERE estado='vigente' ORDER BY numero DESC LIMIT 1`);
  if (!r.rows[0]) return res.status(404).json({ ok: false, codigo: 'sin_version_publicada' });
  const version = r.rows[0];
  const hoy = new Date().toISOString().slice(0, 10);
  const estado_vigencia = version.vigencia_hasta && version.vigencia_hasta < hoy ? 'vencida_pendiente_reemplazo' : 'vigente';
  res.json({ ok: true, version: { ...version, business_red_plus: version.resumen?.business_red_plus || null, vigencia: { desde: version.vigencia_desde, hasta: version.vigencia_hasta }, estado_vigencia } });
}

motorOfertasRouter.get('/version-vigente', requireAuth, versionVigente);
motorOfertasRouter.get('/vigente', versionVigente);
motorOfertasRouter.use(requireAuth);

// Compatibilidad con el contrato historico: la aprobacion sigue siendo explicita.
motorOfertasRouter.post('/aprobar', requireAdmin, (_req, res) => {
  res.status(501).json({
    ok: false,
    codigo: 'aprobacion_expresa_requiere_publicar',
  });
});

motorOfertasRouter.post('/elegibles', async (req, res) => {
  const { rows } = await query(`SELECT estado, vigencia_desde, vigencia_hasta, datos, resumen
    FROM public.ofertas_movil_versiones WHERE estado='vigente' ORDER BY numero DESC LIMIT 1`);
  if (!rows[0]) return res.status(404).json({ ok: false, codigo: 'sin_version_publicada' });
  const block = rows[0].resumen?.business_red_plus || null;
  if (!block) return res.status(404).json({ ok: false, codigo: 'esquema_business_red_plus_no_publicado' });
  const especiales = await query(`SELECT item_code, sap_code, modelo, marca, categoria, precio_regular, mensualidades, upload_id
    FROM public.v_equipos_vigentes
    WHERE categoria IN ('tablet', 'modem') AND COALESCE(fuera_portafolio, false)=false
    ORDER BY categoria, marca, modelo`);
  const result = findBusinessRedPlusEligible({
    block: {
      ...block,
      vigencia: block.vigencia || { desde: rows[0].vigencia_desde, hasta: rows[0].vigencia_hasta },
    },
    linea: req.body?.linea,
    offers: rows[0].datos || [],
    equiposEspeciales: especiales.rows,
    version: { estado: rows[0].estado },
  });
  const invalidContract = result.validaciones.some((item) => item.campo);
  if (invalidContract) return res.status(422).json({ ok: false, codigo: 'contrato_linea_invalido', ...result });
  res.json({ ok: true, ...result });
});

const previews = new Map();
const businessRedPlusPreviews = new Map();
const businessRedMultilineaPreviews = new Map();
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const SOURCE_ROOT = process.env.FUENTES_COMERCIALES_UPLOAD_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/fuentes-comerciales');
const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts');
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const uname = req => req.user?.nick || req.user?.usuario || req.user?.email || 'admin';
const sourcePath = row => path.resolve(SOURCE_ROOT, row.ruta_relativa);
const sourceInfo = row => ({ id: row.id, familia: row.familia, nombre_original: row.nombre_original, ruta_relativa: row.ruta_relativa, sha256: row.sha256 });
function cleanPreviews() { const now = Date.now(); for (const [id, item] of previews) if (now - item.created > PREVIEW_TTL_MS) previews.delete(id); }
function runParser(script, filePath) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(PYTHON, [path.join(SCRIPTS_DIR, script), filePath]);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Parser ${script} fallo (exit ${code}): ${stderr.slice(0, 400)}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error(`Parser ${script}: salida no es JSON valido`)); }
    });
  });
}
export function vigenciaFromName(value) {
  const source = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const year = source.match(/20\d{2}/)?.[0];
  const months = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12 };
  const match = source.match(/(?:(?:del|desde)\s+)?(\d{1,2})\s+de\s+(\w+)\s+(?:al|hasta)\s+(\d{1,2})\s+de\s+(\w+)/);
  if (match && year && months[match[2]] && months[match[4]]) return { desde: `${year}-${String(months[match[2]]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`, hasta: `${year}-${String(months[match[4]]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}` };
  const sameMonth = source.match(/(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(\w+)/);
  if (sameMonth && year && months[sameMonth[3]]) return { desde: `${year}-${String(months[sameMonth[3]]).padStart(2, '0')}-${String(sameMonth[1]).padStart(2, '0')}`, hasta: `${year}-${String(months[sameMonth[3]]).padStart(2, '0')}-${String(sameMonth[2]).padStart(2, '0')}` };
  return { desde: null, hasta: null };
}
export function vigenciaFromSources(financingName, priceListName) {
  const financing = vigenciaFromName(financingName);
  const priceList = vigenciaFromName(priceListName);
  const advertencias = [];
  if (financing.desde && financing.hasta && priceList.desde && priceList.hasta &&
      (financing.desde !== priceList.desde || financing.hasta !== priceList.hasta)) {
    advertencias.push({
      codigo: 'vigencias_fuentes_distintas',
      fuente_principal: financingName,
      fuente_referencia: priceListName,
      vigencia_principal: financing,
      vigencia_referencia: priceList,
      bloqueante: false,
    });
  }
  return { vigencia: financing, advertencias };
}
function diffOffers(previous, current) {
  const before = new Map((previous || []).map(item => [item.id, item]));
  const after = new Map((current || []).map(item => [item.id, item]));
  const nuevos = [...after.keys()].filter(id => !before.has(id));
  const eliminados = [...before.keys()].filter(id => !after.has(id));
  const modificados = [...after.keys()].filter(id => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)));
  return { nuevos: nuevos.length, eliminados: eliminados.length, modificados: modificados.length, anteriores: before.size, actuales: after.size };
}

function diffBusinessRedPlus(previous, current) {
  const before = previous?.groups || [];
  const after = current?.groups || [];
  return {
    grupos_anteriores: before.length,
    grupos_actuales: after.length,
    matrices_modificadas: JSON.stringify(before.map((group) => group.line_discounts)) !== JSON.stringify(after.map((group) => group.line_discounts)),
    equipos_anteriores: before.reduce((total, group) => total + group.equipment.length, 0),
    equipos_actuales: after.reduce((total, group) => total + group.equipment.length, 0),
  };
}
function portalOfferShape(offer) {
  const benefit = offer.beneficio || {};
  const benefitType = benefit.tipo === 'descuento_porcentaje' ? '50pct' : benefit.tipo;
  const families = (offer.familias || []).map(value => String(value).replace(/^business_red_/, ''));
  const equipos = (offer.equipos || []).filter(item => item.precio_regular != null).map(item => ({
    marca: String(item.modelo_comercial || item.modelo_oficial || '').trim().split(/\s+/)[0] || '',
    modelo: item.modelo_comercial || item.modelo_oficial || '',
    precio: item.precio_regular,
    plazos: item.plazos || [],
    fuente: item.fuente_precio || item.fuente || null,
  }));
  return {
    id: offer.id,
    beneficio: benefitType,
    planMin: offer.plan?.min ?? null,
    planMax: offer.plan?.max ?? null,
    planMaxEnforced: offer.plan?.max != null,
    tipo: offer.tipo_linea === 'multilinea_business_red' ? 'multilinea' : 'individual',
    familias: families,
    planesIndividuales: offer.tipo_linea === 'individual' && offer.plan?.min != null && offer.plan?.max === offer.plan?.min ? [offer.plan.min] : [],
    familiasMultilinea: families,
    titulo: offer.nombre,
    plazos: offer.plazos || [],
    tradeinNueva: false,
    tradeinRenov: Boolean(offer.trade_in?.renovacion_requerido),
    pricecodes: { up: null, fi: null },
    bonoStreaming: false,
    lineaLimit: offer.limite_ban?.cantidad ?? null,
    credito: benefit.monto ?? null,
    eventos: offer.eventos || [],
    nota: offer.texto_original?.terminos || '',
    equipos,
    fuente: offer.fuente || null,
  };
}
async function loadSources(ids) {
  const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (cleanIds.length !== 2) throw Object.assign(new Error('Seleccioná exactamente las dos fuentes: financiamiento y lista de precios.'), { status: 400, codigo: 'dos_fuentes_requeridas' });
  const { rows } = await pool.query(`SELECT id, familia, nombre_original, ruta_relativa, sha256, documento_tipo FROM public.fuentes_comerciales WHERE id = ANY($1::uuid[])`, [cleanIds]);
  if (rows.length !== 2) throw Object.assign(new Error('No se encontraron las dos fuentes archivadas.'), { status: 404, codigo: 'fuente_no_encontrada' });
  const financing = rows.find(row => row.familia === 'ofertas_moviles');
  const priceList = rows.find(row => row.familia === 'equipos');
  if (!financing || !priceList || financing.documento_tipo !== 'excel' || priceList.documento_tipo !== 'excel') throw Object.assign(new Error('Las dos fuentes deben ser Excel: Ofertas móviles y Equipos.'), { status: 422, codigo: 'fuentes_movil_invalidas' });
  const financingPath = sourcePath(financing), pricePath = sourcePath(priceList);
  if (!fs.existsSync(financingPath) || !fs.existsSync(pricePath)) throw Object.assign(new Error('Falta uno de los originales archivados.'), { status: 422, codigo: 'original_no_encontrado' });
  return { rows, financing, priceList, financingBuffer: fs.readFileSync(financingPath), priceListBuffer: fs.readFileSync(pricePath) };
}

motorOfertasRouter.post('/preview', requireAdmin, async (req, res) => {
  cleanPreviews();
  try {
    const loaded = await loadSources(req.body?.fuente_ids);
    const parsed = normalizeOfferWorkbooks({ financingBuffer: loaded.financingBuffer, priceListBuffer: loaded.priceListBuffer, sourceIds: { tabla_financiamiento: loaded.financing.id, lista_precios: loaded.priceList.id }, fileNames: { tabla_financiamiento: loaded.financing.nombre_original, lista_precios: loaded.priceList.nombre_original } });
    const portalOffers = parsed.offers.map(portalOfferShape);
    const prior = await query(`SELECT datos FROM public.ofertas_movil_versiones WHERE estado='vigente' ORDER BY numero DESC LIMIT 1`);
    const sourceVigencia = vigenciaFromSources(loaded.financing.nombre_original, loaded.priceList.nombre_original);
    const vigencia = sourceVigencia.vigencia;
    const advertencias = [...(parsed.contradictions || []).map(item => ({ ...item, tipo: 'contradiccion' })), ...sourceVigencia.advertencias];
    const resumen = { ...parsed.summary, diferencias: diffOffers(prior.rows[0]?.datos || [], parsed.offers), vigencia_detectada: vigencia };
    const versionId = crypto.randomUUID();
    previews.set(versionId, { created: Date.now(), loaded, parsed: { ...parsed, offers: portalOffers }, resumen, advertencias, vigencia, usuario: uname(req) });
    res.json({ ok: true, version_id: versionId, resumen, advertencias, vigencia, fuentes: loaded.rows.map(sourceInfo), datos: portalOffers, publicable: portalOffers.length > 0 });
  } catch (error) { res.status(error.status || 422).json({ ok: false, codigo: error.codigo || 'parser_error', error: error.message }); }
});

motorOfertasRouter.post('/preview-business-red-plus', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body?.fuente_ids) ? req.body.fuente_ids : []).map(String))];
    if (ids.length !== 2) return res.status(400).json({ ok: false, codigo: 'dos_fuentes_requeridas', error: 'Selecciona el Excel y el PDF oficiales.' });
    const { rows } = await pool.query(`SELECT id, familia, nombre_original, ruta_relativa, sha256, documento_tipo, vigencia_desde, vigencia_hasta
      FROM public.fuentes_comerciales WHERE id = ANY($1::uuid[])`, [ids]);
    const excel = rows.find((row) => row.documento_tipo === 'excel' && row.familia === 'ofertas_moviles');
    const pdf = rows.find((row) => row.documento_tipo === 'pdf');
    if (!excel || !pdf) return res.status(422).json({ ok: false, codigo: 'fuentes_business_red_plus_invalidas', error: 'Se requiere un Excel de ofertas móviles y un PDF oficial de respaldo.' });
    const workbookPath = sourcePath(excel);
    if (!fs.existsSync(workbookPath)) return res.status(422).json({ ok: false, codigo: 'original_no_encontrado', error: 'No se encontró el Excel archivado.' });
    const block = parseBusinessRedPlusWorkbook({ buffer: fs.readFileSync(workbookPath), fileName: excel.nombre_original, sourceId: excel.id });
    const current = await query(`SELECT resumen FROM public.ofertas_movil_versiones WHERE estado='vigente' ORDER BY numero DESC LIMIT 1`);
    const previousBlock = current.rows[0]?.resumen?.business_red_plus || null;
    const previewId = crypto.randomUUID();
    const vigencia = vigenciaFromName(`${excel.nombre_original} ${pdf.nombre_original}`);
    const preview = {
      created: Date.now(),
      block: { ...block, vigencia: { desde: excel.vigencia_desde || vigencia.desde, hasta: excel.vigencia_hasta || vigencia.hasta }, fuentes: [sourceInfo(excel), sourceInfo(pdf)] },
      diff: diffBusinessRedPlus(previousBlock, block),
      advertencias: block.warnings || [],
      fuentes: [sourceInfo(excel), sourceInfo(pdf)],
      usuario: uname(req),
    };
    businessRedPlusPreviews.set(previewId, preview);
    res.json({ ok: true, preview_id: previewId, business_red_plus: preview.block, diferencias: preview.diff, advertencias: preview.advertencias, publicable: block.groups.length === 4 });
  } catch (error) {
    res.status(422).json({ ok: false, codigo: 'business_red_plus_parser_error', error: error.message });
  }
});

motorOfertasRouter.post('/publicar-business-red-plus', requireAuth, requireAdmin, async (req, res) => {
  const preview = businessRedPlusPreviews.get(String(req.body?.preview_id || ''));
  if (!preview) return res.status(404).json({ ok: false, codigo: 'preview_no_encontrado', error: 'La vista previa expiró. Generala de nuevo.' });
  if (preview.block.groups.length !== 4) return res.status(409).json({ ok: false, codigo: 'matrices_incompletas', error: 'La tabla Business Red Plus no tiene las cuatro matrices oficiales.' });
  if (preview.advertencias.length && req.body?.confirmar_advertencias !== true) return res.status(422).json({ ok: false, codigo: 'advertencias_requieren_confirmacion', error: 'La vista previa tiene advertencias; confirma explícitamente para publicar.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`SELECT * FROM public.ofertas_movil_versiones WHERE estado='vigente' ORDER BY numero DESC LIMIT 1 FOR UPDATE`);
    if (!current.rows[0]) throw Object.assign(new Error('No existe una versión móvil vigente para conservar.'), { status: 409 });
    const old = current.rows[0];
    await client.query(`UPDATE public.ofertas_movil_versiones SET estado='reemplazada', reemplazada_en=now() WHERE id=$1`, [old.id]);
    const manifest = crypto.createHash('sha256').update(preview.fuentes.map((source) => source.sha256).sort().join('|')).digest('hex');
    const resumen = { ...(old.resumen || {}), business_red_plus: preview.block, business_red_plus_diff: preview.diff };
    const { rows } = await client.query(`INSERT INTO public.ofertas_movil_versiones
      (estado, vigencia_desde, vigencia_hasta, archivo_nombre, archivo_sha256, fuentes, datos, resumen, advertencias, creada_por, publicada_por, publicada_en)
      VALUES ('vigente',$1,$2,$3,$4,$5,$6,$7,$8,$9,$9,now()) RETURNING *`, [preview.block.vigencia.desde, preview.block.vigencia.hasta, preview.fuentes.map((source) => source.nombre_original).join(' + '), manifest, JSON.stringify(preview.fuentes), JSON.stringify(old.datos), JSON.stringify(resumen), JSON.stringify(preview.advertencias), preview.usuario]);
    await client.query('COMMIT');
    businessRedPlusPreviews.delete(String(req.body.preview_id));
    res.json({ ok: true, version: { ...rows[0], business_red_plus: preview.block } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(error.status || 500).json({ ok: false, codigo: 'publicacion_business_red_plus_error', error: error.message });
  } finally { client.release(); }
});

motorOfertasRouter.post('/preview-business-red-multilinea', requireAuth, requireAdmin, async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.fuente_ids) ? req.body.fuente_ids : []).map(String))];
  if (ids.length !== 1) return res.status(400).json({ ok: false, codigo: 'fuente_pdf_requerida', error: 'Selecciona un PDF oficial de planes Business Red.' });
  try {
    const { rows } = await pool.query(`SELECT id, familia, nombre_original, ruta_relativa, sha256, documento_tipo, vigencia_desde, vigencia_hasta
      FROM public.fuentes_comerciales WHERE id = ANY($1::uuid[])`, [ids]);
    const pdf = rows.find((row) => row.documento_tipo === 'pdf' && row.familia === 'moviles');
    if (!pdf) return res.status(422).json({ ok: false, codigo: 'fuente_business_red_multilinea_invalida', error: 'La fuente debe ser un PDF archivado como familia Moviles.' });
    const pdfPath = sourcePath(pdf);
    if (!fs.existsSync(pdfPath)) return res.status(422).json({ ok: false, codigo: 'original_no_encontrado', error: 'No se encontro el PDF archivado.' });
    const extracted = await runParser('parse_business_red_multilinea_pdf.py', pdfPath);
    const parsed = parseBusinessRedMultilineaText(extracted.text || '', { fileName: pdf.nombre_original, sourceId: pdf.id });
    const keys = parsed.modulos.map((modulo) => modulo.seccion_key);
    const current = await query(`SELECT id, seccion_key, titulo, contenido FROM public.planes_modulos WHERE pagina='moviles' AND seccion_key = ANY($1::text[])`, [keys]);
    const previewId = crypto.randomUUID();
    const diff = diffBusinessRedMultilinea(current.rows, parsed.modulos);
    const vigencia = vigenciaFromName(pdf.nombre_original);
    const preview = {
      created: Date.now(),
      fuente: sourceInfo(pdf),
      modulos: parsed.modulos,
      advertencias: parsed.advertencias,
      resumen: { ...parsed.resumen, diferencias: diff, paginas: extracted.pages || null },
      vigencia: { desde: pdf.vigencia_desde || vigencia.desde, hasta: pdf.vigencia_hasta || vigencia.hasta },
      usuario: uname(req),
    };
    businessRedMultilineaPreviews.set(previewId, preview);
    res.json({ ok: true, preview_id: previewId, fuente: sourceInfo(pdf), modulos: parsed.modulos, resumen: preview.resumen, advertencias: preview.advertencias, publicable: parsed.modulos.length === 4 });
  } catch (error) {
    res.status(422).json({ ok: false, codigo: 'business_red_multilinea_parser_error', error: error.message });
  }
});

motorOfertasRouter.post('/publicar-business-red-multilinea', requireAuth, requireAdmin, async (req, res) => {
  const preview = businessRedMultilineaPreviews.get(String(req.body?.preview_id || ''));
  if (!preview) return res.status(404).json({ ok: false, codigo: 'preview_no_encontrado', error: 'La vista previa expiro. Generala de nuevo.' });
  if (preview.modulos.length !== 4) return res.status(409).json({ ok: false, codigo: 'modulos_incompletos', error: 'El boletin no produjo los cuatro modulos Business Red.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const modulo of preview.modulos) {
      const existing = await client.query(`SELECT id FROM public.planes_modulos WHERE pagina='moviles' AND seccion_key=$1 FOR UPDATE`, [modulo.seccion_key]);
      if (existing.rows[0]) {
        await client.query(`UPDATE public.planes_modulos
          SET titulo=$1, subtitulo=$2, descripcion=$3, orden=$4, activo=true, tipo=$5, contenido=$6, boletin_ref=$7, updated_by=$8
          WHERE id=$9`, [modulo.titulo, modulo.subtitulo, modulo.descripcion, modulo.orden, modulo.tipo, JSON.stringify(modulo.contenido), preview.fuente.nombre_original, preview.usuario, existing.rows[0].id]);
      } else {
        await client.query(`INSERT INTO public.planes_modulos
          (pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo, contenido, boletin_ref, updated_by)
          VALUES ('moviles',$1,$2,$3,$4,$5,true,$6,$7,$8,$9)`, [modulo.seccion_key, modulo.titulo, modulo.subtitulo, modulo.descripcion, modulo.orden, modulo.tipo, JSON.stringify(modulo.contenido), preview.fuente.nombre_original, preview.usuario]);
      }
    }
    await client.query(`UPDATE public.planes_modulos SET orden=90, updated_by=$1 WHERE pagina='moviles' AND seccion_key='business_red_plus_byop_ban'`, [preview.usuario]);
    await client.query('COMMIT');
    businessRedMultilineaPreviews.delete(String(req.body.preview_id));
    res.json({ ok: true, aplicado: preview.modulos.map((modulo) => ({ seccion_key: modulo.seccion_key, filas: modulo.contenido.activacion.filas.length })) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ ok: false, codigo: 'publicacion_business_red_multilinea_error', error: error.message });
  } finally { client.release(); }
});

motorOfertasRouter.post('/publicar', requireAuth, requireAdmin, async (req, res) => {
  cleanPreviews();
  const preview = previews.get(String(req.body?.version_id || ''));
  if (!preview) return res.status(404).json({ ok: false, codigo: 'version_no_encontrada', error: 'La vista previa expiró. Generala de nuevo.' });
  if (!preview.parsed.offers.length) return res.status(409).json({ ok: false, codigo: 'version_no_publicable', error: 'El parser no encontró ofertas publicables.' });
  const desde = String(req.body?.vigencia_desde || preview.vigencia.desde || '').trim();
  const hasta = String(req.body?.vigencia_hasta || preview.vigencia.hasta || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || desde > hasta) return res.status(422).json({ ok: false, codigo: 'vigencia_invalida', error: 'La vigencia desde/hasta es obligatoria y válida.' });
  if (preview.advertencias.length && req.body?.confirmar_advertencias !== true) return res.status(422).json({ ok: false, codigo: 'advertencias_requieren_confirmacion', error: 'La versión tiene advertencias; confirma explícitamente para publicar.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE public.ofertas_movil_versiones SET estado='reemplazada', reemplazada_en=now() WHERE estado='vigente'`);
    const manifest = crypto.createHash('sha256').update(preview.loaded.rows.map(row => row.sha256).sort().join('|')).digest('hex');
    const { rows } = await client.query(`INSERT INTO public.ofertas_movil_versiones
      (estado, vigencia_desde, vigencia_hasta, archivo_nombre, archivo_sha256, fuentes, datos, resumen, advertencias, creada_por, publicada_por, publicada_en)
      VALUES ('vigente',$1,$2,$3,$4,$5,$6,$7,$8,$9,$9,now()) RETURNING *`, [desde, hasta, preview.loaded.rows.map(row => row.nombre_original).join(' + '), manifest, JSON.stringify(preview.loaded.rows.map(sourceInfo)), JSON.stringify(preview.parsed.offers), JSON.stringify(preview.resumen), JSON.stringify(preview.advertencias), preview.usuario]);
    await client.query('COMMIT');
    previews.delete(String(req.body.version_id));
    res.json({ ok: true, version: rows[0] });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ ok: false, codigo: 'publicacion_error', error: error.message }); }
  finally { client.release(); }
});

motorOfertasRouter.get('/historial', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query(`SELECT id,numero,estado,vigencia_desde,vigencia_hasta,archivo_nombre,resumen,advertencias,creada_por,creada_en,publicada_por,publicada_en,reemplazada_en FROM public.ofertas_movil_versiones ORDER BY numero DESC`);
  res.json({ ok: true, versiones: rows });
});
