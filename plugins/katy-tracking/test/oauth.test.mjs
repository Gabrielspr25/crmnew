import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createTrackingOAuthProvider} from '../src/oauth-provider.mjs';

test('conserva el cliente registrado tras reiniciar sin persistir códigos ni accesos',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'katy-oauth-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const config={resource:'https://crm.example/mcp',consentUrl:'https://crm.example/consent',clientsFile:path.join(dir,'clients.json')};
 const provider=createTrackingOAuthProvider(config);
 const client=await provider.clientsStore.registerClient({redirect_uris:['https://chatgpt.com/connector/oauth/exampleClientId'],token_endpoint_auth_method:'none'});
 const restarted=createTrackingOAuthProvider({...config,now:()=>Date.now()+2*86400_000});
 assert.deepEqual(await restarted.clientsStore.getClient(client.client_id),client);
 const disk=JSON.parse(await readFile(config.clientsFile,'utf8'));assert.deepEqual(Object.keys(disk),['clients']);
 assert.equal(disk.clients.length,1);assert.equal(disk.clients[0].client_id,client.client_id);
 await assert.rejects(()=>restarted.verifyAccessToken('unknown'));
});

test('OAuth liga consentimiento, cliente, recurso y PKCE; código de un solo uso y revocación',async()=>{
 const resource='https://crm.example/mcp',verifier='v'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
 const provider=createTrackingOAuthProvider({resource,consentUrl:'https://crm.example/consent'});
 const client=await provider.clientsStore.registerClient({redirect_uris:['https://chatgpt.com/connector/oauth/callback'],token_endpoint_auth_method:'none'});
 let location;await provider.authorize(client,{redirectUri:client.redirect_uris[0],resource:new URL(resource),codeChallenge:challenge,scopes:['tracking:read'],state:'state'}, {redirect:url=>{location=url;}});
 const pending=new URL(location).searchParams.get('request');
 await assert.rejects(()=>provider.approve(pending,null));
 const callback=await provider.approve(pending,{id:'owner',name:'Propietario'});
 const code=new URL(callback).searchParams.get('code');
 await assert.rejects(()=>provider.exchangeAuthorizationCode(client,code,'wrong',client.redirect_uris[0],new URL(resource)));
 const tokens=await provider.exchangeAuthorizationCode(client,code,verifier,client.redirect_uris[0],new URL(resource));
 assert.deepEqual((await provider.verifyAccessToken(tokens.access_token)).scopes,['tracking:read']);
 await assert.rejects(()=>provider.exchangeAuthorizationCode(client,code,verifier,client.redirect_uris[0],new URL(resource)));
 await provider.revokeToken(client,{token:tokens.access_token});
 await assert.rejects(()=>provider.verifyAccessToken(tokens.access_token));
});

test('OAuth rechaza redirecciones ajenas, scopes desconocidos y recurso distinto',async()=>{
 const provider=createTrackingOAuthProvider({resource:'https://crm.example/mcp',consentUrl:'https://crm.example/consent'});
 await assert.rejects(()=>provider.clientsStore.registerClient({redirect_uris:['https://evil.example/callback']}));
 const client=await provider.clientsStore.registerClient({redirect_uris:['https://chatgpt.com/connector/oauth/callback'],token_endpoint_auth_method:'none'});
 for(const params of [{scopes:['admin']},{resource:new URL('https://else.example/mcp')},{redirectUri:'https://evil.example/callback'}])await assert.rejects(()=>provider.authorize(client,{redirectUri:client.redirect_uris[0],resource:new URL('https://crm.example/mcp'),codeChallenge:'a'.repeat(43),scopes:['tracking:read'],...params},{redirect:()=>{throw Error('No debería redirigir');}}));
});

test('admite el formato de callback individual observado en ChatGPT y rechaza otras rutas',async()=>{
 const provider=createTrackingOAuthProvider({resource:'https://crm.example/mcp',consentUrl:'https://crm.example/consent'});
 const registered=await provider.clientsStore.registerClient({redirect_uris:['https://chatgpt.com/connector/oauth/exampleClientId'],token_endpoint_auth_method:'none'});
 assert.ok(registered.client_id);
 await assert.rejects(()=>provider.clientsStore.registerClient({redirect_uris:['https://chatgpt.com/other/oauth/exampleClientId']}));
});
