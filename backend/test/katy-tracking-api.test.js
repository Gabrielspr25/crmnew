import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createAudienciaStore} from '../src/services/audienciaStore.js';
import {createKatyTrackingRouter} from '../src/routes/katyTrackingRoutes.js';
async function fixture(t){
 const directory=await mkdtemp(path.join(tmpdir(),'katy-tracking-api-'));
 const store=createAudienciaStore({directory}),app=express();app.use(express.json());
 const authorize=async req=>{const token=req.headers.authorization;if(!['Bearer reader','Bearer writer'].includes(token))throw Object.assign(Error('Sesión de integración requerida.'),{status:401});return {id:'katy-test',name:'Katy (prueba)',scopes:token==='Bearer writer'?['tracking:read','tracking:write']:['tracking:read']};};
 app.use('/api/tracking/v1',createKatyTrackingRouter({store,authorize}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port+'/api/tracking/v1';
 const request=(p,opts={})=>fetch(url+p,{...opts,headers:{Authorization:'Bearer writer','Content-Type':'application/json',...(opts.headers||{})},body:opts.body?JSON.stringify(opts.body):undefined});
 return {store,request,url};
}
test('API exige autorización y scopes de escritura',async t=>{
 const f=await fixture(t);assert.equal((await fetch(f.url+'/projects')).status,401);
 const list=await(await f.request('/nodes')).json();const node=list.nodes[0];
 assert.equal((await f.request('/nodes/'+node.id,{method:'PATCH',headers:{Authorization:'Bearer reader'},body:{revision:list.revision,changes:{nextStep:'Verificar'}}})).status,403);
 assert.equal((await f.store.read()).revision,0);
});
test('lectura filtrada muestra revisión y no entrega documento privado completo',async t=>{
 const f=await fixture(t),projects=await(await f.request('/projects')).json();assert.ok(projects.projects.length);
 assert.equal(projects.business_rules.approved_on,'2026-10-08');assert.ok(projects.business_rules.rules.some(rule=>rule.text.includes('cuotas efectivas vacías')));
 const r=await f.request('/nodes?project=newcrm');assert.equal(r.headers.get('cache-control'),'no-store');const list=await r.json();assert.ok(list.nodes.every(n=>n.project==='newcrm'));assert.equal(list.items,undefined);
 assert.equal((await f.request('/nodes/no-existe')).status,404);
});
test('actualiza una rama, registra autor y rechaza revisiones obsoletas',async t=>{
 const f=await fixture(t),before=await f.store.read(),node=before.tracking.nodes[0];
 const r=await f.request('/nodes/'+node.id,{method:'PATCH',body:{revision:before.revision,changes:{nextStep:'Revisar con Gabriel'}}});assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.revision,1);
 const after=await f.store.read();assert.equal(after.tracking.nodes.find(n=>n.id===node.id).nextStep,'Revisar con Gabriel');assert.deepEqual(after.projects,before.projects);assert.deepEqual(after.items,before.items);
 assert.equal(after.tracking.history.at(-1).actor.id,'katy-test');
 assert.equal((await f.request('/nodes/'+node.id,{method:'PATCH',body:{revision:0,changes:{nextStep:'Obsoleto'}}})).status,409);
});
test('bloquea campos externos y agrega nota sin borrar historial',async t=>{
 const f=await fixture(t),before=await f.store.read(),node=before.tracking.nodes[0];
 assert.equal((await f.request('/nodes/'+node.id,{method:'PATCH',body:{revision:0,changes:{id:'forjado'}}})).status,400);
 const response=await f.request('/nodes/'+node.id+'/notes',{method:'POST',body:{revision:0,text:'Revisar el próximo paso'}});assert.equal(response.status,201);
 const after=await f.store.read();assert.equal(after.tracking.decisions.at(-1).text,'Revisar el próximo paso');assert.equal(after.tracking.decisions.at(-1).nodeId,node.id);assert.ok(after.tracking.history.length>before.tracking.history.length);
});

test('dos escrituras simultáneas no sobrescriben una revisión nueva',async t=>{
 const f=await fixture(t),before=await f.store.read(),node=before.tracking.nodes[0];
 const requests=await Promise.all(['Primero','Segundo'].map(nextStep=>f.request('/nodes/'+node.id,{method:'PATCH',body:{revision:0,changes:{nextStep}}})));
 assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);assert.equal((await f.store.read()).revision,1);
});

test('releer una rama devuelve solo sus notas guardadas sin modificar el registro',async t=>{
 const f=await fixture(t),before=await f.store.read(),[node,other]=before.tracking.nodes;
 const first=await(await f.request('/nodes/'+node.id+'/notes',{method:'POST',body:{revision:0,text:'Prueba de conexión completada'}})).json();
 await f.request('/nodes/'+other.id+'/notes',{method:'POST',body:{revision:first.revision,text:'Nota de otro trabajo'}});
 const saved=await f.store.read();
 const result=await(await f.request('/nodes/'+node.id,{headers:{Authorization:'Bearer reader'}})).json();
 assert.equal(result.revision,saved.revision);
 assert.deepEqual(result.notes,saved.tracking.decisions.filter(n=>n.nodeId===node.id));
 assert.ok(result.notes.some(n=>n.text==='Prueba de conexión completada'));
 assert.ok(result.notes.every(n=>n.nodeId===node.id));
 assert.deepEqual(await f.store.read(),saved);
});

test('no permite declarar publicación comprobada sin evidencia ni falsificar autor',async t=>{
 const f=await fixture(t),before=await f.store.read(),node=before.tracking.nodes.find(n=>!n.evidence.some(e=>e.environment==='produccion'));
 assert.ok(node);assert.equal((await f.request('/nodes/'+node.id,{method:'PATCH',body:{revision:0,changes:{status:'publicado_verificado'}}})).status,400);
 assert.equal((await f.request('/nodes/'+node.id+'/notes',{method:'POST',body:{revision:0,text:'Nota',actor:{id:'gabriel'}}})).status,400);
 assert.equal((await f.store.read()).revision,0);
});
