import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parsearExcel } from '../backend/src/routes/equiposRoutes.js';
import { buildListaPreciosPreview } from '../backend/src/services/listaPreciosPreview.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const INVENTORY_JSON = path.join(ROOT, 'docs', 'constructor', 'inventario-fuentes-plan-maestro.json');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'preview-lista-precios-plan-maestro.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'preview-lista-precios-plan-maestro.md');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function canonicalEquipmentProfile(items) {
  const byCode = new Map();
  const duplicateNames = new Map();
  for (const item of items) {
    const code = String(item.item_code || '').trim().toUpperCase();
    if (!code) continue;
    byCode.set(code, item);
    const nameKey = String(item.modelo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (nameKey) {
      const names = duplicateNames.get(nameKey) || new Set();
      names.add(code);
      duplicateNames.set(nameKey, names);
    }
  }
  return {
    total_items: items.length,
    total_item_codes: byCode.size,
    posibles_modelos_mismo_nombre: [...duplicateNames.entries()]
      .filter(([, codes]) => codes.size > 1)
      .map(([modelo_normalizado, codes]) => ({ modelo_normalizado, item_codes: [...codes].sort() })),
    categorias: items.reduce((acc, item) => {
      const key = item.categoria || 'no_determinado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    marcas: items.reduce((acc, item) => {
      const key = item.marca || 'no_determinado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };
}

function markdown(report) {
  return [
    '# Preview Lista de Precios - Plan Maestro Constructor',
    '',
    `Generado: ${report.generated_at}`,
    '',
    'Preview local de solo lectura. No guarda la fuente, no publica catalogo y no cambia precios.',
    '',
    '## Fuente',
    '',
    `- Nombre: ${report.fuente.nombre}`,
    `- SHA-256: ${report.fuente.sha256}`,
    `- Ruta: ${report.fuente.ruta}`,
    '',
    '## Resultado Parser',
    '',
    `- Equipos/accesorios reconocidos: ${report.preview.total}`,
    `- Item codes unicos: ${report.catalogo_canonico.total_item_codes}`,
    `- Hojas: ${report.preview.hojas.join(', ')}`,
    '',
    '## Categorias',
    '',
    '| Categoria | Cantidad |',
    '| --- | ---: |',
    ...Object.entries(report.catalogo_canonico.categorias).sort().map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Marcas',
    '',
    '| Marca | Cantidad |',
    '| --- | ---: |',
    ...Object.entries(report.catalogo_canonico.marcas).sort((a, b) => b[1] - a[1]).map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Muestra',
    '',
    '| Item code | Marca | Modelo | Categoria | Precio regular |',
    '| --- | --- | --- | --- | ---: |',
    ...report.preview.muestra.map(item => `| ${item.item_code || ''} | ${item.marca || ''} | ${(item.modelo || '').replace(/\|/g, '/')} | ${item.categoria || ''} | ${item.precio_regular ?? ''} |`),
    '',
    '## Riesgos',
    '',
    '- El catalogo canonico queda en validacion: este preview demuestra item_code/modelo/precio, pero no persiste identidad canonica.',
    '- Las equivalencias por nombre similar no se resuelven por inferencia.',
    '- La publicacion de la lista vigente requiere flujo aprobado de Fuentes Comerciales.',
    '',
  ].join('\n');
}

async function main() {
  const inventory = JSON.parse(await readFile(INVENTORY_JSON, 'utf8'));
  const source = (inventory.fuentes || []).find(item =>
    item.dominio_inferido === 'lista_precios'
    && item.nombre.includes('3 de septiembre al 28 de octubre de 2026')
  );
  if (!source) throw new Error('No se encontro la Lista de Precios vigente de septiembre en el inventario.');
  const buffer = await readFile(source.ruta);
  const parsed = parsearExcel(buffer);
  const preview = buildListaPreciosPreview(parsed);
  const report = {
    generated_at: new Date().toISOString(),
    fuente: {
      nombre: source.nombre,
      ruta: source.ruta,
      sha256: sha256(buffer),
      vigencia_inferida: source.vigencia_inferida,
    },
    preview,
    catalogo_canonico: canonicalEquipmentProfile(parsed.items),
  };
  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, `${markdown(report)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, json: OUTPUT_JSON, md: OUTPUT_MD, total: preview.total }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
