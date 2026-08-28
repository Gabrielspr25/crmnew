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

test('Esquema 1 incorpora tabletas y modems con financiamiento oficial sin descuento movil', () => {
  const equiposEspeciales = [
    { item_code: 'TAB-1', sap_code: 'SAP-TAB', marca: 'Samsung', modelo: 'Galaxy Tab S10', categoria: 'tablet', precio_regular: 899.99, mensualidades: [{ meses: 30, monto: 30 }] },
    { item_code: 'MODEM-1', sap_code: 'SAP-MOD', marca: 'Inseego', modelo: 'MiFi X Pro', categoria: 'modem', precio_regular: 359.99, mensualidades: [{ meses: 24, monto: 15 }] },
  ];
  const result = findBusinessRedPlusEligible({ block, linea: linea(1), equiposEspeciales, today: '2026-08-23' });

  const tablet = result.equipos.find((item) => item.equipo.modelo_oficial === 'Galaxy Tab S10');
  const modem = result.equipos.find((item) => item.equipo.modelo_oficial === 'MiFi X Pro');
  assert.equal(tablet.equipo.categoria, 'tablet');
  assert.equal(tablet.beneficio.tipo, 'financiado');
  assert.equal(tablet.plazos[0].pago_mensual, 30);
  assert.equal(modem.equipo.categoria, 'modem');
  assert.equal(modem.plazos[0].meses, 24);
  assert.equal(modem.fuente.hoja, 'Finan Modems- Tablets-Routers');
  assert.ok([tablet, modem].every((item) => item.segmento === 'equipos_especiales'));
});
