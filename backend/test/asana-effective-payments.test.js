import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOpportunity } from '../src/services/opportunityConfirmedSales.js';
const opportunity={id:'o',created_at:'2026-10-01'};
const subscriber=(extra={})=>({id:'s',phone:'7871234567',status:'activo',product_type:'G',contract_start_date:'2024-10-07',contract_term:24,remaining_payments:8,contract_end_date:'2026-10-07',...extra});
const run=s=>reconcileOpportunity(opportunity,[],[],[s],'2026-10-07');
test('movil llega a cero por aniversario sin venta Tango ni escritura',()=>{
 const s=subscriber(),snapshot=structuredClone(s),r=run(s);
 assert.equal(r.products.movil_ren.quantity_value,1);assert.deepEqual(s,snapshot);
});
test('movil antes del aniversario conserva una cuota y no entra por fecha vencida',()=>{
 assert.equal(run(subscriber({contract_start_date:'2024-10-08',contract_end_date:'2026-09-01'})).total_lines,0);
});
test('fijo vigente con cero cuotas no entra',()=>{
 assert.equal(run(subscriber({product_type:'O',contract_end_date:'2027-01-01',monthly_value:45})).total_money,0);
});
test('fijo sin contrato o vencido entra aunque conserve cuotas',()=>{
 for(const end of [null,'2026-10-06'])assert.equal(run(subscriber({product_type:'O',contract_start_date:null,contract_end_date:end,remaining_payments:5,monthly_value:45})).total_money,45);
});
test('movil sin cuotas ni fechas no se inventa oportunidad',()=>{
 assert.equal(run(subscriber({contract_start_date:null,contract_end_date:null,remaining_payments:null})).total_lines,0);
});
test('cero informado sin fechas se conserva',()=>{
 assert.equal(run(subscriber({contract_start_date:null,contract_end_date:null,remaining_payments:0})).total_lines,1);
});
test('cancelada sigue fuera aunque el calendario llegue a cero',()=>{
 assert.equal(run(subscriber({status:'cancelado'})).total_lines,0);
});
