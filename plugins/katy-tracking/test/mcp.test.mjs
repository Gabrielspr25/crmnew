import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createTrackingMcpRouter} from '../src/mcp-router.mjs';
test('MCP autentica, lista herramientas y transmite revisión sin credenciales en resultados',async t=>{
 const calls=[],authorize=async req=>{if(req.headers.authorization!=='Bearer integration-test')throw Object.assign(Error('Sin acceso'),{status:401});return {id:'katy',name:'Katy',scopes:['tracking:read']};};
 const app=express();app.use(express.json());app.use('/mcp',createTrackingMcpRouter({authorize,invoke:async({path,method,body})=>{calls.push({path,method,body});return {revision:7,projects:[{id:'newcrm',name:'newcrm'}]};}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=new URL('http://127.0.0.1:'+server.address().port+'/mcp');
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 const client=new Client({name:'katy-test',version:'1.0'});
 await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:'Bearer integration-test'}}}));t.after(()=>client.close());
 const tools=await client.listTools();assert.equal(tools.tools.length,5);
 const result=await client.callTool({name:'tracking_list_projects',arguments:{}});assert.equal(result.structuredContent.revision,7);assert.ok(!JSON.stringify(result).includes('integration-test'));
 const denied=await client.callTool({name:'tracking_update_node',arguments:{id:'node-1',revision:7,changes:{nextStep:'Continuar'}}});assert.equal(denied.isError,true);assert.equal(calls.length,1);
});
