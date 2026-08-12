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

test('la superficie movil renderiza el bloque Business Red Plus sin mezclarlo con otras ofertas', async () => {
  const html = await readFile(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.match(html, /business_red_plus/);
  assert.match(html, /line_order_dependent/);
  assert.match(html, /Precio regular despues del limite/);
  assert.match(html, /@media\s*\(max-width:640px\)/);
  const renderBody = html.match(/function render\(\) \{([\s\S]*?)\n\}\n\nfunction buildActivationTable/);
  assert.ok(renderBody, 'debe existir el render principal de la pagina');
  assert.match(renderBody[1], /renderBusinessRedPlus\(container\)/);
  assert.match(renderBody[1], /const byopModule = visible\.find\(m => m\.seccion_key === 'business_red_plus_byop_ban'\)/);
  assert.match(renderBody[1], /const regularVisible = visible\.filter\(m => m\.seccion_key !== 'business_red_plus_byop_ban'\)/);
  const summaryIndex = renderBody[1].indexOf('container.appendChild(summary);');
  const redPlusIndex = renderBody[1].indexOf('renderBusinessRedPlus(container);');
  const regularCardsIndex = renderBody[1].indexOf('regularVisible.forEach');
  const byopCardIndex = renderBody[1].indexOf('if (byopModule) container.appendChild(buildPlanCard(byopModule));');
  assert.ok(summaryIndex > -1, 'debe conservar el bloque de resumen');
  assert.ok(redPlusIndex > summaryIndex, 'Business Red Plus debe ocupar el lugar visual del modulo BYOP');
  assert.ok(regularCardsIndex > redPlusIndex, 'los modulos regulares deben ir despues de Business Red Plus');
  assert.ok(byopCardIndex > regularCardsIndex, 'BYOP debe quedar como ultimo modulo');
  assert.match(html, /#mainContainer\{padding:8px 0\}/);
  assert.match(html, /\.business-plus-section\{margin:0 0 16px;padding:10px 8px/);
  assert.match(html, /@media\s*\(min-width:1200px\)[\s\S]*\.business-plus-section\s*\{[\s\S]*width:calc\(100vw - 64px\)/);
  assert.match(html, /business-plus-terms/);
  assert.match(html, /<summary[^>]*>Terminos y condiciones<\/summary>/);
  assert.match(html, /conditions\.map\(\(condition\) =>/);
  assert.doesNotMatch(html, /business-plus-conditions/);
});
