import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyTangoCommissionSale,
  mapTangoCommissionSale,
  shouldCreateOperationalRelation,
} from '../src/services/tangoCommissionSync.js';

const sale = {
  ventaid: 80124,
  ban: '792653711',
  telefono: '787-238-7511',
  codigovoz: 'A884',
  pagomensual: 99.99,
  fechaactivacion: '2026-07-21',
  cliente: 'PLANITAX INC',
  vendedor: 'Gabriel Sanchez',
  ventatipo: { id: 140, nombre: 'PYMES Fijo REN' },
};

test('mapea una venta PYMES con sus datos operativos y comisión real', () => {
  const mapped = mapTangoCommissionSale(sale, {
    ventaid: 80124,
    comisiones: { total: 325, bonoportabilidad: 25 },
  });

  assert.equal(mapped.tangoVentaId, 80124);
  assert.equal(mapped.banNumber, '792653711');
  assert.equal(mapped.phone, '7872387511');
  assert.equal(mapped.priceCode, 'A884');
  assert.equal(mapped.monthlyValue, 99.99);
  assert.equal(mapped.companyEarnings, 325);
  assert.equal(mapped.portabilityBonus, 25);
  assert.equal(mapped.lineKind, 'fijo');
  assert.equal(mapped.lineType, 'REN');
});

test('incluye una venta PYMES con comisión y excluye una Claro Update aunque tenga comisión', () => {
  assert.equal(shouldCreateOperationalRelation(mapTangoCommissionSale(sale, { ventaid: 80124, total: 1 })), true);

  const excluded = mapTangoCommissionSale({
    ...sale,
    ventaid: 80099,
    ventatipo: { id: 26, nombre: 'Claro Update REN' },
  }, { ventaid: 80099, total: 500 });

  assert.equal(shouldCreateOperationalRelation(excluded), false);
  assert.equal(classifyTangoCommissionSale(excluded).reason, 'tipo_no_pymes');
});

test('no permite crear Cliente BAN Suscriptor cuando Tango no trae identidad válida', () => {
  const withoutName = mapTangoCommissionSale({ ...sale, cliente: 'SIN NOMBRE' }, { ventaid: 80124, total: 10 });

  assert.equal(shouldCreateOperationalRelation(withoutName), false);
  assert.equal(classifyTangoCommissionSale(withoutName).reason, 'cliente_tango_sin_nombre');
});
