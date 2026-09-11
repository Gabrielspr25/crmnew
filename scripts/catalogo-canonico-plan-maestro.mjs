import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PREVIEW_JSON = path.join(ROOT, 'docs', 'constructor', 'preview-lista-precios-plan-maestro.json');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'catalogo-canonico-equipos-local.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'catalogo-canonico-equipos-local.md');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalFamily(rule) {
  const family = normalize(rule.familia);
  const model = normalize(rule.modelo);
  if (family === 'celular') return 'smartphone';
  if (family === 'modem' || model.includes('mifi') || model.includes('hotspot')) return 'modem_mifi';
  if (family === 'accesorio') return 'accesorio';
  if (family === 'tablet' || model.includes('ipad')) return 'tablet_ipad';
  return family || 'otros';
}

function byCount(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'no_determinado';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildCanonicalCatalog(preview) {
  const reglas = preview.preview?.reglas_normalizadas || [];
  const identities = reglas.map((rule) => ({
    identidad_canonica: [String(rule.item_code || '').trim().toUpperCase(), canonicalFamily(rule)].filter(Boolean).join('|'),
    item_code: String(rule.item_code || '').trim().toUpperCase(),
    modelo: rule.modelo,
    familia_original: rule.familia,
    familia_canonica: canonicalFamily(rule),
    precio_regular: rule.valor?.precio_regular ?? null,
    mensualidades: rule.valor?.mensualidades || [],
    pospago_precios: rule.valor?.pospago_precios || [],
    estado_confianza: rule.estado_confianza,
    estado_publicacion: rule.estado_publicacion,
    fuente: {
      nombre: preview.fuente?.nombre,
      sha256: preview.fuente?.sha256,
    },
  }));
  const duplicateKeys = identities.reduce((acc, item) => {
    acc[item.identidad_canonica] = (acc[item.identidad_canonica] || 0) + 1;
    return acc;
  }, {});
  const repeatedModelGroups = preview.catalogo_canonico?.posibles_modelos_mismo_nombre || [];
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    fuente: preview.fuente,
    resumen: {
      total_registros: identities.length,
      total_identidades_canonicas: new Set(identities.map((item) => item.identidad_canonica)).size,
      duplicados_identidad_canonica: Object.values(duplicateKeys).filter((count) => count > 1).length,
      grupos_nombre_repetido_sin_fusionar: repeatedModelGroups.length,
      por_familia_canonica: byCount(identities, 'familia_canonica'),
      precio_en_llave: false,
    },
    identidades: identities,
    modelos_repetidos_sin_fusionar: repeatedModelGroups.map((group) => ({
      ...group,
      estado: 'requiere_revision',
      motivo: 'Mismo nombre normalizado con varios item_code; no se fusiona sin evidencia oficial.',
    })),
    reglas: [
      'La identidad canonica usa item_code + familia canonica.',
      'El precio regular no forma parte de la llave comercial.',
      'Mismo equipo en varios boletines debe apuntar al mismo item_code cuando la fuente lo conserve.',
      'Nombres parecidos o repetidos no se fusionan por inferencia.',
    ],
  };
}

function markdown(report) {
  return [
    '# Catalogo canonico de equipos - local',
    '',
    `Generado: ${report.generated_at}`,
    '',
    'Evidencia local derivada del preview de Lista de Precios. No publica catalogo, no modifica precios y no ejecuta migraciones.',
    '',
    '## Fuente',
    '',
    `- Nombre: ${report.fuente.nombre}`,
    `- SHA-256: ${report.fuente.sha256}`,
    '',
    '## Resumen',
    '',
    `- Registros: ${report.resumen.total_registros}`,
    `- Identidades canonicas: ${report.resumen.total_identidades_canonicas}`,
    `- Duplicados por identidad canonica: ${report.resumen.duplicados_identidad_canonica}`,
    `- Grupos por nombre repetido sin fusionar: ${report.resumen.grupos_nombre_repetido_sin_fusionar}`,
    `- Precio dentro de llave: ${report.resumen.precio_en_llave}`,
    '',
    '## Familias canonicas',
    '',
    '| Familia | Cantidad |',
    '| --- | ---: |',
    ...Object.entries(report.resumen.por_familia_canonica).sort().map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Modelos repetidos sin fusionar',
    '',
    '| Modelo normalizado | Item codes | Estado |',
    '| --- | --- | --- |',
    ...report.modelos_repetidos_sin_fusionar.map((item) => `| ${item.modelo_normalizado} | ${item.item_codes.join(', ')} | ${item.estado} |`),
    '',
    '## Reglas',
    '',
    ...report.reglas.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

async function main() {
  const preview = JSON.parse(await readFile(PREVIEW_JSON, 'utf8'));
  const report = buildCanonicalCatalog(preview);
  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, `${markdown(report)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    json: OUTPUT_JSON,
    md: OUTPUT_MD,
    identidades: report.resumen.total_identidades_canonicas,
    repetidos_sin_fusionar: report.resumen.grupos_nombre_repetido_sin_fusionar,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
