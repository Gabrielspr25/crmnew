import express from 'express';
import {mcpAuthRouter} from '@modelcontextprotocol/sdk/server/auth/router.js';
import {createTrackingOAuthProvider} from './oauth-provider.mjs';
import {createTrackingMcpRouter} from './mcp-router.mjs';
import {createKatyTrackingRouter} from '../../../backend/src/routes/katyTrackingRoutes.js';

export function createTrackingGateway({origin,verifyOwner,store,clientsFile}){
 if(typeof verifyOwner!=='function')throw Error('Falta verificación del propietario.');
 const originUrl=new URL(origin);if(originUrl.protocol!=='https:'||originUrl.pathname!=='/'||originUrl.search||originUrl.hash||originUrl.username||originUrl.password)throw Error('Origen HTTPS inválido.');
 const resource=new URL('/mcp',originUrl).href,provider=createTrackingOAuthProvider({resource,consentUrl:new URL('/consent',originUrl).href,clientsFile});
 const app=express();app.disable('x-powered-by');app.set('trust proxy','loopback');app.use(express.json({limit:'64kb'}));
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use(mcpAuthRouter({provider,issuerUrl:originUrl,resourceServerUrl:new URL(resource),scopesSupported:['tracking:read','tracking:write'],resourceName:'Seguimiento privado newcrm'}));
 const authorize=async req=>{
  const header=req.headers.authorization;if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>4096)throw Object.assign(Error('Autorización requerida.'),{status:401});
  try{const access=await provider.verifyAccessToken(header.slice(7));return {id:'katy',name:'Katy · autorizado por '+access.extra.owner.name,scopes:access.scopes};}catch{throw Object.assign(Error('Autorización requerida.'),{status:401});}
 };
 app.get('/consent',(_req,res)=>res.set({'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}).type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Autorizar Katy</title><style>body{font:16px system-ui;max-width:540px;margin:60px auto;padding:20px}button{padding:12px;margin:8px 8px 0 0}#message{white-space:pre-wrap}</style><h1>Conectar Katy al seguimiento</h1><p>Permite consultar proyectos y actualizar próximos pasos y notas de Audiencia. No concede acceso a clientes ni reglas comerciales.</p><p id="message">Comprobando solicitud…</p><button id="approve" disabled>Autorizar conexión</button><a href="/">Cancelar</a><script src="/consent.js"></script></html>`));
 app.get('/consent.js',(_req,res)=>res.type('application/javascript').send(`const request=new URLSearchParams(location.search).get('request'),message=document.getElementById('message'),button=document.getElementById('approve');const headers=()=>({'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('vp_token')||'')});async function init(){try{const r=await fetch('/consent/request?request='+encodeURIComponent(request||''),{headers:headers()});const data=await r.json();if(!r.ok)throw Error(data.error);message.textContent='Permisos solicitados: '+data.scopes.map(s=>s==='tracking:read'?'consultar seguimiento':'actualizar seguimiento').join(', ');button.disabled=false;}catch(e){message.textContent=e.message||'Inicia sesión en el CRM y vuelve a abrir esta autorización.';}}button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/consent/approve',{method:'POST',headers:headers(),body:JSON.stringify({request})});const data=await r.json();if(!r.ok)throw Error(data.error);location.assign(data.redirect);}catch(e){message.textContent=e.message;button.disabled=false;}};init();`));
 const owner=async(req,res,next)=>{try{req.owner=await verifyOwner(req);if(!req.owner?.id||!req.owner?.name)throw Error('Sin propietario');next();}catch{res.status(401).json({error:'Inicia sesión como propietario en el CRM y vuelve a esta autorización.'});}};
 app.get('/consent/request',owner,async(req,res)=>{try{if(typeof req.query.request!=='string'||req.query.request.length>100)throw Error();res.json(await provider.inspectRequest(req.query.request));}catch{res.status(400).json({error:'Solicitud inválida o vencida. Reinicia la conexión en ChatGPT.'});}});
 app.post('/consent/approve',owner,async(req,res)=>{try{if(req.headers.origin&&req.headers.origin!==originUrl.origin)throw Error();if(typeof req.body?.request!=='string'||req.body.request.length>100||Object.keys(req.body).some(k=>k!=='request'))throw Error();res.json({redirect:await provider.approve(req.body.request,req.owner)});}catch{res.status(400).json({error:'Solicitud inválida o vencida. Reinicia la conexión en ChatGPT.'});}});
 app.use('/api/tracking/v1',createKatyTrackingRouter({store,authorize}));
 app.use('/mcp',createTrackingMcpRouter({authorize,resource,authorizationServer:originUrl.href,invoke:async({method,path,body,authorization,localPort})=>{
  if(!/^\/(projects|nodes)(\?|\/|$)/.test(path))throw Object.assign(Error('Operación no permitida.'),{status:400});
  const result=await fetch('http://127.0.0.1:'+localPort+'/api/tracking/v1'+path,{method,headers:{Authorization:authorization,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
  const data=await result.json();if(!result.ok)throw Object.assign(Error(data.error||'No se pudo completar el seguimiento.'),{status:result.status});return data;
 }}));
 app.get('/health',(_req,res)=>res.json({ok:true,service:'katy-tracking'}));
 return {app,provider};
}
