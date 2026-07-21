import assert from 'node:assert/strict';
import { test } from 'node:test';
import XLSX from 'xlsx';

function workbookBuffer(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function sources() {
  return {
    financingBuffer: workbookBuffer({
      'Ofertas Equipos en Portafolio': [
        ['OFERTA', 'PLANES QUE APLICAN', 'EQUIPOS QUE APLICAN', 'TERMINOS Y CONDICIONES'],
        ['Equipo gratis', 'Business RED', 'Samsung Galaxy A37\nSamsung Galaxy A37', 'Aplica Business RED sin familia especifica.'],
      ],
    }),
    priceListBuffer: workbookBuffer({
      'Finan Equipos Movil': [
        ['Item Code SIF', 'Material SAP', 'Modelo', 'Precio'],
        ['SIF-A37-BLK', 'SAP-1', 'Samsung Galaxy A37 128GB Black', 399.99],
        ['SIF-A37-WHT', 'SAP-2', 'Samsung Galaxy A37 128GB White', 399.99],
      ],
    }),
  };
}

test('conserva cada bloqueo de equipo como ocurrencia individual y no confirma candidatos', async () => {
  const { buildOfferReviewSnapshot } = await import('../src/services/motorOfertasReview.js');
  const { financingBuffer, priceListBuffer } = sources();

  const review = buildOfferReviewSnapshot({
    financingBuffer,
    priceListBuffer,
    version: { id: 'version-4', numero: 4, estado: 'pendiente_revision' },
    contradictions: [
      {
        id: 'equipo-1',
        codigo: 'equipo_sin_coincidencia_exacta',
        estado: 'abierta',
        detalle: 'No hay una coincidencia unica para Samsung Galaxy A37.',
        fuentes_enfrentadas: [{ sheet: 'Ofertas Equipos en Portafolio', row: 2 }],
      },
      {
        id: 'equipo-2',
        codigo: 'equipo_sin_coincidencia_exacta',
        estado: 'abierta',
        detalle: 'No hay una coincidencia unica para Samsung Galaxy A37.',
        fuentes_enfrentadas: [{ sheet: 'Ofertas Equipos en Portafolio', row: 2 }],
      },
      {
        id: 'business-1',
        codigo: 'contrato_oferta_invalido',
        estado: 'abierta',
        detalle: 'familias: Business RED requiere al menos una familia',
        fuentes_enfrentadas: [{ sheet: 'Ofertas Equipos en Portafolio', row: 2 }],
      },
    ],
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
  });

  assert.equal(review.equipos.length, 2);
  assert.notEqual(review.equipos[0].id, review.equipos[1].id);
  assert.deepEqual(review.equipos.map((item) => item.fila_origen), [2, 2]);
  assert.deepEqual(review.equipos.map((item) => item.repeticiones_otras_filas), [1, 1]);
  assert.equal(review.equipos[0].candidatos.length, 2);
  assert.equal(review.equipos[0].candidatos[0].sku_sif, 'SIF-A37-BLK');
  assert.equal(review.equipos[0].estado_revision, 'pendiente');
  assert.equal(review.equipos[0].equivalencia_confirmada, false);
  assert.equal(review.business_red.length, 1);
  assert.match(review.business_red[0].texto_original, /Business RED sin familia especifica/);
  assert.match(review.business_red[0].dato_pendiente, /familia/i);
});
