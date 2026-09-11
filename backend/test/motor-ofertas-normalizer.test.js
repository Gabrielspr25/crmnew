import assert from 'node:assert/strict';
import { test } from 'node:test';
import XLSX from 'xlsx';

import { normalizeOfferWorkbooks, parseBusinessRedPlusWorkbook } from '../src/services/motorOfertasNormalizer.js';

function workbookBuffer(sheets) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

function sources(terms = 'Oferta solo aplica a 24 plazos. Oferta aplica a cuatro (4) lineas por BAN.') {
  return {
    financingBuffer: workbookBuffer({
      'Ofertas Equipos en Portafolio': [
        ['OFERTAS DE EQUIPOS EN PORTAFOLIO DEL 16 AL 21 DE JULIO DE 2026'],
        [],
        ['Oferta', 'Plan', 'Equipos', 'Segmento', 'Bonos', 'Terminos'],
        ['Equipos GRATIS\nNO REQUIERE TRADE IN\nCLIENTE NUEVO, PORTABILIDAD, RENOVACIONES', 'Plan de $35', 'MOTOROLA MOTO G PLAY 2024\nSAMSUNG GALAXY A07', 'PYMES', 'No aplica', terms],
      ],
    }),
    priceListBuffer: workbookBuffer({
      'Finan Equipos Móvil': [
        ['SKU', 'SAP', 'Modelo', 'Precio Regular', '20', '24', '30', '36'],
        ['10001H', '700001', 'Motorola Moto G Play 2024', '$129.99', '', '$5.42', '', ''],
        ['10002H', '700002', 'Samsung Galaxy A07', '$149.99', '', '$6.25', '', ''],
      ],
    }),
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'lista-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'lista.xlsx' },
  };
}

test('normaliza la fila oficial de $35 con plazo, limite BAN y fuente trazable', () => {
  const result = normalizeOfferWorkbooks(sources());
  assert.equal(result.offers.length, 1);
  assert.equal(result.reglas_normalizadas.length, 1);
  assert.equal(result.resumen_reglas.total, 1);
  assert.deepEqual(result.resumen_reglas.por_tipo, { oferta_temporal: 1 });
  assert.deepEqual(result.resumen_reglas.por_confianza, { confirmado: 1 });
  assert.equal(result.reglas_normalizadas[0].llave_comercial, 'ofertas_moviles|oferta-4|35|linea_nueva,portabilidad,renovacion|individual');
  assert.equal(result.reglas_normalizadas[0].llave_comercial.includes('129.99'), false);
  assert.equal(result.reglas_normalizadas[0].valor.beneficio.tipo, 'gratis');
  assert.deepEqual(result.offers[0].plan, { min: 35, max: 35 });
  assert.deepEqual(result.offers[0].eventos, ['linea_nueva', 'portabilidad', 'renovacion']);
  assert.equal(result.offers[0].beneficio.tipo, 'gratis');
  assert.equal(result.offers[0].limite_ban.cantidad, 4);
  assert.equal(result.offers[0].equipos.length, 2);
  assert.deepEqual(result.offers[0].equipos[0].plazos, [{ meses: 24, pago_mensual: 5.42 }]);
  assert.deepEqual(result.offers[0].fuente, {
    archivo: 'tabla.xlsx', hoja: 'Ofertas Equipos en Portafolio', fila: 4, fuente_id: 'tabla-1',
  });
  assert.equal(result.summary.blockingContradictions, 0);
});

test('un modelo ausente en la lista de precios queda bloqueado y no se confirma', () => {
  const input = sources();
  input.financingBuffer = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      [], [], ['Oferta', 'Plan', 'Equipos', 'Terminos'],
      ['Equipo gratis', 'Plan de $35', 'Modelo inexistente', '24 plazos'],
    ],
  });
  const result = normalizeOfferWorkbooks(input);
  assert.equal(result.offers[0].equipos[0].coincidencia, 'pendiente');
  assert.equal(result.reglas_normalizadas[0].estado_confianza, 'contradiccion');
  assert.ok(result.contradictions.some((item) => item.codigo === 'equipo_sin_coincidencia_exacta' && item.bloqueante));
});

test('el alcance ambiguo both se registra como contradiccion y no como regla comercial', () => {
  const result = normalizeOfferWorkbooks(sources('Aplica a both. Oferta solo aplica a 24 plazos.'));
  assert.ok(result.revisiones.some((item) => item.codigo === 'alcance_ambiguous_both' && item.bloqueante));
  assert.equal(result.offers[0].familias.length, 0);
  assert.equal(result.reglas_normalizadas[0].estado_confianza, 'requiere_revision');
});

test('separa Account types que aplican de la modalidad de linea', () => {
  const input = sources();
  input.financingBuffer = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      [],
      [],
      ['Oferta', 'Plan', 'Equipos', 'Account types que aplican', 'Terminos'],
      ['Equipo gratis', 'Plan de $35', 'Motorola Moto G Play 2024', 'Business BYOP Corporate\nBusiness Regular', '24 plazos'],
    ],
  });

  const result = normalizeOfferWorkbooks(input);
  assert.deepEqual(result.offers[0].account_types, ['Business BYOP Corporate', 'Business Regular']);
  assert.equal(result.offers[0].modalidad_linea, 'no_determinada');
  assert.deepEqual(result.reglas_normalizadas[0].condiciones.account_types, ['Business BYOP Corporate', 'Business Regular']);
  assert.equal(result.reglas_normalizadas[0].condiciones.modalidad_linea, 'no_determinada');
});

test('parsea el formato vigente del 27 de agosto con hoja Ofertas Red Plus y plan $60', () => {
  const buffer = workbookBuffer({
    'Ofertas Red Plus': [
      ['OFERTAS DE EQUIPOS EN PORTAFOLIO-27 DE AGOSTO AL 16 DE SEPTIEMBRE- APLICA A CANAL DIRECTO E INDIRECTO UPDATE PLUS Y FINANCIAMIENTO'],
      ['OFERTAS PLAN INDIVIDUAL Y FAMILIAR RED PLUS $60'],
      [1, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0],
      ['Manufacturer', 'Modelo', 'Precio Regular'],
      ['Apple', 'iPhone 17e', '$599.99'],
      [],
      [1, 0.25, 0, 0, 0, 0, 0, 0, 0, 0],
      ['Update Plus-UPRP30\nFinanciamiento-FIRP30'],
      ['Manufacturer', 'Modelo', 'Precio Regular'],
      ['Samsung', 'Galaxy S26 Ultra 256GB', '$1049.99'],
      [],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ['Manufacturer', 'Modelo', 'Precio Regular'],
      ['Motorola', 'Moto Edge 2025', '$429.99'],
      [],
      [0.5, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0],
      ['Manufacturer', 'Modelo', 'Precio Regular'],
      ['Apple', 'iPhone 17 Pro', '$1099.99'],
    ],
  });

  const result = parseBusinessRedPlusWorkbook({ buffer, fileName: 'Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026.xlsx', sourceId: 'fuente-27ago' });
  assert.equal(result.source.hoja, 'Ofertas Red Plus');
  assert.deepEqual(result.plan, { nombre: 'Business Red Plus', monto: 60 });
  assert.equal(result.vigencia.desde, '2026-08-27');
  assert.equal(result.vigencia.hasta, '2026-09-16');
  assert.equal(result.groups.length, 4);
  assert.equal(result.groups[0].equipment[0].model, 'iPhone 17e');
});

test('una fila con etiqueta de texto y fracciones no se confunde con marcador de matriz', () => {
  const buffer = workbookBuffer({
    'Ofertas Red Plus': [
      ['OFERTAS PLAN INDIVIDUAL Y FAMILIAR RED PLUS $60'],
      [1, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0],
      ['Descuento por linea', 0.5, 0.5, 0.5, 0.5],
      ['Update Plus-UPRP30\nFinanciamiento-FIRP30'],
      ['Manufacturer', 'Modelo', 'Precio Regular'],
      ['Apple', 'iPhone 17e', '$599.99'],
      ['Samsung', 'Galaxy S26 Ultra 256GB', '$1049.99'],
    ],
  });

  const result = parseBusinessRedPlusWorkbook({ buffer, fileName: 'Ofertas 27 de agosto al 16 de septiembre de 2026.xlsx' });
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].line_discounts, [1, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.groups[0].equipment.map((item) => item.model), ['iPhone 17e', 'Galaxy S26 Ultra 256GB']);
  assert.equal(result.warnings.some((item) => item.codigo === 'encabezado_business_red_plus_no_encontrado'), false);
});

test('no confunde un titulo comercial con la fila de encabezados de la tabla', () => {
  const input = sources();
  input.financingBuffer = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTAS DE EQUIPOS Y PLANES'],
      [],
      ['', 'OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS'],
      ['', 'Equipo gratis', 'Plan de $35', 'Motorola Moto G Play 2024', '24 plazos'],
    ],
  });
  const result = normalizeOfferWorkbooks(input);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].plan.min, 35);
  assert.equal(result.offers[0].equipos[0].modelo_oficial, 'Motorola Moto G Play 2024');
});

test('relaciona variantes de color, capacidad y codigo tecnico por modelo comercial confirmado', () => {
  const input = sources();
  input.priceListBuffer = workbookBuffer({
    'Finan Equipos Móvil': [
      ['SKU', 'SAP', 'Modelo', 'Precio Regular', '20', '24', '30', '36'],
      ['10001H', '700001', 'MOTO G PLAY 2024 64GB XT2515-1 BLACK', '$129.99', '', '$5.42', '', ''],
      ['10002H', '700002', 'SAMSUNG A07 64GB A075M BLACK', '$149.99', '', '$6.25', '', ''],
    ],
  });
  const result = normalizeOfferWorkbooks(input);
  assert.equal(result.offers[0].equipos[0].coincidencia, 'exacta');
  assert.equal(result.offers[0].equipos[1].coincidencia, 'exacta');
  assert.equal(result.summary.blockingContradictions, 0);
});

test('agrupa colores y SKU como variantes auditables de un solo equipo comercial', () => {
  const input = sources();
  input.priceListBuffer = workbookBuffer({
    'Finan Equipos Móvil': [
      ['SKU', 'SAP', 'Modelo', 'Precio Regular', '20', '24', '30', '36'],
      ['10001H', '700001', 'MOTO G PLAY 2024 64GB XT2515-1 BLACK', '$129.99', '', '$5.42', '', ''],
      ['10002H', '700002', 'MOTO G PLAY 2024 64GB XT2515-1 BLUE', '$129.99', '', '$5.42', '', ''],
      ['10003H', '700003', 'SAMSUNG A07 64GB A075M BLACK', '$149.99', '', '$6.25', '', ''],
    ],
  });
  const result = normalizeOfferWorkbooks(input);
  const play = result.offers[0].equipos[0];
  assert.equal(play.coincidencia, 'exacta');
  assert.equal(play.variantes.length, 2);
  assert.equal(play.precio_regular, 129.99);
});

test('Precio Regular Nuevo de la tabla confirma un equipo ausente de la lista oficial', () => {
  const input = sources();
  input.priceListBuffer = workbookBuffer({
    'Finan Equipos Móvil': [
      ['SKU', 'SAP', 'Modelo', 'Precio Regular', '20', '24', '30', '36'],
      ['10002H', '700002', 'SAMSUNG A07 64GB A075M BLACK', '$149.99', '', '$6.25', '', ''],
    ],
  });
  input.financingBuffer = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      [], [], ['Oferta', 'Plan', 'Equipos', 'Terminos'],
      ['Equipo gratis', 'Plan de $35', 'Motorola Moto G Play 2024\nSamsung Galaxy A07', '24 plazos'],
      ['Precio Regular Nuevo', '', 'Nuevo precio regular:\nMotorola G Play 2024- $129.99'],
    ],
  });
  const result = normalizeOfferWorkbooks(input);
  const play = result.offers[0].equipos[0];
  assert.equal(play.coincidencia, 'exacta');
  assert.equal(play.precio_regular, 129.99);
  assert.equal(play.fuente_precio.hoja, 'Ofertas Equipos en Portafolio');
});

test('relaciona modelos Galaxy, iPhone y Moto pese a color o codigo tecnico de la lista', () => {
  const input = sources();
  input.financingBuffer = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      [], [], ['Oferta', 'Plan', 'Equipos', 'Terminos'],
      ['Equipo gratis', 'Planes desde $50', 'Samsung Galaxy S26 256GB\niPhone Air 512GB\nMotorola Moto Edge 2025\nSamsung Galaxy Z Flip 7', '30 plazos'],
    ],
  });
  input.priceListBuffer = workbookBuffer({
    'Finan Equipos Móvil': [
      ['SKU', 'SAP', 'Modelo', 'Precio Regular', '20', '24', '30', '36'],
      ['10001H', '700001', 'SAMSUNG GXY S26 S942U 256GB COBALT VIOLET', '$839.99', '', '', '$27.99', ''],
      ['10002H', '700002', 'iPhone Air 512GB CLOUD WHITE', '$1199.99', '', '', '$39.99', ''],
      ['10003H', '700003', 'MOTOROLA EDGE 2025 XT2519-1 DEEP FOREST', '$429.99', '', '', '$14.30', ''],
      ['10004H', '700004', 'SAMSUNG GXY Z FLIP7 F766U BLUE', '$669.99', '', '', '$22.30', ''],
    ],
  });
  const result = normalizeOfferWorkbooks(input);
  assert.deepEqual(result.offers[0].equipos.map((equipo) => equipo.coincidencia), ['exacta', 'exacta', 'exacta', 'exacta']);
});
