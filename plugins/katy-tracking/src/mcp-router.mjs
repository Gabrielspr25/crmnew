import express from 'express';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';

const id=z.string().min(1).max(100),revision=z.number().int().nonnegative();
const changes=z.object({description:z.string().max(10000).optional(),nextStep:z.string().max(3000).optional(),deadline:z.string().max(10).optional(),workState:z.enum(['pendiente','en_curso','completado','bloqueado']).optional()}).strict().refine(v=>Object.keys(v).length>0,'Incluye un campo de seguimiento.');
const denied=()=>({isError:true,content:[{type:'text',text:'El acceso de integración no permite esta operación.'}]});

// invoke recibe identidad verificada y la operación. Debe llamar a la API
// de seguimiento, que vuelve a comprobar permisos y revisión antes de guardar.
export function createTrackingMcpRouter({authorize,invoke,resource,authorizationServer}){
 if(typeof authorize!=='function'||typeof invoke!=='function')throw Error('Falta autorización o adaptador de API.');
 const router=express.Router();
 let metadataUrl;
 if(resource||authorizationServer){
  const resourceUrl=new URL(resource),issuerUrl=new URL(authorizationServer);
  if(resourceUrl.protocol!=='https:'||issuerUrl.protocol!=='https:'||resourceUrl.username||resourceUrl.password||issuerUrl.username||issuerUrl.password||resourceUrl.search||resourceUrl.hash||issuerUrl.search||issuerUrl.hash)throw Error('La configuración OAuth requiere direcciones HTTPS confiables.');
  const metadataPath='/.well-known/oauth-protected-resource'+(resourceUrl.pathname==='/'?'':resourceUrl.pathname);
  metadataUrl=new URL(metadataPath,resourceUrl).href;
  router.get(metadataPath,(_req,res)=>res.set('Cache-Control','no-store').json({resource,authorization_servers:[authorizationServer],scopes_supported:['tracking:read','tracking:write']}));
 }
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  try{const identity=await authorize(req);if(!identity?.id||!Array.isArray(identity.scopes))throw Error('Sin identidad');req.trackingIdentity=identity;next();}
  catch{if(metadataUrl)res.set('WWW-Authenticate',`Bearer resource_metadata="${metadataUrl}", scope="tracking:read tracking:write"`);res.status(401).json({error:'La conexión requiere autorización de seguimiento.'});}
 });
 router.post('/',async(req,res)=>{
  const identity=req.trackingIdentity,server=new McpServer({name:'newcrm-katy-tracking',version:'0.1.0'}),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  const tool=(name,title,scope,inputSchema,operation)=>{
   const read=scope==='tracking:read';
   server.registerTool(name,{title,description:title,inputSchema,annotations:{readOnlyHint:read,destructiveHint:false,idempotentHint:read,openWorldHint:false},_meta:{securitySchemes:[{type:'oauth2',scopes:[scope]}]}},async args=>{
    if(!identity.scopes.includes(scope))return denied();
    try{const data=await invoke({...operation(args),identity,authorization:req.headers.authorization,localPort:req.socket.localPort});return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};}
    catch(error){return {isError:true,content:[{type:'text',text:[400,403,404,409].includes(error?.status)?error.message:'No se pudo completar la operación de seguimiento.'}]};}
   });
  };
  tool('tracking_list_projects','Consultar proyectos de seguimiento','tracking:read',{},()=>({method:'GET',path:'/projects'}));
  tool('tracking_list_nodes','Consultar ramas de seguimiento','tracking:read',{project:z.string().max(160).optional()},args=>({method:'GET',path:'/nodes'+(args.project?'?project='+encodeURIComponent(args.project):'')}));
  tool('tracking_get_node','Consultar una rama, sus notas guardadas y su revisión','tracking:read',{id},args=>({method:'GET',path:'/nodes/'+encodeURIComponent(args.id)}));
  tool('tracking_update_node','Actualizar el próximo paso de una rama','tracking:write',{id,revision,changes},args=>({method:'PATCH',path:'/nodes/'+encodeURIComponent(args.id),body:{revision:args.revision,changes:args.changes}}));
  tool('tracking_add_note','Registrar una nota del seguimiento','tracking:write',{id,revision,text:z.string().min(1).max(5000)},args=>({method:'POST',path:'/nodes/'+encodeURIComponent(args.id)+'/notes',body:{revision:args.revision,text:args.text}}));
  res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{});});
  try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}catch{if(!res.headersSent)res.status(500).json({error:'No se pudo atender la conexión de seguimiento.'});}
 });
 router.all('/',(_req,res)=>{res.set('Allow','POST');res.status(405).json({error:'Usa el transporte MCP por POST.'});});
 return router;
}
