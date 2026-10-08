import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import {markOpportunityNoRenew} from '../src/services/opportunityNoRenew.js';
import {opportunityChecklist} from '../src/services/opportunityConfirmedSales.js';

test('HTTP checklist y No renovar respetan sesión, dueño, elegibilidad y reversión',async()=>{
 const source=readFileSync(new URL('../src/routes/asanaReal.js',import.meta.url),'utf8');
 const start=source.indexOf("asanaRealRouter.post('/asana-real/:id/lines/:subscriberId/no-renew'");
 const end=source.indexOf("asanaRealRouter.get('/asana-real/:id',",start);
 const router=express.Router(),writes=[];let failNote=false;
 const opportunity={id:'opp',client_id:'client',created_at:'2026-10-08'};
 const context={lines:[],sales:[],subscribers:[{id:'sub',product_type:'G',remaining_payments:null,status:'activo'}]};
 const db={query:async sql=>{if(sql.startsWith('SELECT'))return {rows:sql.includes('opportunity_notes')?[]:[opportunity]};writes.push(sql);if(failNote&&sql.includes('INSERT INTO public.opportunity_notes'))throw Error('Fallo simulado');return {rows:[]};}};
 vm.runInNewContext(source.slice(start,end),{
  asanaRealRouter:router,requireAuth:(req,res,next)=>{if(!req.headers.authorization)return res.status(401).end();req.user={nombre:req.headers.authorization};next();},
  sellerCanOpenOpportunity:async(_db,_id,user)=>{if(user.nombre==='other')throw Object.assign(Error('Sin permiso'),{status:403});return true;},
  withPublic:async fn=>{const count=writes.length;try{return await fn(db);}catch(e){writes.length=count;throw e;}},
  opportunitySalesContext:async()=>context,markOpportunityNoRenew,opportunityChecklist,CLIENT_NAME:'c.name',asanaListCache:{at:0,rows:null}
 });
 const app=express();app.use(router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port+'/asana-real/opp';
 const get=(url,user,method='GET')=>fetch(base+url,{method,headers:user?{Authorization:user}:{}});
 try{
  assert.equal((await get('/checklist')).status,401);
  assert.equal((await get('/checklist','other')).status,403);
  const list=await get('/checklist','owner');assert.equal(list.status,200);assert.equal((await list.json()).lines[0].state,'pendiente');assert.equal(writes.length,0);
  assert.equal((await get('/lines/sub/no-renew','other','POST')).status,403);assert.equal(writes.length,0);
  assert.equal((await get('/lines/foreign/no-renew','owner','POST')).status,409);assert.equal(writes.length,0);
  failNote=true;assert.equal((await get('/lines/sub/no-renew','owner','POST')).status,500);assert.equal(writes.length,0);
  failNote=false;const saved=await get('/lines/sub/no-renew','owner','POST');assert.equal(saved.status,200);assert.equal((await saved.json()).state,'no_renueva');assert.equal(writes.length,3);
 }finally{await new Promise(r=>server.close(r));}
});
