import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createTrackingMcpRouter} from '../src/mcp-router.mjs';

test('el recurso publica descubrimiento OAuth y dirige el rechazo al mismo recurso',async t=>{
 const app=express();app.use(express.json());
 app.use(createTrackingMcpRouter({resource:'https://crm.example/mcp',authorizationServer:'https://identity.example',authorize:async()=>{throw Error('Sin acceso');},invoke:async()=>{throw Error('No debe ejecutarse');}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const discovery=await fetch(base+'/.well-known/oauth-protected-resource/mcp');
 assert.equal(discovery.status,200);
 assert.deepEqual(await discovery.json(),{resource:'https://crm.example/mcp',authorization_servers:['https://identity.example'],scopes_supported:['tracking:read','tracking:write']});
 const rejection=await fetch(base+'/',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(rejection.status,401);
 assert.match(rejection.headers.get('www-authenticate'),/resource_metadata="https:\/\/crm.example\/\.well-known\/oauth-protected-resource\/mcp"/);
});
