import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const page = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const loader = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');

function loadConstructorPublications() {
  const context = {
    window: {},
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    localStorage: { getItem: () => 'token-local' },
    URLSearchParams,
  };
  context.window = context;
  vm.runInNewContext(loader, context);
  return context.window.ConstructorPublications;
}

function publishedRule(overrides = {}) {
  return {
    id: 'regla-1',
    identidad_comercial: 'fijo_benefits|bono_streaming|fijo',
    estado_confianza: 'confirmado',
    estado_publicacion: 'vigente',
    autoaplica: false,
    contrato: {
      beneficio: { tipo: 'bono_streaming', monto: 10 },
      productos_afectados: ['fijo', 'movil'],
      condiciones: {
        convergencia: 'requerida',
        eventos: ['portabilidad', 'linea_nueva'],
        plan_minimo: 60,
        compatibilidad: 'no_acumula',
        limite: { cantidad: 1, unidad: 'BAN' },
      },
      terminos_vinculados: [{ codigo: 'T-1', nombre: 'Solo aplica un bono por BAN', pagina: 30 }],
      traza: {
        fuente: { nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES.pdf', sha256: 'a'.repeat(64) },
        beneficio: { pagina: 3 },
      },
    },
    ...overrides,
  };
}

function proposalRule({ id, tipo, monto, compatibilidad = 'acumula', eventos = ['portabilidad'], producto = 'movil', extra = {} }) {
  return {
    id,
    identidad_comercial: `fijo_benefits|${tipo}|${producto}`,
    estado_confianza: 'confirmado',
    estado_publicacion: 'vigente',
    autoaplica: false,
    contrato: {
      beneficio: { tipo, monto, aplicacion: 'mensual', prioridad: monto },
      productos_afectados: [producto],
      condiciones: {
        convergencia: 'requerida',
        eventos,
        plan_minimo: 60,
        compatibilidad,
        limite: { cantidad: 1, unidad: 'BAN' },
        ...extra,
      },
      terminos_vinculados: [{ codigo: `T-${id}`, nombre: `Termino ${tipo}`, pagina: 3 }],
      traza: {
        fuente: { nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES.pdf', sha256: 'a'.repeat(64) },
        beneficio: { pagina: 3 },
      },
    },
  };
}

function scenarioFixture(publications, sourceMode, overrides = {}) {
  return publications.buildCommercialScenario({
    source_mode: sourceMode,
    client: { id: 'cliente-001', name: 'Cliente Integrado' },
    ban: { number: '555000111', status: 'activo' },
    account_type: 'Business Regular',
    full_ban_lines: [
      { id: 'sub-1', ban: '555000111', phone: '7870000001', service_type: 'movil', current_rent: 65, plan_name: 'Business RED Plus' },
      { id: 'sub-2', ban: '555000111', phone: '7870000002', service_type: 'movil', current_rent: 45, plan_name: 'Business RED Plus' },
      { id: 'sub-3', ban: '555000111', phone: '7870000003', service_type: 'movil', current_rent: 20, plan_name: 'Business RED Plus' },
      { id: 'sub-4', ban: '555000111', phone: '7870000004', service_type: 'movil', current_rent: 30, plan_name: 'Business RED Plus' },
      { id: 'sub-5', ban: '555000111', phone: '7870000005', service_type: 'movil', current_rent: 15, plan_name: 'Business RED Plus' },
    ],
    selected_lines: [
      { linea: 1, ban: '555000111', evento: 'renovacion', producto: 'movil', plan_monto: 65 },
      { linea: 2, ban: '555000111', evento: 'renovacion', producto: 'movil', plan_monto: 45 },
      { linea: 3, ban: '555000111', evento: 'renovacion', producto: 'movil', plan_monto: 20 },
      { linea: 4, ban: '555000111', evento: 'renovacion', producto: 'movil', plan_monto: 30 },
      { linea: 5, ban: '555000111', evento: 'renovacion', producto: 'movil', plan_monto: 15 },
    ],
    event: 'renovacion',
    plan: { tipo: 'multilinea', multilinea_familia: 'business_red_plus', total_mensual: 175 },
    equipment_preferences: { marca: 'samsung' },
    fixed_services: overrides.fixed_services || [],
    convergence: overrides.convergence || { estado: 'no_confirmada' },
    seller_preferences: { objetivo: 'preparar_opciones' },
    original_query: sourceMode === 'consultation'
      ? 'Tengo 5 lineas para renovar, quiero Samsung y el cliente tiene servicio fijo. Que opciones tengo?'
      : '',
    ...overrides,
  });
}

test('constructor consume endpoint de reglas publicadas vigentes sin leer archivos comerciales', () => {
  assert.match(loader, /commercialRules:\s*'\/api\/fuentes-comerciales\/planes-fijos\/reglas-compuestas-publicadas\/vigente'/);
  assert.match(loader, /motorRulesVersion/);
  assert.match(loader, /motorRules/);
  assert.doesNotMatch(loader, /extract_pdf_text|\.xlsx|\.xls|\.pdf/);
});

test('evaluacion de simulacion solo usa reglas confirmadas vigentes publicadas y autoaplica false', () => {
  const publications = loadConstructorPublications();
  const result = publications.evaluateCommercialRulesSimulation({
    version: { id: 'version-1', numero: 7, estado_publicacion: 'vigente' },
    rules: [
      publishedRule(),
      publishedRule({ id: 'borrador', estado_publicacion: 'borrador' }),
      publishedRule({ id: 'revision', estado_confianza: 'requiere_revision' }),
      publishedRule({ id: 'auto', autoaplica: true }),
    ],
    context: {
      cliente: { convergente: true, ban: 'BAN-001' },
      lineas: [{ evento: 'portabilidad', producto: 'movil', plan_monto: 65 }],
      productos: ['fijo', 'movil'],
    },
  });

  assert.equal(result.recibidas, 4);
  assert.equal(result.elegibles.length, 1);
  assert.equal(result.descartadas.length, 3);
  assert.equal(result.elegibles[0].identidad_comercial, 'fijo_benefits|bono_streaming|fijo');
  assert.equal(result.elegibles[0].autoaplica, false);
  assert.equal(result.recomendacion.modo, 'simulacion');
});

test('simulacion descarta reglas por contexto sin inventar elegibilidad', () => {
  const publications = loadConstructorPublications();
  const result = publications.evaluateCommercialRulesSimulation({
    version: { id: 'version-1', numero: 7, estado_publicacion: 'vigente' },
    rules: [publishedRule()],
    context: {
      cliente: { convergente: false, ban: 'BAN-001' },
      lineas: [{ evento: 'renovacion', producto: 'movil', plan_monto: 45 }],
      productos: ['movil'],
    },
  });

  assert.equal(result.elegibles.length, 0);
  assert.deepEqual(Array.from(result.descartadas[0].motivos), ['requiere_convergencia_confirmada', 'evento_no_aplica', 'plan_minimo_no_cumplido']);
});

test('constructor muestra panel de evaluacion del Motor Comercial sin reemplazar comportamiento actual', () => {
  assert.match(page, /id="motorSimulationPanel"/);
  assert.match(page, /id="motorSimulationPanelProductos"/);
  assert.match(page, /renderMotorCommercialSimulation/);
  assert.match(page, /buildMotorCommercialContext/);
  assert.match(page, /evaluateCommercialProposal/);
  assert.match(page, /evaluateCommercialShadowProposal/);
  assert.match(page, /Motor Comercial - modo sombra/);
  assert.match(page, /Total flujo actual/);
  assert.match(page, /Total Motor/);
  assert.match(page, /Diferencias detectadas/);
  assert.match(page, /offer_total:d\.totalOferta/);
  assert.doesNotMatch(page, /offer_total:d\.motorShadow/);
  assert.match(page, /propuesta local/i);
  assert.match(page, /alternativas/i);
  assert.match(page, /modo evaluacion/);
  assert.match(page, /Equipo y mensualidad/);
  assert.match(page, /Estado/);
  assert.match(page, /Bloqueada/);
  assert.match(page, /Evaluable/);
  assert.match(page, /Vigencia/);
  assert.match(page, /Motivo:/);
  assert.match(page, /comparacion contra comportamiento actual/i);
  assert.doesNotMatch(page, /autoaplica\s*=\s*true/);
});

test('modo sombra compara flujo actual vs Motor sin reemplazar total de propuesta', () => {
  const publications = loadConstructorPublications();
  const result = publications.evaluateCommercialShadowProposal({
    version: { id: 'version-1', numero: 7, estado_publicacion: 'vigente' },
    currentProposal: {
      totalActual: 140,
      totalOferta: 125,
      planCosto: 105,
      equipoCosto: 20,
      productosCosto: 0,
      descuento_mensual_estimado: 0,
      beneficios: [],
    },
    baseProposal: {
      cliente: { convergente: true, ban: 'BAN-001' },
      lineas: [{ linea: 1, evento: 'portabilidad', producto: 'movil', plan_monto: 65 }],
      productos: ['movil', 'fijo'],
      precio_base_mensual: 105,
      equipo_mensual: 20,
    },
    rules: [
      proposalRule({ id: 'streaming', tipo: 'bono_streaming', monto: 10, compatibilidad: 'no_acumula', producto: 'fijo' }),
      proposalRule({ id: 'data', tipo: 'doble_data', monto: 0, compatibilidad: 'acumula', producto: 'movil' }),
    ],
  });

  assert.equal(result.modo, 'sombra');
  assert.equal(result.autoaplica, false);
  assert.equal(result.actual.total_flujo_actual, 125);
  assert.equal(result.motor.total_estimado_mensual, 115);
  assert.equal(result.actual.total_flujo_actual, 125, 'el total visible del flujo actual se conserva');
  assert.ok(result.diferencias.some((item) => item.campo === 'total' && item.diferencia === -10));
  assert.ok(result.diferencias.some((item) => item.campo === 'descuentos' && item.motor === 10));
  assert.ok(result.diferencias.some((item) => item.campo === 'benefits'));
  assert.ok(result.motor.reglas_aplicadas.every((rule) => rule.autoaplica === false));
});

test('modo sombra bloquea reglas no determinadas y conserva comparacion actual', () => {
  const publications = loadConstructorPublications();
  const result = publications.evaluateCommercialShadowProposal({
    version: { id: 'version-1', numero: 7, estado_publicacion: 'vigente' },
    currentProposal: {
      totalActual: 95,
      totalOferta: 95,
      planCosto: 65,
      equipoCosto: 30,
    },
    baseProposal: {
      cliente: { convergente: true, ban: 'BAN-002' },
      lineas: [{ linea: 1, evento: 'renovacion', producto: 'movil', plan_monto: 65 }],
      productos: ['movil'],
      precio_base_mensual: 65,
      equipo_mensual: 30,
    },
    rules: [
      proposalRule({ id: 'incompleta', tipo: 'descuento_porcentaje', monto: 8, eventos: ['renovacion'], producto: 'movil', extra: { compatibilidad: 'no_determinado' } }),
    ],
  });

  assert.equal(result.actual.total_flujo_actual, 95);
  assert.equal(result.motor.bloqueada, true);
  assert.equal(result.motor.reglas_aplicadas.length, 0);
  assert.deepEqual(Array.from(result.motor.reglas_descartadas[0].motivos), ['dato_no_determinado']);
  assert.equal(result.motor.total_estimado_mensual, 95);
});

test('Constructor v1 calcula propuesta local con beneficios acumulables e incompatibles sin autoaplicar', () => {
  const publications = loadConstructorPublications();
  const result = publications.evaluateCommercialProposal({
    version: { id: 'version-1', numero: 7, estado_publicacion: 'vigente' },
    baseProposal: {
      cliente: { convergente: true, ban: 'BAN-001' },
      lineas: [{ linea: 1, evento: 'portabilidad', producto: 'movil', plan_monto: 65 }],
      productos: ['movil', 'fijo'],
      precio_base_mensual: 105,
      equipo_mensual: 20,
    },
    rules: [
      proposalRule({ id: 'streaming', tipo: 'bono_streaming', monto: 10, compatibilidad: 'no_acumula', producto: 'fijo' }),
      proposalRule({ id: 'portabilidad', tipo: 'bono_portabilidad', monto: 15, compatibilidad: 'no_acumula', producto: 'movil' }),
      proposalRule({ id: 'data', tipo: 'doble_data', monto: 0, compatibilidad: 'acumula', producto: 'movil' }),
    ],
  });

  assert.equal(result.modo, 'local');
  assert.equal(result.propuesta.total_base_mensual, 125);
  assert.equal(result.propuesta.descuento_mensual_estimado, 15);
  assert.equal(result.propuesta.total_estimado_mensual, 110);
  assert.deepEqual(Array.from(result.reglas_aplicadas.map((rule) => rule.identidad_comercial)), [
    'fijo_benefits|bono_portabilidad|movil',
    'fijo_benefits|doble_data|movil',
  ]);
  assert.deepEqual(Array.from(result.reglas_descartadas.map((rule) => rule.motivos[0])), ['beneficio_incompatible']);
  assert.equal(result.recomendacion.modo, 'simulacion');
  assert.equal(result.recomendacion.autoaplica, false);
  assert.ok(result.alternativas.length >= 2);
});

test('Constructor v1 cubre no convergente renovacion y regla incompleta como descartes explicitos', () => {
  const publications = loadConstructorPublications();
  const result = publications.evaluateCommercialProposal({
    version: { id: 'version-1', numero: 7, estado_publicacion: 'vigente' },
    baseProposal: {
      cliente: { convergente: false, ban: 'BAN-002' },
      lineas: [{ linea: 1, evento: 'renovacion', producto: 'movil', plan_monto: 65 }],
      productos: ['movil'],
      precio_base_mensual: 65,
      equipo_mensual: 30,
    },
    rules: [
      proposalRule({ id: 'renovacion', tipo: 'descuento_porcentaje', monto: 8, eventos: ['renovacion'], producto: 'movil' }),
      proposalRule({ id: 'incompleta', tipo: 'beneficio_no_determinado', monto: 5, eventos: ['renovacion'], producto: 'movil', extra: { compatibilidad: 'no_determinado' } }),
    ],
  });

  assert.equal(result.reglas_aplicadas.length, 0);
  assert.deepEqual(Array.from(result.reglas_descartadas.map((rule) => Array.from(rule.motivos))), [
    ['requiere_convergencia_confirmada'],
    ['dato_no_determinado'],
  ]);
  assert.equal(result.propuesta.bloqueada, true);
  assert.match(result.recomendacion.texto, /No hay reglas aplicables/);
});

test('preparacion fuente principal crea decision comercial manual sin autoaplicar', () => {
  const publications = loadConstructorPublications();
  const decision = publications.buildManualCommercialDecision({
    version: { id: 'version-motor-1', numero: 1 },
    source: 'motor_comercial',
    line: { linea: 1, evento: 'portabilidad', plan_monto: 65 },
    plan: { codigo: 'BRPLUS', nombre: 'Business Red Plus', monto: 65 },
    equipment: { item_code: 'F13030', modelo: 'FRANKLIN JEX STREAM CG890 5G', precio_regular: 299.99 },
    offer: { id: 'oferta-130', nombre: 'Descuento Business Red Plus modems' },
    benefit: { tipo: 'descuento_monto', monto: 130 },
    terms: ['Business Red Plus, lineas 1 a 10'],
    validity: { desde: '2026-04-16' },
    trace: { fuente: 'Boletin Oferta Descuentos Modems, MIFI y Tablets', seccion: 'Planes Multilineas Business RED' },
    totals: { equipo_mensual: 5.67, equipo_regular: 299.99, precio_resultante: 169.99 },
    selected: true,
  });

  assert.equal(decision.source, 'motor_comercial');
  assert.equal(decision.autoaplica, false);
  assert.equal(decision.selected, true);
  assert.equal(decision.plan.codigo, 'BRPLUS');
  assert.equal(decision.equipment.item_code, 'F13030');
  assert.equal(decision.benefit.monto, 130);
  assert.equal(decision.totals.equipo_mensual, 5.67);
  assert.equal(decision.trace.fuente, 'Boletin Oferta Descuentos Modems, MIFI y Tablets');
});

test('preparacion fuente principal conserva fallback y detecta diferencias antes de activar', () => {
  const publications = loadConstructorPublications();
  const motorDecision = publications.buildManualCommercialDecision({
    source: 'motor_comercial',
    line: { linea: 1, evento: 'renovacion', plan_monto: 65 },
    totals: { equipo_mensual: 5.67, equipo_regular: 299.99, precio_resultante: 169.99 },
    selected: true,
  });
  const legacyDecision = publications.buildManualCommercialDecision({
    source: 'flujo_anterior_fallback',
    line: { linea: 1, evento: 'renovacion', plan_monto: 65 },
    totals: { equipo_mensual: 10, equipo_regular: 299.99, precio_resultante: 299.99 },
    selected: true,
  });
  const comparison = publications.compareCommercialDecisionTransition({
    currentDecision: legacyDecision,
    motorDecision,
  });

  assert.equal(comparison.autoaplica, false);
  assert.equal(comparison.ready_for_definitive_source, false);
  assert.equal(comparison.fallback.available, true);
  assert.ok(comparison.diferencias.some(diff => diff.campo === 'equipo_mensual' && diff.diferencia === -4.33));
});

test('Constructor usa una decision comercial seleccionada para carrito, totales y propuesta', () => {
  assert.match(page, /commercialDecision/);
  assert.match(page, /selectedCommercialDecision/);
  assert.match(page, /rowCommercialDecision/);
  assert.match(page, /decisionPaymentPerUnit/);
  assert.match(page, /decisionOfferLabel/);
  assert.match(page, /payload:\{status,comparison:d,state,commercial_decisions:d\.commercialDecisions/);
  assert.doesNotMatch(page, /autoaplica\s*=\s*true/);
});

test('validacion integral Caso A: CRM movil solamente no recibe Benefits de convergencia', () => {
  const publications = loadConstructorPublications();
  const scenario = scenarioFixture(publications, 'crm');
  const base = publications.buildBaseProposalFromCommercialScenario(scenario);
  const result = publications.evaluateCommercialProposal({
    version: { id: 'version-integral', numero: 1, estado_publicacion: 'vigente' },
    baseProposal: base,
    rules: [proposalRule({ id: 'streaming', tipo: 'bono_streaming', monto: 10, producto: 'fijo', eventos: ['renovacion'] })],
  });

  assert.equal(scenario.source_mode, 'crm');
  assert.equal(scenario.full_ban_lines.length, 5);
  assert.equal(scenario.selected_lines.length, 5);
  assert.equal(base.cliente.convergente, false);
  assert.deepEqual(Array.from(base.productos), ['movil']);
  assert.equal(result.reglas_aplicadas.length, 0);
  assert.ok(result.reglas_descartadas.some(rule => rule.motivos.includes('requiere_convergencia_confirmada')));
});

test('validacion integral Casos B C D: CRM Manual y Consulta generan la misma decision convergente', () => {
  const publications = loadConstructorPublications();
  const rules = [
    proposalRule({ id: 'streaming', tipo: 'bono_streaming', monto: 10, producto: 'fijo', eventos: ['renovacion'], compatibilidad: 'no_acumula' }),
    proposalRule({ id: 'data', tipo: 'doble_data', monto: 0, producto: 'movil', eventos: ['renovacion'], compatibilidad: 'acumula' }),
  ];
  const fixedServices = [{ codigo: 'INT500', descripcion: 'Internet fijo publicado', precio: 60 }];
  const crmScenario = scenarioFixture(publications, 'crm', { fixed_services: fixedServices, convergence: { estado: 'convergente' } });
  const manualScenario = scenarioFixture(publications, 'manual', { fixed_services: fixedServices, convergence: { estado: 'convergente' } });
  const consultationScenario = scenarioFixture(publications, 'consultation', { fixed_services: fixedServices, convergence: { estado: 'convergente' } });
  const decisions = [crmScenario, manualScenario, consultationScenario].map(scenario => {
    const base = publications.buildBaseProposalFromCommercialScenario(scenario);
    const result = publications.evaluateCommercialProposal({
      version: { id: 'version-integral', numero: 1, estado_publicacion: 'vigente' },
      baseProposal: base,
      rules,
    });
    return {
      source_mode: scenario.source_mode,
      productos: base.productos,
      aplicada: result.reglas_aplicadas.map(rule => rule.identidad_comercial),
      descartada: result.reglas_descartadas.map(rule => rule.identidad_comercial),
      total: result.propuesta.total_estimado_mensual,
      autoaplica: result.propuesta.autoaplica,
    };
  });

  assert.deepEqual(decisions.map(item => item.source_mode), ['crm', 'manual', 'consultation']);
  assert.deepEqual(Array.from(decisions[0].productos), ['movil', 'fijo']);
  assert.deepEqual(Array.from(decisions[0].aplicada), Array.from(decisions[1].aplicada));
  assert.deepEqual(Array.from(decisions[1].aplicada), Array.from(decisions[2].aplicada));
  assert.deepEqual(Array.from(decisions[0].descartada), Array.from(decisions[1].descartada));
  assert.equal(decisions[0].total, decisions[1].total);
  assert.equal(decisions[1].total, decisions[2].total);
  assert.ok(decisions.every(item => item.autoaplica === false));
});

test('validacion integral Caso E: convergencia insuficiente no infiere beneficio', () => {
  const publications = loadConstructorPublications();
  const scenario = scenarioFixture(publications, 'crm', {
    fixed_services: [{ codigo: 'INT500', descripcion: 'Internet fijo sin Tax ID confirmado', precio: 60 }],
    convergence: { estado: 'requiere_revision' },
  });
  const base = publications.buildBaseProposalFromCommercialScenario(scenario);
  const result = publications.evaluateCommercialProposal({
    version: { id: 'version-integral', numero: 1, estado_publicacion: 'vigente' },
    baseProposal: base,
    rules: [proposalRule({ id: 'streaming', tipo: 'bono_streaming', monto: 10, producto: 'fijo', eventos: ['renovacion'] })],
  });

  assert.equal(base.cliente.convergente, false);
  assert.equal(base.cliente.convergencia_estado, 'requiere_revision');
  assert.equal(result.reglas_aplicadas.length, 0);
  assert.ok(result.reglas_descartadas.some(rule => rule.motivos.includes('requiere_convergencia_confirmada')));
});

test('validacion integral Caso F: Benefit existente incompatible queda descartado con razon', () => {
  const publications = loadConstructorPublications();
  const scenario = scenarioFixture(publications, 'manual', {
    fixed_services: [{ codigo: 'INT500', descripcion: 'Internet fijo publicado', precio: 60 }],
    convergence: { estado: 'convergente' },
  });
  const base = publications.buildBaseProposalFromCommercialScenario(scenario);
  const result = publications.evaluateCommercialProposal({
    version: { id: 'version-integral', numero: 1, estado_publicacion: 'vigente' },
    baseProposal: base,
    rules: [
      proposalRule({ id: 'portabilidad', tipo: 'bono_portabilidad', monto: 15, producto: 'movil', eventos: ['renovacion'], compatibilidad: 'no_acumula' }),
      proposalRule({ id: 'streaming', tipo: 'bono_streaming', monto: 10, producto: 'fijo', eventos: ['renovacion'], compatibilidad: 'no_acumula' }),
    ],
  });

  assert.deepEqual(Array.from(result.reglas_aplicadas.map(rule => rule.identidad_comercial)), ['fijo_benefits|bono_portabilidad|movil']);
  assert.ok(result.reglas_descartadas.some(rule => rule.identidad_comercial === 'fijo_benefits|bono_streaming|fijo' && rule.motivos.includes('beneficio_incompatible')));
  assert.equal(result.propuesta.autoaplica, false);
});
