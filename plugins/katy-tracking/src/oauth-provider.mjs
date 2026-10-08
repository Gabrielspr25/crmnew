import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {InvalidGrantError,InvalidClientError,InvalidScopeError,InvalidTokenError,InvalidRequestError} from '@modelcontextprotocol/sdk/server/auth/errors.js';

const token=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('base64url');
const SCOPES=['tracking:read','tracking:write'];
const callbackAllowed=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='chatgpt.com'&&!u.username&&!u.password&&!u.hash&&/^\/connector\/oauth\/[-_A-Za-z0-9]{1,200}$/.test(u.pathname)&&!u.search;}catch{return false;}};

// Reiniciar revoca códigos y accesos. El registro público de clientes se
// conserva cuando se configura clientsFile; no guarda tokens ni sesiones CRM.
export function createTrackingOAuthProvider({resource,consentUrl,clientsFile,now=()=>Date.now()}){
 for(const value of [resource,consentUrl]){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)throw Error('OAuth requiere configuración HTTPS confiable.');}
 const clients=new Map(),pending=new Map(),codes=new Map(),access=new Map(),refresh=new Map();
 const validClient=c=>c&&typeof c.client_id==='string'&&/^[-_A-Za-z0-9]{43}$/.test(c.client_id)&&c.token_endpoint_auth_method==='none'&&Array.isArray(c.redirect_uris)&&c.redirect_uris.length&&c.redirect_uris.every(callbackAllowed);
 if(clientsFile){
  let saved;try{saved=JSON.parse(readFileSync(clientsFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(saved){if(!Array.isArray(saved.clients)||saved.clients.length>1000||saved.clients.some(c=>!validClient(c)))throw Error('Registro OAuth inválido.');for(const client of saved.clients)clients.set(client.client_id,{client,expires:Infinity});}
 }
 const saveClients=()=>{if(!clientsFile)return;mkdirSync(path.dirname(clientsFile),{recursive:true,mode:0o700});const temporary=clientsFile+'.'+token()+'.tmp';writeFileSync(temporary,JSON.stringify({clients:[...clients.values()].map(v=>v.client)}),{mode:0o600,flag:'wx'});renameSync(temporary,clientsFile);};
 const cleanup=()=>{for(const map of [clients,pending,codes,access,refresh])for(const [key,value] of map)if(value.expires<=now())map.delete(key);};
 const put=(map,key,value)=>{cleanup();if(map.size>=1000)throw new InvalidRequestError('Límite de solicitudes alcanzado.');map.set(key,value);};
 const scopesFor=values=>{const scopes=values??['tracking:read'];if(!Array.isArray(scopes)||!scopes.length||scopes.some(s=>!SCOPES.includes(s)))throw new InvalidScopeError('Permiso no admitido.');return [...new Set(scopes)];};
 const resourceFor=value=>{if(value?.href!==resource)throw new InvalidRequestError('Recurso de seguimiento requerido.');};
 const clientFor=client=>{cleanup();if(!clients.has(client.client_id))throw new InvalidClientError('Cliente no registrado.');};
 const codeFor=(client,code)=>{clientFor(client);const grant=codes.get(hash(code));if(!grant||grant.clientId!==client.client_id)throw new InvalidGrantError('Código inválido o vencido.');return grant;};
 const issue=grant=>{
  const accessToken=token(),refreshToken=token();
  put(access,hash(accessToken),{...grant,expires:now()+3600_000});
  put(refresh,hash(refreshToken),{...grant,expires:now()+86400_000});
  return {access_token:accessToken,token_type:'Bearer',expires_in:3600,refresh_token:refreshToken,scope:grant.scopes.join(' ')};
 };
 const provider={
  skipLocalPkceValidation:true, // La validación S256 se realiza abajo, incluida en los tests.
  clientsStore:{
   async getClient(id){cleanup();return clients.get(id)?.client;},
   async registerClient(metadata){
    if(!Array.isArray(metadata.redirect_uris)||!metadata.redirect_uris.length||metadata.redirect_uris.some(u=>!callbackAllowed(u))||(metadata.token_endpoint_auth_method&&metadata.token_endpoint_auth_method!=='none'))throw new InvalidClientError('Solo se admite un cliente público de ChatGPT.');
    const client={...metadata,client_id:token(),client_id_issued_at:Math.floor(now()/1000),token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']};
    put(clients,client.client_id,{client,expires:clientsFile?Infinity:now()+86400_000});try{saveClients();}catch(error){clients.delete(client.client_id);throw error;}return client;
   }
  },
  async authorize(client,params,res){
   clientFor(client);resourceFor(params.resource);
   if(!client.redirect_uris.includes(params.redirectUri)||!callbackAllowed(params.redirectUri)||!/^[-_A-Za-z0-9]{43}$/.test(params.codeChallenge))throw new InvalidRequestError('Redirección o PKCE inválido.');
   const request=token();put(pending,hash(request),{clientId:client.client_id,redirectUri:params.redirectUri,challenge:params.codeChallenge,state:params.state,scopes:scopesFor(params.scopes),expires:now()+300_000});
   const url=new URL(consentUrl);url.searchParams.set('request',request);res.redirect(url.href);
  },
  async inspectRequest(request){cleanup();const grant=pending.get(hash(request));if(!grant)throw new InvalidGrantError('Solicitud vencida.');return {scopes:grant.scopes,clientName:clients.get(grant.clientId)?.client.client_name||'ChatGPT'};},
  // Solo invocable tras verificar al propietario mediante autenticación CRM.
  async approve(request,owner){
   cleanup();if(!owner?.id||!owner?.name)throw new InvalidGrantError('Se requiere autorización del propietario.');
   const grant=pending.get(hash(request));if(!grant)throw new InvalidGrantError('Solicitud vencida.');
   const code=token();put(codes,hash(code),{...grant,owner:{id:String(owner.id),name:String(owner.name)},expires:now()+60_000});pending.delete(hash(request));
   const callback=new URL(grant.redirectUri);callback.searchParams.set('code',code);if(grant.state!==undefined)callback.searchParams.set('state',grant.state);return callback.href;
  },
  async challengeForAuthorizationCode(client,code){return codeFor(client,code).challenge;},
  async exchangeAuthorizationCode(client,code,verifier,redirectUri,target){
   const grant=codeFor(client,code);resourceFor(target);
   if(redirectUri!==grant.redirectUri||typeof verifier!=='string'||verifier.length<43||verifier.length>128)throw new InvalidGrantError('Código inválido.');
   const received=hash(verifier);if(received.length!==grant.challenge.length||!timingSafeEqual(Buffer.from(received),Buffer.from(grant.challenge)))throw new InvalidGrantError('PKCE inválido.');
   const result=issue(grant);codes.delete(hash(code));return result;
  },
  async exchangeRefreshToken(client,value,requestedScopes,target){
   clientFor(client);resourceFor(target);const grant=refresh.get(hash(value));if(!grant||grant.clientId!==client.client_id)throw new InvalidGrantError('Acceso vencido.');
   const scopes=requestedScopes===undefined?grant.scopes:scopesFor(requestedScopes);if(scopes.some(s=>!grant.scopes.includes(s)))throw new InvalidScopeError('No se pueden ampliar permisos.');
   const result=issue({...grant,scopes});refresh.delete(hash(value));return result;
  },
  async verifyAccessToken(value){cleanup();const grant=access.get(hash(value));if(!grant)throw new InvalidTokenError('Acceso inválido o vencido.');return {token:value,clientId:grant.clientId,scopes:grant.scopes,expiresAt:Math.floor(grant.expires/1000),resource:new URL(resource),extra:{owner:grant.owner}};},
  async revokeToken(client,request){clientFor(client);for(const map of [access,refresh]){const grant=map.get(hash(request.token));if(grant?.clientId===client.client_id)map.delete(hash(request.token));}}
 };
 return provider;
}
