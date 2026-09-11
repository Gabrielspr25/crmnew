import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeOfferWorkbooks, parseBusinessRedPlusWorkbook } from '../backend/src/services/motorOfertasNormalizer.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const INVENTORY_JSON = path.join(ROOT, 'docs', 'constructor', 'inventario-fuentes-plan-maestro.json');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'preview-ofertas-27ago-plan-maestro.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'preview-ofertas-27ago-plan-maestro.md');

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function source(inventory, name) {
  const found = (inventory.fuentes || []).find(item => item.nombre === name);
  if (!found) throw new Error(`Fuente no encontrada en inventario: ${name}`);
  return found;
}

function offerFingerprint(offer) {
  return [
    offer.nombre,
    offer.plan?.min ?? '',
    offer.plan?.max ?? '',
    (offer.eventos || []).join(','),
    (offer.familias || []).join(','),
    offer.beneficio?.tipo || '',
    offer.beneficio?.monto || offer.beneficio?.porcentaje || '',
    (offer.equipos || []).map(item => `${item.modelo_comercial}:${item.precio_regular}`).sort().join(';'),
  ].join('|');
}

function diffOffers(previous, current) {
  const before = new Map((previous.offers || []).map(offer => [offerFingerprint(offer), offer]));
  const after = new Map((current.offers || []).map(offer => [offerFingerprint(offer), offer]));
  return {
    ofertas_anteriores: previous.offers.length,
    ofertas_actuales: current.offers.length,
    nuevas: [...after.keys()].filter(key => !before.has(key)).length,
    removidas: [...before.keys()].filter(key => !after.has(key)).length,
    contradicciones_anteriores: previous.contradictions.length,
    contradicciones_actuales: current.contradictions.length,
    revision_anteriores: previous.revisiones.length,
    revision_actuales: current.revisiones.length,
  };
}

function summarizeBusinessRedPlus(parsed) {
  return {
    plan: parsed.plan,
    vigencia: parsed.vigencia,
    grupos: parsed.groups.length,
    equipos: parsed.groups.reduce((sum, group) => sum + group.equipment.length, 0),
    max_lineas_descuento: parsed.groups.map(group => group.max_discounted_lines),
    price_codes: parsed.groups.map(group => group.price_codes),
    warnings: parsed.warnings,
  };
}

function markdown(report) {
  return [
    '# Preview Ofertas 27 Agosto - Plan Maestro Constructor',
    '',
    `Generado: ${report.generated_at}`,
    '',
    'Preview local sin publicacion. No activa promociones, no cambia fallback y no resuelve ambiguedades por inferencia.',
    '',
    '## Fuentes',
    '',
    `- Tabla original: ${report.fuentes.tabla_original.nombre} (${report.fuentes.tabla_original.sha256})`,
    `- Tabla RV: ${report.fuentes.tabla_revision.nombre} (${report.fuentes.tabla_revision.sha256})`,
    `- Lista de Precios: ${report.fuentes.lista_precios.nombre} (${report.fuentes.lista_precios.sha256})`,
    '',
    '## Normalizacion General',
    '',
    '| Version | Ofertas | Reglas | Confirmadas | Requiere revision | Contradicciones |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    `| Original | ${report.original.summary.offers} | ${report.original.reglas_normalizadas.length} | ${report.original.resumen_reglas.por_confianza.confirmado || 0} | ${report.original.resumen_reglas.por_confianza.requiere_revision || 0} | ${report.original.contradictions.length} |`,
    `| RV | ${report.revision.summary.offers} | ${report.revision.reglas_normalizadas.length} | ${report.revision.resumen_reglas.por_confianza.confirmado || 0} | ${report.revision.resumen_reglas.por_confianza.requiere_revision || 0} | ${report.revision.contradictions.length} |`,
    '',
    '## Diferencia Original Vs RV',
    '',
    `- Nuevas: ${report.diff.nuevas}`,
    `- Removidas: ${report.diff.removidas}`,
    `- Contradicciones original/RV: ${report.diff.contradicciones_anteriores}/${report.diff.contradicciones_actuales}`,
    '',
    '## Business RED Plus',
    '',
    '| Version | Plan detectado | Vigencia | Grupos | Equipos | Max lineas descuento |',
    '| --- | --- | --- | ---: | ---: | --- |',
    `| Original | $${report.business_red_plus.original.plan.monto ?? 'no_determinado'} | ${report.business_red_plus.original.vigencia.desde || '?'} a ${report.business_red_plus.original.vigencia.hasta || '?'} | ${report.business_red_plus.original.grupos} | ${report.business_red_plus.original.equipos} | ${report.business_red_plus.original.max_lineas_descuento.join(', ')} |`,
    `| RV | $${report.business_red_plus.revision.plan.monto ?? 'no_determinado'} | ${report.business_red_plus.revision.vigencia.desde || '?'} a ${report.business_red_plus.revision.vigencia.hasta || '?'} | ${report.business_red_plus.revision.grupos} | ${report.business_red_plus.revision.equipos} | ${report.business_red_plus.revision.max_lineas_descuento.join(', ')} |`,
    '',
    '## Riesgos',
    '',
    '- REDPLUS $60 sigue separado de BREDP1 $65 hasta fuente oficial o decision comercial.',
    '- Este preview no publica la RV ni reemplaza la version vigente del Motor.',
    '- Las contradicciones de equipos sin coincidencia exacta bloquean aplicacion automatica.',
    '',
  ].join('\n');
}

async function main() {
  const inventory = JSON.parse(await readFile(INVENTORY_JSON, 'utf8'));
  const tablaOriginal = source(inventory, 'Tabla Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026- PYMES.xlsx');
  const tablaRevision = source(inventory, 'Tabla Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026- PYMES-rv.xlsx');
  const listaPrecios = source(inventory, 'Lista de Precios 3 de septiembre al 28 de octubre de 2026-PYM-CORP.xlsx');
  const originalBuffer = await readFile(tablaOriginal.ruta);
  const revisionBuffer = await readFile(tablaRevision.ruta);
  const priceBuffer = await readFile(listaPrecios.ruta);

  const original = normalizeOfferWorkbooks({
    financingBuffer: originalBuffer,
    priceListBuffer: priceBuffer,
    fileNames: { tabla_financiamiento: tablaOriginal.nombre, lista_precios: listaPrecios.nombre },
    sourceIds: { tabla_financiamiento: tablaOriginal.sha256, lista_precios: listaPrecios.sha256 },
  });
  const revision = normalizeOfferWorkbooks({
    financingBuffer: revisionBuffer,
    priceListBuffer: priceBuffer,
    fileNames: { tabla_financiamiento: tablaRevision.nombre, lista_precios: listaPrecios.nombre },
    sourceIds: { tabla_financiamiento: tablaRevision.sha256, lista_precios: listaPrecios.sha256 },
  });

  const report = {
    generated_at: new Date().toISOString(),
    fuentes: {
      tabla_original: { nombre: tablaOriginal.nombre, ruta: tablaOriginal.ruta, sha256: hash(originalBuffer) },
      tabla_revision: { nombre: tablaRevision.nombre, ruta: tablaRevision.ruta, sha256: hash(revisionBuffer) },
      lista_precios: { nombre: listaPrecios.nombre, ruta: listaPrecios.ruta, sha256: hash(priceBuffer) },
    },
    original,
    revision,
    diff: diffOffers(original, revision),
    business_red_plus: {
      original: summarizeBusinessRedPlus(parseBusinessRedPlusWorkbook({ buffer: originalBuffer, fileName: tablaOriginal.nombre, sourceId: tablaOriginal.sha256 })),
      revision: summarizeBusinessRedPlus(parseBusinessRedPlusWorkbook({ buffer: revisionBuffer, fileName: tablaRevision.nombre, sourceId: tablaRevision.sha256 })),
    },
  };

  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, `${markdown(report)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, json: OUTPUT_JSON, md: OUTPUT_MD, diff: report.diff }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
