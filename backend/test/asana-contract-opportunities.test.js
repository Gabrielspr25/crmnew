import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOpportunity, opportunityChecklist } from '../src/services/opportunityConfirmedSales.js';
const opp={id:'opp',created_at:'2026-10-05'};
const sub=(id,extra={})=>({id,phone:'787000000'+id,status:'activo',product_type:'G',contract_end_date:'2028-03-05',remaining_payments:17,...extra});
const run=(subs,lines=[],sales=[])=>reconcileOpportunity(opp,lines,sales,subs,'2026-10-07');
test('CAS sin productos guardados muestra cuatro renovaciones y excluye la vigente',()=>{
 const r=run([sub('1',{remaining_payments:0}),sub('2',{remaining_payments:0}),sub('3',{remaining_payments:0}),sub('4'),sub('5',{remaining_payments:0})]);
 assert.equal(r.products.movil_ren?.quantity_value,4);
});
test('movil con cuotas pendientes no entra aunque el contrato venza o falte',()=>{
 assert.equal(run([sub('1',{contract_end_date:'2026-10-06'}),sub('2',{contract_end_date:null})]).total_lines,0);
});
test('cuotas efectivas vacias admiten renovacion movil sin alterar el dato original',()=>{
 const r=run([sub('1',{remaining_payments:null}),sub('2',{remaining_payments:''})]);
 assert.equal(r.total_lines,2);assert.equal(r.review_count,2);
});

test('Samary con cinco moviles activos sin contratos ni cuotas genera cinco renovaciones pendientes',()=>{
 const subscribers=Array.from({length:5},(_,i)=>sub(String(i+1),{ban_id:'ban-samary',contract_start_date:null,contract_end_date:null,contract_term:null,remaining_payments:null}));
 const before=structuredClone(subscribers),result=run(subscribers);
 assert.equal(result.products.movil_ren.quantity_value,5);assert.equal(result.lines.length,5);assert.deepEqual(subscribers,before);
});

test('cuotas vacias respetan primero calendario valido y rechazan datos invalidos o negativos',()=>{
 const result=run([sub('1',{remaining_payments:null,contract_start_date:'2026-09-07',contract_term:24}),...['mal',-1,NaN,Infinity,false].map((remaining_payments,i)=>sub(String(i+2),{remaining_payments}))]);
 assert.equal(result.total_lines,0);
});

test('cuotas vacias conservan exclusiones y descuento de renovacion confirmada',()=>{
 const result=run([sub('1',{remaining_payments:null,status:'inactive'}),sub('2',{remaining_payments:null}),sub('3',{remaining_payments:null})],[{subscriber_id:'2',product_key:'movil_ren',status:'no_renueva'}],[{sale_id:'venta',phone:'7870000003',product_key:'movil_ren',sale_date:'2026-10-06'}]);
 assert.equal(result.total_lines,0);assert.equal(result.sold_count,1);
});
test('no renueva y canceladas quedan fuera',()=>{
 assert.equal(run([sub('1',{status:'no_renueva_ahora',remaining_payments:0}),sub('2',{status:'cancelado',remaining_payments:0})]).total_lines,0);
});
test('deduplica productos guardados por suscriptor y telefono, conserva nuevas manuales',()=>{
 const lines=[{id:'old',subscriber_id:'1',phone:'7870000001',product_key:'movil_ren',quantity_value:1},{id:'manual',product_key:'movil_new',quantity_value:3}];
 const r=run([sub('1',{remaining_payments:0}),sub('1',{remaining_payments:0})],lines);
 assert.equal(r.products.movil_ren.quantity_value,1);assert.equal(r.products.movil_new.quantity_value,3);
});
test('linea guardada vigente deja de contar como renovacion',()=>{
 assert.equal(run([sub('1')],[{subscriber_id:'1',product_key:'movil_ren',quantity_value:1}]).total_lines,0);
});
test('respeta exclusion explicita guardada y descuenta venta confirmada exacta',()=>{
 const r=run([sub('1',{remaining_payments:0}),sub('2',{remaining_payments:0})],[{subscriber_id:'1',product_key:'movil_ren',status:'no_renueva'}],[{sale_id:'s',product_key:'movil_ren',phone:'7870000002',sale_date:'2026-10-06'}]);
 assert.equal(r.total_lines,0);assert.equal(r.sold_count,1);
});
test('fijo usa mensualidad real y MPLS unidades',()=>{
 const r=run([sub('1',{product_type:'O',contract_end_date:'2026-10-06',remaining_payments:3,monthly_value:42.50}),sub('2',{product_type:'T',remaining_payments:0,monthly_value:100})]);
 assert.equal(r.total_money,42.50);assert.equal(r.products.mpls.quantity_value,1);
});
test('conserva nuevas manuales asociadas a un suscriptor vigente',()=>{
 assert.equal(run([sub('1')],[{subscriber_id:'1',phone:'7870000001',product_key:'movil_new',quantity_value:2}]).total_lines,2);
});
test('fijo sin precio conserva oportunidad sin inventar importe',()=>{
 const r=run([sub('1',{product_type:'O',contract_end_date:null,remaining_payments:3,monthly_value:null})]);
 assert.equal(r.products.fijo_ren.subscriber_count,1);assert.equal(r.total_money,0);assert.equal(r.products.fijo_ren.missing_price_count,1);
});
test('Cloud nueva manual no desaparece al coincidir su telefono con cartera vigente',()=>{
 const r=run([sub('1',{product_type:'K'})],[{id:'manual',line_mode:'nueva',phone:'7870000001',product_key:'cloud',quantity_value:3}]);
 assert.equal(r.products.cloud.quantity_value,3);
});
test('estado canceled no genera oportunidades',()=>{
 assert.equal(run([sub('1',{status:'canceled',remaining_payments:0})]).total_lines,0);
});

test('checklist conserva renovada confirmada y No renovar sin contarlas pendientes',()=>{
 const subs=[sub('1',{remaining_payments:null,ban_number:'123',equipment:'Equipo real'}),sub('2',{remaining_payments:null,status:'no_renueva'}),sub('3',{remaining_payments:null,equipment:null}),sub('4',{status:'cancelado'})];
 const sale={sale_id:'venta',phone:subs[0].phone,product_key:'movil_ren',sale_date:'2026-10-06'};
 const result=opportunityChecklist(opp,[],[sale],subs,'2026-10-07');
 assert.deepEqual(result.lines.map(l=>l.state),['renovada','no_renueva','pendiente']);
 assert.equal(result.lines[0].equipment,'Equipo real');assert.equal(result.lines[0].ban_number,'123');
 assert.equal(result.lines[2].equipment,null);assert.equal(result.pending.total_lines,1);
});

test('checklist no convierte cuotas pendientes en oportunidades ni suspensión en No renovar',()=>{
 const result=opportunityChecklist(opp,[],[],[sub('1',{remaining_payments:19}),sub('2',{status:'suspendido',remaining_payments:0})],'2026-10-07');
 assert.equal(result.lines.length,1);assert.equal(result.lines[0].subscriber_id,'2');assert.equal(result.lines[0].state,'pendiente');
});
test('checklist conserva renovación confirmada aunque el nuevo contrato tenga cuotas',()=>{
 const s=sub('1',{remaining_payments:24,contract_start_date:'2026-10-08'});
 const checklist=opportunityChecklist(opp,[],[{sale_id:'sale',product_key:'movil_ren',phone:s.phone,sale_date:'2026-10-06'}],[s],'2026-10-08');
 assert.equal(checklist.lines.length,1);assert.equal(checklist.lines[0].state,'renovada');assert.equal(checklist.pending.total_lines,0);
});
