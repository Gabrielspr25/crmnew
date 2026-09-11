import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const loader = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');

function loadPublications() {
  const context = {
    window: {},
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    localStorage: { getItem: () => 'token-local' },
  };
  context.window = context;
  vm.runInNewContext(loader, context);
  return context.window.ConstructorPublications;
}

function scenario(publications, overrides = {}) {
  return publications.buildCommercialScenario({
    source_mode: 'consultation',
    client: overrides.client || { id: 'crm-1', name: 'Cliente CRM' },
    ban: { number: '555000111', status: 'activo' },
    account_type: 'Business Regular',
    full_ban_lines: Array.from({ length: overrides.fullLines || 8 }, (_, index) => ({
      id: `sub-${index + 1}`,
      ban: '555000111',
      phone: `78700000${String(index + 1).padStart(2, '0')}`,
      service_type: 'movil',
      current_rent: 65,
      plan_name: 'Business RED Plus',
    })),
    selected_lines: Array.from({ length: overrides.selectedLines || 8 }, (_, index) => ({
      linea: index + 1,
      ban: '555000111',
      evento: overrides.event || 'renovacion',
      producto: 'movil',
      plan_monto: 65,
    })),
    event: overrides.event || 'renovacion',
    plan: { tipo: 'multilinea', multilinea_familia: 'business_red_plus', total_mensual: overrides.planTotal || 520 },
    selected_equipment: [],
    fixed_services: overrides.fixed ? [{ nombre: 'Internet Negocios', precio: 80 }] : [],
    convergence: overrides.convergence || { estado: 'no_confirmada' },
    ...overrides.extra,
  });
}

function motorEquipment({ count, promo = 0, model = 'Samsung Galaxy A37', result = 'gratis', blocked = false } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    linea: index + 1,
    equipment: model,
    resultado: blocked ? 'FUENTE_AMBIGUA' : (index < promo ? result : 'regular'),
    monthly: index < promo ? 0 : 22,
    source: 'Boletin oficial Motor Comercial',
    validity: '2026-08-27',
    explanation: index < promo
      ? 'Decision recibida del Motor Comercial por posicion vigente.'
      : 'Decision recibida del Motor Comercial sin promocion para esta posicion.',
  }));
}

function alternatives(count = 4, brand = 'samsung') {
  return Array.from({ length: count }, (_, index) => ({
    id: `alt-${index + 1}`,
    marca: brand,
    modelo: `${brand} Alternativa ${index + 1}`,
    resultado: 'gratis',
    mensualidad: 0,
    fuente: 'Boletin oficial Motor Comercial',
    vigencia: '2026-08-27',
    regla_id: `regla-alt-${index + 1}`,
  }));
}

test('Consulta interpreta 10 renovaciones Samsung S26 y no decide sin Motor', () => {
  const publications = loadPublications();
  const base = scenario(publications, { selectedLines: 10, fullLines: 10 });
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Tengo 10 lineas para renovar y quiero Samsung S26.',
    scenario: base,
  });

  assert.equal(interpretation.intent.event, 'renovacion');
  assert.equal(interpretation.intent.requested_lines, 10);
  assert.equal(interpretation.intent.primary_equipment, 'Samsung Galaxy S26');
  assert.equal(interpretation.scenario_patch.selected_lines_count, 10);
  assert.equal(interpretation.scenario_patch.equipment_preferences.categoria_producto, 'smartphone');
  assert.equal(interpretation.external_provider, false);
  assert.equal(interpretation.interpreter_type, 'local_rule_based');

  const blocked = publications.evaluateCommercialConsultation({
    query: 'Tengo 10 lineas para renovar y quiero Samsung S26.',
    scenario: base,
  });
  assert.equal(blocked.blocked_reason, 'motor_result_required');
  assert.equal(blocked.commercial_response, null);
  assert.equal(blocked.generated_without_motor, false);
});

test('Consulta conserva Business RED Plus explicito como familia para candidatos del Motor', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Tengo 10 lineas Business Red Plus para renovar y quiero Samsung S26.',
    scenario: publications.buildCommercialScenario({
      source_mode: 'consultation',
      selected_lines: [],
      full_ban_lines: [],
      event: 'renovacion',
      plan: {},
    }),
  });

  assert.equal(interpretation.intent.plan_family, 'business_red_plus');
  assert.equal(interpretation.scenario_patch.plan.tipo, 'multilinea');
  assert.equal(interpretation.scenario_patch.plan.multilinea_familia, 'business_red_plus');
  assert.equal(interpretation.scenario_patch.plan.codigo, 'BREDP1');
});

test('Consulta normaliza familia plus heredada a Business RED Plus sin inferir otra familia', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Tengo 10 lineas para renovar y quiero Samsung S26.',
    scenario: scenario(publications, { selectedLines: 10, fullLines: 10 }),
  });

  assert.equal(interpretation.intent.plan_family, 'business_red_plus');
  assert.equal(interpretation.scenario_patch.plan.multilinea_familia, 'business_red_plus');
});

test('Consulta no infiere Business RED Plus desde selector interno si el escenario no es multilinea', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Tengo 10 lineas para renovar y quiero Samsung S26.',
    scenario: publications.buildCommercialScenario({
      source_mode: 'consultation',
      event: 'renovacion',
      plan: { tipo: 'individual', individual_monto: 35, multilinea_familia: 'plus' },
    }),
  });

  assert.equal(interpretation.intent.plan_family, null);
  assert.equal(interpretation.scenario_patch.plan.tipo, 'individual');
});

test('Consulta interpreta BYOP como modalidad valida sin promocion de equipo', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Cliente BYOP con 3 lineas nuevas y mantener mis equipos.',
    scenario: scenario(publications, { selectedLines: 3, event: 'nueva' }),
  });

  assert.equal(interpretation.intent.event, 'byop');
  assert.equal(interpretation.intent.requested_lines, 3);
  assert.equal(interpretation.scenario_patch.equipment_preferences.mantener_equipos_actuales, true);
});

test('Consulta interpreta las 4 restantes desde el texto', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Busca equipos gratis para las 4 restantes.',
    scenario: scenario(publications, { selectedLines: 8 }),
  });

  assert.equal(interpretation.intent.requested_lines, 4);
  assert.equal(interpretation.intent.requested_remaining_lines, true);
  assert.equal(interpretation.intent.objective, 'buscar_equipos_gratis');
});

test('Consulta reconoce iPhone 17 y preferencia Apple', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Quiero iPhone 17 para portabilidad.',
    scenario: scenario(publications, { event: 'portabilidad' }),
  });

  assert.equal(interpretation.intent.event, 'portabilidad');
  assert.equal(interpretation.intent.primary_equipment, 'iPhone 17');
  assert.equal(interpretation.intent.brand_preference, 'apple');
});

test('Consulta interpreta mezcla de plan Extreme, iPhone 17 y modem 890', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'un renovacion de 5lineas, plan multilinea extreme con iphone 4 eq 17 regular y 1 modem 890',
    scenario: publications.buildCommercialScenario({
      source_mode: 'consultation',
      selected_lines: [],
      full_ban_lines: [],
      plan: {},
    }),
  });

  assert.equal(interpretation.intent.event, 'renovacion');
  assert.equal(interpretation.intent.requested_lines, 5);
  assert.equal(interpretation.intent.plan_family, 'business_red_extreme');
  assert.equal(interpretation.scenario_patch.plan.tipo, 'multilinea');
  assert.equal(interpretation.scenario_patch.plan.multilinea_familia, 'business_red_extreme');
  assert.equal(interpretation.scenario_patch.plan.nombre, 'Business RED Extreme');
  assert.deepEqual(JSON.parse(JSON.stringify(interpretation.intent.equipment_selections.map(item => ({
    cantidad: item.cantidad,
    equipo: item.equipo,
    marca: item.marca,
    categoria: item.categoria,
    confidence: item.confidence,
  })))), [
    { cantidad: 4, equipo: 'iPhone 17', marca: 'apple', categoria: 'smartphone', confidence: 'confirmado' },
    { cantidad: 1, equipo: 'Franklin JEXstream CG890 5G', marca: 'franklin', categoria: 'modem', confidence: 'confirmado' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(interpretation.scenario_patch.selected_equipment.map(item => ({
    modelo: item.modelo,
    cantidad: item.cantidad,
    categoria_producto: item.categoria_producto,
  })))), [
    { modelo: 'iPhone 17', cantidad: 4, categoria_producto: 'smartphone' },
    { modelo: 'Franklin JEXstream CG890 5G', cantidad: 1, categoria_producto: 'modem' },
  ]);
  assert.equal(interpretation.clarification_required, false);
});

test('Consulta reconoce familias Business RED por lenguaje natural sin precio', () => {
  const publications = loadPublications();
  const cases = [
    ['Extreme', 'business_red_extreme', 'Business RED Extreme'],
    ['Business RED Extreme', 'business_red_extreme', 'Business RED Extreme'],
    ['multilinea Supreme', 'business_red_supreme', 'Business RED Supreme'],
    ['Sin Fronteras', 'business_red_sin_fronteras', 'Business RED Sin Fronteras'],
  ];

  for (const [text, key, label] of cases) {
    const interpretation = publications.interpretCommercialConsultation({
      query: `5 renovaciones ${text} con Samsung S26`,
      scenario: publications.buildCommercialScenario({ source_mode: 'consultation', plan: {} }),
    });
    assert.equal(interpretation.intent.plan_family, key);
    assert.equal(interpretation.scenario_patch.plan.nombre, label);
  }
});

test('Consulta bloquea cantidades de equipos que no cuadran con lineas solicitadas', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Tengo 5 lineas y quiero 3 iPhone 17.',
    scenario: scenario(publications, { selectedLines: 5 }),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 3, promo: 0, model: 'iPhone 17' }),
  });

  assert.equal(result.blocked_reason, 'clarificacion_requerida');
  assert.match(result.clarification_questions[0].pregunta, /cantidades/i);
});

test('Consulta pide precision cuando el modelo es ambiguo', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Quiero 3 iPhone Pro y 2 S26.',
    scenario: scenario(publications, { selectedLines: 5 }),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 5, promo: 0 }),
  });

  assert.equal(result.blocked_reason, 'clarificacion_requerida');
  assert.match(JSON.stringify(result.clarification_questions), /iPhone Pro/);
  assert.equal(result.generated_without_motor, false);
});

test('Consulta reconoce cualquier equipo equipos con 50 y comparar opciones', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Compara opciones con cualquier equipo con 50%.',
    scenario: scenario(publications),
  });

  assert.equal(interpretation.intent.objective, 'comparar_opciones');
  assert.equal(interpretation.scenario_patch.equipment_preferences.cualquier_equipo, true);
  assert.equal(interpretation.scenario_patch.equipment_preferences.beneficio_objetivo, 'cualquier_equipo');
});

test('Consulta pide aclaracion puntual cuando la intencion no es segura', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Quiero lo mejor para estas lineas.',
    scenario: scenario(publications),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 1, promo: 0 }),
  });

  assert.equal(result.blocked_reason, 'clarificacion_requerida');
  assert.equal(result.commercial_response, null);
  assert.ok(result.clarification_questions[0].opciones.includes('menor costo'));
});

test('Consulta evalua 8 A37 y solicita alternativas para lineas no cubiertas', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Tengo 8 lineas para renovar y quiero Samsung A37. Dime que puedo usar gratis para completar las demas.',
    scenario: scenario(publications, { selectedLines: 8 }),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 8, promo: 4, model: 'Samsung Galaxy A37' }),
    motorAlternatives: alternatives(4, 'samsung'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.selection.remaining_lines, 4);
  assert.equal(result.motor.equipment_summary.covered, 4);
  assert.equal(result.alternatives.complete, true);
  assert.equal(result.alternatives.alternatives.length, 4);
});

test('Consulta construye respuesta comercial simple sin exponer trazas tecnicas por defecto', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: '5 renovaciones Business RED Extreme, 4 iPhone 17 y 1 modem 890 convergente.',
    scenario: scenario(publications, {
      selectedLines: 5,
      fullLines: 5,
      fixed: true,
      convergence: { estado: 'convergente' },
      extra: {
        plan: {
          tipo: 'multilinea',
          multilinea_familia: 'business_red_extreme',
          nombre: 'Business RED Extreme',
          total_mensual: 200,
          total_mensual_autopay: 150,
        },
      },
    }),
    version: { id: 'v-motor', numero: 'pub-local' },
    rules: [],
    motorEquipmentResults: [
      ...motorEquipment({ count: 4, promo: 4, model: 'iPhone 17', result: 'gratis' }),
      ...motorEquipment({ count: 1, promo: 1, model: 'Franklin JEXstream CG890 5G', result: 'gratis' }).map(item => ({ ...item, linea: 5 })),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.commercial_response.title, 'Cotizacion');
  assert.match(result.commercial_response.summary_text, /5 renovaciones/i);
  assert.match(result.commercial_response.summary_text, /Business RED Extreme/i);
  assert.match(result.commercial_response.summary_text, /4 x iPhone 17/i);
  assert.match(result.commercial_response.summary_text, /1 x Franklin JEXstream CG890 5G/i);
  assert.match(result.commercial_response.summary_text, /Plan sin AutoPay: \$200\.00/i);
  assert.match(result.commercial_response.summary_text, /Plan con AutoPay: \$150\.00/i);
  assert.doesNotMatch(result.commercial_response.summary_text, /source_mode|commercialScenario|confidence|rule_id|publication_id|motor_decision_id|autoaplica|pendiente_seleccion_vendedor/i);
  assert.ok(result.actions.includes('Enviar a Comparativa'));
  assert.ok(result.actions.includes('Ver detalles'));
});

test('Agente Comercial responde como vendedor e infiere 8 lineas desde 5 iPhone y 3 modem', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'renovacion con 5 iphone 17 multilinea extreme y 3 modem 890 convergente',
    scenario: scenario(publications, {
      selectedLines: 0,
      fullLines: 0,
      event: null,
      convergence: { estado: 'no_confirmada' },
      extra: {
        selected_lines: [],
        full_ban_lines: [],
        plan: {},
      },
    }),
    version: { id: 'v-motor', numero: 'pub-local' },
    motorDecision: {
      propuesta: { total_base_mensual: 0, total_estimado_mensual: 0 },
      reglas_aplicadas: [
        {
          nombre: 'Beneficio Claro Full PYMES',
          beneficio: 'Convergencia confirmada',
          estado_confianza: 'confirmado',
          fuente: 'Claro Full PYMES @23.JUL.2026',
          vigencia: '2026-07-23',
        },
      ],
      reglas_descartadas: [],
      recomendacion: { texto: 'Cotizacion calculada por Motor Comercial en modo simulacion.' },
    },
    motorEquipmentResults: [
      ...motorEquipment({ count: 5, promo: 5, model: 'iPhone 17', result: 'gratis' }),
      ...motorEquipment({ count: 3, promo: 0, model: 'Franklin JEXstream CG890 5G', result: 'regular' }).map((item, index) => ({
        ...item,
        linea: index + 6,
        monthly: 15,
      })),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.interpretation.intent.requested_lines, 8);
  assert.equal(result.scenario.selected_lines_count, 8);
  assert.equal(result.scenario.event, 'renovacion');
  assert.equal(result.scenario.plan.multilinea_familia, 'business_red_extreme');
  assert.equal(result.scenario.convergence.estado, 'convergente');
  assert.equal(result.scenario.selected_equipment.find(item => item.modelo === 'iPhone 17').cantidad, 5);
  assert.equal(result.scenario.selected_equipment.find(item => item.modelo === 'Franklin JEXstream CG890 5G').cantidad, 3);
  assert.match(result.commercial_response.summary_text, /Para las 8 renovaciones en Business RED Extreme/i);
  assert.match(result.commercial_response.summary_text, /5 x iPhone 17/i);
  assert.match(result.commercial_response.summary_text, /3 x Franklin JEXstream CG890 5G/i);
  assert.match(result.commercial_response.summary_text, /Beneficios por convergencia/i);
  assert.match(result.commercial_response.summary_text, /Beneficio Claro Full PYMES/i);
  assert.doesNotMatch(result.commercial_response.summary_text, /Intencion detectada|source_mode|commercialScenario|autoaplica|rule_id|confidence|publication_id|pendiente_seleccion_vendedor|lineas no especificadas|1 linea/i);
});

test('Consulta exacta con simbolo de multiplicacion infiere 7 lineas y dos grupos de equipos', () => {
  const publications = loadPublications();
  const result = publications.interpretCommercialConsultation({
    query: 'renovación Business RED Extreme multilínea 5 × iPhone 17 2 × Franklin JEXstream CG890 5G convergente',
    scenario: scenario(publications, {
      selectedLines: 0,
      fullLines: 0,
      event: null,
      convergence: { estado: 'no_confirmada' },
      extra: {
        selected_lines: [],
        full_ban_lines: [],
        plan: {},
      },
    }),
  });

  assert.equal(result.intent.requested_lines, 7);
  assert.equal(result.scenario_patch.selected_lines_count, 7);
  assert.equal(result.intent.event, 'renovacion');
  assert.equal(result.intent.plan_family, 'business_red_extreme');
  assert.equal(result.scenario_patch.convergence.estado, 'convergente');
  assert.deepEqual(JSON.parse(JSON.stringify(result.intent.equipment_selections.map(item => ({
    cantidad: item.cantidad,
    equipo: item.equipo,
  })))), [
    { cantidad: 5, equipo: 'iPhone 17' },
    { cantidad: 2, equipo: 'Franklin JEXstream CG890 5G' },
  ]);
});

test('Consulta prepara payload para Comparativa existente sin recalcular promociones', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: '5 renovaciones Business RED Extreme, 4 iPhone 17 y 1 modem 890 convergente.',
    scenario: scenario(publications, {
      selectedLines: 5,
      fullLines: 5,
      fixed: true,
      convergence: { estado: 'convergente' },
      extra: {
        plan: {
          tipo: 'multilinea',
          multilinea_familia: 'business_red_extreme',
          nombre: 'Business RED Extreme',
          total_mensual: 200,
          total_mensual_autopay: 150,
        },
      },
    }),
    version: { id: 'v-motor', numero: 'pub-local' },
    rules: [],
    motorEquipmentResults: [
      ...motorEquipment({ count: 4, promo: 4, model: 'iPhone 17', result: 'gratis' }),
      ...motorEquipment({ count: 1, promo: 1, model: 'Franklin JEXstream CG890 5G', result: 'gratis' }).map(item => ({ ...item, linea: 5 })),
    ],
  });
  const payload = publications.buildConsultationComparisonPayload({
    result,
    clientId: 'crm-1',
    currentRows: [{ linea: 1, plan: 'Actual', costo: 90 }],
    status: 'borrador',
  });

  assert.equal(payload.client_id, 'crm-1');
  assert.equal(payload.source, 'constructor_agente_comercial');
  assert.equal(payload.payload.status, 'borrador');
  assert.equal(payload.payload.comparison_source, 'comparativas_existente');
  assert.equal(payload.payload.recalculate_in_comparativa, false);
  assert.equal(payload.payload.scenario.selected_lines_count, 5);
  assert.equal(payload.payload.scenario.plan.multilinea_familia, 'business_red_extreme');
  assert.equal(payload.payload.propuesta.equipos.length, 2);
  assert.equal(payload.payload.propuesta.equipos.find(item => item.modelo === 'iPhone 17').cantidad, 4);
  assert.equal(payload.payload.propuesta.equipos.find(item => item.modelo === 'Franklin JEXstream CG890 5G').cantidad, 1);
  assert.equal(payload.lines.length, 1);
  assert.ok(Array.isArray(payload.payload.beneficios_aplicados));
  assert.doesNotMatch(JSON.stringify(payload.payload.beneficios_aplicados), /requiere_revision|FUENTE_AMBIGUA|contradiccion/i);
});

test('Consulta bloquea envio a Comparativa si la huella del escenario cambio', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: '5 renovaciones Business RED Extreme, 4 iPhone 17 y 1 modem 890 convergente.',
    scenario: scenario(publications, {
      selectedLines: 5,
      fullLines: 5,
      fixed: true,
      convergence: { estado: 'convergente' },
      extra: { plan: { tipo: 'multilinea', multilinea_familia: 'business_red_extreme', nombre: 'Business RED Extreme' } },
    }),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 5, promo: 5, model: 'iPhone 17', result: 'gratis' }),
  });

  assert.throws(
    () => publications.buildConsultationComparisonPayload({
      result,
      clientId: 'crm-1',
      expectedFingerprint: 'escenario-mostrado',
      currentFingerprint: 'escenario-modificado',
    }),
    /consulta_comparativa_mismatch/
  );
});

test('Consulta respeta solo Samsung al filtrar alternativas del Motor', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Quiero solo Samsung para renovar.',
    scenario: scenario(publications),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 2, promo: 0 }),
    motorAlternatives: [...alternatives(2, 'samsung'), ...alternatives(2, 'motorola')],
  });

  assert.equal(result.interpretation.intent.brand_preference, 'samsung');
  assert.ok(result.alternatives.alternatives.every(item => item.brand === 'samsung'));
  assert.match(result.commercial_response.summary_text, /Equipos: preferencia samsung/);
  assert.doesNotMatch(result.commercial_response.summary_text, /2 x samsung|8 x samsung|10 x samsung/i);
});

test('Consulta interpreta presupuesto maximo de 500 mensuales', () => {
  const publications = loadPublications();
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Quiero Samsung pero no quiero pasar de $500 entre plan y equipos.',
    scenario: scenario(publications),
  });

  assert.equal(interpretation.intent.max_monthly_budget, 500);
  assert.equal(interpretation.intent.objective, 'optimizar_costo');
});

test('Consulta desde CRM usa todas las lineas del contexto cuando el vendedor dice todas', () => {
  const publications = loadPublications();
  const base = scenario(publications, { selectedLines: 6, fullLines: 6 });
  const interpretation = publications.interpretCommercialConsultation({
    query: 'Renueva todas y dime que equipos gratis tengo.',
    scenario: base,
  });

  assert.equal(interpretation.intent.requested_lines, 6);
  assert.equal(interpretation.scenario_patch.selected_lines_count, 6);
});

test('Consulta manual sin cliente conserva escenario y no inventa CRM', () => {
  const publications = loadPublications();
  const base = scenario(publications, { client: {}, selectedLines: 1, fullLines: 0 });
  const result = publications.evaluateCommercialConsultation({
    query: 'Quiero Samsung.',
    scenario: base,
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 1, promo: 0 }),
  });

  assert.equal(result.scenario.client.id, null);
  assert.equal(result.scenario.source_mode, 'consultation');
  assert.equal(result.autoaplica, false);
});

test('Consulta conserva convergencia confirmada para que decida el Motor', () => {
  const publications = loadPublications();
  const base = scenario(publications, { fixed: true, convergence: { estado: 'convergente' } });
  const applied = publications.applyConsultationIntentToScenario({
    scenario: base,
    interpretation: publications.interpretCommercialConsultation({ query: 'Quiero Samsung para todas.', scenario: base }),
  });
  const proposal = publications.buildBaseProposalFromCommercialScenario(applied);

  assert.equal(proposal.cliente.convergente, true);
  assert.ok(proposal.productos.includes('fijo'));
});

test('Consulta no inventa convergencia cuando el cliente no es convergente', () => {
  const publications = loadPublications();
  const base = scenario(publications, { convergence: { estado: 'no_confirmada' } });
  const proposal = publications.buildBaseProposalFromCommercialScenario(base);

  assert.equal(proposal.cliente.convergente, false);
  assert.equal(proposal.cliente.convergencia_estado, 'no_confirmada');
});

test('Consulta marca FUENTE_AMBIGUA como revision comercial', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Quiero Samsung A37.',
    scenario: scenario(publications),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 1, promo: 0, blocked: true }),
  });

  assert.equal(result.blocked, true);
  assert.equal(result.blocked_reason, 'requiere_revision_comercial');
  assert.equal(result.motor.equipment_summary.blocked, 1);
});

test('Consulta muestra equipo sin promocion como regular, no como gratis', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Quiero Samsung A37.',
    scenario: scenario(publications, { selectedLines: 1 }),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: motorEquipment({ count: 1, promo: 0 }),
  });

  assert.equal(result.motor.equipment_summary.covered, 0);
  assert.equal(result.motor.equipment_summary.regular, 1);
});

test('Consulta conserva bloqueo por maximo BAN agotado recibido del Motor', () => {
  const publications = loadPublications();
  const result = publications.evaluateCommercialConsultation({
    query: 'Tengo 8 lineas para renovar y quiero Samsung A37.',
    scenario: scenario(publications, { selectedLines: 8 }),
    version: { id: 'v-motor' },
    rules: [],
    motorEquipmentResults: [
      ...motorEquipment({ count: 4, promo: 4 }),
      ...Array.from({ length: 4 }, (_, index) => ({
        linea: index + 5,
        equipment: 'Samsung Galaxy A37',
        resultado: 'requiere_revision',
        motivos: ['limite_ban_agotado'],
        source: 'Boletin oficial Motor Comercial',
      })),
    ],
  });

  assert.equal(result.blocked, true);
  assert.equal(result.motor.equipment_summary.blocked, 4);
});

test('Consulta encuentra alternativas cuando el Motor las devuelve vigentes', () => {
  const publications = loadPublications();
  const result = publications.findCommercialAlternatives({
    remainingLines: 2,
    preferences: { brand: 'samsung', objective: 'buscar_equipos_gratis' },
    motorAlternatives: alternatives(3, 'samsung'),
  });

  assert.equal(result.found, 2);
  assert.equal(result.complete, true);
  assert.equal(result.blocked, false);
});

test('Consulta filtra alternativas automaticas por categoria smartphone y agrupa repetidas', () => {
  const publications = loadPublications();
  const result = publications.findCommercialAlternatives({
    remainingLines: 4,
    preferences: { brand: 'samsung', productCategory: 'smartphone' },
    motorAlternatives: [
      {
        posicion: 4,
        fabricante: 'samsung',
        equipo: 'Samsung Galaxy S25 FE',
        categoria: 'gama_alta',
        tipo_beneficio: 'gratis',
        mensualidad: 0,
        fuente_publicacion: { archivo: 'PYMES 27.AGO.2026.pdf' },
        vigencia: '2026-08-27',
        regla_id: 'brp-s25-fe',
      },
      {
        posicion: 5,
        fabricante: 'samsung',
        equipo: 'Samsung Galaxy S25 FE',
        categoria: 'gama_alta',
        tipo_beneficio: 'gratis',
        mensualidad: 0,
        fuente_publicacion: { archivo: 'PYMES 27.AGO.2026.pdf' },
        vigencia: '2026-08-27',
        regla_id: 'brp-s25-fe',
      },
      {
        posicion: 6,
        fabricante: 'samsung',
        equipo: 'Samsung Galaxy Tab S10 FE 128GB 5G',
        categoria_producto: 'tablet',
        tipo_beneficio: 'gratis',
        mensualidad: 0,
        fuente_publicacion: { archivo: 'PYMES 27.AGO.2026.pdf' },
        vigencia: '2026-08-27',
        regla_id: 'tablet-130',
      },
      {
        posicion: 7,
        fabricante: 'samsung',
        equipo: 'Samsung MIFI',
        categoria_producto: 'mifi',
        tipo_beneficio: 'gratis',
        mensualidad: 0,
        fuente_publicacion: { archivo: 'PYMES 27.AGO.2026.pdf' },
        vigencia: '2026-08-27',
        regla_id: 'mifi-130',
      },
    ],
  });

  assert.equal(result.found, 1);
  assert.equal(result.complete, false);
  assert.equal(result.alternatives[0].equipment, 'Samsung Galaxy S25 FE');
  assert.equal(result.alternatives[0].available_lines, 2);
  assert.equal(JSON.stringify(result.alternatives[0].lineas), JSON.stringify([4, 5]));
  assert.doesNotMatch(JSON.stringify(result.alternatives), /Tab S10|MIFI/);
});

test('Consulta considera completo un grupo repetido cuando cubre todas las lineas pendientes', () => {
  const publications = loadPublications();
  const result = publications.findCommercialAlternatives({
    remainingLines: 2,
    preferences: { brand: 'samsung', productCategory: 'smartphone' },
    motorAlternatives: [
      {
        posicion: 4,
        fabricante: 'samsung',
        equipo: 'Samsung Galaxy S25 FE',
        categoria: 'gama_baja',
        tipo_beneficio: 'gratis',
        mensualidad: 0,
        fuente_publicacion: 'PYMES 27.AGO.2026.pdf',
        regla_id: 'brp-s25-fe',
      },
      {
        posicion: 5,
        fabricante: 'samsung',
        equipo: 'Samsung Galaxy S25 FE',
        categoria: 'gama_baja',
        tipo_beneficio: 'gratis',
        mensualidad: 0,
        fuente_publicacion: 'PYMES 27.AGO.2026.pdf',
        regla_id: 'brp-s25-fe',
      },
    ],
  });

  assert.equal(result.found, 1);
  assert.equal(result.complete, true);
  assert.equal(result.alternatives[0].available_lines, 2);
});

test('Consulta bloquea alternativas cuando el Motor no devuelve candidatas vigentes', () => {
  const publications = loadPublications();
  const result = publications.findCommercialAlternatives({
    remainingLines: 2,
    preferences: { brand: 'samsung', objective: 'buscar_equipos_gratis' },
    motorAlternatives: alternatives(2, 'motorola'),
  });

  assert.equal(result.found, 0);
  assert.equal(result.complete, false);
  assert.equal(result.blocked_reason, 'sin_alternativas_vigentes_motor');
});

test('Pantalla muestra resultado estructurado de Consulta y acciones sin autoaplica', () => {
  assert.match(page, /id="consultationResult"/);
  assert.match(page, /function renderConsultationResult/);
  assert.match(page, /evaluateCommercialConsultation/);
  assert.match(page, /loadConsultationMotorCandidates/);
  assert.match(page, /function consultationPlanFamily/);
  assert.match(page, /function consultationMotorEquipmentRowsFromCandidates/);
  assert.match(page, /function sourceDisplayName/);
  assert.match(page, /item\.tipo_beneficio==='financiado'&&!hasDiscount\?'regular'/);
  assert.match(page, /function consultationBenefitDisplay/);
  assert.match(page, /Disponible hasta/);
  assert.match(page, /Cotizacion por linea/);
  assert.match(page, /<th>Linea<\/th><th>Equipo<\/th><th>Precio regular<\/th><th>Oferta<\/th><th>Credito\/descuento<\/th><th>Equipo\/mes neto<\/th><th>Plan\/mes<\/th><th>Total linea<\/th>/);
  assert.match(page, /Mensualidad regular/);
  assert.match(page, /Credito\/descuento/);
  assert.match(page, /Mensualidad neta/);
  assert.match(page, /lineRegularMonthly/);
  assert.match(page, /lineNetMonthly/);
  assert.match(page, /lineDiscountMonthly/);
  assert.match(page, /No puedo cerrar el total porque falta precio vigente para/);
  assert.doesNotMatch(page, /Cantidad<\/th><th>Resultado Motor/);
  assert.doesNotMatch(page, /Resumen de equipos/);
  assert.match(page, /intent\?\.plan_family/);
  assert.match(page, /consultationPlanKeyFromFamily/);
  assert.match(page, /equipment_selections/);
  assert.match(page, /selected_equipment/);
  assert.match(page, /business_red_extreme/);
  assert.match(page, /Business RED Extreme/);
  assert.match(page, /Necesito una aclaracion puntual antes de cotizar/);
  assert.match(page, /consultationScenarioForEvaluation/);
  assert.doesNotMatch(page, /total_mensual:lineMonthly\*count/);
  assert.match(page, /total_mensual_autopay/);
  assert.match(page, /autopay_assumed:false/);
  assert.match(page, /Sin AutoPay/);
  assert.match(page, /Con AutoPay/);
  assert.match(page, /Total equipos neto/);
  assert.match(page, /consultationLoadedIntoConstructor/);
  assert.match(page, /hideManual/);
  assert.match(page, /Business RED Plus/);
  assert.match(page, /renderSummary\(\);/);
  assert.match(page, /Array\.from\(\{length:count\}/);
  assert.match(page, /planFamily==='business_red_plus'\?'BREDP1'/);
  assert.doesNotMatch(page, /item\.source\|\|'-'/);
  assert.match(page, /consultationDecisionFingerprint/);
  assert.match(page, /consultationScenarioFingerprint/);
  assert.match(page, /consulta_constructor_mismatch/);
  assert.match(page, /Enviar a Comparativa/);
  assert.match(page, /Nueva consulta/);
  assert.match(page, /function startNewConsultation/);
  assert.match(page, /consultationTraceVisible=false/);
  assert.match(page, /function sendConsultationToComparison/);
  assert.match(page, /consulta_comparativa_mismatch/);
  assert.match(page, /Ver detalles/);
  assert.match(page, /source:'constructor_agente_comercial'/);
  assert.doesNotMatch(page, /source_mode=consultation/);
  assert.match(loader, /function buildConsultationComparisonPayload/);
  assert.match(loader, /comparison_source:\s*'comparativas_existente'/);
  assert.match(loader, /recalculate_in_comparativa:\s*false/);
  assert.match(loader, /commercialCandidates:\s*'\/api\/motor-ofertas\/candidatos-alternativas'/);
  assert.match(loader, /requestCommercialCandidates/);
  assert.match(page, /Cargar al Constructor/);
  assert.match(page, /autoaplica=false/);
  assert.doesNotMatch(page, /chat\/completions|api\.openai|anthropic|COMMERCIAL_CONSULTATION_LLM_API_KEY|autoaplica\s*=\s*true/);
});

test('Agente Comercial conserva un mismo commercialScenario entre turnos', () => {
  const publications = loadPublications();
  let session = publications.createCommercialAgentSession({
    scenario: publications.buildCommercialScenario({
      source_mode: 'consultation',
      selected_lines: [],
      full_ban_lines: [],
      plan: { tipo: 'multilinea', multilinea_familia: 'business_red_plus', codigo: 'BREDP1', nombre: 'Business RED Plus' },
    }),
  });

  session = publications.applyCommercialAgentTurn({ session, query: 'Tengo 5 renovaciones' }).session;
  assert.equal(session.scenario.selected_lines_count, 5);
  assert.equal(session.scenario.event, 'renovacion');

  session = publications.applyCommercialAgentTurn({ session, query: 'Quiero 3 iPhone Pro y 2 S26' }).session;
  assert.equal(session.scenario.selected_lines_count, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(session.scenario.selected_equipment.map(item => [item.modelo, item.cantidad]))), [
    ['iPhone Pro', 3],
    ['Samsung Galaxy S26', 2],
  ]);

  session = publications.applyCommercialAgentTurn({ session, query: 'Agrégame 2 tablets' }).session;
  assert.equal(session.scenario.selected_lines_count, 5);
  assert.ok(session.scenario.selected_equipment.some(item => item.categoria_producto === 'tablet' && item.cantidad === 2));
  assert.equal(session.turns.length, 3);
  assert.equal(session.external_provider, false);
  assert.equal(session.autoaplica, false);
});

test('Agente Comercial puede cambiar cantidades y reemplazar equipo sin decidir promociones', () => {
  const publications = loadPublications();
  let session = publications.createCommercialAgentSession({
    scenario: scenario(publications, { selectedLines: 5, fullLines: 5 }),
  });

  session = publications.applyCommercialAgentTurn({ session, query: 'Quiero 3 iPhone Pro y 2 S26' }).session;
  session = publications.applyCommercialAgentTurn({ session, query: 'Reemplaza los 2 S26 por Samsung A37' }).session;

  assert.ok(session.scenario.selected_equipment.some(item => item.modelo === 'iPhone Pro' && item.cantidad === 3));
  assert.ok(session.scenario.selected_equipment.some(item => item.modelo === 'Samsung Galaxy A37' && item.cantidad === 2));
  assert.equal(session.scenario.selected_equipment.some(item => item.modelo === 'Samsung Galaxy S26'), false);
  assert.equal(session.last_result.blocked_reason, 'motor_result_required');
  assert.equal(session.last_result.generated_without_motor, false);
});

test('Agente Comercial sustituye seleccion vieja cuando nueva consulta cambia a estrategia marca presupuesto', () => {
  const publications = loadPublications();
  let session = publications.createCommercialAgentSession({
    scenario: publications.buildCommercialScenario({
      source_mode: 'consultation',
      selected_lines: [],
      full_ban_lines: Array.from({ length: 10 }, (_, index) => ({ id: `sub-${index + 1}`, ban: '555000111', current_rent: 65 })),
      event: 'renovacion',
      plan: { tipo: 'multilinea', multilinea_familia: 'business_red_extreme', nombre: 'Business RED Extreme' },
    }),
  });

  session = publications.applyCommercialAgentTurn({ session, query: 'Tengo 5 renovaciones Business RED Extreme con 4 iPhone 17 y 1 modem 890' }).session;
  assert.equal(session.scenario.selected_lines_count, 5);
  assert.ok(session.scenario.selected_equipment.some(item => item.modelo === 'Franklin JEXstream CG890 5G'));

  session = publications.applyCommercialAgentTurn({ session, query: '10 lineas Samsung, maximo $500, mayor ahorro' }).session;

  assert.equal(session.scenario.selected_lines_count, 10);
  assert.equal(session.scenario.event, 'renovacion');
  assert.equal(session.scenario.equipment_preferences.marca, 'samsung');
  assert.equal(session.scenario.equipment_preferences.modelo, null);
  assert.equal(session.scenario.budget.maximo_mensual, 500);
  assert.equal(session.scenario.seller_preferences.objetivo, 'maximo_ahorro');
  assert.equal(session.scenario.selected_equipment.length, 0);
  assert.equal(session.scenario.selected_equipment.some(item => /Franklin|iPhone/i.test(item.modelo || '')), false);
  assert.equal(session.last_result.blocked_reason, 'motor_result_required');
});

test('Consulta de marca y presupuesto no pide cantidades de equipos si no hay modelo explicito', () => {
  const publications = loadPublications();
  const base = publications.buildCommercialScenario({
    source_mode: 'consultation',
    selected_lines: Array.from({ length: 5 }, (_, index) => ({ linea: index + 1, evento: 'renovacion', producto: 'movil' })),
    event: 'renovacion',
    plan: { tipo: 'multilinea', multilinea_familia: 'business_red_extreme', nombre: 'Business RED Extreme' },
    equipment_preferences: { modelo: 'Franklin JEXstream CG890 5G', marca: 'franklin', categoria_producto: 'modem' },
    selected_equipment: [{ modelo: 'Franklin JEXstream CG890 5G', marca: 'franklin', categoria_producto: 'modem', cantidad: 1 }],
    budget: { maximo_mensual: 300 },
  });
  const interpretation = publications.interpretCommercialConsultation({
    query: '10 lineas Samsung, maximo $500, mayor ahorro',
    scenario: base,
  });

  assert.equal(interpretation.intent.requested_lines, 10);
  assert.equal(interpretation.intent.brand_preference, 'samsung');
  assert.equal(interpretation.intent.max_monthly_budget, 500);
  assert.equal(interpretation.intent.objective, 'maximo_ahorro');
  assert.equal(interpretation.scenario_patch.equipment_preferences.modelo, null);
  assert.equal(interpretation.scenario_patch.selected_equipment.length, 0);
  assert.equal(interpretation.intent.equipment_quantity_mismatch, false);
  assert.equal(interpretation.clarification_questions.some(item => item.campo === 'cantidades_equipos'), false);
});

test('Agente Comercial conserva presupuesto y pide Motor para benefits', () => {
  const publications = loadPublications();
  let session = publications.createCommercialAgentSession({ scenario: scenario(publications, { selectedLines: 5 }) });
  session = publications.applyCommercialAgentTurn({ session, query: 'No quiero pasar de $500' }).session;
  session = publications.applyCommercialAgentTurn({ session, query: 'Que Benefits me aplican?' }).session;

  assert.equal(session.scenario.budget.maximo_mensual, 500);
  assert.equal(session.last_turn.intent.objective, 'consultar_benefits');
  assert.equal(session.last_result.blocked_reason, 'motor_result_required');
  assert.match(JSON.stringify(session.last_result), /Motor Comercial/);
});
