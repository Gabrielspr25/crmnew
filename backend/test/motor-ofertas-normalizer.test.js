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

function financingBuffer({ additionalRows = [] } = {}) {
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
      [
        null,
        '50% de descuento LINEAS NUEVAS Y PORTABILIDADES',
        'Business RED Plus, RED Extreme, RED Supreme y Sin Fronteras',
        'Samsung Galaxy A37 128GB',
        'PYMES',
        '',
        'Aplica a dos (2) lineas por BAN. Financiamiento en 24 y 30 plazos.',
      ],
      [
        null,
        '50% de descuento LINEAS NUEVAS Y PORTABILIDADES',
        'Planes desde $50',
        'iPhone 17 Pro Max 256GB',
        'PYMES',
        '',
        'Financiamiento en 24 y 30 plazos.',
      ],
      ...additionalRows,
    ],
    'Ofertas Planes y Bonos': [
      ['OFERTAS DE PLANES Y SERVICIOS ESPECIALES'],
      [],
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN'],
    ],
  });
}

function priceListBuffer({ duplicateA37 = false } = {}) {
  const rows = [
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
    ['33979H', '7014074', 'Samsung Galaxy A37 128GB', 'FIUP24/FIUP30', 349.99, 14.58, 11.67],
    ['34017H', '7015001', 'iPhone 17 Pro Max 256GB', 'FIUP30', 1299.99, null, 43.33],
  ];
  if (duplicateA37) {
    rows.push(['DUP-A37', 'DUP-SAP', 'Samsung Galaxy A37 128GB', 'FIUP30', 359.99, null, 12]);
  }
  return workbookBuffer({
    'Finan Equipos Movil': rows,
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

test('infiere vigencia solo desde rangos explicitos presentes en encabezados Excel', async () => {
  const normalizer = await loadNormalizer();
  const inferred = normalizer.inferSourceValidity({
    financingBuffer: financingBuffer(),
    priceListBuffer: priceListBuffer(),
    now: new Date('2026-07-13T12:00:00.000Z'),
  });

  assert.deepEqual(inferred, {
    tabla_financiamiento: {
      desde: '2026-07-04',
      hasta: '2026-07-15',
      estado: 'vigente',
    },
    lista_precios: {
      desde: '2026-05-28',
      hasta: '2026-07-31',
      estado: 'vigente',
    },
    preview: {
      desde: '2026-07-04',
      hasta: '2026-07-15',
      estado: 'vigente',
    },
  });
});

test('prioriza el rango documental mas reciente cuando la lista conserva hojas historicas', async () => {
  const normalizer = await loadNormalizer();
  const priceListWithHistory = workbookBuffer({
    'Ofertas historicas': [['Lista valida del 29 de abril al 26 de mayo de 2020']],
    'Finan Equipos Movil': [
      ['Lista de Precios del 28 de mayo al 31 de julio de 2026'],
      ['Item Code SIF', 'Modelo', 'Precio'],
    ],
  });

  const inferred = normalizer.inferSourceValidity({
    financingBuffer: financingBuffer(),
    priceListBuffer: priceListWithHistory,
    now: new Date('2026-07-17T12:00:00.000Z'),
  });

  assert.deepEqual(inferred.lista_precios, {
    desde: '2026-05-28',
    hasta: '2026-07-31',
    estado: 'vigente',
  });
});

test('deja vigencia pendiente cuando los encabezados no contienen un rango explicito', async () => {
  const normalizer = await loadNormalizer();
  const blank = workbookBuffer({
    Portafolio: [['OFERTAS DE EQUIPOS'], ['MODELO', 'PRECIO']],
  });
  const inferred = normalizer.inferSourceValidity({
    financingBuffer: blank,
    priceListBuffer: blank,
    now: new Date('2026-07-13T12:00:00.000Z'),
  });

  assert.deepEqual(inferred, {
    tabla_financiamiento: {
      desde: null,
      hasta: null,
      estado: 'pendiente_confirmacion',
    },
    lista_precios: {
      desde: null,
      hasta: null,
      estado: 'pendiente_confirmacion',
    },
    preview: {
      desde: null,
      hasta: null,
      estado: 'pendiente_confirmacion',
    },
  });
});

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

test('cuenta filas y equipos procesados sin incluir rótulos comerciales', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      ['Equipo gratis para linea nueva', 'Plan de $50', 'Samsung Galaxy A37 128GB\nDOS EQUIPOS GRATIS\nCrédito $1,000:', 'Solo 30 plazos.'],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['A37', 'SAP-A37', 'Samsung Galaxy A37 128GB', 359.99, 12],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'precios-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  assert.equal(result.summary.filas_procesadas, 1);
  assert.equal(result.summary.equipos_procesados, 1);
  assert.equal(result.offers[0].equipment.length, 1);
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

test('agrupa variantes de color y SKU por modelo y capacidad sin pedir una equivalencia', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      ['Equipo gratis para linea nueva', 'Plan de $50', 'iPhone 17 Pro 512GB', 'Solo 30 plazos.'],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['SIF-SILVER', 'SAP-1', 'iPhone 17 Pro 512GB Silver', 1299.99, 43.33],
      ['SIF-BLUE', 'SAP-2', 'iPhone 17 Pro 512GB Deep Blue', 1299.99, 43.33],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'lista-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  assert.equal(result.contradictions.filter((item) => item.code === 'equipo_sin_coincidencia_exacta').length, 0);
  const equipo = result.offers[0].equipment[0];
  assert.equal(equipo.coincidencia, 'exacta');
  assert.equal(equipo.sku_sif, null);
  assert.equal(equipo.variantes.length, 2);
  assert.deepEqual(equipo.variantes.map((item) => item.sku_sif), ['SIF-SILVER', 'SIF-BLUE']);
});

test('relaciona un modelo sin capacidad cuando la lista oficial tiene una sola capacidad', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      ['Equipo gratis para linea nueva', 'Plan de $50', 'Samsung Galaxy A37', 'Solo 30 plazos.'],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['SIF-BLACK', 'SAP-1', 'Samsung GXY A37 128GB Black', 359.99, 12],
      ['SIF-VIOLET', 'SAP-2', 'Samsung GXY A37 128GB Violet', 359.99, 12],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'lista-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  assert.equal(result.contradictions.filter((item) => item.code === 'equipo_sin_coincidencia_exacta').length, 0);
  const equipo = result.offers[0].equipment[0];
  assert.equal(equipo.coincidencia, 'exacta');
  assert.equal(equipo.modelo_oficial, 'SAMSUNG GALAXY A37 128GB');
  assert.equal(equipo.sku_sif, null);
  assert.equal(equipo.variantes.length, 2);
});

test('relaciona un modelo confirmado aunque la lista oficial tenga varias capacidades', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      ['Equipo gratis para linea nueva', 'Plan de $50', 'Samsung Galaxy A37', 'Solo 30 plazos.'],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['SIF-128', 'SAP-1', 'Samsung GXY A37 128GB Black', 359.99, 12],
      ['SIF-256', 'SAP-2', 'Samsung GXY A37 256GB Violet', 459.99, 15.33],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'lista-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  assert.equal(result.offers[0].equipment[0].coincidencia, 'equivalencia_aprobada');
  assert.equal(result.contradictions.filter((item) => item.code === 'equipo_sin_coincidencia_exacta').length, 0);
});

test('acepta un equipo incluido solo en Precio Regular Nuevo del boletin', async () => {
  const normalizer = await loadNormalizer();
  const financing = financingBuffer({
    additionalRows: [
      [
        null,
        'Equipo gratis para linea nueva',
        'Plan de $35',
        'Motorola Moto G Play 2024',
        'PYMES',
        '',
        'Aplica a lineas nuevas. Solo 24 plazos.',
      ],
      [null, 'Precio Regular Nuevo', '', 'Nuevo precio regular:\nMotorola G Play 2024- $129.99'],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    ...normalizeInput(),
    financingBuffer: financing,
  });
  const offer = result.offers.find((item) => item.trace.row === 10);

  assert.equal(offer.equipment[0].coincidencia, 'exacta');
  assert.equal(offer.equipment[0].precio_regular, 129.99);
  assert.equal(offer.equipment[0].fuente_precio_id, 'fuente-tabla-1');
  assert.equal(offer.equipment[0].sku_sif, null);
});

test('Precio Regular Nuevo reemplaza el precio de la lista oficial', async () => {
  const normalizer = await loadNormalizer();
  const financing = financingBuffer({
    additionalRows: [
      [
        null,
        'Equipo gratis para linea nueva',
        'Plan de $35',
        'Motorola G Play 2024',
        'PYMES',
        '',
        'Aplica a lineas nuevas. Solo 24 plazos.',
      ],
      [null, 'Precio Regular Nuevo', '', 'Nuevo precio regular:\nMotorola G Play 2024- $129.99'],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['SIF-PLAY', 'SAP-PLAY', 'Motorola G Play 2024', 149.99, 5],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    ...normalizeInput(),
    financingBuffer: financing,
    priceListBuffer: prices,
  });
  const offer = result.offers.find((item) => item.trace.row === 10);

  assert.equal(offer.equipment[0].precio_regular, 129.99);
  assert.equal(offer.equipment[0].fuente_precio_id, 'fuente-tabla-1');
  assert.equal(offer.equipment[0].sku_sif, 'SIF-PLAY');
});

test('relaciona los nueve pares confirmados por su modelo comercial principal', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      [
        'Equipo gratis para lineas nuevas',
        'Plan de $50',
        [
          'Samsung Galaxy A07',
          'Samsung Galaxy A17',
          'Moto G Power 2025 5G',
          'iPhone 17e',
          'Motorola Moto Edge 2025',
          'Motorola Razr 2025',
          'Samsung Z Flip 7',
          'Samsung Z Fold 7',
          'Motorola Moto Razr 2025',
        ].join('\n'),
        'Aplica a lineas nuevas. Solo 30 plazos.',
      ],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['A07', 'SAP-A07', 'Samsung A07 64GB A075M Black', 119.99, 4],
      ['A17', 'SAP-A17', 'Samsung A17 5G A176U 128GB Black', 199.99, 6.67],
      ['POWER', 'SAP-POWER', 'Moto G Power 2025 XT2515-1 128GB Juniper', 279.99, 9.33],
      ['17E', 'SAP-17E', 'IPH 17e 256GB Black', 599.99, 19.97],
      ['EDGE', 'SAP-EDGE', 'Motorola Edge 2025 XT2519-1 Deep Forest', 429.99, 14.33],
      ['RAZR', 'SAP-RAZR', 'Motorola Razr 2025 XT2553-3 256GB Gibraltar Sea', 649.99, 21.63],
      ['FLIP', 'SAP-FLIP', 'Samsung GXY Z Flip 7 F766U 256GB Jet Black', 799.99, 26.63],
      ['FOLD', 'SAP-FOLD', 'Samsung GXY Z Fold 7 F966U 256GB Jet Black', 1899.99, 63.33],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    ...normalizeInput(),
    financingBuffer: financing,
    priceListBuffer: prices,
  });

  assert.equal(result.offers[0].equipment.length, 9);
  assert.ok(
    result.offers[0].equipment.every(
      (item) => item.coincidencia === 'equivalencia_aprobada'
    )
  );
  assert.equal(result.contradictions.filter((item) => item.code === 'equipo_sin_coincidencia_exacta').length, 0);
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

test('propaga solo el beneficio documentado a cada snapshot de equipo', async () => {
  const normalizer = await loadNormalizer();
  const result = normalizer.normalizeOfferWorkbooks({
    ...normalizeInput(),
    financingBuffer: financingBuffer({
      additionalRows: [
        [
          null,
          'Credito de $100 para LINEAS NUEVAS',
          'Plan de $35',
          'Samsung Galaxy A37 128GB',
          'PYMES',
          '',
          'Aplica a lineas nuevas. Solo 24 plazos.',
        ],
        [
          null,
          'Oferta especial para LINEAS NUEVAS',
          'Plan de $35',
          'Samsung Galaxy A37 128GB',
          'PYMES',
          '',
          'Aplica a lineas nuevas. Solo 24 plazos.',
        ],
      ],
    }),
  });

  const equipmentByRow = new Map(
    result.offers.map((offer) => [offer.trace.row, offer.equipment[0]])
  );

  assert.equal(equipmentByRow.get(4).beneficio_tipo, 'gratis');
  assert.equal(equipmentByRow.get(5).beneficio_tipo, 'descuento_porcentaje');
  assert.equal(equipmentByRow.get(10).beneficio_tipo, 'credito');
  assert.equal(equipmentByRow.get(11).beneficio_tipo, null);
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

test('extrae familias abreviadas, limite de dos lineas y plazos compuestos', async () => {
  const normalizer = await loadNormalizer();
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  const offer = result.offers.find((item) => item.trace.row === 8);

  assert.deepEqual(offer.contract.tipos_plan, ['multilinea_business_red']);
  assert.deepEqual(offer.contract.familias, [
    'business_red_plus',
    'business_red_extreme',
    'business_red_supreme',
    'business_red_sin_fronteras',
  ]);
  assert.equal(offer.contract.limite_ban.cantidad, 2);
  assert.deepEqual(offer.contract.plazos, [24, 30]);
});

test('marca plazo sin mensualidad y agrupa fuentes de variantes del mismo equipo', async () => {
  const normalizer = await loadNormalizer();
  const result = normalizer.normalizeOfferWorkbooks(normalizeInput());
  const missingTerm = result.offers.find((item) => item.trace.row === 9);

  assert.equal(missingTerm.contract.estado, 'confirmada_parcial');
  assert.ok(result.contradictions.some((item) =>
    item.code === 'plazo_sin_mensualidad_confirmada'
      && item.offerKey === missingTerm.contract.id
  ));

  const duplicateResult = normalizer.normalizeOfferWorkbooks({
    ...normalizeInput(),
    priceListBuffer: priceListBuffer({ duplicateA37: true }),
  });
  const duplicateOffer = duplicateResult.offers.find((item) =>
    item.contract.id === 'equipo-gratis-plan-35-fila-4'
  );
  assert.equal(duplicateOffer.equipment[0].coincidencia, 'exacta');
  assert.equal(duplicateOffer.equipment[0].sku_sif, null);
  assert.deepEqual(duplicateOffer.equipment[0].variantes.map((item) => item.fuente_precio.row), [6, 8]);
});

test('"planes Business RED" expande a todas las familias solo cuando se menciona expresamente', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      [
        '50% de descuento lineas nuevas',
        'Planes Business RED desde $50',
        'Samsung Galaxy A37 128GB',
        'Aplica a lineas nuevas. Solo 30 plazos.',
      ],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['A37', 'SAP-A37', 'Samsung Galaxy A37 128GB', 359.99, 12],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'precios-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  const offer = result.offers.find((item) => item.trace.row === 2);
  assert.ok(offer, 'la oferta con Business RED generico debe emitirse');
  assert.deepEqual(offer.contract.familias, [
    'business_red_plus',
    'business_red_extreme',
    'business_red_supreme',
    'business_red_sin_fronteras',
  ]);
});

test('una fila sin mencion de Business RED no hereda familias automaticamente', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      [
        '50% de descuento lineas nuevas',
        'Planes desde $50',
        'Samsung Galaxy A37 128GB',
        'Aplica a lineas nuevas. Solo 30 plazos.',
      ],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 30 meses'],
      ['A37', 'SAP-A37', 'Samsung Galaxy A37 128GB', 359.99, 12],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'precios-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  const offer = result.offers.find((item) => item.trace.row === 2);
  assert.ok(offer, 'la oferta individual debe emitirse');
  assert.deepEqual(offer.contract.familias, []);
});

test('equipos con beneficio gratis quedan en mensualidad $0 en todos los plazos aplicables', async () => {
  const normalizer = await loadNormalizer();
  const financing = workbookBuffer({
    'Ofertas Equipos en Portafolio': [
      ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
      [
        'Equipo gratis para linea nueva',
        'Plan de $50',
        'Samsung Galaxy A37 128GB',
        'Aplica a lineas nuevas. Financiamiento en 24 y 30 plazos.',
      ],
    ],
  });
  const prices = workbookBuffer({
    'Finan Equipos Movil': [
      ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio', 'Mensualidad 24 meses', 'Mensualidad 30 meses'],
      ['A37', 'SAP-A37', 'Samsung Galaxy A37 128GB', 349.99, 14.58, 11.67],
    ],
  });

  const result = normalizer.normalizeOfferWorkbooks({
    financingBuffer: financing,
    priceListBuffer: prices,
    sourceIds: { tabla_financiamiento: 'tabla-1', lista_precios: 'precios-1' },
    fileNames: { tabla_financiamiento: 'tabla.xlsx', lista_precios: 'precios.xlsx' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  const offer = result.offers.find((item) => item.trace.row === 2);
  assert.ok(offer, 'la oferta gratis debe emitirse');
  assert.equal(offer.equipment[0].beneficio_tipo, 'gratis');
  assert.deepEqual(offer.equipment[0].mensualidades, [
    { meses: 24, monto: 0 },
    { meses: 30, monto: 0 },
  ]);
});
