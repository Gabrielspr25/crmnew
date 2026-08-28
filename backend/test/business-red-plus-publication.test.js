import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import XLSX from 'xlsx';

import { parseBusinessRedPlusWorkbook } from '../src/services/motorOfertasNormalizer.js';

function workbookBuffer(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Ofertas Business Red Plus');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

const terms = 'Aplica a portabilidades y lineas nuevas. En renovaciones requiere Trade In. Oferta solo aplica a 30 plazos en Update Plus o Financiamiento. Los price codes son Update Plus: UPRP30 y Financiamiento: FIRP30. El descuento depende del orden en que se active el equipo.';

test('extrae la matriz Business Red Plus por posicion, precios y codigos oficiales', () => {
  const result = parseBusinessRedPlusWorkbook({
    buffer: workbookBuffer([
      [],
      [1, 0.5, 0.5, 0.5, 0, 0],
      ['Titulo'],
      ['Oferta Business Red Plus $65'],
      ['', '', '', '', '', '', terms],
      ['Manufacturero', 'Modelo', 'Precio Regular', 'GRATIS', 'Pago a 30 meses', '50% DE DESCUENTO', 'Pago a 30 meses'],
      ['Apple', 'Modelo Uno', 599.99, 'Gratis', 0, 299.995, 9.99],
    ]),
    fileName: 'Tabla nueva.xlsx',
    sourceId: 'xlsx-1',
  });

  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].line_discounts.slice(0, 4), [1, 0.5, 0.5, 0.5]);
  assert.equal(result.groups[0].max_discounted_lines, 4);
  assert.equal(result.groups[0].price_codes.up, 'UPRP30');
  assert.equal(result.groups[0].price_codes.fi, 'FIRP30');
  assert.equal(result.groups[0].equipment[0].regular_price, 599.99);
  assert.equal(result.groups[0].source.row, 1);
  assert.equal(result.line_order_dependent, true);
});

test('la superficie movil usa las familias publicadas y excluye el bloque Business Red heredado', async () => {
  const html = await readFile(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.match(html, /api\/planes-modulos\/moviles/);
  assert.match(html, /function isLegacyBusinessRedModule/);
  assert.match(html, /allModulos\.filter\(\s*m\s*=>\s*!isLegacyBusinessRedModule\(m\)\s*\)/);
  assert.match(html, /movil_multilinea_business_red_plus/);
  assert.match(html, /movil_multilinea_business_red_extreme/);
  assert.match(html, /movil_multilinea_business_red_supreme/);
  assert.match(html, /movil_multilinea_business_red_sin_fronteras/);
  assert.match(html, /movil_multilinea_byop_ban/);
});
