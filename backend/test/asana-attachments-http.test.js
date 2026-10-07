import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import express from 'express';import pg from 'pg';import jwt from 'jsonwebtoken';
import {requireAuth} from '../src/auth.js';
import {createAsanaAttachmentsRouter,listAsanaAttachments} from '../src/routes/asanaAttachments.js';
const enabled=process.env.ASANA_ATTACHMENTS_TEST==='1'?test:test.skip;
const opp='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64');
enabled('HTTP y PostgreSQL: permisos, upload real, relectura, descarga y rollback de archivos',async()=>{
 const pool=new pg.Pool({host:'127.0.0.1',port:45437,user:'asana_test',database:'asana_referral_test'});
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'asana-attachments-'));
 const app=express();app.use('/api',createAsanaAttachmentsRouter({pool,requireAuth,uploadDir:root}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api/asana-real/'+opp;
 const token=(name,role='vendedor')=>jwt.sign({nombre:name,rol:role},process.env.JWT_SECRET||'dev-secret-cambiar');
 const owner=token('Vendedor Uno - Prueba'),other=token('Vendedor Dos - Prueba'),admin=token('Admin prueba','admin');
 const send=(t,files=[{name:'captura.png',data:png}],body='Nota técnica de prueba')=>{
  const form=new FormData();form.append('body',body);for(const f of files)form.append('files',new Blob([f.data]),f.name);
  return fetch(base+'/notes-with-attachments',{method:'POST',headers:t?{Authorization:'Bearer '+t}:{},body:form});
 };
 const ids=[];
 try{
  await pool.query("UPDATE sales_opportunities SET salesperson_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',archived_at=NULL WHERE id=$1",[opp]);
  assert.equal((await send(null)).status,401);assert.equal((await send(other)).status,403);assert.equal((await fs.readdir(root)).length,0);
  assert.equal((await send(owner,[{name:'falsa.png',data:Buffer.from('<html>')}])).status,422);
  assert.equal((await send(owner,Array.from({length:6},()=>({name:'captura.png',data:png})))).status,413);
  assert.equal((await send(owner,[{name:'grande.png',data:Buffer.alloc(10*1024*1024+1)}])).status,413);
  const response=await send(owner);assert.equal(response.status,201);const note=await response.json();ids.push(note.id);assert.equal(note.attachments.length,1);
  const url=base+'/log/'+note.id+'/attachments/'+note.attachments[0].id;
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+other}})).status,403);
  const read=await fetch(url,{headers:{Authorization:'Bearer '+owner}});assert.equal(read.status,200);assert.deepEqual(Buffer.from(await read.arrayBuffer()),png);assert.match(read.headers.get('content-type'),/image\/png/);
  const download=await fetch(url+'?download=1',{headers:{Authorization:'Bearer '+admin}});assert.match(download.headers.get('content-disposition'),/^attachment/);
  const list=await fetch(base+'/log/'+note.id+'/attachments',{headers:{Authorization:'Bearer '+owner}}).then(r=>r.json());assert.equal(list.length,1);assert.ok(!Object.hasOwn(list[0],'storage_key'));
  assert.deepEqual(await listAsanaAttachments(pool,opp,{nombre:'Vendedor Dos - Prueba',rol:'vendedor'},{hideForbidden:true}),[]);
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const blank=await send(owner,[{name:'documento.pdf',data:pdf}],'');assert.equal(blank.status,201);ids.push((await blank.json()).id);
  const five=await send(owner,Array.from({length:5},(_,i)=>({name:'captura'+i+'.png',data:png})));assert.equal(five.status,201);ids.push((await five.json()).id);
  await pool.query("ALTER TABLE public.opportunity_note_attachments ADD CONSTRAINT reject_attachment_test CHECK(filename<>'rollback.png')");
  const before=await fs.readdir(root);assert.equal((await send(owner,[{name:'rollback.png',data:png}])).status,500);assert.deepEqual(await fs.readdir(root),before);
  await pool.query('ALTER TABLE public.opportunity_note_attachments DROP CONSTRAINT reject_attachment_test');
  assert.equal((await fetch(base+'/log/'+note.id,{method:'DELETE',headers:{Authorization:'Bearer '+other}})).status,403);
  assert.equal((await fetch(base+'/log/'+note.id,{method:'DELETE',headers:{Authorization:'Bearer '+owner}})).status,200);
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+owner}})).status,404);
 }finally{
  await pool.query('ALTER TABLE public.opportunity_note_attachments DROP CONSTRAINT IF EXISTS reject_attachment_test');
  await pool.query('DELETE FROM public.opportunity_notes WHERE id=ANY($1::uuid[])',[ids]);
  await new Promise(r=>server.close(r));await pool.end();await fs.rm(root,{recursive:true,force:true});
 }
});
