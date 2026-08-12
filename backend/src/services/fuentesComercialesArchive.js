import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sanitizeCommercialFileName(originalName) {
  const parsed = path.parse(String(originalName || 'documento'));
  const ext = parsed.ext.toLowerCase();
  const base = (parsed.name || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'documento';
  return `${base}${ext}`;
}

export function getDocumentoTipo(originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.xlsx' || ext === '.xls') return 'excel';
  throw Object.assign(new Error('tipo_archivo_invalido'), { code: 'tipo_archivo_invalido' });
}

export function deriveFuenteTitulo({ titulo = '', originalName = '', familia = '' }) {
  const manual = String(titulo || '').trim();
  if (manual) return manual;

  const fromFile = path.parse(String(originalName || '')).name.trim();
  if (fromFile) return fromFile;

  const label = String(familia || 'fuente comercial').replace(/_/g, ' ').toLowerCase();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Fuente comercial';
}

function formatDateSegment(now) {
  return now.toISOString().slice(0, 10);
}

export async function archiveFuenteComercialBuffer({ rootDir, familia, originalName, buffer, now = new Date() }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw Object.assign(new Error('archivo_requerido'), { code: 'archivo_requerido' });
  }

  const documento_tipo = getDocumentoTipo(originalName);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const safeName = sanitizeCommercialFileName(originalName);
  const nombre_archivado = `${sha256.slice(0, 12)}-${safeName}`;
  const dateSegment = formatDateSegment(now);
  const ruta_relativa = path.posix.join(familia, dateSegment, nombre_archivado);
  const dir = path.join(rootDir, familia, dateSegment);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, nombre_archivado), buffer);

  return {
    documento_tipo,
    nombre_archivado,
    ruta_relativa,
    sha256,
    bytes: buffer.length,
  };
}
