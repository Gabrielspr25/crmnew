import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('../backend/node_modules/xlsx');

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OFFICIAL_DROPBOX = 'C:\\Users\\Gabriel\\Dropbox\\Boletines Vigentes PYMES';
const CURRENT_DROPBOX = path.join(OFFICIAL_DROPBOX, '27 AL 16 DE SEPTIEMBRE 2026');
const ARCHIVE_DIR = path.join(ROOT, 'documentos-ofertas');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'inventario-fuentes-plan-maestro.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'inventario-fuentes-plan-maestro.md');

const EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls']);

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferDomain(filePath) {
  const value = normalize(filePath);
  if (value.includes('lista de precios')) return 'lista_precios';
  if (value.includes('modems') || value.includes('mifi') || value.includes('tablet')) return 'tabletas_modems_mifi';
  if (value.includes('int go') || value.includes('iot') || value.includes('inalambrico')) return 'inalambrico_iot';
  if (value.includes('tabla ofertas') || value.includes('update plus') || value.includes('financiamiento')) return 'ofertas_financiamiento';
  if (value.includes('business red plus') || value.includes('business red')) return 'business_red_plus';
  if (value.includes('byop')) return 'byop';
  if (value.includes('convergencia') || value.includes('claro full')) return 'convergencia_benefits';
  if (value.includes('portabilidad')) return 'bono_portabilidad';
  if (value.includes('accesorios')) return 'accesorios';
  if (value.includes('claro tv')) return 'claro_tv';
  if (value.includes('directorio')) return 'directorio_fijo';
  if (value.includes('planes negocios') || value.includes('estructura planes') || value.includes('ipmpls')) return 'fijo';
  if (value.includes('cloud')) return 'servicios_cloud';
  return 'otros';
}

function extractValidityFromName(name) {
  const normalized = normalize(name);
  const patterns = [
    /(\d{1,2})\s*de\s*([a-z]+)\s*al\s*(\d{1,2})\s*de\s*([a-z]+)\s*de\s*(\d{4})/,
    /(\d{1,2})\s*al\s*(\d{1,2})\s*de\s*([a-z]+)\s*(\d{4})/,
    /(\d{1,2})\s*al\s*(\d{1,2})\s*([a-z]+)\s*(\d{4})/,
    /(\d{1,2})([a-z]+)@(\d{1,2})([a-z]+)'?(\d{2,4})/,
    /(\d{1,2})\s*de\s*([a-z]+)\s*de\s*(\d{4})\s*en\s*adelante/,
  ];
  const match = patterns.map(pattern => normalized.match(pattern)).find(Boolean);
  if (!match) return { estado: 'requiere_revision', texto: null };
  return { estado: 'detectada_nombre_archivo', texto: match[0] };
}

function baseRevisionKey(name) {
  return normalize(name)
    .replace(/\.(pdf|xlsx|xls)$/i, '')
    .replace(/\b(rv|revision|revisado)\b/g, '')
    .replace(/\b\d{6,8}\b/g, '')
    .replace(/\b\d{1,2}\s*(al|a)\s*\d{1,2}\b/g, '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function walk(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    if (entry.isFile() && !entry.name.startsWith('~$') && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex').toUpperCase();
}

function readExcelSheets(filePath) {
  try {
    const workbook = XLSX.readFile(filePath, { bookSheets: true, cellDates: false });
    return workbook.SheetNames || [];
  } catch (error) {
    return [`ERROR:${error.message}`];
  }
}

async function fileRecord(filePath, sourceRoot, archiveByHash) {
  const info = await stat(filePath);
  const hash = await sha256(filePath);
  const name = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const archivedMatches = archiveByHash.get(hash) || [];
  return {
    nombre: name,
    ruta: filePath,
    ruta_relativa_origen: path.relative(sourceRoot, filePath),
    origen: sourceRoot === ARCHIVE_DIR ? 'archivo_newcrm' : 'boletines_vigentes_dropbox',
    extension,
    sha256: hash,
    bytes: info.size,
    modificado: info.mtime.toISOString(),
    dominio_inferido: inferDomain(filePath),
    vigencia_inferida: extractValidityFromName(name),
    grupo_revision: baseRevisionKey(name),
    estado_archivo_newcrm: sourceRoot === ARCHIVE_DIR
      ? 'archivado_en_newcrm'
      : (archivedMatches.length ? 'coincide_hash_archivado' : 'no_archivado_por_hash'),
    coincidencias_archivo_newcrm: archivedMatches,
    hojas_excel: ['.xlsx', '.xls'].includes(extension) ? readExcelSheets(filePath) : [],
    estado_publicacion: 'no_determinado_por_inventario',
    siguiente_accion: 'preview_diff_publicacion_local_si_corresponde',
  };
}

function summarize(records) {
  const byDomain = {};
  const byOrigin = {};
  const groups = {};
  for (const item of records) {
    byDomain[item.dominio_inferido] = (byDomain[item.dominio_inferido] || 0) + 1;
    byOrigin[item.origen] = (byOrigin[item.origen] || 0) + 1;
    groups[item.grupo_revision] = groups[item.grupo_revision] || [];
    groups[item.grupo_revision].push(item);
  }
  const revisionGroups = Object.entries(groups)
    .filter(([, items]) => items.length > 1)
    .map(([grupo, items]) => ({
      grupo,
      archivos: items.map(item => ({
        nombre: item.nombre,
        origen: item.origen,
        sha256: item.sha256,
        dominio_inferido: item.dominio_inferido,
        estado_archivo_newcrm: item.estado_archivo_newcrm,
      })),
    }));
  return { total_fuentes: records.length, por_dominio: byDomain, por_origen: byOrigin, grupos_revision: revisionGroups };
}

function markdown(inventory) {
  const lines = [
    '# Inventario de fuentes - Plan Maestro Constructor',
    '',
    `Generado: ${inventory.generated_at}`,
    '',
    'Este inventario es evidencia local. No publica reglas, no cambia precios y no convierte parser output en verdad comercial.',
    '',
    '## Resumen',
    '',
    `- Total de fuentes inventariadas: ${inventory.resumen.total_fuentes}`,
    `- Archivo newcrm: ${inventory.resumen.por_origen.archivo_newcrm || 0}`,
    `- Dropbox boletines vigentes: ${inventory.resumen.por_origen.boletines_vigentes_dropbox || 0}`,
    '',
    '## Por Dominio',
    '',
    '| Dominio | Fuentes |',
    '| --- | ---: |',
    ...Object.entries(inventory.resumen.por_dominio).sort().map(([domain, count]) => `| ${domain} | ${count} |`),
    '',
    '## Fuentes',
    '',
    '| Dominio | Fuente | Vigencia inferida | Origen | Estado archivo | SHA-256 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...inventory.fuentes.map(item => `| ${item.dominio_inferido} | ${item.nombre.replace(/\|/g, '/')} | ${item.vigencia_inferida.texto || item.vigencia_inferida.estado} | ${item.origen} | ${item.estado_archivo_newcrm} | ${item.sha256} |`),
    '',
    '## Grupos con Posibles Revisiones',
    '',
    inventory.resumen.grupos_revision.length
      ? inventory.resumen.grupos_revision.map(group => `- ${group.grupo}: ${group.archivos.map(item => `${item.nombre} (${item.origen})`).join('; ')}`).join('\n')
      : '- No se detectaron grupos repetidos por nombre base.',
    '',
    '## Riesgos',
    '',
    '- La vigencia inferida desde nombre de archivo no sustituye la vigencia documental extraida del documento.',
    '- El estado de publicacion queda no determinado hasta consultar la base/API local por fuente y version.',
    '- Los PDFs requieren parser/preview especifico antes de cualquier publicacion local.',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const archiveFiles = await walk(ARCHIVE_DIR);
  const archiveByHash = new Map();
  for (const filePath of archiveFiles) {
    const hash = await sha256(filePath);
    const matches = archiveByHash.get(hash) || [];
    matches.push(path.relative(ROOT, filePath));
    archiveByHash.set(hash, matches);
  }

  const roots = [ARCHIVE_DIR, CURRENT_DROPBOX].filter(existsSync);
  const files = (await Promise.all(roots.map(root => walk(root).then(items => items.map(file => ({ file, root })))))).flat();
  const records = [];
  for (const { file, root } of files) records.push(await fileRecord(file, root, archiveByHash));
  records.sort((a, b) => a.dominio_inferido.localeCompare(b.dominio_inferido) || a.nombre.localeCompare(b.nombre));

  const inventory = {
    generated_at: new Date().toISOString(),
    workspace: ROOT,
    fuentes_consultadas: roots,
    resumen: summarize(records),
    fuentes: records,
  };

  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, markdown(inventory), 'utf8');
  console.log(JSON.stringify({ ok: true, json: OUTPUT_JSON, md: OUTPUT_MD, total: records.length }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
