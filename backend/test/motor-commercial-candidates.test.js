import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  findBusinessRedPlusCommercialCandidates,
  resolveCurrentEquipmentPrice,
} from '../src/services/businessRedPlusEligibility.js';

const routeSource = await readFile(new URL('../src/routes/motorOfertasRoutes.js', import.meta.url), 'utf8');

const block = {
  plan: { nombre: 'Business Red Plus', monto: 65 },
  line_order_dependent: true,
  vigencia: { desde: '2026-08-27', hasta: null },
  source: { archivo: 'Boletin oficial Business RED Plus 27-08-2026.pdf', pagina: 3 },
  groups: [
    {
      line_discounts: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      price_codes: { up: 'UPA3730', fi: 'FIA3730' },
      equipment: [
        { manufacturer: 'Samsung', model: 'Samsung Galaxy A37', regular_price: 349.99, discount_prices: [0, 0, 0, 0, 349.99, 349.99, 349.99, 349.99, 349.99, 349.99] },
      ],
      source: { hoja: 'Ofertas Business Red Plus', row: 10 },
    },
    {
      line_discounts: [1, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0],
      price_codes: { up: 'UPS2630', fi: 'FIS2630' },
      equipment: [
        { manufacturer: 'Samsung', model: 'Samsung Galaxy S26', regular_price: 999.99, discount_prices: [0, 499.99, 499.99, 499.99, 999.99, 999.99, 999.99, 999.99, 999.99, 999.99] },
      ],
      source: { hoja: 'Ofertas Business Red Plus', row: 20 },
    },
  ],
};

function line(position, overrides = {}) {
  const family = overrides.familia_business_red || 'business_red_plus';
  return {
    id: `linea-${position}`,
    tipo: 'multilinea_business_red',
    familia_business_red: family,
    modalidad_linea: 'financiamiento',
    plan: {
      codigo: family === 'business_red_extreme' ? 'BREDE1' : 'BREDP1',
      nombre: family === 'business_red_extreme' ? 'Business RED Extreme' : 'Business RED Plus',
      monto: overrides.plan_monto ?? (family === 'business_red_extreme' ? 40 : 65),
      monto_autopay: overrides.plan_monto_autopay ?? (family === 'business_red_extreme' ? 30 : 55),
    },
    evento: 'renovacion',
    trade_in: { aplica: false, validado: false },
    posicion_en_ban: position,
    ...overrides,
  };
}

function lines(from, to, overrides = {}) {
  return Array.from({ length: to - from + 1 }, (_, index) => line(from + index, overrides));
}

const offers = [
  {
    id: 'portafolio-gratis-45',
    nombre: 'Equipo gratis desde $45',
    estado_comercial: 'confirmada',
    vigencia_documental: 'vigente',
    tipo_linea: 'multilinea_business_red',
    familias: ['business_red_plus'],
    plan: { min: 45, max: null },
    eventos: ['renovacion', 'portabilidad'],
    trade_in: { renovacion_requerido: false },
    limite_ban: { aplica: true, cantidad: 4, fuera_limite: 'financiado_si_fuente_lo_permite' },
    beneficio: { tipo: 'gratis' },
    equipos: [
      { id: 'galaxy-a16', marca: 'Samsung', modelo_oficial: 'Samsung Galaxy A16', modelo_comercial: 'Samsung Galaxy A16', precio_regular: 199.99, coincidencia: 'exacta', plazos: [{ meses: 30, precio_financiado: 0, pago_mensual: 0, price_code: 'FIA1630' }] },
      { id: 'moto-g', marca: 'Motorola', modelo_oficial: 'Motorola G', modelo_comercial: 'Motorola G', precio_regular: 149.99, coincidencia: 'exacta', plazos: [{ meses: 30, precio_financiado: 0, pago_mensual: 0, price_code: 'FIG30' }] },
    ],
    fuente: { archivo: 'Tabla Ofertas Financiamiento 27 agosto 2026.xlsx', hoja: 'Ofertas Equipos en Portafolio', fila: 7 },
    vigencia: { desde: '2026-08-27', hasta: null },
  },
  {
    id: 'alternativa-gratis-confirmada',
    nombre: 'Alternativa gratis confirmada',
    estado_comercial: 'confirmada',
    vigencia_documental: 'vigente',
    tipo_linea: 'multilinea_business_red',
    familias: ['business_red_plus'],
    plan: { min: 45, max: null },
    eventos: ['renovacion', 'portabilidad'],
    trade_in: { renovacion_requerido: false },
    limite_ban: { aplica: false },
    beneficio: { tipo: 'gratis' },
    equipos: [
      { id: 'galaxy-a15', marca: 'Samsung', modelo_oficial: 'Samsung Galaxy A15', modelo_comercial: 'Samsung Galaxy A15', precio_regular: 149.99, coincidencia: 'exacta', plazos: [{ meses: 30, precio_financiado: 0, pago_mensual: 0, price_code: 'FIA1530' }] },
    ],
    fuente: { archivo: 'Tabla Ofertas Financiamiento 27 agosto 2026.xlsx', hoja: 'Ofertas Equipos en Portafolio', fila: 9 },
    vigencia: { desde: '2026-08-27', hasta: null },
  },
  {
    id: 'portafolio-ambigua',
    nombre: 'Oferta con fuente ambigua',
    estado_comercial: 'confirmada',
    vigencia_documental: 'vigente',
    tipo_linea: 'multilinea_business_red',
    familias: ['business_red_plus'],
    plan: { min: 45, max: null },
    eventos: ['renovacion'],
    trade_in: { renovacion_requerido: false },
    limite_ban: { aplica: false },
    beneficio: { tipo: 'gratis' },
    equipos: [
      { id: 'ambiguous-phone', marca: 'Samsung', modelo_oficial: 'Samsung Ambiguo', modelo_comercial: 'Samsung Ambiguo', precio_regular: 99.99, coincidencia: 'exacta', plazos: [{ meses: 30, precio_financiado: 0, pago_mensual: 0 }] },
    ],
    fuente: { archivo: 'Fuente en revision.pdf', estado_confianza: 'FUENTE_AMBIGUA' },
    vigencia: { desde: '2026-08-27', hasta: null },
  },
];

const mixedScenarioOffers = [
  {
    id: 'iphone-17-extreme-financiado',
    nombre: 'iPhone 17 financiado Business RED Extreme',
    estado_comercial: 'confirmada',
    vigencia_documental: 'vigente',
    tipo_linea: 'multilinea_business_red',
    familias: ['business_red_extreme'],
    plan: { min: 35, max: null },
    eventos: ['renovacion'],
    trade_in: { renovacion_requerido: false },
    limite_ban: { aplica: false },
    beneficio: { tipo: 'financiado' },
    equipos: [
      {
        id: 'iphone-17-256',
        marca: 'Apple',
        modelo_oficial: 'iPhone 17',
        modelo_comercial: 'iPhone 17',
        precio_regular: 829.99,
        coincidencia: 'exacta',
        plazos: [{ meses: 30, precio_financiado: 829.99, pago_mensual: 27.67, price_code: 'FI1730' }],
      },
    ],
    fuente: { archivo: 'Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx', hoja: 'Equipos', fila: 41 },
    vigencia: { desde: '2026-05-28', hasta: '2026-07-31' },
  },
];

const mixedScenarioSpecialEquipment = [
  {
    item_code: 'F890',
    sap_code: 'SAP890',
    marca: 'Franklin',
    modelo: 'Franklin JEXstream CG890 5G',
    categoria: 'modem',
    precio_regular: 299.99,
    mensualidades: [{ meses: 30, monto: 10 }, { meses: 24, monto: 12.5 }],
    upload_id: 'upload-cg890',
  },
];

const currentEquipmentCatalog = [
  {
    item_code: '33762H',
    sap_code: '7013495',
    marca: 'Apple',
    modelo: 'iPhone 17 256GB Black',
    categoria: 'celular',
    precio_regular: 829.99,
    mensualidades: [{ meses: 30, monto: 27.67 }],
    fuente: {
      tipo: 'lista_precios',
      nombre: 'Lista de Precios vigente',
      vigencia_desde: '2026-09-03',
      vigencia_hasta: '2026-10-28',
      estado_publicacion: 'vigente',
    },
  },
  {
    item_code: '33761H',
    sap_code: '7013494',
    marca: 'Apple',
    modelo: 'iPhone 17 256GB Lavender',
    categoria: 'celular',
    precio_regular: 829.99,
    mensualidades: [{ meses: 30, monto: 27.67 }],
    fuente: {
      tipo: 'lista_precios',
      nombre: 'Lista de Precios vigente',
      vigencia_desde: '2026-09-03',
      vigencia_hasta: '2026-10-28',
      estado_publicacion: 'vigente',
    },
  },
  {
    item_code: '33348H',
    sap_code: '7012279',
    marca: 'Franklin',
    modelo: 'FRANKLIN JEX STREAM CG890 5G',
    categoria: 'modem',
    precio_regular: 299.99,
    mensualidades: [{ meses: 30, monto: 10 }],
    fuente: {
      tipo: 'inalambrico_iot',
      nombre: 'Boletin INT Go, Claro Oficina y IoT 1al30sept2026- CORP.pdf',
      sha256: 'c302b8eb28036d2b877c907230c887bab541f5a3a208c633cdec8d00ea04e076',
      vigencia_desde: '2026-09-01',
      vigencia_hasta: '2026-09-30',
      estado_publicacion: 'vigente',
    },
  },
];

test('endpoint del Motor expone candidatos-alternativas sin tocar calculo definitivo', () => {
  assert.match(routeSource, /post\('\/candidatos-alternativas'/);
  assert.match(routeSource, /findBusinessRedPlusCommercialCandidates/);
  assert.match(routeSource, /FROM public\.ofertas_movil_versiones WHERE estado='vigente'/);
  assert.match(routeSource, /FROM public\.v_equipos_vigentes/);
  assert.match(routeSource, /readSpecialDiscountVigencia\(pool\)/);
  assert.match(routeSource, /specialDiscountVigencia,\s*\n\s*version:/);
});

test('Cupo por BAN se comparte entre las lineas de una misma solicitud en orden de posicion', () => {
  const ofertaDiezLineas = [{ ...offers[0], id: 'portafolio-gratis-10', limite_ban: { aplica: true, cantidad: 10, fuera_limite: 'financiado_si_fuente_lo_permite' } }];
  const byPosition = (result) => result.candidatos.filter((item) => item.equipo === 'Samsung Galaxy A16').sort((a, b) => a.posicion - b.posicion);

  const sinUsos = byPosition(findBusinessRedPlusCommercialCandidates({ block, lineas: lines(5, 10), offers: ofertaDiezLineas, filtros: { equipo: 'A16' }, today: '2026-08-28' }));
  assert.equal(sinUsos.length, 6);
  assert.deepEqual(sinUsos.map((item) => item.cupo_promocional_restante), [10, 9, 8, 7, 6, 5]);
  assert.ok(sinUsos.every((item) => item.tipo_beneficio === 'gratis' && item.reason !== 'limite_ban_excedido'));

  const result = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: lines(5, 10),
    offers: ofertaDiezLineas,
    contexto_ban: { beneficios_usados_por_oferta: { 'portafolio-gratis-10': 8 } },
    filtros: { equipo: 'A16' },
    today: '2026-08-28',
  });
  const conUsos = byPosition(result);
  assert.equal(conUsos.length, 6);
  assert.deepEqual(conUsos.map((item) => item.cupo_promocional_restante), [2, 1, 0, 0, 0, 0]);
  assert.ok(conUsos.slice(0, 2).every((item) => item.tipo_beneficio === 'gratis' && item.mensualidad === 0));
  assert.ok(conUsos.slice(2).every((item) => item.reason === 'limite_ban_excedido' && item.tipo_beneficio === 'financiado' && item.mensualidad === item.mensualidad_regular));
  assert.ok(conUsos.slice(2).every((item) => item.validaciones.some((validationItem) => validationItem.codigo === 'limite_ban_excedido' && validationItem.estado === 'informativo')));
  assert.ok(conUsos.every((item) => item.autoaplica === false));
  assert.equal(result.estado, 'candidatos_disponibles');

  const sinFinanciado = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: lines(5, 6),
    offers: [{ ...ofertaDiezLineas[0], limite_ban: { aplica: true, cantidad: 10, fuera_limite: null } }],
    contexto_ban: { beneficios_usados_por_oferta: { 'portafolio-gratis-10': 9 } },
    filtros: { equipo: 'A16' },
    today: '2026-08-28',
  });
  assert.equal(sinFinanciado.candidatos.filter((item) => item.equipo === 'Samsung Galaxy A16').length, 1);
  assert.equal(sinFinanciado.requiere_revision.filter((item) => item.equipo === 'Samsung Galaxy A16' && item.bloqueado).length, 1);
});

test('El resultado expone un estado explicito cuando todo queda en revision o no hay candidatos', () => {
  const revision = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: [line(1, { familia_business_red: 'business_red_extreme', equipo_solicitado: 'Equipo sin precio oficial', categoria_producto: 'modem' })],
    equiposEspeciales: [],
    filtros: { equipo: 'Equipo sin precio oficial', categoria_producto: 'modem', plan_familia: 'business_red_extreme' },
    version: { estado: 'vigente' },
    today: '2026-08-28',
  });
  assert.equal(revision.estado, 'requiere_revision');
  assert.equal(revision.candidatos.length, 0);

  const vacio = findBusinessRedPlusCommercialCandidates({ block, lineas: [], today: '2026-08-28' });
  assert.equal(vacio.estado, 'sin_candidatos');
});

test('A37 con promocion agotada deja lineas 5 a 8 como candidatas regulares', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(5, 8), today: '2026-08-28' });

  assert.equal(result.lineas_evaluadas, 4);
  assert.equal(result.candidatos.filter((item) => item.equipo === 'Samsung Galaxy A37').length, 4);
  assert.ok(result.candidatos.every((item) => item.tipo_beneficio === 'financiado'));
});

test('Motor devuelve alternativas gratis disponibles para lineas pendientes', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(5, 8), offers, filtros: { solo_gratis: true }, today: '2026-08-28' });

  assert.ok(result.candidatos.length >= 4);
  assert.ok(result.candidatos.every((item) => item.tipo_beneficio === 'gratis'));
  assert.ok(result.candidatos.every((item) => item.fuente_publicacion));
});

test('Motor informa sin alternativas gratis cuando ninguna regla vigente coincide', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(5, 6), offers, filtros: { solo_gratis: true, fabricante: 'Apple' }, today: '2026-08-28' });

  assert.equal(result.candidatos.length, 0);
});

test('Filtro solo Samsung excluye otros fabricantes', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(5, 6), offers, filtros: { fabricante: 'Samsung' }, today: '2026-08-28' });

  assert.ok(result.candidatos.length > 0);
  assert.ok(result.candidatos.every((item) => item.fabricante === 'Samsung'));
});

test('S26 con lineas a regular permite identificar posiciones sin beneficio', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(5, 10), filtros: { equipo: 'S26' }, today: '2026-08-28' });

  assert.equal(result.candidatos.length, 6);
  assert.ok(result.candidatos.every((item) => item.tipo_beneficio === 'financiado'));
  assert.ok(result.candidatos.every((item) => item.precio_promocion === 999.99));
});

test('Filtro de presupuesto maximo deja solo candidatos bajo mensualidad solicitada', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: lines(1, 2), filtros: { presupuesto_maximo: 10 }, today: '2026-08-28' });

  assert.ok(result.candidatos.length > 0);
  assert.ok(result.candidatos.every((item) => Number(item.mensualidad) <= 10));
});

test('Limite BAN agotado se refleja en cupo restante cero cuando aplica portafolio', () => {
  const result = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: [line(5)],
    offers,
    contexto_ban: { beneficios_usados_por_oferta: { 'portafolio-gratis-45': 4 } },
    filtros: { equipo: 'A16' },
    today: '2026-08-28',
  });

  const candidate = result.candidatos.find((item) => item.equipo === 'Samsung Galaxy A16');
  assert.equal(candidate.cupo_promocional_restante, 0);
  assert.equal(candidate.reason, 'limite_ban_excedido');
});

test('Linea 1 y linea 5 reciben candidatos distintos por posicion', () => {
  const first = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(1)], filtros: { equipo: 'A37' }, today: '2026-08-28' });
  const fifth = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(5)], filtros: { equipo: 'A37' }, today: '2026-08-28' });

  assert.equal(first.candidatos[0].tipo_beneficio, 'gratis');
  assert.equal(fifth.candidatos[0].tipo_beneficio, 'financiado');
  assert.equal(first.candidatos[0].posicion, 1);
  assert.equal(fifth.candidatos[0].posicion, 5);
});

test('Filtro renovacion conserva evento en cada candidato', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(1, { evento: 'renovacion' })], filtros: { evento: 'renovacion' }, today: '2026-08-28' });

  assert.ok(result.candidatos.length > 0);
  assert.ok(result.candidatos.every((item) => item.evento === 'renovacion'));
});

test('Filtro portabilidad devuelve candidatos del evento portabilidad', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(5, { evento: 'portabilidad' })], offers, filtros: { evento: 'portabilidad', solo_gratis: true }, today: '2026-08-28' });

  assert.ok(result.candidatos.length > 0);
  assert.ok(result.candidatos.every((item) => item.evento === 'portabilidad'));
});

test('Equipo sin promocion aparece financiado y no gratis', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(5)], filtros: { equipo: 'A37' }, today: '2026-08-28' });

  assert.equal(result.candidatos[0].tipo_beneficio, 'financiado');
  assert.notEqual(result.candidatos[0].mensualidad, 0);
});

test('Candidato FUENTE_AMBIGUA queda separado en requiere_revision', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(5)], offers, filtros: { equipo: 'Ambiguo' }, today: '2026-08-28' });

  assert.equal(result.candidatos.length, 0);
  assert.equal(result.requiere_revision.length, 1);
  assert.equal(result.requiere_revision[0].confidence, 'requiere_revision');
});

test('Candidato confirmado conserva regla aplicada fuente vigencia y confidence', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(1)], filtros: { equipo: 'A37' }, today: '2026-08-28' });
  const candidate = result.candidatos[0];

  assert.equal(candidate.confidence, 'confirmado');
  assert.equal(candidate.regla_aplicada, 'business-red-plus-esquema-1-grupo-1');
  assert.equal(candidate.fuente_publicacion.hoja, 'Ofertas Business Red Plus');
  assert.deepEqual(candidate.vigencia, block.vigencia);
  assert.equal(candidate.autoaplica, false);
});

test('Varias ofertas vigentes validas se ordenan por gratis y menor costo mensual', () => {
  const result = findBusinessRedPlusCommercialCandidates({ block, lineas: [line(5)], offers, today: '2026-08-28' });

  assert.ok(result.candidatos.length >= 3);
  assert.equal(result.candidatos[0].tipo_beneficio, 'gratis');
  assert.equal(result.candidatos[0].mensualidad, 0);
  assert.equal(result.autoaplica, false);
});

test('Business RED Extreme devuelve precios para 5 iPhone 17 y 3 CG890 sin inventar descuentos', () => {
  const iphoneRows = lines(1, 5, { familia_business_red: 'business_red_extreme' }).map((item) => ({
    ...item,
    equipo_solicitado: 'iPhone 17',
  }));
  const modemRows = lines(6, 8, { familia_business_red: 'business_red_extreme' }).map((item) => ({
    ...item,
    equipo_solicitado: 'Franklin JEXstream CG890 5G',
    categoria_producto: 'modem',
  }));
  const iphoneResult = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: iphoneRows,
    offers: mixedScenarioOffers,
    filtros: { equipo: 'iPhone 17', fabricante: 'apple', evento: 'renovacion', plan_familia: 'business_red_extreme' },
    version: { estado: 'vigente', vigencia: { desde: '2026-08-27', hasta: null } },
    today: '2026-08-28',
  });
  const modemResult = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: modemRows,
    equiposEspeciales: mixedScenarioSpecialEquipment,
    filtros: { equipo: 'Franklin JEXstream CG890 5G', fabricante: 'franklin', categoria_producto: 'modem', evento: 'renovacion', plan_familia: 'business_red_extreme' },
    version: { estado: 'vigente', vigencia: { desde: '2026-08-27', hasta: null } },
    today: '2026-08-28',
  });

  assert.equal(iphoneResult.candidatos.length, 5);
  assert.equal(modemResult.candidatos.length, 3);
  assert.ok(iphoneResult.candidatos.every((item) => item.precio_regular === 829.99));
  assert.ok(iphoneResult.candidatos.every((item) => item.plazo === 30));
  assert.ok(iphoneResult.candidatos.every((item) => item.mensualidad_regular === 27.67));
  assert.ok(iphoneResult.candidatos.every((item) => item.mensualidad_neta === 27.67));
  assert.ok(iphoneResult.candidatos.every((item) => item.descuento === 0));
  assert.ok(iphoneResult.candidatos.every((item) => item.fuente_publicacion));
  assert.ok(modemResult.candidatos.every((item) => item.precio_regular === 299.99));
  assert.ok(modemResult.candidatos.every((item) => item.plazo === 30));
  assert.ok(modemResult.candidatos.every((item) => item.mensualidad_regular === 10));
  assert.ok(modemResult.candidatos.every((item) => item.mensualidad_neta === 10));
  assert.ok(modemResult.candidatos.every((item) => item.tipo_beneficio === 'financiado'));
  assert.ok(modemResult.candidatos.every((item) => item.descuento === 0));
  assert.equal(iphoneResult.totales.total_plan_regular, 200);
  assert.equal(iphoneResult.totales.total_plan_autopay, 150);
  assert.equal(iphoneResult.totales.total_equipos_regular, 138.35);
  assert.equal(iphoneResult.totales.total_descuentos_creditos, 0);
  assert.equal(iphoneResult.totales.total_equipos_neto, 138.35);
  assert.equal(modemResult.totales.total_plan_regular, 120);
  assert.equal(modemResult.totales.total_plan_autopay, 90);
  assert.equal(modemResult.totales.total_equipos_regular, 30);
  assert.equal(modemResult.totales.total_descuentos_creditos, 0);
  assert.equal(modemResult.totales.total_equipos_neto, 30);
});

test('Resolutor usa Inalambrico IoT vigente para CG890 aunque el nombre venga como JEXstream', () => {
  const result = resolveCurrentEquipmentPrice({
    equipment: {
      modelo: 'Franklin JEXstream CG890 5G',
      categoria_producto: 'modem',
    },
    catalog: currentEquipmentCatalog,
    scenarioDate: '2026-09-05',
  });

  assert.equal(result.ok, true);
  assert.equal(result.identity.modelo_canonico, 'Franklin JEXstream CG890 5G');
  assert.equal(result.item_code, '33348H');
  assert.equal(result.sap_code, '7012279');
  assert.equal(result.precio_regular, 299.99);
  assert.equal(result.mensualidades.find((item) => item.meses === 30).monto, 10);
  assert.equal(result.fuente.tipo, 'inalambrico_iot');
  assert.equal(result.fuente.nombre, 'Boletin INT Go, Claro Oficina y IoT 1al30sept2026- CORP.pdf');
});

test('Resolutor agrupa iPhone 17 256GB por precio sin escoger color arbitrario', () => {
  const result = resolveCurrentEquipmentPrice({
    equipment: {
      modelo: 'iPhone 17',
      categoria_producto: 'smartphone',
    },
    catalog: currentEquipmentCatalog,
    scenarioDate: '2026-09-05',
  });

  assert.equal(result.ok, true);
  assert.equal(result.identity.modelo_canonico, 'iPhone 17 256GB');
  assert.equal(result.precio_regular, 829.99);
  assert.deepEqual(result.item_codes.sort(), ['33761H', '33762H']);
  assert.equal(result.item_code, null);
  assert.equal(result.requires_choice, false);
  assert.equal(result.fuente.tipo, 'lista_precios');
});

test('Business RED Extreme mixto usa resolutor vigente para 5 iPhone 17 y 2 CG890', () => {
  const result = findBusinessRedPlusCommercialCandidates({
    block,
    grupos: [
      {
        lineas: lines(1, 5, { familia_business_red: 'business_red_extreme' }).map((item) => ({
          ...item,
          equipo_solicitado: 'iPhone 17',
        })),
        filtros: { equipo: 'iPhone 17', fabricante: 'apple', evento: 'renovacion', plan_familia: 'business_red_extreme' },
      },
      {
        lineas: lines(6, 7, { familia_business_red: 'business_red_extreme' }).map((item) => ({
          ...item,
          equipo_solicitado: 'Franklin JEXstream CG890 5G',
          categoria_producto: 'modem',
        })),
        filtros: { equipo: 'Franklin JEXstream CG890 5G', fabricante: 'franklin', categoria_producto: 'modem', evento: 'renovacion', plan_familia: 'business_red_extreme' },
      },
    ],
    equipmentCatalog: currentEquipmentCatalog,
    version: { estado: 'vigente', vigencia: { desde: '2026-08-27', hasta: null } },
    today: '2026-09-05',
  });

  assert.equal(result.lineas_evaluadas, 7);
  assert.equal(result.candidatos.length, 7);
  assert.equal(result.requiere_revision.length, 0);
  assert.equal(result.candidatos.filter((item) => item.equipo === 'iPhone 17 256GB').length, 5);
  assert.equal(result.candidatos.filter((item) => item.equipo === 'Franklin JEXstream CG890 5G').length, 2);
  assert.ok(result.candidatos.filter((item) => item.equipo === 'iPhone 17 256GB').every((item) => item.item_code == null && item.item_codes.length === 2));
  assert.ok(result.candidatos.filter((item) => item.equipo === 'Franklin JEXstream CG890 5G').every((item) => item.item_code === '33348H'));
  assert.ok(result.candidatos.every((item) => item.precio_regular > 0));
  assert.ok(result.candidatos.every((item) => item.mensualidad_regular > 0));
  assert.ok(result.candidatos.every((item) => item.mensualidad_neta > 0));
  assert.equal(result.totales.total_equipos_regular, 158.35);
  assert.equal(result.totales.total_equipos_neto, 158.35);
  assert.equal(result.totales.total_mensual_regular, 438.35);
  assert.equal(result.totales.total_mensual_autopay, 368.35);
});

test('Business RED Extreme mixto devuelve totales agregados de plan y equipos por grupo', () => {
  const result = findBusinessRedPlusCommercialCandidates({
    block,
    grupos: [
      {
        lineas: lines(1, 5, { familia_business_red: 'business_red_extreme' }).map((item) => ({
          ...item,
          equipo_solicitado: 'iPhone 17',
        })),
        filtros: { equipo: 'iPhone 17', fabricante: 'apple', evento: 'renovacion', plan_familia: 'business_red_extreme' },
      },
      {
        lineas: lines(6, 8, { familia_business_red: 'business_red_extreme' }).map((item) => ({
          ...item,
          equipo_solicitado: 'Franklin JEXstream CG890 5G',
          categoria_producto: 'modem',
        })),
        filtros: { equipo: 'Franklin JEXstream CG890 5G', fabricante: 'franklin', categoria_producto: 'modem', evento: 'renovacion', plan_familia: 'business_red_extreme' },
      },
    ],
    offers: mixedScenarioOffers,
    equiposEspeciales: mixedScenarioSpecialEquipment,
    version: { estado: 'vigente', vigencia: { desde: '2026-08-27', hasta: null } },
    today: '2026-08-28',
  });

  assert.equal(result.grupos_evaluados, 2);
  assert.equal(result.lineas_evaluadas, 8);
  assert.equal(result.candidatos.length, 8);
  assert.equal(result.requiere_revision.length, 0);
  assert.equal(result.candidatos.filter((item) => item.equipo === 'iPhone 17').length, 5);
  assert.equal(result.candidatos.filter((item) => item.equipo === 'Franklin JEXstream CG890 5G').length, 3);
  assert.equal(result.totales.total_plan_regular, 320);
  assert.equal(result.totales.total_plan_autopay, 240);
  assert.equal(result.totales.total_equipos_regular, 168.35);
  assert.equal(result.totales.total_descuentos_creditos, 0);
  assert.equal(result.totales.total_equipos_neto, 168.35);
  assert.equal(result.totales.total_mensual_regular, 488.35);
  assert.equal(result.totales.total_mensual_autopay, 408.35);
});

test('Equipo solicitado sin precio oficial queda en requiere_revision solo para ese equipo', () => {
  const result = findBusinessRedPlusCommercialCandidates({
    block,
    lineas: [line(1, {
      familia_business_red: 'business_red_extreme',
      equipo_solicitado: 'Equipo sin precio oficial',
      categoria_producto: 'modem',
    })],
    equiposEspeciales: [],
    filtros: { equipo: 'Equipo sin precio oficial', categoria_producto: 'modem', plan_familia: 'business_red_extreme' },
    version: { estado: 'vigente' },
    today: '2026-08-28',
  });

  assert.equal(result.candidatos.length, 0);
  assert.equal(result.requiere_revision.length, 1);
  assert.equal(result.requiere_revision[0].confidence, 'requiere_revision');
  assert.equal(result.requiere_revision[0].reason, 'precio_oficial_no_publicado');
});
