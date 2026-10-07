import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReferralUpdate, updateOpportunityReferral } from '../src/services/asanaReferral.js';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const seller='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('referido acepta cualquier persona, normaliza espacios y vacío limpia el dato',()=>{
 assert.deepEqual(validateReferralUpdate({referred_by_name:'  María Pérez  '}),{referred_by_name:'María Pérez'});
 assert.deepEqual(validateReferralUpdate({referred_by_name:''}),{referred_by_name:null});
 assert.deepEqual(validateReferralUpdate({salesperson_id:''}),{salesperson_id:null});
 assert.throws(()=>validateReferralUpdate({referred_by_name:'x'.repeat(201)}),/200/);
 assert.throws(()=>validateReferralUpdate({referred_by_name:{}}),/texto/);
 assert.throws(()=>validateReferralUpdate({salesperson_id:'invalid'}),/Vendedor/);
 assert.throws(()=>validateReferralUpdate({}),/Nada/);
});
function fakeDb(row,{vendorExists=true}={}){
 const calls=[];
 return {calls,query:async(sql,params)=>{calls.push({sql,params});
  if(sql.includes('FROM sales_opportunities'))return {rows:row?[row]:[]};
  if(sql.includes('FROM salespeople'))return {rows:vendorExists?[{id:seller}]:[]};
  return {rows:[],rowCount:1};
 }};
}
test('vendedor puede guardar un referido propio sin alterar asignación',async()=>{
 const db=fakeDb({id,client_id:id,salesperson_id:seller});
 await updateOpportunityReferral(db,id,{referred_by_name:'Persona externa'},{canAssign:false,sellerId:seller});
 assert.ok(db.calls.some(c=>c.sql.includes('referred_by_name =')));
 assert.ok(!db.calls.some(c=>c.sql.includes('UPDATE clients')));
});
test('vendedor ajeno o intento de reasignar queda bloqueado antes de escribir',async()=>{
 for(const [sellerId,body] of [[id,{referred_by_name:'Ana'}],[seller,{salesperson_id:id,referred_by_name:'Ana'}]]){
  const db=fakeDb({id,client_id:id,salesperson_id:seller});
  await assert.rejects(updateOpportunityReferral(db,id,body,{canAssign:false,sellerId}),e=>e.status===403);
  assert.ok(!db.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)));
 }
});
test('vendedor inexistente no guarda el referido parcialmente',async()=>{
 const db=fakeDb({id,client_id:id,salesperson_id:null},{vendorExists:false});
 await assert.rejects(updateOpportunityReferral(db,id,{salesperson_id:seller,referred_by_name:'Ana'},{canAssign:true}),e=>e.status===400);
 assert.ok(!db.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)));
});
test('administrador sincroniza Cliente y oportunidades activas conservando referido por oportunidad',async()=>{
 const db=fakeDb({id,client_id:id,salesperson_id:null});
 await updateOpportunityReferral(db,id,{salesperson_id:seller,referred_by_name:'Ana'},{canAssign:true});
 assert.ok(db.calls.some(c=>c.sql.includes('UPDATE clients')&&c.params[0]===seller));
 assert.ok(db.calls.some(c=>c.sql.includes('WHERE client_id = $2 AND archived_at IS NULL')));
 assert.ok(db.calls.some(c=>c.sql.includes('referred_by_name = $1')&&c.params[0]==='Ana'));
});
test('oportunidad inexistente devuelve 404 y no escribe',async()=>{
 const db=fakeDb(null);
 await assert.rejects(updateOpportunityReferral(db,id,{referred_by_name:'Ana'},{canAssign:true}),e=>e.status===404);
 assert.ok(!db.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)));
});
test('edición obsoleta de vendedor o referido se rechaza sin escrituras',async()=>{
 for(const body of [{salesperson_id:id,expected_salesperson_id:null},{referred_by_name:'Ana',expected_referred_by_name:'Otra persona'}]){
  const db=fakeDb({id,client_id:id,salesperson_id:seller,referred_by_name:'Original'});
  await assert.rejects(updateOpportunityReferral(db,id,body,{canAssign:true}),e=>e.status===409);
  assert.ok(!db.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)));
 }
});
