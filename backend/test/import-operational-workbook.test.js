import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { parseOperationalWorkbook, isReferenceOnlyHeader } = require('../../frontend/import-workbook.js');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function workbook(sheets) {
  return { SheetNames: Object.keys(sheets), Sheets: sheets };
}

const xlsx = {
  utils: {
    sheet_to_json(sheet) {
      return sheet;
    },
  },
};

test('consolida Empresa y Email por BAN sin duplicar las filas convergentes', () => {
  const parsed = parseOperationalWorkbook(workbook({
    MOvil: [
      ['Empresa', 'BAN', 'SUB', 'SUB_STATUS', 'SUB_STATUS_DATE', 'SOC', 'Email'],
      ['ACME LLC', '712345678', '7871111111', 'A', '2025-02-01', 'BREDP2', 'acme@example.com'],
      ['', '712345678', '7872222222', 'S', '2025-02-02', 'BREDP2', ''],
    ],
    Fijos: [
      ['BAN', 'SUB', 'SUB_STATUS', 'SOC', 'Empresa', 'Email'],
      ['712345678', '7873333333', 'A', 'A1690', '', ''],
    ],
    Cancelados: [
      ['BAN', 'SUB', 'SUB_STATUS', 'SOC', 'Empresa'],
      ['799999999', '7874444444', 'C', 'VOLTE50', 'ANTIGUO INC'],
    ],
    Convergente: [
      ['LINEAS MOVIL'],
      ['Cant_Lineas_BAN', 'Empresa', 'BAN', 'SUB'],
      ['2', 'ACME LLC', '712345678', '7871111111'],
      ['LINEAS FIJO'],
      ['BAN', 'SUB'],
      ['712345678', '7873333333'],
    ],
  }), xlsx);

  assert.equal(parsed.isOperationalWorkbook, true);
  assert.deepEqual(parsed.summary, { movil: 2, fijo: 1, cancelados: 1, convergente: 2 });
  assert.equal(parsed.rows.length, 4);

  const suspended = parsed.rows.find((row) => row.sub_phone === '7872222222');
  assert.equal(suspended.company, 'ACME LLC');
  assert.equal(suspended.email, 'acme@example.com');
  assert.equal(suspended.line_kind, 'movil');
  assert.equal(suspended.status, 'S');
  assert.equal(suspended.activation_date, '2025-02-02');

  const fixed = parsed.rows.find((row) => row.sub_phone === '7873333333');
  assert.equal(fixed.company, 'ACME LLC');
  assert.equal(fixed.line_kind, 'fijo');

  const cancelled = parsed.rows.find((row) => row.sub_phone === '7874444444');
  assert.equal(cancelled.status, 'C');
  assert.equal(cancelled.line_kind, '');
});

test('oculta campos de referencia del Excel en el mapeo', () => {
  assert.equal(isReferenceOnlyHeader('GrupoBanda'), true);
  assert.equal(isReferenceOnlyHeader('Cant_Lineas_BAN'), true);
  assert.equal(isReferenceOnlyHeader('BAN'), false);
  assert.match(appHtml, /ImportWorkbook\.isReferenceOnlyHeader/);
});

test('reporta un suscriptor repetido y no lo envía dos veces al importador', () => {
  const parsed = parseOperationalWorkbook(workbook({
    MOvil: [
      ['Empresa', 'BAN', 'SUB', 'SUB_STATUS'],
      ['ACME LLC', '712345678', '7871111111', 'A'],
      ['ACME LLC', '712345678', '7871111111', 'A'],
    ],
    Fijos: [['BAN', 'SUB', 'SUB_STATUS']],
    Cancelados: [['BAN', 'SUB', 'SUB_STATUS']],
  }), xlsx);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /Suscriptor repetido/);
});
