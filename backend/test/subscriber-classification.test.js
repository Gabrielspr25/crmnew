import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeImportedSubscriber, normalizeOperationalStatus } from '../src/services/subscriberClassification.js';

test('clasifica PRODUCT_TYPE operativo sin depender de una columna manual', () => {
  assert.equal(normalizeImportedSubscriber({ product_type: 'G' }).line_kind, 'movil');
  assert.equal(normalizeImportedSubscriber({ product_type: 'O' }).line_kind, 'fijo');
  assert.equal(normalizeImportedSubscriber({ product_type: 'T' }).line_kind, 'fijo');
  assert.equal(normalizeImportedSubscriber({ product_type: 'V' }).line_kind, 'fijo');
  assert.equal(normalizeImportedSubscriber({ product_type: 'K' }).line_kind, 'cloud');
});

test('completa 30 de 30 solo para movil cuando ambas cuotas vienen vacias', () => {
  assert.deepEqual(normalizeImportedSubscriber({ product_type: 'G' }), {
    product_type: 'G',
    line_kind: 'movil',
    installment_from: 30,
    installment_total: 30,
    remaining_payments: 0,
  });
});

test('conserva cuotas informadas y no inventa tipo para PRODUCT_TYPE C', () => {
  assert.deepEqual(normalizeImportedSubscriber({
    product_type: 'C',
    installment_from: '27',
    installment_total: '30',
  }), {
    product_type: 'C',
    installment_from: '27',
    installment_total: '30',
  });
});

test('convierte suspendida en activa durante la normalizacion de importacion', () => {
  assert.equal(normalizeImportedSubscriber({ status: 'S' }).status, 'activo');
  assert.equal(normalizeImportedSubscriber({ status: 'Suspendido' }).status, 'activo');
});

test('normaliza suspendida tambien para cualquier escritura manual', () => {
  assert.equal(normalizeOperationalStatus('suspended'), 'activo');
  assert.equal(normalizeOperationalStatus('cancelado'), 'cancelado');
});
