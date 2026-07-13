import assert from 'node:assert/strict';
import { test } from 'node:test';
import XLSX from 'xlsx';

async function loadNormalizer() {
  try {
    return await import('../src/services/motorOfertasNormalizer.js');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
}

function workbookBuffer(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      name
    );
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function financingBuffer() {
  return workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      [
        'CLARO25=',
        'OFERTAS DE EQUIPOS EN PORTAFOLIO DEL 4 AL 15 DE JULIO DE 2026',
      ],
      [null, 'OFERTAS DE EQUIPOS PLANES $20 A $50'],
      [
        null,
        'OFERTA',
        'PLANES QUE APLICAN',
        'EQUIPOS QUE APLICAN',
        'Account types que aplican',
        'BONOS QUE APLICAN',
        'RESUMEN TERMINOS Y CONDICIONES',
      ],
      [
        null,
        'Equipo GRATIS NO REQUIERE TRADE IN CLIENTE NUEVO PORTABILIDADES Y RENOVACIONES',
        'Plan de $35',
        'Samsung Galaxy A37 128GB',
        'PYMES',
        'No aplica Bono de Streaming',
        'Aplica a lineas nuevas, portabilidades y renovaciones. Oferta para cuatro (4) lineas por BAN en Business RED Plus. Solo 24 plazos.',
      ],
      [
        null,
        '50% de descuento NO REQUIERE TRADE IN LINEAS NUEVAS PORTABILIDADES Y RENOVACIONES',
        'Planes desde $50',
        'iPhone 17 Pro Max 256GB',
        'PYMES',
        'Aplica Bono de Streaming',
        'Aplica a todas las lineas Business RED desde la 1 hasta 10, Business RED Supreme y Business RED Sin Fronteras. Solo 30 plazos.',
      ],
      [
        null,
        'Equipo GRATIS SI REQUIERE TRADE IN PARA RENOVACIONES',
        'Planes desde $60',
        'Modelo Fantasma 5G',
        'PYMES',
        'Aplica Bono de Streaming',
        'Aplica a lineas nuevas, portabilidades y renovaciones. Cuatro (4) lineas por BAN en Business RED Extreme. Solo 30 plazos.',
      ],
      [
        null,
        'BOTH',
        'Plan de $45',
        'Samsung Galaxy A37 128GB',
        'PYMES',
        '',
        'BOTH. Solo 30 plazos.',
      ],
    ],
    'Ofertas Planes y Bonos': [
      ['OFERTAS DE PLANES Y SERVICIOS ESPECIALES'],
      [],
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN'],
    ],
  });
}

function priceListBuffer() {
  return workbookBuffer({
    'Finan Equipos Movil': [
      ['Lista de Precios de Update Plus'],
      ['28 de mayo al 31 de julio de 2026'],
      [],
      [],
      [
        'Nuevo Item Code SIF',
        'Numero de Material SAP',
        'Modelo',
        'Price Code',
        'Precio',
        'Mensualidad 24 meses',
        'Mensualidad 30 meses',
      ],
      [
        '33979H',
        '7014074',
        'Samsung Galaxy A37 128GB',
        'FIUP24/FIUP30',
        349.99,
        14.58,
        11.67,
      ],
      [
        '34017H',
        '7015001',
        'iPhone 17 Pro Max 256GB',
        'FIUP30',
        1299.99,
        null,
        43.33,
      ],
    ],
    Accesorios: [['Modelo', 'Precio'], ['Case de prueba', 10]],
  });
}

function normalizeInput() {
  return {
    financingBuffer: financingBuffer(),
    priceListBuffer: priceListBuffer(),
    sourceIds: {
      tabla_financiamiento: 'fuente-tabla-1',
      lista_precios: 'fuente-lista-1',
    },
    fileNames: {
      tabla_financiamiento: 'tabla-ofertas.xlsx',
      lista_precios: 'lista-precios.xlsx',
    },
    vigencia: {
      desde: '2026-07-04',
      hasta: '2026-07-15',
      estado: 'vigente',
    },
  };
}

test('normaliza de forma determinista e inventaria todas las hojas', async () => {
  const normalizer = await loadNormalizer();
  assert.ok(normalizer, 'falta motorOfertasNormalizer.js');
  const first = normalizer.normalizeOfferWorkbooks(normalizeInput());
  const second = normalizer.normalizeOfferWorkbooks(normalizeInput());
  assert.deepEqual(first, second);
  assert.deepEqual(first.inventory.financingSheets, [
    'Ofertas Equipos en Portafolio',
    'Ofertas Planes y Bonos',
  ]);
  assert.deepEqual(first.inventory.priceSheets, [
    'Finan Equipos Movil',
    'Accesorios',
  ]);
});

test('conserva archivo, hoja, fila y celdas originales', async () => {
  const normalizer = await loadNormalizer();
  assert.ok(normalizer, 'falta motorOfertasNormalizer.js');
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  const offer = result.offers.find(
    (item) => item.contract.id === 'equipo-gratis-plan-35-fila-4'
  );
  assert.ok(offer);
  assert.equal(offer.trace.sourceId, 'fuente-tabla-1');
  assert.equal(offer.trace.fileName, 'tabla-ofertas.xlsx');
  assert.equal(offer.trace.sheet, 'Ofertas Equipos en Portafolio');
  assert.equal(offer.trace.row, 4);
  assert.equal(offer.trace.cells.plan, 'Plan de $35');
  assert.equal(offer.contract.fuente.fila, 4);
});

test('extrae plan, eventos, familia, plazo, limite BAN y trade-in', async () => {
  const normalizer = await loadNormalizer();
  assert.ok(normalizer, 'falta motorOfertasNormalizer.js');
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  const offer35 = result.offers.find(
    (item) => item.contract.id === 'equipo-gratis-plan-35-fila-4'
  );
  assert.deepEqual(offer35.derived, {
    planMontoMinimo: 35,
    planMontoMaximo: 35,
  });
  assert.deepEqual(offer35.contract.eventos, [
    'linea_nueva',
    'portabilidad',
    'renovacion',
  ]);
  assert.deepEqual(offer35.contract.familias, ['business_red_plus']);
  assert.deepEqual(offer35.contract.plazos, [24]);
  assert.equal(offer35.contract.limite_ban.cantidad, 4);
  assert.deepEqual(offer35.contract.trade_in.requerido_eventos, []);

  const offer60 = result.offers.find(
    (item) => item.contract.id === 'equipo-gratis-plan-60-fila-6'
  );
  assert.deepEqual(offer60.contract.trade_in.requerido_eventos, ['renovacion']);
});

test('cruza equipos exactos y deja coincidencias inciertas como contradiccion', async () => {
  const normalizer = await loadNormalizer();
  assert.ok(normalizer, 'falta motorOfertasNormalizer.js');
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  const offer35 = result.offers.find(
    (item) => item.contract.id === 'equipo-gratis-plan-35-fila-4'
  );
  assert.equal(offer35.equipment[0].coincidencia, 'exacta');
  assert.equal(offer35.equipment[0].sku_sif, '33979H');
  assert.equal(offer35.equipment[0].precio_regular, 349.99);
  assert.equal(offer35.equipment[0].fuente_precio_id, 'fuente-lista-1');

  const offer60 = result.offers.find(
    (item) => item.contract.id === 'equipo-gratis-plan-60-fila-6'
  );
  assert.equal(offer60.equipment[0].coincidencia, 'pendiente');
  assert.ok(
    result.contradictions.some(
      (item) =>
        item.code === 'equipo_sin_coincidencia_exacta' &&
        item.offerKey === offer60.contract.id &&
        item.blocking === true
    )
  );
});

test('mantiene estado comercial, vigencia y contradicciones separados', async () => {
  const normalizer = await loadNormalizer();
  assert.ok(normalizer, 'falta motorOfertasNormalizer.js');
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  assert.equal('versionState' in result, false);
  assert.ok(
    result.offers.every((item) =>
      ['confirmada', 'confirmada_parcial', 'pendiente_fuente'].includes(
        item.contract.estado
      )
    )
  );
  assert.ok(
    result.offers.every(
      (item) => item.contract.vigencia.estado === 'vigente'
    )
  );
  assert.ok(Array.isArray(result.contradictions));
});

test('rechaza alcance both y no lo persiste como oferta', async () => {
  const normalizer = await loadNormalizer();
  assert.ok(normalizer, 'falta motorOfertasNormalizer.js');
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  assert.ok(!result.offers.some((item) => item.trace.row === 7));
  assert.ok(
    result.contradictions.some(
      (item) => item.code === 'alcance_ambiguo_both' && item.source.row === 7
    )
  );
});
