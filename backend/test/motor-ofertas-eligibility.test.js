import assert from 'node:assert/strict';
import { test } from 'node:test';

const servicePath = '../src/services/motorOfertasEligibility.js';
const TODAY = new Date('2026-07-13T12:00:00.000Z');

async function loadEligibility() {
  try {
    return await import(servicePath);
  } catch (error) {
    assert.fail(`falta motorOfertasEligibility.js: ${error.message}`);
  }
}

function makeRequest(overrides = {}) {
  const request = {
    linea: {
      id: 'linea-1',
      indice: 1,
      ban: 'BAN-1',
      tipo: 'individual',
      familia_business_red: null,
      plan: {
        codigo: 'PLAN-35',
        nombre: 'Plan 35',
        monto: 35,
      },
      evento: 'linea_nueva',
      convergente: false,
      trade_in: {
        estado: 'no_requiere',
        validado: false,
      },
    },
    contexto_ban: {
      posicion_en_ban: 1,
      beneficios_usados_por_oferta: {},
    },
  };

  return {
    ...request,
    ...overrides,
    linea: {
      ...request.linea,
      ...overrides.linea,
      plan: {
        ...request.linea.plan,
        ...overrides.linea?.plan,
      },
      trade_in: {
        ...request.linea.trade_in,
        ...overrides.linea?.trade_in,
      },
    },
    contexto_ban: overrides.contexto_ban === undefined
      ? request.contexto_ban
      : overrides.contexto_ban,
  };
}

function makeOffer(overrides = {}) {
  const contract = {
    id: 'oferta-35',
    nombre: 'Equipo para plan 35',
    estado: 'confirmada',
    vigencia: {
      desde: '2026-07-01',
      hasta: '2026-07-31',
      estado: 'vigente',
    },
    tipos_plan: ['individual'],
    familias: [],
    eventos: ['linea_nueva', 'portabilidad'],
    plazos: [24, 36],
    limite_ban: {
      aplica: true,
      cantidad: 4,
      fuera_limite: 'financiado_si_fuente_lo_permite',
    },
    equipos: [],
    fuente: {
      tipo: 'tabla_financiamiento',
      hoja: 'Ofertas',
      fila: 7,
    },
  };
  const mergedContract = {
    ...contract,
    ...overrides.contract,
    vigencia: {
      ...contract.vigencia,
      ...overrides.contract?.vigencia,
    },
    limite_ban: {
      ...contract.limite_ban,
      ...overrides.contract?.limite_ban,
    },
  };

  return {
    id: 'row-oferta-35',
    oferta_key: mergedContract.id,
    estado_comercial: mergedContract.estado,
    vigencia_documental: mergedContract.vigencia.estado,
    vigencia_desde: mergedContract.vigencia.desde,
    vigencia_hasta: mergedContract.vigencia.hasta,
    plan_monto_minimo: 35,
    plan_monto_maximo: 35,
    contrato: JSON.stringify(mergedContract),
    ...overrides,
    contrato: overrides.contrato ?? JSON.stringify(mergedContract),
  };
}

function makeEquipment(overrides = {}) {
  return {
    id: 'equipo-row-1',
    oferta_id: 'row-oferta-35',
    equipo_key: 'SKU-35',
    equipo_lista_id: 20,
    modelo_comercial: 'Equipo 35',
    modelo_oficial: 'Equipo 35 oficial',
    sku_sif: 'SKU-35',
    sap: 'SAP-35',
    precio_regular: 349.99,
    plazo: 24,
    pago_mensual: 14.58,
    beneficio_tipo: 'equipo_gratis',
    coincidencia: 'exacta',
    ...overrides,
  };
}

function makeSnapshot({ offers = [makeOffer()], equipment = [makeEquipment()] } = {}) {
  return { offers, equipment };
}

test('devuelve solo plazos persistidos para una linea individual de $35', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest(),
    snapshot: makeSnapshot({
      equipment: [
        makeEquipment({ plazo: 24, pago_mensual: 14.58 }),
        makeEquipment({ id: 'equipo-row-2', plazo: 36, pago_mensual: 9.72 }),
        makeEquipment({ id: 'equipo-row-3', plazo: 48, pago_mensual: 7.29 }),
      ],
    }),
    today: TODAY,
  });

  assert.equal(result.equipos.length, 1);
  assert.deepEqual(result.equipos[0].plazos, [
    { meses: 24, pago_mensual: 14.58 },
    { meses: 36, pago_mensual: 9.72 },
  ]);
  assert.deepEqual(result.equipos[0].oferta, {
    id: 'oferta-35',
    nombre: 'Equipo para plan 35',
  });
  assert.equal(result.equipos[0].fuente.hoja, 'Ofertas');
  assert.equal(result.equipos[0].vigencia.estado, 'vigente');
  assert.equal(result.equipos[0].aplicacion_automatica, true);
});

test('exige familia Business RED exacta', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const offer = makeOffer({
    contract: {
      id: 'oferta-business-red',
      tipos_plan: ['multilinea_business_red'],
      familias: ['business_red_plus'],
    },
  });
  const result = evaluateEligibleOffers({
    request: makeRequest({
      linea: {
        tipo: 'multilinea_business_red',
        familia_business_red: 'business_red_extreme',
        plan: { monto: 35 },
      },
    }),
    snapshot: makeSnapshot({ offers: [offer] }),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
  assert.ok(result.validaciones.some((item) => item.codigo === 'sin_equipos_elegibles'));
});

test('no cruza eventos distintos', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const offer = makeOffer({ contract: { eventos: ['portabilidad'] } });
  const result = evaluateEligibleOffers({
    request: makeRequest({ linea: { evento: 'linea_nueva' } }),
    snapshot: makeSnapshot({ offers: [offer] }),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
});

test('permite el beneficio dentro del limite BAN', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest({
      contexto_ban: {
        posicion_en_ban: 4,
        beneficios_usados_por_oferta: { 'oferta-35': 3 },
      },
    }),
    snapshot: makeSnapshot(),
    today: TODAY,
  });

  assert.equal(result.equipos.length, 1);
  assert.equal(result.equipos[0].aplicacion_automatica, true);
});

test('no devuelve combinaciones aplicables fuera del limite BAN', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest({
      contexto_ban: {
        posicion_en_ban: 5,
        beneficios_usados_por_oferta: { 'oferta-35': 4 },
      },
    }),
    snapshot: makeSnapshot(),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
  assert.ok(result.validaciones.some((item) => item.codigo === 'limite_ban_excedido'));
});

test('requiere trade-in validado para renovacion cuando la oferta lo documenta', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const offer = makeOffer({
    contract: {
      eventos: ['renovacion'],
      trade_in: {
        requerido_eventos: ['renovacion'],
        no_requerido_eventos: [],
        texto: 'Requiere trade-in para renovacion',
      },
    },
  });
  const snapshot = makeSnapshot({ offers: [offer] });
  const withoutTradeIn = evaluateEligibleOffers({
    request: makeRequest({
      linea: {
        evento: 'renovacion',
        trade_in: { estado: 'pendiente', validado: false },
      },
    }),
    snapshot,
    today: TODAY,
  });
  const withTradeIn = evaluateEligibleOffers({
    request: makeRequest({
      linea: {
        evento: 'renovacion',
        trade_in: { estado: 'entregado', validado: true },
      },
    }),
    snapshot,
    today: TODAY,
  });

  assert.deepEqual(withoutTradeIn.equipos, []);
  assert.equal(withTradeIn.equipos.length, 1);
});

test('oferta vencida pendiente de reemplazo solo devuelve advertencia', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const offer = makeOffer({
    vigencia_documental: 'vencida_pendiente_reemplazo',
    contract: { vigencia: { estado: 'vencida_pendiente_reemplazo' } },
  });
  const result = evaluateEligibleOffers({
    request: makeRequest(),
    snapshot: makeSnapshot({ offers: [offer] }),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
  assert.ok(result.validaciones.some((item) => item.codigo === 'oferta_vencida_pendiente_reemplazo'));
});

test('equipo pendiente nunca forma una combinacion aplicable', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest(),
    snapshot: makeSnapshot({ equipment: [makeEquipment({ coincidencia: 'pendiente' })] }),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
  assert.ok(result.validaciones.some((item) => item.codigo === 'equipo_no_confirmado'));
});

test('ofertas pendientes o en contradiccion nunca forman combinaciones aplicables', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest(),
    snapshot: makeSnapshot({
      offers: [
        makeOffer({
          id: 'row-pendiente',
          contract: { id: 'oferta-pendiente', estado: 'pendiente_fuente' },
        }),
        makeOffer({
          id: 'row-contradiccion',
          contract: { id: 'oferta-contradiccion', estado: 'contradiccion' },
        }),
      ],
      equipment: [
        makeEquipment({ oferta_id: 'row-pendiente' }),
        makeEquipment({ id: 'equipo-row-contradiccion', oferta_id: 'row-contradiccion' }),
      ],
    }),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
  assert.ok(result.validaciones.some((item) => item.codigo === 'oferta_no_confirmada'));
});

test('no hereda una tarifa cuando falta el rango persistido', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest(),
    snapshot: makeSnapshot({
      offers: [makeOffer({
        plan_monto_minimo: null,
        plan_monto_maximo: null,
      })],
    }),
    today: TODAY,
  });

  assert.deepEqual(result.equipos, []);
  assert.ok(result.validaciones.some((item) => item.codigo === 'monto_plan_no_documentado'));
});

test('sin equipos elegibles responde de forma determinista', async () => {
  const { evaluateEligibleOffers } = await loadEligibility();
  const result = evaluateEligibleOffers({
    request: makeRequest(),
    snapshot: makeSnapshot({ equipment: [] }),
    today: TODAY,
  });

  assert.deepEqual(result, {
    equipos: [],
    validaciones: [{ codigo: 'sin_equipos_elegibles', estado: 'info' }],
  });
});
