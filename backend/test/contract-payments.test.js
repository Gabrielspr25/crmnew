import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remainingContractPayments, effectiveContractPayments } from '../src/services/contractPayments.js';

test('un contrato nuevo muestra todos los pagos hasta cumplir el primer mes', () => {
  assert.equal(remainingContractPayments('2026-09-22', 30, '2026-09-22'), 30);
  assert.equal(remainingContractPayments('2026-09-22', 30, '2026-10-21'), 30);
  assert.equal(remainingContractPayments('2026-09-22', 30, '2026-10-22'), 29);
  assert.equal(remainingContractPayments('2026-09-21', 24, '2028-09-21'), 0);
});

test('valor efectivo es igual con y sin venta Tango y no cambia datos originales',()=>{
  for(const tango_ventaid of [null,'venta-1']){
    const s={contract_start_date:'2024-10-08',contract_term:24,remaining_payments:8,tango_ventaid};
    assert.equal(effectiveContractPayments(s,'2026-10-07').remaining_payments,1);
    assert.equal(effectiveContractPayments(s,'2026-10-08').remaining_payments,0);
    assert.equal(s.remaining_payments,8);
  }
});

test('datos insuficientes conservan pagos guardados sin convertir vacios a cero',()=>{
  for(const remaining_payments of [null,'',0,5]){
    const s={contract_start_date:null,contract_term:24,remaining_payments};
    assert.equal(effectiveContractPayments(s,'2026-10-07'),s);
  }
  assert.equal(remainingContractPayments('fecha-invalida',24,'2026-10-07'),null);
  assert.equal(remainingContractPayments('2026-02-30',24,'2026-10-07'),null);
});

test('respeta aniversarios de fin de mes y nunca produce pagos negativos', () => {
  assert.equal(remainingContractPayments('2026-01-31', 24, '2026-02-27'), 24);
  assert.equal(remainingContractPayments('2026-01-31', 24, '2026-02-28'), 23);
  assert.equal(remainingContractPayments('2026-09-22', 24, '2030-01-01'), 0);
  assert.equal(remainingContractPayments(null, 24, '2026-09-22'), null);
});
