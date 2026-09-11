import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findBusinessRedPlusEligible } from '../src/services/businessRedPlusEligibility.js';

const block = {
  plan: { nombre: 'Business Red Plus', monto: 65 },
  line_order_dependent: true,
  vigencia: { desde: '2026-08-06', hasta: '2026-08-26' },
  groups: [
    {
      line_discounts: [1, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0],
      price_codes: { up: 'UPRP30', fi: 'FIRP30' },
      equipment: [
        { manufacturer: 'Apple', model: 'iPhone 17e', regular_price: 599.99, discount_prices: [0, 300, 300, 300, 599.99, 599.99, 599.99, 599.99, 599.99, 599.99] },
      ],
      source: { hoja: 'Ofertas Business Red Plus', row: 2 },
    },
    {
      line_discounts: [1, 0.25, 0, 0, 0, 0, 0, 0, 0, 0],
      price_codes: { up: 'UPRP30', fi: 'FIRP30' },
      equipment: [
        { manufacturer: 'Samsung', model: 'GALAXY S26 ULTRA 256GB', regular_price: 1049.99, discount_prices: [0, 787.49, 1049.99, 1049.99, 1049.99, 1049.99, 1049.99, 1049.99, 1049.99, 1049.99] },
      ],
      source: { hoja: 'Ofertas Business Red Plus', row: 26 },
    },
  ],
};

function linea(posicion, evento = 'linea_nueva') {
  return {
    id: `linea-${posicion}`,
    tipo: 'multilinea_business_red',
    familia_business_red: 'business_red_plus',
    modalidad_linea: 'financiamiento',
    plan: { codigo: 'BRPLUS', nombre: 'Business Red Plus', monto: 65 },
    evento,
    trade_in: { aplica: false, validado: false },
    posicion_en_ban: posicion,
  };
}

test('Esquema 1 devuelve todos los equipos gratis para la primera linea', () => {
  const result = findBusinessRedPlusEligible({ block, linea: linea(1), today: '2026-08-23' });

  assert.equal(result.equipos.length, 2);
  assert.deepEqual(result.equipos.map((item) => item.plazos[0].pago_mensual), [0, 0]);
  assert.deepEqual(result.equipos.map((item) => item.beneficio.tipo), ['gratis', 'gratis']);
  assert.ok(result.equipos.every((item) => item.fuente.hoja === 'Ofertas Business Red Plus'));
});

test('Esquema 1 calcula el pago del equipo segun grupo y posicion', () => {
  const second = findBusinessRedPlusEligible({ block, linea: linea(2), today: '2026-08-23' });
  const ultraSecond = second.equipos.find((item) => item.equipo.modelo_oficial.includes('S26 ULTRA'));
  assert.equal(ultraSecond.plazos[0].pago_mensual, 26.25);
  assert.equal(ultraSecond.beneficio.tipo, 'descuento_porcentaje');
  assert.equal(ultraSecond.beneficio.porcentaje, 25);

  const third = findBusinessRedPlusEligible({ block, linea: linea(3), today: '2026-08-23' });
  const ultraThird = third.equipos.find((item) => item.equipo.modelo_oficial.includes('S26 ULTRA'));
  assert.equal(ultraThird.plazos[0].pago_mensual, 35);
  assert.equal(ultraThird.beneficio.tipo, 'financiado');
});

test('Esquema 1 no inventa linea adicional ni posiciones fuera de 1 a 10', () => {
  const additional = findBusinessRedPlusEligible({ block, linea: linea(1, 'linea_adicional'), today: '2026-08-23' });
  assert.equal(additional.equipos.length, 0);
  assert.ok(additional.validaciones.some((item) => item.codigo === 'evento_no_aplica_business_red_plus'));

  const invalidPosition = findBusinessRedPlusEligible({ block, linea: linea(11), today: '2026-08-23' });
  assert.equal(invalidPosition.equipos.length, 0);
  assert.ok(invalidPosition.validaciones.some((item) => item.codigo === 'posicion_en_ban_invalida'));
});

test('Esquema 1 incorpora Portafolio como gama baja desde la linea 5 sin duplicar modelos', () => {
  const offers = [{
    id: 'oferta-portafolio-45', nombre: 'Equipo gratis desde $45', estado_comercial: 'confirmada', vigencia_documental: 'vigente',
    tipo_linea: 'multilinea_business_red', familias: ['business_red_plus'], plan: { min: 45, max: null }, eventos: ['linea_nueva'],
    trade_in: { renovacion_requerido: false }, limite_ban: { aplica: true, cantidad: 4, fuera_limite: 'financiado_si_fuente_lo_permite' }, beneficio: { tipo: 'gratis' },
    equipos: [
      { id: 'galaxy-a37', modelo_oficial: 'Galaxy A37', modelo_comercial: 'Galaxy A37', precio_regular: 349.99, coincidencia: 'exacta', plazos: [{ meses: 30, pago_mensual: 11.67 }] },
      { id: 'iphone-17e', modelo_oficial: 'iPhone 17e', modelo_comercial: 'iPhone 17e', precio_regular: 599.99, coincidencia: 'exacta', plazos: [{ meses: 30, pago_mensual: 20 }] },
    ],
    fuente: { hoja: 'Ofertas Equipos en Portafolio', fila: 7 },
  }];
  const result = findBusinessRedPlusEligible({ block, linea: linea(5), offers, version: { estado: 'vigente' }, today: '2026-08-23' });

  assert.ok(result.equipos.some((item) => item.segmento === 'gama_alta'));
  assert.ok(result.equipos.some((item) => item.equipo.modelo_oficial === 'Galaxy A37' && item.segmento === 'gama_baja'));
  assert.equal(result.equipos.filter((item) => item.equipo.modelo_oficial === 'iPhone 17e').length, 1);
});

test('Esquema 1 incorpora tabletas y modems con descuento oficial Business Red Plus', () => {
  const equiposEspeciales = [
    { item_code: 'TAB-1', sap_code: 'SAP-TAB', marca: 'Samsung', modelo: 'Galaxy Tab S10', categoria: 'tablet', precio_regular: 899.99, mensualidades: [{ meses: 30, monto: 30 }] },
    { item_code: 'MODEM-1', sap_code: 'SAP-MOD', marca: 'Inseego', modelo: 'MiFi X Pro', categoria: 'modem', precio_regular: 359.99, mensualidades: [{ meses: 24, monto: 15 }] },
  ];
  const result = findBusinessRedPlusEligible({ block, linea: linea(1), equiposEspeciales, today: '2026-08-23' });

  const tablet = result.equipos.find((item) => item.equipo.modelo_oficial === 'Galaxy Tab S10');
  const modem = result.equipos.find((item) => item.equipo.modelo_oficial === 'MiFi X Pro');
  assert.equal(tablet.equipo.categoria, 'tablet');
  assert.deepEqual(tablet.beneficio, {
    tipo: 'descuento_monto',
    monto: 130,
    aplicacion: 'credito_mensual',
  });
  assert.deepEqual(tablet.plazos.map((item) => item.meses), [24, 30]);
  assert.equal(tablet.plazos.find((item) => item.meses === 30).precio_financiado, 769.99);
  assert.equal(tablet.plazos.find((item) => item.meses === 30).pago_mensual, 25.67);
  assert.equal(modem.equipo.categoria, 'modem');
  assert.equal(modem.plazos.find((item) => item.meses === 24).precio_financiado, 229.99);
  assert.equal(modem.plazos.find((item) => item.meses === 24).pago_mensual, 9.58);
  assert.equal(modem.fuente.hoja, 'Boletín Oferta Descuentos Modems, MIFI y Tablets');
  assert.equal(modem.fuente.pagina, 6);
  assert.equal(modem.autoaplica, false);
  assert.ok([tablet, modem].every((item) => item.segmento === 'equipos_especiales'));
});

test('BYOP conserva Business RED Plus como tipo pero no recibe promocion de equipo', () => {
  const result = findBusinessRedPlusEligible({
    block,
    linea: {
      ...linea(1, 'portabilidad'),
      modalidad_linea: 'byop',
      account_type: 'Business BYOP Corporate',
    },
    equiposEspeciales: [
      { item_code: 'TAB-1', sap_code: 'SAP-TAB', marca: 'Samsung', modelo: 'Galaxy Tab S10', categoria: 'tablet', precio_regular: 899.99, mensualidades: [{ meses: 30, monto: 30 }] },
    ],
    today: '2026-08-23',
  });

  assert.equal(result.equipos.length, 0);
  assert.equal(result.esquema, 'business_red_plus_byop');
  assert.ok(result.validaciones.some((item) => item.codigo === 'byop_sin_promocion_equipo' && item.estado === 'informativo'));
});

test('accountType BYOP no bloquea ofertas si la modalidad de linea es financiamiento', () => {
  const result = findBusinessRedPlusEligible({
    block,
    linea: {
      ...linea(1, 'portabilidad'),
      modalidad_linea: 'financiamiento',
      account_type: 'Business BYOP Corporate',
    },
    today: '2026-08-23',
  });

  assert.ok(result.equipos.length > 0);
  assert.equal(result.equipos[0].autoaplica, false);
});

test('descuento oficial de tabletas y modems conserva codigos Update Plus y Financiamiento por plazo', () => {
  const result = findBusinessRedPlusEligible({
    block,
    linea: {
      ...linea(1, 'portabilidad'),
      modalidad_linea: 'update_plus',
    },
    equiposEspeciales: [
      { item_code: 'MODEM-1', sap_code: 'SAP-MOD', marca: 'Inseego', modelo: 'MiFi X Pro', categoria: 'modem', precio_regular: 359.99, mensualidades: [{ meses: 24, monto: 15 }, { meses: 30, monto: 12 }] },
    ],
    today: '2026-08-23',
  });

  const modem = result.equipos.find((item) => item.equipo.modelo_oficial === 'MiFi X Pro');
  assert.equal(modem.plazos.find((item) => item.meses === 24).price_code, 'U13024');
  assert.equal(modem.plazos.find((item) => item.meses === 30).price_code, 'U13030');
  assert.deepEqual(modem.price_codes.financiamiento, { 24: 'F13024', 30: 'F13030' });
  assert.deepEqual(modem.price_codes.update_plus, { 24: 'U13024', 30: 'U13030' });
});

test('descuento de tabletas y modems respeta la vigencia de la fuente archivada', () => {
  const equiposEspeciales = [
    { item_code: 'TAB-1', sap_code: 'SAP-TAB', marca: 'Samsung', modelo: 'Galaxy Tab S10', categoria: 'tablet', precio_regular: 899.99, mensualidades: [{ meses: 30, monto: 30 }] },
  ];
  const specialDiscountVigencia = { desde: '2026-07-23', hasta: '2026-08-31' };

  const vencida = findBusinessRedPlusEligible({ block, linea: linea(1), equiposEspeciales, today: '2026-09-07', specialDiscountVigencia });
  const tablet = vencida.equipos.find((item) => item.segmento === 'equipos_especiales');
  assert.ok(tablet);
  assert.deepEqual(tablet.vigencia, specialDiscountVigencia);
  assert.equal(tablet.fuente.vigencia_hasta, '2026-08-31');
  assert.ok(tablet.validaciones.some((item) => item.codigo === 'fuente_vencida' && item.estado === 'warning'));
  assert.equal(tablet.autoaplica, false);

  const vigente = findBusinessRedPlusEligible({ block, linea: linea(1), equiposEspeciales, today: '2026-08-23', specialDiscountVigencia });
  assert.equal(vigente.equipos.find((item) => item.segmento === 'equipos_especiales').validaciones.length, 0);

  const previa = findBusinessRedPlusEligible({ block, linea: linea(1), equiposEspeciales, today: '2026-07-01', specialDiscountVigencia });
  assert.equal(previa.equipos.filter((item) => item.segmento === 'equipos_especiales').length, 0);

  const sinFuente = findBusinessRedPlusEligible({ block, linea: linea(1), equiposEspeciales, today: '2026-08-23' });
  assert.deepEqual(sinFuente.equipos.find((item) => item.segmento === 'equipos_especiales').vigencia, { desde: '2026-07-23', hasta: null });
});

test('equipo solicitado fuera del esquema se resuelve desde el catalogo de precios vigente', () => {
  const equipmentCatalog = [
    {
      item_code: '33762H', sap_code: '7013495', marca: 'Apple', modelo: 'iPhone 17 256GB Black', categoria: 'celular', precio_regular: 829.99,
      mensualidades: [{ meses: 30, monto: 27.67 }],
      fuente: { tipo: 'lista_precios', nombre: 'Lista de Precios vigente', vigencia_desde: '2026-08-01', vigencia_hasta: '2026-10-28', estado_publicacion: 'vigente' },
    },
  ];
  const solicitud = { ...linea(3), equipo_solicitado: 'iPhone 17' };

  const result = findBusinessRedPlusEligible({ block, linea: solicitud, equipmentCatalog, today: '2026-08-23' });
  const resolved = result.equipos.find((item) => item.segmento === 'catalogo_precio_regular');
  assert.ok(resolved);
  assert.equal(resolved.equipo.modelo_oficial, 'iPhone 17 256GB');
  assert.equal(resolved.equipo.precio_regular, 829.99);
  assert.equal(resolved.plazos[0].pago_mensual, 27.67);
  assert.equal(resolved.beneficio.tipo, 'financiado');
  assert.equal(resolved.autoaplica, false);

  const sinCatalogo = findBusinessRedPlusEligible({ block, linea: solicitud, today: '2026-08-23' });
  assert.equal(sinCatalogo.equipos.some((item) => item.segmento === 'catalogo_precio_regular'), false);
});
