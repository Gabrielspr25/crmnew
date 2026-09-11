import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildBenefitsConsolidation } from '../backend/src/services/benefitsConsolidation.js';

const require = createRequire(import.meta.url);
const XLSX = require('../backend/node_modules/xlsx');

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const INVENTORY_JSON = path.join(ROOT, 'docs', 'constructor', 'inventario-fuentes-plan-maestro.json');
const AUDIT_JSON = path.join(ROOT, 'docs', 'constructor', 'auditoria-publicaciones-plan-maestro.json');
const EXTRACTS_DIR = path.join(ROOT, 'docs', 'motor-ofertas', 'extractos');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'servicios-benefits-consolidado-local.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'servicios-benefits-consolidado-local.md');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function readExtracts() {
  if (!existsSync(EXTRACTS_DIR)) return {};
  const files = await readdir(EXTRACTS_DIR, { withFileTypes: true });
  const result = {};
  for (const file of files) {
    if (!file.isFile() || !file.name.toLowerCase().endsWith('.txt')) continue;
    result[file.name] = await readFile(path.join(EXTRACTS_DIR, file.name), 'utf8');
  }
  return result;
}

function excelText(filePath) {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const chunks = [];
    for (const sheetName of workbook.SheetNames || []) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, blankrows: false });
      chunks.push(`HOJA ${sheetName}`);
      chunks.push(rows.slice(0, 80).map((row) => row.join(' | ')).join('\n'));
    }
    return chunks.join('\n');
  } catch {
    return '';
  }
}

function attachExcelTexts(inventory, textBySource) {
  for (const source of inventory.fuentes || []) {
    if (!['.xlsx', '.xls'].includes(String(source.extension || '').toLowerCase())) continue;
    if (!source.ruta || !existsSync(source.ruta)) continue;
    textBySource[source.nombre] = excelText(source.ruta);
  }
}

function sourceLine(source) {
  return `| ${source.fuente.nombre.replace(/\|/g, '/')} | ${source.fuente.dominio} | ${source.vigencia_estado} | ${source.estado} | ${source.monto_o_beneficio || ''} | ${source.fuente.sha256} |`;
}

function markdown(report) {
  const lines = [
    '# Servicios / Beneficios consolidado local',
    '',
    `Generado: ${report.generated_at}`,
    '',
    'Evidencia local. No escribe base de datos, no publica produccion, no lee PDFs desde Portal y no convierte detecciones por palabra clave en reglas comerciales definitivas.',
    '',
    '## Resumen',
    '',
    `- Fuentes evaluadas: ${report.resumen.fuentes_evaluadas}`,
    `- Detecciones de beneficios: ${report.resumen.detecciones}`,
    `- Beneficios canónicos: ${report.resumen.beneficios_canonicos}`,
    `- Publicados/local vigentes detectados: ${report.resumen.publicados}`,
    `- Requieren revision/normalizacion: ${report.resumen.requieren_revision}`,
    `- autoaplica: ${report.resumen.autoaplica}`,
    '',
    '## Por Categoria',
    '',
    '| Categoria | Cantidad |',
    '| --- | ---: |',
    ...Object.entries(report.resumen.por_categoria).sort().map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Beneficios canónicos',
    '',
    '| Categoria | Nombre | Producto | Estado | Publicado | Fuentes | Faltante |',
    '| --- | --- | --- | --- | --- | ---: | --- |',
    ...report.beneficios.map((item) => `| ${item.categoria} | ${item.nombre} | ${item.producto_afectado} | ${item.estado} | ${item.publicado ? 'si' : 'no'} | ${item.fuentes.length} | ${item.faltantes.join('; ') || ''} |`),
    '',
    '## Detecciones por Fuente',
    '',
    '| Fuente | Dominio | Vigencia | Estado | Monto/señal | SHA-256 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.detecciones.map(sourceLine),
    '',
    '## Reglas publicadas detectadas',
    '',
    '| Regla | Estado confianza | Estado publicacion | autoaplica | Fuente SHA-256 |',
    '| --- | --- | --- | --- | --- |',
    ...report.reglas_publicadas_detectadas.map((row) => `| ${row.identidad_comercial} | ${row.estado_confianza} | ${row.estado_publicacion} | ${row.autoaplica} | ${row.fuente_sha256} |`),
    '',
    '## Riesgos',
    '',
    ...report.riesgos.map((item) => `- ${item}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const inventory = JSON.parse(await readFile(INVENTORY_JSON, 'utf8'));
  const audit = JSON.parse(await readFile(AUDIT_JSON, 'utf8'));
  const textBySource = await readExtracts();
  attachExcelTexts(inventory, textBySource);

  const report = buildBenefitsConsolidation({
    inventory,
    textBySource,
    publishedRows: audit.motor_comercial_reglas_compuestas?.rows || [],
    today: '2026-09-04',
  });

  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, markdown(report), 'utf8');
  console.log(JSON.stringify({
    ok: true,
    json: OUTPUT_JSON,
    md: OUTPUT_MD,
    beneficios: report.resumen.beneficios_canonicos,
    detecciones: report.resumen.detecciones,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
