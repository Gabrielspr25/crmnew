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
