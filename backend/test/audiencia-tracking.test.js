import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAudienciaStore, audienceDefaults, validateAudience } from '../src/services/audienciaStore.js';

test('inventario estable cubre menú real y separa Constructor del acceso comercial', async () => {
  const store = createAudienciaStore({ directory: await mkdtemp(path.join(tmpdir(), 'aud-tree-')) });
  const first = await store.read(), second = await store.read();
  assert.deepEqual(first, second);
  assert.ok(first.tracking);
  const crm = first.tracking.nodes.filter(n => n.project === 'newcrm' && !n.parentId);
  assert.deepEqual(crm.map(n => n.title), ['Panel General', 'Clientes', 'Gestión', 'Correos', 'Administración de Ofertas', 'Portal de Ofertas', 'Prospección', 'Import New', 'Perfil']);
  assert.ok(first.tracking.nodes.some(n => n.project === 'Constructor' && n.title === 'Mapa del Constructor'));
  const campaigns = first.tracking.nodes.find(n => n.id === 'campanas-envios');
  assert.equal(campaigns.status, 'pendiente_desarrollo');
  assert.equal(campaigns.fulfillment, 'incompleto');
  assert.ok(first.tracking.nodes.some(n => n.status === 'publicado_verificado'));
});

test('primera escritura persiste inventario y preserva versión 1 y fichas existentes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aud-legacy-'));
  const old = audienceDefaults();
  delete old.tracking;
  old.items.push({id:'old',title:'Idea real conservada',kind:'idea',state:'pendiente',projectId:'',rawInput:'Original',images:[{name:'adjunto',data:'conservado'}],history:[]});
  await writeFile(path.join(directory,'audiencia.json'), JSON.stringify(old));
  const store = createAudienciaStore({directory}), loaded = await store.read();
  assert.deepEqual(loaded.items,old.items);
  assert.deepEqual(loaded.projects,old.projects);
  const saved = await store.write(loaded,0,{id:'gabriel',name:'Gabriel'});
  assert.equal(saved.tracking.history.filter(e=>e.entity==='inventory'&&e.entityId==='initial').length,1);
  const again=await store.write(saved,saved.revision,{id:'gabriel',name:'Gabriel'});
  assert.equal(again.tracking.history.filter(e=>e.entity==='inventory'&&e.entityId==='initial').length,1);
  assert.deepEqual((await createAudienciaStore({directory}).read()).tracking,saved.tracking);
  const previous = JSON.parse(await readFile(path.join(directory,'audiencia.previous.json')));
  assert.deepEqual(previous,saved);
});

test('el historial conserva eventos y permite guardar despues de 10 000',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'aud-history-limit-'));
 const initial=audienceDefaults();
 initial.tracking.history=Array.from({length:10000},(_,i)=>({id:'old-'+i,at:'2026-10-04T00:00:00Z',entity:'items',entityId:'historic',actor:{id:'owner',name:'Propietario'},before:null,after:null}));
 await writeFile(path.join(directory,'audiencia.json'),JSON.stringify(initial));
 const store=createAudienciaStore({directory});const loaded=await store.read();loaded.theme='dark';
 loaded.tracking.nodes[0].nextStep='Revision autorizada del historial';
 const saved=await store.write(loaded,loaded.revision,{id:'owner',name:'Propietario'});
 assert.ok(saved.tracking.history.length>10000);
 assert.deepEqual(saved.tracking.history.slice(0,10000),initial.tracking.history);
 assert.equal((await store.read()).revision,saved.revision);
});

test('seguimiento rechaza ciclos, referencias, estados, fechas y falsa evidencia publicada', () => {
  const base = audienceDefaults();
  assert.ok(base.tracking);
  for (const change of [
    d => { d.tracking.nodes[0].parentId = d.tracking.nodes[0].id; },
    d => { d.tracking.nodes[0].parentId = 'inexistente'; },
    d => { d.tracking.nodes[0].status = 'todo-listo'; },
    d => { d.tracking.nodes[0].deadline = '2026-02-30'; },
    d => { d.tracking.nodes[0].status = 'publicado_verificado'; d.tracking.nodes[0].evidence = []; },
    d => { d.tracking.nodes[0].assignee = 'agente-inventado'; },
    d => { d.tracking.nodes[0].kind = 'step'; },
    d => { d.tracking.nodes[0].workState = 'inventado'; },
  ]) { const data=structuredClone(base); change(data); assert.throws(()=>validateAudience(data)); }
});

test('servidor registra antes/después y decisiones; rechaza historia alterada y conflicto', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'aud-history-')), store=createAudienciaStore({directory});
  const initial=await store.read();
  const first=await store.write(initial,0,{id:'gabriel',name:'Gabriel'});
  const next=structuredClone(first), node=next.tracking.nodes.find(n=>n.id==='campanas-envios');
  node.nextStep='Definir alcance de envíos con Gabriel';
  next.tracking.decisions.push({id:'decision-real',nodeId:node.id,text:'No enviar correos durante la revisión',at:'2026-10-04',assignee:''});
  const saved=await store.write(next,first.revision,{id:'gabriel',name:'Gabriel'});
  const event=saved.tracking.history.find(e=>e.entityId===node.id && e.before?.nextStep!==e.after?.nextStep);
  assert.equal(event.actor.id,'gabriel');
  assert.equal(event.after.nextStep,node.nextStep);
  assert.ok(event.at);
  const tampered=structuredClone(saved); tampered.tracking.history=[];
  await assert.rejects(()=>store.write(tampered,saved.revision),e=>e.status===400);
  await assert.rejects(()=>store.write(next,first.revision),e=>e.status===409);
  assert.deepEqual((await store.read()).tracking,saved.tracking);
});

test('cliente anterior conserva seguimiento y adjuntos; entrada inválida no altera archivo', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'aud-old-client-')), store=createAudienciaStore({directory});
  const initial=await store.read();
  const saved=await store.write(initial,0,{id:'owner',name:'Propietario'});
  const legacy=structuredClone(saved); delete legacy.tracking;
  legacy.items.push({id:'original',title:'Requisito autorizado',rawInput:'Texto original',kind:'idea',state:'pendiente',projectId:'',images:[{name:'adjunto'}],history:[]});
  const next=await store.write(legacy,saved.revision,{id:'owner',name:'Propietario'});
  assert.deepEqual(next.tracking.nodes,saved.tracking.nodes);
  assert.deepEqual(next.items[0].images,legacy.items[0].images);
  assert.ok(next.tracking.history.some(e=>e.entity==='items'&&e.after.rawInput==='Texto original'));
  const invalid={...next,items:undefined};
  await assert.rejects(()=>store.write(invalid,next.revision),e=>e.status===400);
  assert.deepEqual(await store.read(),next);
});
