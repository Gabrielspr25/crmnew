import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dateOnly, parseRangoVigencia } from '../src/services/vigenciaTexto.js';

test('interpreta rangos escritos en nombres de archivo oficiales', () => {
  assert.deepEqual(
    parseRangoVigencia('Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026.xlsx'),
    { desde: '2026-08-27', hasta: '2026-09-16', texto: '27 de agosto al 16 de septiembre de 2026' }
  );
  assert.equal(parseRangoVigencia('Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx').desde, '2026-05-28');
  assert.deepEqual(
    parseRangoVigencia('Boletin INT Go, Claro Oficina y IoT 1al30sept2026- CORP.pdf'),
    { desde: '2026-09-01', hasta: '2026-09-30', texto: '1al30sept2026' }
  );
});

test('usa el anio por defecto cuando la celda no lo incluye y respeta acentos', () => {
  const parsed = parseRangoVigencia('OFERTAS DE EQUIPOS EN PORTAFOLIO-27 DE AGOSTO AL 16 DE SEPTIEMBRE- APLICA', { defaultYear: '2026' });
  assert.deepEqual([parsed.desde, parsed.hasta], ['2026-08-27', '2026-09-16']);
  assert.equal(parseRangoVigencia('Válido del 1 de agosto al 31 de agosto de 2026').hasta, '2026-08-31');
  assert.equal(parseRangoVigencia('27 de agosto al 16 de septiembre'), null);
});

test('entiende abreviaturas, anios de dos digitos y vigencias abiertas', () => {
  assert.deepEqual(parseRangoVigencia('1 jun@31 jul 26', { requireYear: true }), { desde: '2026-06-01', hasta: '2026-07-31', texto: '1 jun 31 jul 26' });
  assert.deepEqual(parseRangoVigencia('Válido desde el 23 de julio de 2026'), { desde: '2026-07-23', hasta: null, texto: 'desde el 23 de julio de 2026' });
  assert.equal(parseRangoVigencia('23 de julio de 2026 en adelante').hasta, null);
});

test('acepta la forma "del" que usa el boletin Affinity', () => {
  assert.deepEqual(parseRangoVigencia('Vigencia: Desde el 5 de noviembre del 2025'), { desde: '2025-11-05', hasta: null, texto: 'desde el 5 de noviembre del 2025' });
  assert.equal(parseRangoVigencia('5 de noviembre del 2025 en adelante').desde, '2025-11-05');
});

test('no inventa vigencia cuando el texto no trae fechas', () => {
  assert.equal(parseRangoVigencia('3 meses gratis y doble velocidad', { requireYear: true }), null);
  assert.equal(parseRangoVigencia(''), null);
  assert.equal(parseRangoVigencia('12 meses de contrato 2026'), null);
});

test('dateOnly normaliza Date, ISO, fechas embebidas y descarta basura', () => {
  assert.equal(dateOnly(new Date('2026-01-05T12:00:00Z')), '2026-01-05');
  assert.equal(dateOnly('2026-07-23T00:00:00Z'), '2026-07-23');
  assert.equal(dateOnly('vigencia 2026-09-01'), '2026-09-01');
  assert.equal(dateOnly('07/23/2026'), '2026-07-23');
  assert.equal(dateOnly('nada'), null);
  assert.equal(dateOnly(''), null);
  assert.equal(dateOnly(null), null);
});
