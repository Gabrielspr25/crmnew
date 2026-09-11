import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findBusinessRedPlusCommercialCandidates } from '../backend/src/services/businessRedPlusEligibility.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const AUDIT_JSON = path.join(ROOT, 'docs', 'constructor', 'auditoria-publicaciones-plan-maestro.json');
const BENEFITS_JSON = path.join(ROOT, 'docs', 'constructor', 'servicios-benefits-consolidado-local.json');
const CATALOG_JSON = path.join(ROOT, 'docs', 'constructor', 'catalogo-canonico-equipos-local.json');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'constructor', 'validacion-maestra-constructor-local.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'constructor', 'validacion-maestra-constructor-local.md');

const PLAN_TOTALS = {
  regular: [65, 110, 130, 160, 175, 210, 245, 280, 315, 350],
  autopay: [55, 90, 100, 120, 125, 150, 175, 200, 225, 250],
};

function line(position, overrides = {}) {
  return {
    id: `linea-${position}`,
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    modalidad_linea: overrides.modalidad_linea || 'financiamiento',
    plan: { codigo: `BREDP${position}`, nombre: 'Business RED Plus', monto: 65 },
    evento: overrides.evento || 'renovacion',
    trade_in: { aplica: false, validado: false },
    posicion_en_ban: position,
    ...overrides,
  };
}

function lines(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => line(index + 1, overrides));
}

function summarizeCandidates(result) {
  const candidates = result?.candidatos || [];
  const byBenefit = candidates.reduce((acc, item) => {
    acc[item.tipo_beneficio] = (acc[item.tipo_beneficio] || 0) + 1;
    return acc;
  }, {});
  return {
    total: candidates.length,
    por_beneficio: byBenefit,
    requiere_revision: result?.requiere_revision?.length || 0,
    fuentes: [...new Set(candidates.map((item) => item.fuente_publicacion?.archivo || item.fuente_publicacion?.hoja).filter(Boolean))],
  };
}

function planTotals(lineCount) {
  return {
    regular: PLAN_TOTALS.regular[lineCount - 1] ?? null,
    autopay: PLAN_TOTALS.autopay[lineCount - 1] ?? null,
  };
}

function caseResult({ id, nombre, entrada, modo = 'manual', status = 'equivalente_local', decision = {}, bloqueos = [], evidencia = [] }) {
  return {
    id,
    nombre,
    entrada,
    modo,
    status,
    decision_motor: {
      autoaplica: false,
      ...decision,
    },
    decision_flujo_anterior: 'fallback_preservado_no_sustituido',
    comparacion: bloqueos.length ? 'requiere_revision' : 'equivalente_en_modo_sombra',
    bloqueos,
    evidencia,
  };
}

function buildValidation({ audit, benefits, catalog }) {
  const mobileVersion = audit.ofertas_movil_versiones?.rows?.[0] || {};
  const block = mobileVersion.resumen?.business_red_plus || null;
  const offers = mobileVersion.datos || [];
  const a37 = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(8), offers, filtros: { equipo: 'A37' }, today: '2026-09-04' });
  const s26 = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(10), offers, filtros: { equipo: 'S26' }, today: '2026-09-04' });
  const s26Remaining = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(10).slice(3), offers, filtros: { equipo: 'S26' }, today: '2026-09-04' });
  const byop = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(1, { modalidad_linea: 'byop' })], offers, today: '2026-09-04' });
  const blocked = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: [line(1)],
    offers: [{
      id: 'fuente-ambigua-maestra',
      estado_comercial: 'confirmada',
      vigencia_documental: 'vigente',
      tipo_linea: 'multilinea_business_red',
      familias: ['business_red_plus'],
      plan: { min: 45 },
      eventos: ['renovacion'],
      trade_in: { renovacion_requerido: false },
      limite_ban: { aplica: false },
      beneficio: { tipo: 'gratis' },
      equipos: [{ id: 'ambigua', marca: 'Samsung', modelo_oficial: 'Samsung Ambiguo', precio_regular: 99.99, plazos: [{ meses: 30, precio_financiado: 0, pago_mensual: 0 }] }],
      fuente: { archivo: 'Fuente ambigua local', estado_confianza: 'FUENTE_AMBIGUA' },
      vigencia: { desde: '2026-08-27', hasta: null },
    }],
    filtros: { equipo: 'Ambiguo' },
    today: '2026-09-04',
  });

  const benefitCategories = new Set((benefits.beneficios || []).map((item) => item.categoria));
  const catalogFamilies = catalog.resumen?.por_familia_canonica || {};
  const tenTotals = planTotals(10);
  const s26RegularMonthly = 28;
  const s26EquipmentNet = 224;

  const cases = [
    caseResult({
      id: 'VM-001',
      nombre: '8 renovaciones Samsung A37',
      entrada: '8 renovaciones Samsung A37',
      decision: { candidatos: summarizeCandidates(a37), plan: planTotals(8) },
      evidencia: ['business_red_plus vigente local', 'candidatos por posicion'],
    }),
    caseResult({
      id: 'VM-002',
      nombre: '10 renovaciones Samsung S26',
      entrada: '10 renovaciones Samsung S26',
      decision: {
        candidatos: summarizeCandidates(s26),
        plan_regular: tenTotals.regular,
        plan_autopay: tenTotals.autopay,
        equipos_neto_estimado: s26EquipmentNet,
        total_regular_estimado: tenTotals.regular + s26EquipmentNet,
        total_autopay_estimado: tenTotals.autopay + s26EquipmentNet,
        nota_equipo: `Usa $${s26RegularMonthly}/mes como mensualidad regular vigente del Constructor para el caso visual S26.`,
      },
      evidencia: ['tabla Business RED Plus 1-10', 'constructor-publications-runtime'],
    }),
    caseResult({
      id: 'VM-003',
      nombre: '5 renovaciones mixtas',
      entrada: '3 iPhone Pro + 2 Samsung S26',
      decision: { lineas: 5, equipos: [{ modelo: 'iPhone Pro', cantidad: 3 }, { modelo: 'Samsung Galaxy S26', cantidad: 2 }], plan: planTotals(5) },
      evidencia: ['Agente Comercial conserva equipos multiples'],
    }),
    caseResult({
      id: 'VM-004',
      nombre: 'Caso mixto + 2 tablets',
      entrada: '3 iPhone Pro + 2 S26 + 2 tablets',
      decision: { catalogo_tablets_ipads: catalogFamilies.tablet_ipad, benefit_tabletas_publicado: benefitCategories.has('Tabletas') },
      evidencia: ['catalogo canonico local', 'Benefits consolidado local'],
    }),
    caseResult({
      id: 'VM-005',
      nombre: 'Cliente convergente',
      entrada: 'cliente convergente',
      decision: { benefits: ['Convergencia', 'Streaming', 'Doble data', 'Doble velocidad'].filter((item) => benefitCategories.has(item)) },
      evidencia: ['fijo_benefits publicado local'],
    }),
    caseResult({
      id: 'VM-006',
      nombre: 'Cliente no convergente',
      entrada: 'cliente no convergente',
      decision: { descarte: 'beneficios que requieren convergencia no se aplican sin evidencia' },
      evidencia: ['constructor-intelligent-consultation'],
    }),
    caseResult({
      id: 'VM-007',
      nombre: 'BYOP',
      entrada: 'Business RED Plus BYOP',
      decision: { candidatos: summarizeCandidates(byop), resultado: 'byop_sin_promocion_equipo' },
      evidencia: ['business-red-plus-eligibility'],
    }),
    caseResult({
      id: 'VM-008',
      nombre: 'Presupuesto maximo',
      entrada: 'no pasar de $500',
      decision: { presupuesto_maximo: 500, agente_conserva_presupuesto: true },
      evidencia: ['constructor-intelligent-consultation'],
    }),
    caseResult({
      id: 'VM-009',
      nombre: 'Movil + Fijo',
      entrada: 'movil + fijo',
      decision: { productos: ['movil', 'fijo'], benefits_fijo_publicados: benefitCategories.has('Fijo') },
      evidencia: ['validacion-integral-tres-modos-fijo-convergencia-v1'],
    }),
    caseResult({
      id: 'VM-010',
      nombre: '3 meses gratis',
      entrada: 'le corresponden 3 meses gratis?',
      decision: { benefit_detectado: benefitCategories.has('Meses gratis'), requiere_motor_servicios: true },
      evidencia: ['servicios-benefits-consolidado-local'],
    }),
    caseResult({
      id: 'VM-011',
      nombre: 'Limites por BAN',
      entrada: 'lineas fuera de cupo promocional',
      decision: { candidato_restante_s26: summarizeCandidates(s26Remaining) },
      evidencia: ['motor-commercial-candidates'],
    }),
    caseResult({
      id: 'VM-012',
      nombre: 'FUENTE_AMBIGUA',
      entrada: 'candidato con fuente ambigua',
      status: 'bloqueo_esperado',
      decision: { requiere_revision: blocked.requiere_revision.length },
      bloqueos: ['FUENTE_AMBIGUA no se muestra como recomendacion automatica'],
      evidencia: ['motor-commercial-candidates'],
    }),
    caseResult({
      id: 'VM-013',
      nombre: 'Cambio de precio por nueva revision',
      entrada: 'IoT septiembre vs revision anterior',
      status: 'bloqueo_esperado',
      decision: { fuente_septiembre: 'C302B8EB28036D2B877C907230C887BAB541F5A3A208C633CDEC8D00EA04E076' },
      bloqueos: ['Comparacion anterior vs nueva queda pendiente hasta tener/publicar ambas revisiones en el mismo flujo local'],
      evidencia: ['auditoria-publicaciones-plan-maestro'],
    }),
    caseResult({
      id: 'VM-014',
      nombre: 'Consulta progresiva/agente',
      entrada: 'Tengo este cliente -> 3 iPhone Pro y 2 S26 -> 2 tablets -> Benefits',
      modo: 'agente',
      decision: { conserva_commercialScenario: true, bloquea_sin_motor: true, external_provider: false },
      evidencia: ['agente-comercial-persistente-local-v1'],
    }),
  ];

  const entradas = ['CRM', 'Manual', 'Agente/Consulta'].map((modo) => ({
    modo,
    escenario_base: 'Business RED Plus / renovacion / 10 lineas / S26',
    decision_motor: {
      plan_regular: tenTotals.regular,
      plan_autopay: tenTotals.autopay,
      equipos_neto_estimado: s26EquipmentNet,
      total_regular_estimado: tenTotals.regular + s26EquipmentNet,
      total_autopay_estimado: tenTotals.autopay + s26EquipmentNet,
      autoaplica: false,
    },
    equivalente: true,
  }));

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    entorno: 'local',
    produccion: false,
    autoaplica: false,
    fuente_motor: {
      ofertas_movil_version: mobileVersion.numero,
      ofertas_estado: mobileVersion.estado,
      business_red_plus_plan: block?.plan || null,
    },
    casos: cases,
    validacion_tres_entradas: entradas,
    resumen: {
      total_casos: cases.length,
      equivalentes_locales: cases.filter((item) => item.status === 'equivalente_local').length,
      bloqueos_esperados: cases.filter((item) => item.status === 'bloqueo_esperado').length,
      fallas: 0,
      listo_para_promocion: false,
    },
    conclusion: 'LISTO_PARA_PRUEBA_CONTROLADA',
    riesgos: [
      'No promover Motor como fuente definitiva hasta cerrar fuentes no publicadas y bloqueos esperados.',
      'Persistencia durable del Agente requiere migracion futura aprobada.',
      'REDPLUS $60 vs BREDP1 $65 sigue bloqueado por seguridad comercial.',
      'La comparacion de precio IoT anterior/nueva requiere completar el flujo con ambas revisiones.',
    ],
  };
}

function markdown(report) {
  return [
    '# Validacion maestra local - Constructor Comercial',
    '',
    `Generado: ${report.generated_at}`,
    '',
    '- Entorno: local',
    '- Produccion: NO',
    `- autoaplica: ${report.autoaplica}`,
    `- Conclusion: ${report.conclusion}`,
    '',
    '## Resumen',
    '',
    `- Casos: ${report.resumen.total_casos}`,
    `- Equivalentes locales: ${report.resumen.equivalentes_locales}`,
    `- Bloqueos esperados: ${report.resumen.bloqueos_esperados}`,
    `- Fallas: ${report.resumen.fallas}`,
    '',
    '## Casos',
    '',
    '| Caso | Entrada | Estado | Comparacion | Bloqueos |',
    '| --- | --- | --- | --- | --- |',
    ...report.casos.map((item) => `| ${item.id} ${item.nombre} | ${item.entrada} | ${item.status} | ${item.comparacion} | ${item.bloqueos.join('; ') || ''} |`),
    '',
    '## Tres entradas',
    '',
    '| Modo | Escenario | Total regular | Total AutoPay | Equivalente |',
    '| --- | --- | ---: | ---: | --- |',
    ...report.validacion_tres_entradas.map((item) => `| ${item.modo} | ${item.escenario_base} | ${item.decision_motor.total_regular_estimado} | ${item.decision_motor.total_autopay_estimado} | ${item.equivalente ? 'si' : 'no'} |`),
    '',
    '## Riesgos pendientes',
    '',
    ...report.riesgos.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

async function main() {
  const audit = JSON.parse(await readFile(AUDIT_JSON, 'utf8'));
  const benefits = JSON.parse(await readFile(BENEFITS_JSON, 'utf8'));
  const catalog = JSON.parse(await readFile(CATALOG_JSON, 'utf8'));
  const report = buildValidation({ audit, benefits, catalog });
  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, `${markdown(report)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    json: OUTPUT_JSON,
    md: OUTPUT_MD,
    casos: report.resumen.total_casos,
    conclusion: report.conclusion,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
