import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {markOpportunityNoRenew} from '../src/services/opportunityNoRenew.js';
import {reconcileOpportunity} from '../src/services/opportunityConfirmedSales.js';

test('notas del checklist y lista excluyen marcas de prioridad antiguas y actuales',()=>{
 const source=readFileSync(new URL('../src/routes/asanaReal.js',import.meta.url),'utf8');
 assert.match(source,/n\.note NOT ILIKE '\[ASANA_PRIORITY:%'/);
 assert.match(source,/note NOT ILIKE '\[PRIORIDAD_ASANA:%' AND note NOT ILIKE '\[ASANA_PRIORITY:%'/);
});

test('No renovar registra decisión e historial sin cambiar contrato ni suscriptor',async()=>{
 const opportunity={id:'opp',client_id:'client',created_at:'2026-10-07'};
 const context={lines:[],sales:[],subscribers:[{id:'sub',ban_id:'ban',phone:'7870000001',product_type:'G',status:'activo',remaining_payments:null}]};
 const before=structuredClone(context),queries=[];
 await markOpportunityNoRenew({db:{query:async(sql,args)=>{queries.push({sql,args});return {rows:[]};}},opportunity,context,subscriberId:'sub',user:{nombre:'Mayra'}});
 assert.deepEqual(context,before);assert.equal(queries.length,3);
 assert.match(queries[0].sql,/no_trabajar_ahora/);assert.match(queries[0].sql,/no_renueva/);
 assert.match(queries[1].sql,/opportunity_notes/);assert.equal(queries[1].args.at(-1),'Mayra');
 assert.ok(queries.every(q=>!q.sql.includes('UPDATE public.subscribers')));
});

test('No renovar rechaza línea ajena o no elegible antes de escribir',async()=>{
 const db={query:async()=>{throw Error('No debe escribir');}};
 await assert.rejects(()=>markOpportunityNoRenew({db,opportunity:{id:'opp'},context:{lines:[],sales:[],subscribers:[{id:'sub',product_type:'G',remaining_payments:19,status:'activo'}]},subscriberId:'sub'}),{status:409});
});

test('notas se ordenan por fecha real sin agrupar autores y checklist muestra estados y equipo faltante',()=>{
 const source=readFileSync(new URL('../../frontend/app.html',import.meta.url),'utf8');
 const helper=source.slice(source.indexOf('function asanaNotesNewestFirst'),source.indexOf('async function abrirChecklistAsana'));
 const context={esc:String,fmtPhone:String,cliEquipmentLabel:value=>value||''};vm.runInNewContext(helper,context);
 const notes=[{id:'a',body:'Anterior',user_name:'Gabriel',created_at:'2026-10-07T01:00:00Z'},{id:'b',body:'Más reciente',user_name:'Mayra',created_at:'2026-10-08T01:00:00Z'}];
 const html=context.asanaChecklistHtml({id:'opp',client_name:'Ejemplo',notes,lines:[{subscriber_id:'sub',phone:'7870000001',state:'pendiente',equipment:null},{subscriber_id:'ren',state:'renovada',equipment:'Equipo real'}]});
 assert.ok(html.indexOf('Más reciente')<html.indexOf('Anterior'));assert.doesNotMatch(html,/Gabriel|Mayra/);
 assert.match(html,/Sin equipo registrado/);assert.match(html,/Equipo real/);assert.match(html,/Renovada/);assert.match(html,/No renovar/);
});

test('cinco renovaciones sin productos guardados habilitan plantillas existentes y preservan pasos',async()=>{
 const source=readFileSync(new URL('../src/routes/asanaReal.js',import.meta.url),'utf8');
 const helper=source.slice(source.indexOf('async function fetchWorkflowTemplateSteps'),source.indexOf('async function closeOpportunityToPool'));
 const subscribers=Array.from({length:5},(_,i)=>({id:'sub'+i,phone:'787000000'+i,product_type:'G',status:'activo',remaining_payments:null}));
 const templates=Array.from({length:5},(_,i)=>({name:'Paso de prueba '+i,step_order:i+1}));
 const context={reconcileOpportunity,opportunitySalesContext:async()=>({lines:[],sales:[],subscribers}),MEANINGFUL_OPPORTUNITY_LINE_SQL:()=> 'true',cleanText:s=>String(s||''),randomUUID:()=> 'id'};vm.runInNewContext(helper,context);
 const inserted=[];
 const db={query:async(sql,args)=>{
  if(sql.includes('INSERT INTO opportunity_steps')){inserted.push(args);return {rows:[]};}
  if(sql.includes('SELECT DISTINCT ol.product_key'))return {rows:[]};
  if(sql.includes('SELECT created_at'))return {rows:[{created_at:'2026-10-07'}]};
  if(sql.includes('product_step_templates'))return {rows:templates};
  if(sql.includes('SELECT LOWER(TRIM(name))'))return {rows:[]};
  if(sql.includes('SELECT COALESCE(MAX'))return {rows:[{n:inserted.length+1}]};
  return {rows:[]};
 }};
 await context.ensureOpportunityWorkflowSteps(db,'opp');assert.equal(inserted.length,5);assert.ok(inserted.every(args=>args[2]==='movil_ren'));
});
