import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { archiveFuenteComercialBuffer, deriveFuenteTitulo } from '../services/fuentesComercialesArchive.js';
import { classifyFuenteComercialUpload } from '../services/fuentesComercialesVersioning.js';
import { PLANES_FIJOS_COLUMNAS } from '../services/planesOfertasContract.js';
import { diffFilasPlanesFijos } from '../services/planesOfertasDiff.js';
import { buildBasesInformativasPreviews } from '../services/basesInformativasPreview.js';
import { buildListaPreciosPreview } from '../services/listaPreciosPreview.js';
import { normalizeFijoOfferBenefitSources } from '../services/fijoBenefitsNormalizer.js';
import { AFFINITY_DOMINIO, AFFINITY_NORMALIZADOR_VERSION, normalizeAffinityBenefitSources } from '../services/affinityBenefitsNormalizer.js';
import { readAffinityPortalDetail, readBenefitsPortalCatalog } from '../services/benefitsPortalCatalog.js';
import {
  diffCompositeRules,
  listCompositeRulesVersions,
  persistCompositeRulesVersion,
  publishApprovedCompositeRulesVersion,
  readCompositeRulesVersion,
  readCurrentPublishedCompositeRules,
} from '../services/motorComercialReglasCompuestasPersistence.js';
import { runParser } from '../services/secureParserRunner.js';
import { dateOnly } from '../services/vigenciaTexto.js';
import { DIAS_ALERTA_VENCIMIENTO, buildVigenciaAlertas } from '../services/vigenciaAlertas.js';
import { importarListaEquiposDesdeFuente, parsearExcel } from './equiposRoutes.js';

export const fuentesComercialesRouter = Router();

fuentesComercialesRouter.get('/benefits-vigentes', async (_req, res) => {
  try {
    const catalog = await readBenefitsPortalCatalog({ db: pool });
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'lectura_benefits_vigentes_error', error: error.message });
  }
});

// El portal del vendedor no tiene sesion: lee solo lo publicado, igual que benefits-vigentes.
fuentesComercialesRouter.get('/affinity-vigente', async (_req, res) => {
  try {
    res.json(await readAffinityPortalDetail(pool));
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'lectura_affinity_vigente_portal_error', error: error.message });
  }
});

fuentesComercialesRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/fuentes-comerciales');
const UPLOAD_DIR = process.env.FUENTES_COMERCIALES_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
const FAMILIAS = new Set(['equipos', 'fijos', 'moviles', 'inalambrico_iot', 'servicios', 'cloud_sva', 'claro_tv', 'ofertas_moviles', 'ofertas_fijo', 'beneficios', 'affinity']);
const BASE_PDF_FAMILIES = new Set(['fijos', 'claro_tv', 'moviles', 'inalambrico_iot']);
const CRM_ROOT = path.resolve(__dirname, '../../..');
const LEGACY_BASE_DOCUMENT_DIRS = [
  path.resolve(CRM_ROOT, 'Planes para web/Estructura de planes/planes'),
  path.resolve(CRM_ROOT, 'documentos-ofertas'),
];
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls']);

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

function normalizeSha256(value) {
  return String(value || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
}

function mimeTypeForDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.xls') return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

function hashFileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listDocumentFiles(rootDir, depth = 0) {
  if (depth > 4) return [];
  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listDocumentFiles(fullPath, depth + 1));
      continue;
    }
    if (!entry.isFile() || !DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(fullPath);
  }
  return files;
}

function findLegacyDocumentBySha(sha256) {
  const expected = normalizeSha256(sha256);
  if (!expected) return null;
  for (const root of LEGACY_BASE_DOCUMENT_DIRS) {
    let realRoot;
    try {
      realRoot = fs.realpathSync(root);
    } catch {
      continue;
    }
    for (const candidate of listDocumentFiles(realRoot)) {
      let filePath;
      try {
        filePath = fs.realpathSync(candidate);
        if (!isPathInside(realRoot, filePath)) continue;
        if (hashFileSha256(filePath) !== expected) continue;
        return {
          filePath,
          nombre_original: path.basename(filePath),
          mime_type: mimeTypeForDocument(filePath),
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

function normalizeDocumentName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function documentNameTokens(value) {
  const stopWords = new Set(['de', 'del', 'la', 'el', 'y', 'al', 'a', 'en', 'para', 'pyM'.toLowerCase(), 'corp']);
  return normalizeDocumentName(value).split(/\s+/).filter((token) => token.length >= 3 && !stopWords.has(token));
}

function preferPdfDocuments(documents) {
  return documents.slice().sort((a, b) => {
    const aPdf = path.extname(a.filePath).toLowerCase() === '.pdf' ? 1 : 0;
    const bPdf = path.extname(b.filePath).toLowerCase() === '.pdf' ? 1 : 0;
    if (aPdf !== bPdf) return bPdf - aPdf;
    return b.score - a.score;
  });
}

function findLegacyDocumentsByPublicationName(fuenteNombre) {
  const parts = String(fuenteNombre || '').split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return [];
  const matches = [];
  for (const root of LEGACY_BASE_DOCUMENT_DIRS) {
    let realRoot;
    try {
      realRoot = fs.realpathSync(root);
    } catch {
      continue;
    }
    const files = listDocumentFiles(realRoot).map((candidate) => {
      try {
        const filePath = fs.realpathSync(candidate);
        if (!isPathInside(realRoot, filePath)) return null;
        return { filePath, normalizedName: normalizeDocumentName(path.basename(filePath)) };
      } catch {
        return null;
      }
    }).filter(Boolean);
    for (const part of parts) {
      const tokens = documentNameTokens(part);
      if (tokens.length < 2) continue;
      for (const file of files) {
        const matched = tokens.filter((token) => file.normalizedName.includes(token));
        const score = matched.length / tokens.length;
        if (score < 0.6 || matched.length < 2) continue;
        matches.push({
          filePath: file.filePath,
          nombre_original: path.basename(file.filePath),
          mime_type: mimeTypeForDocument(file.filePath),
          score,
        });
      }
    }
  }
  const unique = new Map();
  for (const match of preferPdfDocuments(matches)) {
    if (!unique.has(match.filePath)) unique.set(match.filePath, match);
  }
  return preferPdfDocuments([...unique.values()]);
}

function documentDescriptor(documentInfo, index, baseUrl) {
  return {
    index,
    nombre_original: documentInfo.nombre_original || path.basename(documentInfo.filePath),
    mime_type: documentInfo.mime_type || mimeTypeForDocument(documentInfo.filePath),
    documento_tipo: path.extname(documentInfo.filePath).toLowerCase() === '.pdf' ? 'pdf' : 'excel',
    url: `${baseUrl}?inline=1&documento_index=${index}`,
  };
}

function uniqueDocuments(documents) {
  const unique = new Map();
  for (const doc of documents || []) {
    if (!doc?.filePath || unique.has(doc.filePath)) continue;
    unique.set(doc.filePath, doc);
  }
  return preferPdfDocuments([...unique.values()]);
}

function fuenteFromPublicationRow(row) {
  if (!row.fuente_id) return null;
  return {
    id: row.fuente_id,
    familia: row.fuente_familia,
    titulo: row.fuente_titulo,
    documento_tipo: row.documento_tipo,
    nombre_original: row.nombre_original,
    nombre_archivado: row.nombre_archivado,
    ruta_relativa: row.ruta_relativa,
    sha256: row.sha256,
    mime_type: row.mime_type,
    bytes: row.bytes,
    vigencia_desde: row.vigencia_desde,
    vigencia_hasta: row.vigencia_hasta,
    vigencia_documental: row.vigencia_documental,
    estado: row.fuente_estado,
    subido_por: row.subido_por,
    creado_en: row.creado_en,
  };
}

function resolvePublicationDocuments(row) {
  const docs = [];
  const fuente = fuenteFromPublicationRow(row);
  if (fuente) {
    docs.push({ filePath: resolveFuentePath(fuente), nombre_original: fuente.nombre_original, mime_type: fuente.mime_type });
  }
  const legacyDocument = findLegacyDocumentBySha(row.fuente_sha256);
  if (legacyDocument) docs.push(legacyDocument);
  docs.push(...findLegacyDocumentsByPublicationName(row.fuente_nombre));
  return uniqueDocuments(docs);
}

function resolveModuleDocuments(key) {
  if (key === 'lista_precios') return findLegacyDocumentsByPublicationName('Lista de Precios');
  if (key === 'ofertas_vigentes' || key === 'moviles') {
    return findLegacyDocumentsByPublicationName('Tabla Ofertas Financiamiento 23al29julio 2026 + Lista de Precios 28mayo-31julio 2026 + Business Red PYMES');
  }
  return [];
}

function sendDocumentFile(req, res, documentInfo) {
  const filePath = documentInfo.filePath;
  const filename = documentInfo.nombre_original || path.basename(filePath);
  if (String(req.query.inline || '') === '1') {
    res.setHeader('Content-Type', documentInfo.mime_type || mimeTypeForDocument(filePath));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    return res.sendFile(filePath);
  }
  return res.download(filePath, filename);
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

function baseCatalogUploadError(familia, originalName) {
  const name = String(originalName || '').trim();
  if (BASE_PDF_FAMILIES.has(familia) && !/\.pdf$/i.test(name)) {
    return {
      codigo: 'formato_base_pdf_invalido',
      error: 'Este catalogo base requiere el PDF oficial. Las tablas Excel de ofertas o precios van en su modulo correspondiente.',
    };
  }
  if (familia === 'affinity' && !/\.pdf$/i.test(name)) {
    return {
      codigo: 'formato_affinity_pdf_invalido',
      error: 'Affinity solo acepta el PDF oficial del programa.',
    };
  }
  if (familia === 'moviles' && /nuevas?\s+ofertas|accesorios/i.test(name)) {
    return {
      codigo: 'fuente_moviles_base_incompatible',
      error: 'Planes Moviles base usa el PDF oficial de planes vigentes. Los PDFs de ofertas o accesorios van en Ofertas Vigentes > Ofertas Moviles.',
    };
  }
  return null;
}

function emptyMovilModule(titulo) {
  return { titulo, filas: [] };
}

function combineMovilParsedSources(parsedSources, fuentes) {
  const combined = {
    tipo: 'planes_moviles_compuesto',
    fuentes: fuentes.map((fuente) => ({
      id: fuente.id,
      nombre_original: fuente.nombre_original,
      sha256: fuente.sha256,
    })),
    modulos: {
      planes_individuales: emptyMovilModule('Planes individuales Business/PYMES'),
      planes_multilinea_opciones: emptyMovilModule('Planes multilinea Business RED'),
      planes_multilinea_byop_ban: emptyMovilModule('Planes multilinea BYOP-BAN'),
      referencia_operativa: emptyMovilModule('Referencia operativa'),
      segmento_no_incluido: emptyMovilModule('Segmento no incluido'),
      contenido_temporal_excluido: emptyMovilModule('Contenido temporal excluido'),
      revision_manual: emptyMovilModule('Revision manual'),
    },
    auditoria_original: { total_filas: 0, duplicados_exactos_total: 0, duplicados_exactos: [] },
    registros_normalizados_total: 0,
    resumen: {},
  };

  for (const parsed of parsedSources) {
    for (const [key, module] of Object.entries(combined.modulos)) {
      module.filas.push(...(parsed?.modulos?.[key]?.filas || []));
    }
    combined.auditoria_original.total_filas += Number(parsed?.auditoria_original?.total_filas || 0);
    combined.auditoria_original.duplicados_exactos_total += Number(parsed?.auditoria_original?.duplicados_exactos_total || 0);
    combined.auditoria_original.duplicados_exactos.push(...(parsed?.auditoria_original?.duplicados_exactos || []));
    combined.registros_normalizados_total += Number(parsed?.registros_normalizados_total || 0);
  }

  combined.resumen = {
    planes_individuales_unicos: combined.modulos.planes_individuales.filas.length,
    familias_multilinea: 5,
    opciones_multilinea_publicables: combined.modulos.planes_multilinea_opciones.filas.length,
    planes_multilinea_byop_ban: combined.modulos.planes_multilinea_byop_ban.filas.length,
    referencias_operativas: combined.modulos.referencia_operativa.filas.length,
    segmento_no_incluido_gobierno: combined.modulos.segmento_no_incluido.filas.filter((row) => row.segmento_no_incluido === 'gobierno').length,
    candidatos_publicos: combined.modulos.planes_individuales.filas.length
      + combined.modulos.planes_multilinea_opciones.filas.length
      + combined.modulos.planes_multilinea_byop_ban.filas.length,
  };

  return combined;
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

function fechaDesdeNombreFuenteBase(fuente) {
  const nombre = String(fuente?.nombre_original || fuente?.nombre_archivado || '').trim();
  const matches = [...nombre.matchAll(/(?:^|[^0-9])(\d{6})(?:[^0-9]|$)/g)].map((match) => match[1]);
  const fechasValidas = [];
  for (const token of matches) {
    const year = 2000 + Number(token.slice(0, 2));
    const month = Number(token.slice(2, 4));
    const day = Number(token.slice(4, 6));
    const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isRealIsoDate(value)) fechasValidas.push(value);
  }
  const unicas = [...new Set(fechasValidas)];
  if (unicas.length !== 1) return null;
  return unicas[0];
}

function fechaActualizacionBase({ body, fuente }) {
  const manual = body?.fecha_actualizacion_base;
  if (manual != null && String(manual).trim() !== '') {
    const value = String(manual).trim();
    if (!isRealIsoDate(value)) {
      throw Object.assign(new Error('fecha_actualizacion_base_invalida'), { code: 'fecha_actualizacion_base_invalida' });
    }
    return { value, origen: 'entrada_manual_confirmada' };
  }
  const detectada = fechaDesdeNombreFuenteBase(fuente);
  if (detectada) return { value: detectada, origen: 'nombre_archivo_confirmado' };
  throw Object.assign(new Error('fecha_actualizacion_base_requerida'), { code: 'fecha_actualizacion_base_requerida' });
}

const INALAMBRICO_MESES = new Map([
  ['ene', 1], ['enero', 1],
  ['feb', 2], ['febrero', 2],
  ['mar', 3], ['marzo', 3],
  ['abr', 4], ['abril', 4],
  ['may', 5], ['mayo', 5],
  ['jun', 6], ['junio', 6],
  ['jul', 7], ['julio', 7],
  ['ago', 8], ['agosto', 8],
  ['sep', 9], ['sept', 9], ['set', 9], ['septiembre', 9], ['setiembre', 9],
  ['oct', 10], ['octubre', 10],
  ['nov', 11], ['noviembre', 11],
  ['dic', 12], ['diciembre', 12],
]);

export function inalambricoVigenciaDesdeNombre(nombre) {
  const text = String(nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = text.match(/(\d{1,2})\s*(?:al|a|-)\s*(\d{1,2})\s*(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|septiembre|setiembre|sept|sep|set|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\s*(20\d{2}|\d{2})/i);
  if (!match) return null;
  const desdeDia = Number(match[1]);
  const hastaDia = Number(match[2]);
  const mes = INALAMBRICO_MESES.get(match[3]);
  const year = match[4].length === 2 ? 2000 + Number(match[4]) : Number(match[4]);
  const desde = `${year}-${String(mes).padStart(2, '0')}-${String(desdeDia).padStart(2, '0')}`;
  const hasta = `${year}-${String(mes).padStart(2, '0')}-${String(hastaDia).padStart(2, '0')}`;
  if (!mes || !isRealIsoDate(desde) || !isRealIsoDate(hasta)) return null;
  return { desde: `${desde}T04:00:00.000Z`, hasta: `${hasta}T04:00:00.000Z` };
}

export function buildInalambricoModuleContent(seccionKey, contenidoActual = {}, parsed = {}) {
  const secciones = Array.isArray(parsed.secciones) ? parsed.secciones : [];
  const claroOficina = secciones.find((section) => section.key === 'claro_oficina') || {};
  const internetOnTheGo = secciones.find((section) => section.key === 'internet_on_the_go') || {};
  const common = {
    financiamiento_of: parsed.financiamiento_of || [],
    financiamiento_gu: parsed.financiamiento_gu || [],
    ofertas_especiales: parsed.ofertas_especiales || [],
    ofertas_especiales_normalizadas: parsed.ofertas_especiales_normalizadas || [],
  };

  if (seccionKey === 'equipos_precios_inalambrico') {
    return {
      ...contenidoActual,
      secciones,
      ...common,
    };
  }
  if (seccionKey === 'claro_oficina') {
    return {
      ...contenidoActual,
      equipos: claroOficina.equipos || contenidoActual.equipos || [],
      ...common,
    };
  }
  if (seccionKey === 'internet_on_the_go') {
    return {
      ...contenidoActual,
      equipos: internetOnTheGo.equipos || contenidoActual.equipos || [],
      ...common,
    };
  }
  if (seccionKey === 'iot_telemetria') {
    return {
      ...contenidoActual,
      secciones_detectadas: parsed.secciones_detectadas || [],
    };
  }
  return contenidoActual;
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
      `SELECT id, seccion_key, contenido
       FROM public.planes_modulos
       WHERE pagina='inalambrico' AND activo=true
       ORDER BY orden, id`
    );
    if (modulos.length !== 4) throw new Error('La publicación inalámbrica no tiene los cuatro módulos esperados. No se reemplazó nada.');
    const actualizados = [];
    for (const modulo of modulos) {
      const contenido = buildInalambricoModuleContent(modulo.seccion_key, modulo.contenido || {}, parsed);
      const { rows } = await client.query(
        `UPDATE public.planes_modulos
         SET contenido=$1, vigencia_desde=$2, vigencia_hasta=$3, boletin_ref=$4, updated_by=$5
         WHERE id=$6
         RETURNING id, seccion_key`,
        [JSON.stringify(contenido), vigencia.desde, vigencia.hasta, fuente.nombre_original, usuario, modulo.id]
      );
      actualizados.push(rows[0]);
    }
    await client.query(
      `UPDATE public.fuentes_comerciales
       SET vigencia_desde=$1, vigencia_hasta=$2, vigencia_documental='vigente', estado='activa'
       WHERE id=$3`,
      [vigencia.desde, vigencia.hasta, fuente.id]
    );
    await client.query('COMMIT');
    return { vigencia, modulos: actualizados.map(row => row.seccion_key) };
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
    const offerBenefitSources = [];
    for (const row of rows) {
      const filePath = sourcePath(row);
      if (!fs.existsSync(filePath)) { warnings.push(`${row.nombre_original}: archivo archivado no encontrado.`); continue; }
      let parsed = null;
      if (row.documento_tipo === 'pdf') {
        try { parsed = await runParser('parse_planes_fijos_pdf.py', filePath); } catch (error) { warnings.push(`${row.nombre_original}: ${error.message}`); }
        try {
          const extracted = await runParser('extract_pdf_text.py', filePath);
          offerBenefitSources.push({ fuente: row, text: extracted.text || '' });
        } catch (error) {
          warnings.push(`${row.nombre_original}: no se pudo extraer texto para Ofertas/Beneficios (${error.code || error.message}).`);
        }
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
    const reglasComerciales = normalizeFijoOfferBenefitSources(offerBenefitSources);
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
    previews.set(previewId, { created: Date.now(), rows, sourceResults, resumen, planAplicacion, reglasComerciales, warnings, usuario: uname(req) });
    res.json({
      ok: true,
      preview_id: previewId,
      expira_en_min: 30,
      fuentes: sourceResults,
      resumen,
      reglas_normalizadas: reglasComerciales.reglas_normalizadas,
      reglas_compuestas: reglasComerciales.reglas_compuestas,
      benefits: reglasComerciales.benefits,
      contradicciones: reglasComerciales.contradicciones,
      relaciones_ambiguas: reglasComerciales.relaciones_ambiguas,
      resumen_reglas: reglasComerciales.resumen_reglas,
      resumen_compuestas: reglasComerciales.resumen_compuestas,
      advertencias: [...warnings, ...reglasComerciales.advertencias],
      publicable: planAplicacion.length > 0 && reglasComerciales.contradicciones.length === 0,
    });
  } catch (error) { res.status(500).json({ ok: false, codigo: 'preview_error', error: error.message }); }
});

fuentesComercialesRouter.post('/planes-fijos/reglas-compuestas/persistir', requireAdmin, async (req, res) => {
  gcPreviews();
  const preview = previews.get(String(req.body?.preview_id || ''));
  if (!preview) return res.status(404).json({ ok: false, codigo: 'preview_expirado', error: 'La vista previa expiró. Volvé a generarla.' });
  const estadoPublicacion = String(req.body?.estado_publicacion || 'aprobada');
  if (!['borrador', 'validada', 'aprobada'].includes(estadoPublicacion)) {
    return res.status(422).json({ ok: false, codigo: 'estado_publicacion_no_autorizado' });
  }
  try {
    const result = await persistCompositeRulesVersion({
      db: pool,
      dominio: 'fijo_benefits',
      estadoPublicacion,
      normalizadorVersion: 'fijo-benefits-compuestas-v1',
      actor: uname(req),
      fuentes: preview.sourceResults,
      reglasCompuestas: preview.reglasComerciales?.reglas_compuestas || [],
      relacionesAmbiguas: preview.reglasComerciales?.relaciones_ambiguas || [],
      contradicciones: preview.reglasComerciales?.contradicciones || [],
    });
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    const status = error.code === 'reglas_no_confirmadas' ? 422 : 500;
    res.status(status).json({ ok: false, codigo: error.code || 'persistencia_reglas_compuestas_error', error: error.message });
  }
});

fuentesComercialesRouter.get('/planes-fijos/reglas-compuestas/:versionId', requireAdmin, async (req, res) => {
  const versionId = String(req.params.versionId || '').trim();
  if (!UUID_RE.test(versionId)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const result = await readCompositeRulesVersion({ db: pool, versionId });
    if (!result) return res.status(404).json({ ok: false, codigo: 'version_no_encontrada' });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'lectura_reglas_compuestas_error', error: error.message });
  }
});

fuentesComercialesRouter.post('/planes-fijos/reglas-compuestas/:versionId/publicar-local', requireAdmin, async (req, res) => {
  const versionId = String(req.params.versionId || '').trim();
  if (!UUID_RE.test(versionId)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const result = await publishApprovedCompositeRulesVersion({
      db: pool,
      dominio: 'fijo_benefits',
      versionId,
      actor: uname(req),
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = ['version_no_encontrada', 'version_no_aprobada', 'reglas_no_publicables'].includes(error.code) ? 409 : 500;
    res.status(status).json({ ok: false, codigo: error.code || 'publicacion_local_reglas_compuestas_error', error: error.message });
  }
});

fuentesComercialesRouter.get('/planes-fijos/reglas-compuestas-publicadas/vigente', requireAdmin, async (_req, res) => {
  try {
    const result = await readCurrentPublishedCompositeRules({ db: pool, dominio: 'fijo_benefits' });
    if (!result) return res.status(404).json({ ok: false, codigo: 'version_vigente_no_disponible' });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'lectura_consumidor_reglas_compuestas_error', error: error.message });
  }
});

function diffSummary(diffs) {
  return diffs.reduce((acc, item) => ({ ...acc, [item.accion_version]: (acc[item.accion_version] || 0) + 1 }), { total: diffs.length });
}

// Affinity: PDF oficial -> texto -> reglas compuestas (mismo contrato que Benefits) -> version por dominio affinity_benefits.
fuentesComercialesRouter.post('/affinity/preview', requireAdmin, async (req, res) => {
  gcPreviews();
  const ids = Array.isArray(req.body?.fuente_ids) ? [...new Set(req.body.fuente_ids.map(String))] : [];
  if (ids.length !== 1) return res.status(400).json({ ok: false, codigo: 'fuente_affinity_requerida', error: 'Selecciona el PDF oficial de Affinity.' });
  if (!UUID_RE.test(ids[0])) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const { rows } = await pool.query(
      `SELECT id, familia, titulo, nombre_original, nombre_archivado, ruta_relativa, sha256, documento_tipo,
              vigencia_desde, vigencia_hasta, vigencia_documental
       FROM public.fuentes_comerciales WHERE id=$1`, [ids[0]]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    if (row.familia !== 'affinity' || row.documento_tipo !== 'pdf') {
      return res.status(422).json({ ok: false, codigo: 'familia_no_aplicable', error: 'Affinity solo analiza el PDF oficial archivado en la familia Affinity.' });
    }
    const filePath = sourcePath(row);
    if (!fs.existsSync(filePath)) return res.status(422).json({ ok: false, codigo: 'original_no_encontrado', error: 'No se encontro el PDF archivado.' });
    const extracted = await runParser('extract_pdf_text.py', filePath);
    // Las aclaraciones sobre contradicciones del documento las decide una persona y quedan con su traza.
    const resoluciones = {};
    for (const [tecnologia, valor] of Object.entries(req.body?.resoluciones || {})) {
      const megas = Number(valor?.megas ?? valor);
      if (!Number.isFinite(megas)) continue;
      resoluciones[tecnologia] = { megas, actor: uname(req), motivo: String(valor?.motivo || 'aclaracion_comercial').slice(0, 200) };
    }
    const reglasComerciales = normalizeAffinityBenefitSources([{ fuente: row, text: extracted.text || '' }], { resoluciones });
    const vigente = await readCurrentPublishedCompositeRules({ db: pool, dominio: AFFINITY_DOMINIO });
    const diferencias = diffCompositeRules({ dominio: AFFINITY_DOMINIO, previousRules: vigente?.reglas || [], currentRules: reglasComerciales.reglas_compuestas });
    const previewId = crypto.randomUUID();
    previews.set(previewId, { created: Date.now(), rows: [row], sourceResults: [sourceSummary(row)], reglasComerciales, warnings: [], usuario: uname(req), dominio: AFFINITY_DOMINIO });
    res.json({
      ok: true,
      preview_id: previewId,
      expira_en_min: 30,
      dominio: AFFINITY_DOMINIO,
      fuente: publicFuentePreview(row),
      vigencia: reglasComerciales.vigencia,
      paginas: extracted.pages || null,
      texto_muestra: String(extracted.text || '').slice(0, 1200),
      reglas_compuestas: reglasComerciales.reglas_compuestas,
      benefits: reglasComerciales.benefits,
      beneficios_affinity: reglasComerciales.beneficios_affinity,
      contradicciones: reglasComerciales.contradicciones,
      relaciones_ambiguas: reglasComerciales.relaciones_ambiguas,
      resumen_reglas: reglasComerciales.resumen_reglas,
      resumen_compuestas: reglasComerciales.resumen_compuestas,
      diferencias: diffSummary(diferencias),
      version_vigente: vigente?.version || null,
      advertencias: reglasComerciales.advertencias,
      resoluciones_aplicadas: resoluciones,
      publicable: reglasComerciales.publicable,
    });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'affinity_preview_error', error: error.message });
  }
});

fuentesComercialesRouter.post('/affinity/reglas-compuestas/persistir', requireAdmin, async (req, res) => {
  gcPreviews();
  const preview = previews.get(String(req.body?.preview_id || ''));
  if (!preview || preview.dominio !== AFFINITY_DOMINIO) return res.status(404).json({ ok: false, codigo: 'preview_expirado', error: 'La vista previa expiro. Volve a generarla.' });
  const estadoPublicacion = String(req.body?.estado_publicacion || 'borrador');
  if (!['borrador', 'validada', 'aprobada'].includes(estadoPublicacion)) {
    return res.status(422).json({ ok: false, codigo: 'estado_publicacion_no_autorizado' });
  }
  try {
    const result = await persistCompositeRulesVersion({
      db: pool,
      dominio: AFFINITY_DOMINIO,
      estadoPublicacion,
      normalizadorVersion: AFFINITY_NORMALIZADOR_VERSION,
      actor: uname(req),
      fuentes: preview.sourceResults,
      reglasCompuestas: preview.reglasComerciales?.reglas_compuestas || [],
      relacionesAmbiguas: preview.reglasComerciales?.relaciones_ambiguas || [],
      contradicciones: preview.reglasComerciales?.contradicciones || [],
    });
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    const status = error.code === 'reglas_no_confirmadas' ? 422 : 500;
    res.status(status).json({ ok: false, codigo: error.code || 'persistencia_affinity_error', error: error.message });
  }
});

fuentesComercialesRouter.get('/affinity/historial', requireAdmin, async (_req, res) => {
  try {
    const versiones = await listCompositeRulesVersions({ db: pool, dominio: AFFINITY_DOMINIO });
    res.json({ ok: true, dominio: AFFINITY_DOMINIO, versiones });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'historial_affinity_error', error: error.message });
  }
});

fuentesComercialesRouter.get('/affinity/reglas-compuestas-publicadas/vigente', requireAdmin, async (_req, res) => {
  try {
    const result = await readCurrentPublishedCompositeRules({ db: pool, dominio: AFFINITY_DOMINIO });
    if (!result) return res.status(404).json({ ok: false, codigo: 'version_vigente_no_disponible' });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'lectura_affinity_vigente_error', error: error.message });
  }
});

fuentesComercialesRouter.get('/affinity/reglas-compuestas/:versionId', requireAdmin, async (req, res) => {
  const versionId = String(req.params.versionId || '').trim();
  if (!UUID_RE.test(versionId)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const result = await readCompositeRulesVersion({ db: pool, versionId });
    if (!result || result.version?.dominio !== AFFINITY_DOMINIO) return res.status(404).json({ ok: false, codigo: 'version_no_encontrada' });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'lectura_affinity_error', error: error.message });
  }
});

fuentesComercialesRouter.post('/affinity/reglas-compuestas/:versionId/publicar-local', requireAdmin, async (req, res) => {
  const versionId = String(req.params.versionId || '').trim();
  if (!UUID_RE.test(versionId)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const result = await publishApprovedCompositeRulesVersion({ db: pool, dominio: AFFINITY_DOMINIO, versionId, actor: uname(req) });
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = ['version_no_encontrada', 'version_no_aprobada', 'reglas_no_publicables'].includes(error.code) ? 409 : 500;
    res.status(status).json({ ok: false, codigo: error.code || 'publicacion_affinity_error', error: error.message });
  }
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
    const { rows } = await dbPool.query(
      `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
              vigencia_desde, vigencia_hasta, vigencia_documental, estado
       FROM public.fuentes_comerciales WHERE id=$1 LIMIT 1`,
      [id]
    );
    const fuente = rows[0];
    if (!fuente) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    if (!['fijos', 'claro_tv', 'ofertas_fijo', 'moviles', 'inalambrico_iot'].includes(fuente.familia) || fuente.documento_tipo !== 'pdf') {
      return res.status(422).json({ ok: false, codigo: 'archivo_incompatible' });
    }
    const baseFuenteError = baseCatalogUploadError(fuente.familia, fuente.nombre_original);
    if (baseFuenteError) return res.status(422).json({ ok: false, ...baseFuenteError });

    let fechaBase;
    try {
      fechaBase = fechaActualizacionBase({ body: req.body, fuente });
    } catch (error) {
      return res.status(400).json({ ok: false, codigo: error.code || 'fecha_actualizacion_base_invalida' });
    }

    let fuentes = [fuente];
    if (fuente.familia === 'moviles') {
      const companionIds = Array.isArray(req.body?.fuente_ids)
        ? [...new Set(req.body.fuente_ids.map(String).filter((item) => item !== id))]
        : [];
      if (!companionIds.length) return res.status(400).json({ ok: false, codigo: 'fuente_byop_requerida' });
      if (companionIds.some((item) => !UUID_RE.test(item))) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
      const companion = await dbPool.query(
        `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
                vigencia_desde, vigencia_hasta, vigencia_documental, estado
         FROM public.fuentes_comerciales WHERE id = ANY($1::uuid[])`,
        [companionIds]
      );
      if (companion.rows.length !== companionIds.length) return res.status(404).json({ ok: false, codigo: 'fuente_complementaria_no_encontrada' });
      if (companion.rows.some((row) => row.familia !== 'moviles' || row.documento_tipo !== 'pdf')) {
        return res.status(422).json({ ok: false, codigo: 'archivo_complementario_incompatible' });
      }
      fuentes = [fuente, ...companion.rows];
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
      if (fuente.familia === 'moviles') {
        const parsedSources = [];
        for (const fuenteItem of fuentes) {
          const sourcePath = resolveFuentePath(fuenteItem, { uploadDir });
          parsedSources.push(await parserRunner('parse_planes_moviles_pdf.py', sourcePath));
        }
        parsed = combineMovilParsedSources(parsedSources, fuentes);
      } else if (fuente.familia === 'inalambrico_iot') {
        parsed = await parserRunner('parse_equipos_pdf.py', filePath);
      } else {
        parsed = await parserRunner('parse_planes_fijos_pdf.py', filePath);
      }
    } catch (error) {
      const codigo = PARSER_ERROR_CODES.has(error.code) ? error.code : 'parser_error';
      logger.error?.('[fuentes-comerciales/preview-base/parser]', codigo);
      return res.status(422).json({ ok: false, codigo });
    }

    const vigenciaDetectada = fuente.familia === 'inalambrico_iot' ? inalambricoVigenciaDesdeNombre(fuente.nombre_original) : null;
    const anteriores = await dbPool.query(
      `SELECT DISTINCT ON (categoria) categoria, modulos_generados, fuente_sha256, fuente_nombre, fuente_comercial_id, fecha_actualizacion_base
       FROM public.bases_informativas_publicaciones
       WHERE estado = 'publicada'
       ORDER BY categoria, numero DESC`
    );
    const publicacionesAnteriores = Object.fromEntries(anteriores.rows.map((row) => [row.categoria, row]));
    const historicalParses = new Map();
    for (const previous of anteriores.rows) {
      if (!['fijo', 'claro_tv'].includes(previous.categoria)) continue;
      const legacy = (previous.modulos_generados || []).some((module) =>
        (module.contenido?.filas || []).some((row) => row.llave_normalizada));
      if (!legacy) continue;
      const original = findLegacyDocumentBySha(previous.fuente_sha256);
      if (!original) return res.status(422).json({ ok: false, codigo: 'fuente_anterior_requerida_para_comparar' });
      if (!historicalParses.has(previous.fuente_sha256)) {
        historicalParses.set(previous.fuente_sha256, await parserRunner('parse_planes_fijos_pdf.py', original.filePath));
      }
      const normalized = previewBuilder({
        parsed: historicalParses.get(previous.fuente_sha256),
        fuente: { id: previous.fuente_comercial_id, sha256: previous.fuente_sha256,
          nombre_original: previous.fuente_nombre, fecha_actualizacion_base: previous.fecha_actualizacion_base },
      });
      const category = normalized.previews.find((item) => item.categoria === previous.categoria);
      if (!category) return res.status(422).json({ ok: false, codigo: 'fuente_anterior_no_comparable' });
      publicacionesAnteriores[previous.categoria] = category;
    }
    const preview = previewBuilder({
      parsed,
      publicacionesAnteriores,
      fuente: {
        id: fuente.id,
        nombre_original: fuente.nombre_original,
        sha256: fuente.sha256,
        fecha_actualizacion_base: fechaBase.value,
        vigencia_desde: fuente.vigencia_desde || vigenciaDetectada?.desde || null,
        vigencia_hasta: fuente.vigencia_hasta || vigenciaDetectada?.hasta || null,
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
      reglas_normalizadas: item.reglas_normalizadas || [],
      resumen_reglas: item.resumen_reglas || { total: 0, por_tipo: {}, por_confianza: {} },
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
        ...Object.fromEntries(Object.entries(previews).map(([categoria, item]) => [categoria, item.candidatos_publicos?.length || 0])),
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
    const previewsToSave = Object.values(previewPayload.previews || {});
    if (!previewsToSave.length) return res.status(422).json({ ok: false, codigo: 'preview_incompleto' });

    try {
      const guardadas = [];
      for (const item of previewsToSave) {
        const auditoria = {
          ...(item.auditoria || {}),
          reglas_normalizadas: item.reglas_normalizadas || item.auditoria?.reglas_normalizadas || [],
          resumen_reglas: item.resumen_reglas || item.auditoria?.resumen_reglas || { total: 0, por_tipo: {}, por_confianza: {} },
        };
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
            jsonbParam(auditoria, {}),
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

async function loadPublicationDocumentRow(id) {
  const { rows } = await pool.query(
    `SELECT p.id, p.fuente_comercial_id, p.fuente_nombre, p.fuente_sha256,
        f.id AS fuente_id, f.familia AS fuente_familia, f.titulo AS fuente_titulo, f.documento_tipo,
        f.nombre_original, f.nombre_archivado, f.ruta_relativa, f.sha256,
        f.mime_type, f.bytes, f.vigencia_desde, f.vigencia_hasta, f.vigencia_documental,
        f.estado AS fuente_estado, f.subido_por, f.creado_en
       FROM public.bases_informativas_publicaciones p
       LEFT JOIN LATERAL (
         SELECT *
           FROM public.fuentes_comerciales f
          WHERE f.id = p.fuente_comercial_id
             OR (p.fuente_comercial_id IS NULL AND f.sha256 = p.fuente_sha256)
          ORDER BY f.creado_en DESC
          LIMIT 1
       ) f ON true
      WHERE p.id=$1
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

fuentesComercialesRouter.get('/bases-informativas/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.numero, p.categoria, p.estado, p.version_etiqueta, p.fuente_comercial_id,
          p.fuente_nombre, p.fuente_sha256, p.fecha_actualizacion_base, p.candidatos_publicos,
          p.modulos_generados, p.validacion, p.diferencias, p.observaciones,
          p.cargada_por, p.cargada_en, p.validada_por, p.validada_en, p.aprobada_por,
          p.aprobada_en, p.publicada_por, p.publicada_en, p.reemplazada_en,
          f.familia AS fuente_familia, f.titulo AS fuente_titulo, f.documento_tipo,
          f.nombre_original, f.nombre_archivado, f.ruta_relativa, f.sha256,
          f.mime_type, f.bytes, f.vigencia_desde, f.vigencia_hasta, f.vigencia_documental,
          f.estado AS fuente_estado, f.subido_por, f.creado_en
         FROM public.bases_informativas_publicaciones p
         LEFT JOIN LATERAL (
           SELECT *
             FROM public.fuentes_comerciales f
            WHERE f.id = p.fuente_comercial_id
               OR (p.fuente_comercial_id IS NULL AND f.sha256 = p.fuente_sha256)
            ORDER BY f.creado_en DESC
            LIMIT 1
         ) f ON true
        WHERE p.id=$1
        LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ ok: false, codigo: 'publicacion_no_encontrada' });
    const publicacion = sanitizeBasePublicacion(row);
    publicacion.candidatos_publicos = Array.isArray(row.candidatos_publicos) ? row.candidatos_publicos : [];
    publicacion.modulos_generados = Array.isArray(row.modulos_generados) ? row.modulos_generados : [];
    publicacion.fuente = row.fuente_comercial_id ? publicFuente({
      id: row.fuente_comercial_id,
      familia: row.fuente_familia,
      titulo: row.fuente_titulo,
      documento_tipo: row.documento_tipo,
      nombre_original: row.nombre_original,
      nombre_archivado: row.nombre_archivado,
      ruta_relativa: row.ruta_relativa,
      sha256: row.sha256,
      mime_type: row.mime_type,
      bytes: row.bytes,
      vigencia_desde: row.vigencia_desde,
      vigencia_hasta: row.vigencia_hasta,
      vigencia_documental: row.vigencia_documental,
      estado: row.fuente_estado,
      subido_por: row.subido_por,
      creado_en: row.creado_en,
    }) : null;
    res.json({ ok: true, publicacion });
  } catch (error) {
    res.status(500).json({ ok: false, codigo: 'error_interno', error: error.message });
  }
});

fuentesComercialesRouter.get('/modulos/:key/documentos', requireAdmin, async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!['lista_precios', 'ofertas_vigentes', 'moviles'].includes(key)) return res.status(404).json({ ok: false, codigo: 'modulo_sin_documentos' });
  const documents = resolveModuleDocuments(key);
  if (!documents.length) return res.status(404).json({ ok: false, codigo: 'documento_no_encontrado' });
  res.json({ ok: true, documentos: documents.map((doc, index) => documentDescriptor(doc, index, `/api/fuentes-comerciales/modulos/${encodeURIComponent(key)}/documento`)) });
});

fuentesComercialesRouter.get('/modulos/:key/documento', requireAdmin, async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!['lista_precios', 'ofertas_vigentes', 'moviles'].includes(key)) return res.status(404).json({ ok: false, codigo: 'modulo_sin_documentos' });
  const documents = resolveModuleDocuments(key);
  const index = Number(req.query.documento_index || 0);
  const documentInfo = documents[Number.isInteger(index) && index >= 0 ? index : 0];
  if (!documentInfo) return res.status(404).json({ ok: false, codigo: 'documento_no_encontrado' });
  return sendDocumentFile(req, res, documentInfo);
});

fuentesComercialesRouter.get('/bases-informativas/:id/documentos', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const row = await loadPublicationDocumentRow(id);
    if (!row) return res.status(404).json({ ok: false, codigo: 'publicacion_no_encontrada' });
    const documents = resolvePublicationDocuments(row);
    if (!documents.length) return res.status(404).json({ ok: false, codigo: 'documento_no_encontrado', sha256: row.fuente_sha256 || null });
    res.json({ ok: true, documentos: documents.map((doc, index) => documentDescriptor(doc, index, `/api/fuentes-comerciales/bases-informativas/${encodeURIComponent(id)}/documento`)) });
  } catch (error) {
    if (error.code === 'archivo_fuera_directorio' || error.code === 'archivo_no_encontrado') return res.status(404).json({ ok: false, codigo: error.code });
    res.status(500).json({ ok: false, codigo: 'error_interno', error: error.message });
  }
});

fuentesComercialesRouter.get('/bases-informativas/:id/documento', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const row = await loadPublicationDocumentRow(id);
    if (!row) return res.status(404).json({ ok: false, codigo: 'publicacion_no_encontrada' });
    const documents = resolvePublicationDocuments(row);
    const index = Number(req.query.documento_index || 0);
    const documentInfo = documents[Number.isInteger(index) && index >= 0 ? index : 0];
    if (documentInfo) return sendDocumentFile(req, res, documentInfo);
    return res.status(404).json({ ok: false, codigo: 'documento_no_encontrado', sha256: row.fuente_sha256 || null });
  } catch (error) {
    if (error.code === 'archivo_fuera_directorio' || error.code === 'archivo_no_encontrado') return res.status(404).json({ ok: false, codigo: error.code });
    res.status(500).json({ ok: false, codigo: 'error_interno', error: error.message });
  }
});

fuentesComercialesRouter.get('/:id/documento', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const { rows } = await pool.query(
      `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
        mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
       FROM public.fuentes_comerciales WHERE id=$1 LIMIT 1`,
      [id]
    );
    const fuente = rows[0];
    if (!fuente) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    return sendDocumentFile(req, res, { filePath: resolveFuentePath(fuente), nombre_original: fuente.nombre_original, mime_type: fuente.mime_type });
  } catch (error) {
    if (error.code === 'archivo_fuera_directorio' || error.code === 'archivo_no_encontrado') return res.status(404).json({ ok: false, codigo: error.code });
    res.status(500).json({ ok: false, codigo: 'error_interno', error: error.message });
  }
});

fuentesComercialesRouter.post('/:id/equipos-preview', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const { rows } = await pool.query(
      `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
        mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
       FROM public.fuentes_comerciales WHERE id=$1 LIMIT 1`,
      [id]
    );
    const fuente = rows[0];
    if (!fuente) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    if (fuente.familia !== 'equipos' || fuente.documento_tipo !== 'excel') return res.status(422).json({ ok: false, codigo: 'archivo_incompatible' });
    const buffer = fs.readFileSync(resolveFuentePath(fuente));
    const parsed = parsearExcel(buffer);
    if (!parsed.items.length) return res.status(422).json({ ok: false, codigo: 'formato_equipos_invalido', error: 'El Excel no contiene equipos reconocibles con el formato oficial.' });
    res.json({
      ok: true,
      fuente: publicFuente(fuente),
      preview: buildListaPreciosPreview(parsed),
    });
  } catch (error) {
    if (error.code === 'archivo_fuera_directorio' || error.code === 'archivo_no_encontrado') return res.status(404).json({ ok: false, codigo: error.code });
    res.status(500).json({ ok: false, codigo: 'error_interno', error: error.message });
  }
});

fuentesComercialesRouter.post('/:id/equipos-publicar', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, codigo: 'uuid_invalido' });
  try {
    const { rows } = await pool.query(
      `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
        mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
       FROM public.fuentes_comerciales WHERE id=$1 LIMIT 1`,
      [id]
    );
    const fuente = rows[0];
    if (!fuente) return res.status(404).json({ ok: false, codigo: 'fuente_no_encontrada' });
    if (fuente.familia !== 'equipos' || fuente.documento_tipo !== 'excel') return res.status(422).json({ ok: false, codigo: 'archivo_incompatible' });
    const buffer = fs.readFileSync(resolveFuentePath(fuente));
    const publicacion = await importarListaEquiposDesdeFuente({
      buffer,
      nombreArchivo: fuente.nombre_original,
      usuario: uname(req),
      notas: `Fuente comercial: ${fuente.id}`,
      fuenteComercialId: fuente.id,
    });
    await pool.query(
      `UPDATE public.fuentes_comerciales
       SET estado='activa', notas=NULL, vigencia_documental='vigente'
       WHERE id=$1`,
      [fuente.id]
    );
    res.json({ ok: true, fuente: publicFuente(fuente), publicacion });
  } catch (error) {
    if (error.code === 'formato_equipos_invalido' || error.code === 'demasiados_equipos') return res.status(422).json({ ok: false, codigo: error.code, error: error.message });
    if (error.code === 'archivo_fuera_directorio' || error.code === 'archivo_no_encontrado') return res.status(404).json({ ok: false, codigo: error.code });
    res.status(500).json({ ok: false, codigo: 'error_interno', error: error.message });
  }
});

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
      const publicacion = rows[0];
      const firstModule = Array.isArray(publicacion?.modulos_generados) ? publicacion.modulos_generados[0] : null;
      if (publicacion?.fuente_comercial_id) {
        await dbPool.query(
          `UPDATE public.fuentes_comerciales
             SET estado='activa',
                 vigencia_documental='vigente',
                 vigencia_desde=COALESCE(vigencia_desde, NULLIF($2, '')::date),
                 vigencia_hasta=COALESCE(vigencia_hasta, NULLIF($3, '')::date),
                 notas=NULL
           WHERE id=$1`,
          [publicacion.fuente_comercial_id, dateOnly(firstModule?.vigencia_desde), dateOnly(firstModule?.vigencia_hasta)]
        );
      }
      res.json({ ok: true, publicacion: sanitizeBasePublicacion(publicacion) });
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

fuentesComercialesRouter.get('/alertas-vencimiento', async (req, res) => {
  const dias = Number(req.query.dias);
  const diasAlerta = Number.isInteger(dias) && dias >= 0 && dias <= 365 ? dias : DIAS_ALERTA_VENCIMIENTO;
  try {
    const { rows } = await pool.query(`SELECT DISTINCT ON (familia) id, familia, nombre_original, vigencia_desde, vigencia_hasta, vigencia_documental, estado, creado_en
      FROM public.fuentes_comerciales
      ORDER BY familia, creado_en DESC`);
    res.json({ ok: true, ...buildVigenciaAlertas({ fuentes: rows, diasAlerta }) });
  } catch (e) {
    res.status(500).json({ ok: false, codigo: 'alertas_vencimiento_error', error: e.message });
  }
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
  const modoPublicacion = String(req.body.publicacion_modo || '').trim();
  const vigenciaDesde = String(req.body.vigencia_desde || '').trim() || null;
  const vigenciaHasta = String(req.body.vigencia_hasta || '').trim() || null;

  if (!FAMILIAS.has(familia)) return res.status(400).json({ ok: false, codigo: 'familia_invalida' });
  if (!req.file?.buffer?.length) return res.status(400).json({ ok: false, codigo: 'archivo_requerido' });
  if (vigenciaDesde && !ISO_DATE_RE.test(vigenciaDesde)) return res.status(422).json({ ok: false, codigo: 'vigencia_desde_invalida' });
  if (vigenciaHasta && !ISO_DATE_RE.test(vigenciaHasta)) return res.status(422).json({ ok: false, codigo: 'vigencia_hasta_invalida' });
  if (familia === 'equipos' && !/\.(xlsx|xls)$/i.test(req.file.originalname)) return res.status(422).json({ ok: false, codigo: 'formato_equipos_invalido', error: 'Lista de Equipos requiere un Excel oficial (.xlsx o .xls).' });
  const baseUploadError = baseCatalogUploadError(familia, req.file.originalname);
  if (baseUploadError) return res.status(422).json({ ok: false, ...baseUploadError });
  const uploadSha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  try {
    const titulo = deriveFuenteTitulo({ originalName: req.file.originalname, familia });
    const existing = await pool.query(
      `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
          mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
         FROM public.fuentes_comerciales
        WHERE sha256=$1 OR familia=$2
        ORDER BY creado_en DESC
        LIMIT 500`,
      [uploadSha256, familia]
    );
    const versioning = classifyFuenteComercialUpload({
      existingSources: existing.rows,
      familia,
      nombre_original: req.file.originalname,
      sha256: uploadSha256,
      vigencia_desde: vigenciaDesde,
      vigencia_hasta: vigenciaHasta,
    });
    if (versioning.action === 'block') {
      return res.status(409).json({
        ok: false,
        codigo: versioning.codigo,
        tipo: versioning.tipo,
        revision_status: versioning.codigo,
        duplicate: true,
        sha256: uploadSha256,
        matched_source_id: versioning.duplicate?.id || null,
        matched_revision_id: versioning.duplicate?.id || null,
        reason: versioning.message,
        mensaje: versioning.message,
        fuente: versioning.duplicate ? publicFuente(versioning.duplicate) : null,
        versionado: {
          tipo: versioning.tipo,
          revision_numero: versioning.revision_numero,
        },
      });
    }
    let fuenteRow = null;
    if (versioning.action === 'reuse_failed') {
      fuenteRow = versioning.previous;
    } else {
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
          vigenciaDesde,
          vigenciaHasta,
          'pendiente_confirmacion',
          null,
          uname(req),
        ]
      );
      fuenteRow = rows[0];
    }
    let publicacion = null;
    if (familia === 'equipos' && modoPublicacion !== 'borrador') {
      publicacion = await importarListaEquiposDesdeFuente({
        buffer: req.file.buffer,
        nombreArchivo: req.file.originalname,
        usuario: uname(req),
        notas: `Fuente comercial: ${fuenteRow.id}`,
        fuenteComercialId: fuenteRow.id,
      });
      await pool.query(`UPDATE public.fuentes_comerciales SET estado='activa', notas=NULL WHERE id=$1`, [fuenteRow.id]);
    }
    if (familia === 'inalambrico_iot' && fuenteRow.documento_tipo === 'pdf' && modoPublicacion !== 'borrador') {
      try {
        const parsed = await runParser('parse_equipos_pdf.py', sourcePath(fuenteRow));
        publicacion = await applyInalambricoFuenteAutomatica({ fuente: fuenteRow, parsed, usuario: uname(req) });
      } catch (error) {
        await pool.query(`UPDATE public.fuentes_comerciales SET notas=$1 WHERE id=$2`, [error.message, fuenteRow.id]);
        fuenteRow = { ...fuenteRow, notas: error.message };
        return res.status(422).json({
          ok: false,
          codigo: error.code || 'validacion_inalambrico_fallida',
          error: error.message,
          duplicate: false,
          sha256: uploadSha256,
          revision_status: versioning.codigo,
          matched_source_id: versioning.previous?.id || null,
          matched_revision_id: fuenteRow.id,
          reason: versioning.message,
          fuente: publicFuente(fuenteRow),
        });
      }
    }
    res.status(201).json({
      ok: true,
      codigo: versioning.codigo,
      tipo: versioning.tipo,
      revision_status: versioning.codigo,
      duplicate: false,
      sha256: uploadSha256,
      matched_source_id: versioning.previous?.id || null,
      matched_revision_id: fuenteRow.id,
      reason: versioning.message,
      mensaje: versioning.message,
      fuente: publicFuente(fuenteRow),
      publicacion,
      versionado: {
        tipo: versioning.tipo,
        revision_numero: versioning.revision_numero,
        identidad_comercial_key: versioning.identidad_comercial_key,
        fuente_anterior_id: versioning.previous?.id || null,
      },
    });
  } catch (e) {
    if (e.code === '23505') {
      const { rows } = await pool.query(
        `SELECT id, familia, titulo, documento_tipo, nombre_original, nombre_archivado, ruta_relativa, sha256,
          mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental, notas, estado, subido_por, creado_en
         FROM public.fuentes_comerciales WHERE sha256=$1 LIMIT 1`,
        [uploadSha256]
      ).catch(() => ({ rows: [] }));
      return res.status(409).json({
        ok: false,
        codigo: 'fuente_duplicada',
        tipo: 'archivo_identico_hash',
        revision_status: 'fuente_duplicada',
        duplicate: true,
        sha256: uploadSha256,
        matched_source_id: rows[0]?.id || null,
        matched_revision_id: rows[0]?.id || null,
        reason: 'El archivo ya existe por hash; no se crea otra fuente.',
        fuente: rows[0] ? publicFuente(rows[0]) : null,
      });
    }
    if (e.code === 'tipo_archivo_invalido' || e.code === 'archivo_requerido') {
      return res.status(400).json({ ok: false, codigo: e.code });
    }
    res.status(500).json({ ok: false, codigo: 'error_interno', error: e.message });
  }
});
