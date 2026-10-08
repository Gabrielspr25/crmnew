import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackingGateway} from '../src/gateway.mjs';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
test('gateway protege consentimiento, publica descubrimiento y rechaza acceso anónimo',async t=>{
 const gateway=createTrackingGateway({origin:'https://crm.example',verifyOwner:async()=>{throw Error('Sin sesión');},store:{read:async()=>({revision:0,projects:[],tracking:{nodes:[]}}),write:async()=>{throw Error('No permitido');}}});
 const server=await new Promise(resolve=>{const s=gateway.app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 assert.equal((await fetch(base+'/consent/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"request":"x"}'})).status,401);
 const metadata=await(await fetch(base+'/.well-known/oauth-authorization-server')).json();
 assert.equal(metadata.issuer,'https://crm.example/');assert.equal(metadata.authorization_endpoint,'https://crm.example/authorize');
 assert.equal((await fetch(base+'/api/tracking/v1/projects')).status,401);
});

test('flujo HTTP OAuth completo habilita una consulta real por MCP con identidad separada',async t=>{
 const resource='https://crm.example/mcp',verifier='z'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
 const gateway=createTrackingGateway({origin:'https://crm.example',verifyOwner:async req=>{if(req.headers.authorization!=='Bearer owner-session-test')throw Error();return {id:'owner',name:'Propietario'};},store:{read:async()=>({revision:12,projects:[{id:'newcrm',name:'newcrm'}],tracking:{nodes:[{id:'trabajo-katy',project:'newcrm',title:'Prueba Katy'}],decisions:[{id:'nota-katy',nodeId:'trabajo-katy',text:'Prueba de conexión completada'},{id:'otra-nota',nodeId:'otro-trabajo',text:'Privada de otro trabajo'}]}}),write:async()=>{throw Error();}}});
 const server=await new Promise(resolve=>{const s=gateway.app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const registered=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'ChatGPT test',redirect_uris:['https://chatgpt.com/connector/oauth/callback'],token_endpoint_auth_method:'none'})});assert.equal(registered.status,201);const clientInfo=await registered.json();
 const query=new URLSearchParams({client_id:clientInfo.client_id,response_type:'code',redirect_uri:clientInfo.redirect_uris[0],code_challenge:challenge,code_challenge_method:'S256',resource,scope:'tracking:read',state:'test-state'});
 const authorization=await fetch(base+'/authorize?'+query,{redirect:'manual'});assert.equal(authorization.status,302);const pending=new URL(authorization.headers.get('location')).searchParams.get('request');
 const consent=await fetch(base+'/consent/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner-session-test',Origin:'https://crm.example'},body:JSON.stringify({request:pending})});assert.equal(consent.status,200);const code=new URL((await consent.json()).redirect).searchParams.get('code');
 const exchanged=await fetch(base+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientInfo.client_id,code,code_verifier:verifier,redirect_uri:clientInfo.redirect_uris[0],resource})});assert.equal(exchanged.status,200);const credential=await exchanged.json();
 const client=new Client({name:'katy-test',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+credential.access_token}}}));t.after(()=>client.close());
 const result=await client.callTool({name:'tracking_list_projects',arguments:{}});assert.equal(result.structuredContent.revision,12);assert.equal(result.structuredContent.projects[0].id,'newcrm');assert.ok(!JSON.stringify(result).includes(credential.access_token));
 const detail=await client.callTool({name:'tracking_get_node',arguments:{id:'trabajo-katy'}});
 assert.equal(detail.structuredContent.notes.length,1);assert.equal(detail.structuredContent.notes[0].text,'Prueba de conexión completada');assert.ok(!JSON.stringify(detail).includes('Privada de otro trabajo'));
});
