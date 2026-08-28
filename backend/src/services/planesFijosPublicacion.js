import { createHash } from 'node:crypto';
import path from 'node:path';

function normalizeString(value) {
  return value == null ? null : String(value).trim() || null;
}

function metadataFromOriginalName(originalName) {
  const baseName = path.basename(String(originalName || ''));
  const versionMatch = baseName.match(/\((\d{1,3})\)/) || baseName.match(/(?:^|[-_])(\d{1,3})[-_](\d{6})(?:\.pdf)?$/i);
  const dateMatch = baseName.match(/[-_](\d{6})(?:\.pdf)?$/i);
  let fecha_documento = null;
  if (dateMatch) {
    const yymmdd = dateMatch[1];
    const yy = Number(yymmdd.slice(0, 2));
    const yyyy = yy < 80 ? 2000 + yy : 1900 + yy;
    fecha_documento = `${yyyy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
  }
  return {
    version_doc: versionMatch ? versionMatch[1] : null,
    fecha_documento,
  };
}

export function buildPlanesFijosFuenteMetadata({ originalName, buffer, archivedPath, parsed }) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const filenameMeta = metadataFromOriginalName(originalName);
  return {
    familia: 'planes_fijos',
    nombre_original: normalizeString(originalName) || 'documento.pdf',
    sha256,
    documento_archivado: String(archivedPath || '').replace(/\\/g, '/'),
    titulo_documento: normalizeString(parsed?.titulo_documento) || path.basename(String(originalName || 'documento')),
    rev: normalizeString(parsed?.rev),
    version_doc: parsed?.version_doc == null ? filenameMeta.version_doc : String(parsed.version_doc),
    fecha_documento: normalizeString(parsed?.fecha_documento) || filenameMeta.fecha_documento,
  };
}

export async function getUltimaPublicacionPlanesFijos(db) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM public.planes_fijos_publicaciones
       WHERE familia = 'planes_fijos'
       ORDER BY publicado_en DESC, id DESC
       LIMIT 1`
    );
    return rows[0] || null;
  } catch (e) {
    if (e.code === '42P01') return null;
    throw e;
  }
}
