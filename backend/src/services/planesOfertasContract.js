import path from 'path';

export const PLANES_FIJOS_COLUMNAS = Object.freeze([
  'Codigo',
  'Descripcion',
  'Precio',
  'Alfa Code',
  'Tecnologia',
  'Minuto Adicional',
  'Inst. 0M',
  'Inst. 12M',
  'Inst. 24M',
  'Act. 0M',
  'Act. 12M',
  'Act. 24M',
  'Penalidad',
]);

export function safeDocumentoOfertasName(originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  const base = path.basename(String(originalName || 'documento'), ext);
  const safeBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  const safeExt = ext && /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : '.pdf';
  return `${safeBase || 'documento'}${safeExt}`;
}

export function buildDocumentoOfertasArchivePath(rootDir, originalName, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return path.join(rootDir, `${stamp}-${safeDocumentoOfertasName(originalName)}`).replace(/\\/g, '/');
}
