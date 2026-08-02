import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLocalOcrText } from '../src/services/ocrParser.js';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('OCR conserva 989 como suscriptor Cloud y excluye códigos internos 100', () => {
  const parsed = parseLocalOcrText([
    '989-122-4901 K Active CCPRO',
    '100-502-6178 N Active ISP_EMP1',
  ].join('\n'));

  assert.deepEqual(parsed.rows.map((row) => ({
    subscriber: row.subscriber,
    line_kind: row.line_kind,
  })), [{ subscriber: '9891224901', line_kind: 'cloud' }]);
});

test('la pantalla OCR conserva tipo y clasificación Cloud al guardar', () => {
  assert.match(appHtml, /line_kind:x\.line_kind\|\|''/);
  assert.match(appHtml, /product_type:r\.type\|\|null/);
});

test('OCR corrige cero leído en la columna Type como O y clasifica fijo', () => {
  const parsed = parseLocalOcrText('787-090-0155 0 Active 72001');

  assert.deepEqual(parsed.rows.map((row) => ({
    subscriber: row.subscriber,
    type: row.type,
    line_kind: row.line_kind,
  })), [{
    subscriber: '7870900155',
    type: 'O',
    line_kind: 'fijo',
  }]);
});

test('OCR rechaza prefijos fuera de 787, 939 y 989', () => {
  const parsed = parseLocalOcrText('767-090-0155 O Active 72001');

  assert.deepEqual(parsed.rows.map((row) => row.subscriber), []);
});

test('OCR de Subscriber List no asigna el BAN como plan de la primera linea', () => {
  const parsed = parseLocalOcrText([
    'Subscriber list for BAN - 787601854',
    'Subscriber Type Status Price Plan',
    '989-107-1744 K Active CCPRO',
    '787-889-3120 O Active A8742',
    '100-532-7859 N Active ISP_EMP1',
    '989-112-3220 K Active CCPRO',
    '787-371-3793 G Active HOCV002V',
  ].join('\n'));

  assert.equal(parsed.banNumber, '787601854');
  assert.deepEqual(parsed.rows.map((row) => ({
    subscriber: row.subscriber,
    type: row.type,
    status: row.status,
    pricePlan: row.pricePlan,
    line_kind: row.line_kind,
  })), [
    { subscriber: '9891071744', type: 'K', status: 'Active', pricePlan: 'CCPRO', line_kind: 'cloud' },
    { subscriber: '7878893120', type: 'O', status: 'Active', pricePlan: 'A8742', line_kind: 'fijo' },
    { subscriber: '9891123220', type: 'K', status: 'Active', pricePlan: 'CCPRO', line_kind: 'cloud' },
    { subscriber: '7873713793', type: 'G', status: 'Active', pricePlan: 'HOCV002V', line_kind: 'movil' },
  ]);
});

test('OCR normaliza lecturas comunes del formato Subscriber List pequeno', () => {
  const parsed = parseLocalOcrText([
    'Subscriber list for BAN - 787601854',
    'Subscriber Type Status 1 Price Plan',
    '989-107-1744 K Active CCPPRO',
    '787-889-3120 O Active ABT42',
    '989-112-3220 K Active CCPPRO',
    '787-371-3793 G Active HOCVO002V',
    '787-889-4769 O Active 71072',
    '787-889-2378 0 Active ABT42',
    '787-612-4564 G Canceled AUS1000M',
    '787-325-9362 G Canceled ALT20M1',
  ].join('\n'));

  assert.deepEqual(parsed.rows.map((row) => ({
    subscriber: row.subscriber,
    type: row.type,
    status: row.status,
    pricePlan: row.pricePlan,
    line_kind: row.line_kind,
  })), [
    { subscriber: '9891071744', type: 'K', status: 'Active', pricePlan: 'CCPRO', line_kind: 'cloud' },
    { subscriber: '7878893120', type: 'O', status: 'Active', pricePlan: 'A8742', line_kind: 'fijo' },
    { subscriber: '9891123220', type: 'K', status: 'Active', pricePlan: 'CCPRO', line_kind: 'cloud' },
    { subscriber: '7873713793', type: 'G', status: 'Active', pricePlan: 'HOCV002V', line_kind: 'movil' },
    { subscriber: '7878894769', type: 'O', status: 'Active', pricePlan: '71072', line_kind: 'fijo' },
    { subscriber: '7878892378', type: 'O', status: 'Active', pricePlan: 'A8742', line_kind: 'fijo' },
    { subscriber: '7876124564', type: 'G', status: 'Cancelled', pricePlan: 'AUS1000M', line_kind: 'movil' },
    { subscriber: '7873259362', type: 'G', status: 'Cancelled', pricePlan: 'ALT20M1', line_kind: 'movil' },
  ]);
});
