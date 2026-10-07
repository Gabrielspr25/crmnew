import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOpportunity } from '../src/services/opportunityConfirmedSales.js';
const base={id:'opp',created_at:'2026-05-31'};
test('descuenta una nueva de siete sin descontar renovaciones ni duplicados',()=>{
 const line={id:'l',product_key:'movil_new',quantity_value:7,created_at:'2026-05-31'};
 const sale={sale_id:'s',product_key:'movil_new',sale_date:'2026-08-29',phone:'7874596322'};
 const r=reconcileOpportunity(base,[line],[sale,sale,{sale_id:'ren',product_key:'movil_ren',sale_date:'2026-09-30'}]);
 assert.equal(r.products.movil_new.quantity_value,6);assert.equal(r.total_lines,6);
});
test('no usa venta anterior a la oportunidad ni crea pendientes desde registros vacios',()=>{
 const r=reconcileOpportunity(base,[{id:'l',product_key:'movil_new',quantity_value:2},{id:'z',product_key:'cloud',quantity_value:0}], [{sale_id:'old',product_key:'movil_new',sale_date:'2026-01-01'}]);
 assert.equal(r.total_lines,2);assert.equal(r.products.cloud,undefined);
});
test('cruza telefono exacto y conserva otra linea no vendida',()=>{
 const lines=['7871111111','7872222222'].map((phone,i)=>({id:String(i),phone,product_key:'movil_ren',quantity_value:1}));
 const r=reconcileOpportunity(base,lines,[{sale_id:'s',phone:'787-111-1111',product_key:'movil_ren',sale_date:'2026-09-01'}]);
 assert.equal(r.total_lines,1);assert.equal(r.lines[0].phone,'7872222222');
});
test('fijo descuenta mensualidad por producto y nunca produce negativo',()=>{
 const r=reconcileOpportunity(base,[{id:'l',product_key:'fijo_ren',money_value:100}], [{sale_id:'s',product_key:'fijo_ren',monthly_value:150,sale_date:'2026-09-01'}]);
 assert.equal(r.total_money,0);assert.equal(r.lines.length,0);
});
test('reconoce fechas PostgreSQL entregadas como objetos Date',()=>{
 const r=reconcileOpportunity(base,[{id:'l',product_key:'movil_new',quantity_value:7,created_at:new Date('2026-05-31T15:58:46Z')}],[{sale_id:'s',product_key:'movil_new',sale_date:'2026-08-29'}]);
 assert.equal(r.total_lines,6);
});
