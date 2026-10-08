import express from 'express';
import {randomUUID} from 'node:crypto';
import {readBusinessRules} from '../services/businessRules.js';

const READ='tracking:read',WRITE='tracking:write';
const EDITABLE=new Set(['description','status','fulfillment','verification','assignee','role','nextStep','deadline','reviewedAt','requirements','missing','corrections','improvements','steps','evidence','workState']);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function revision(value){if(!Number.isInteger(value)||value<0)throw fail(400,'Incluye la revisión vigente del registro.');return value;}
function bodyKeys(body,allowed){if(!object(body)||Object.keys(body).some(key=>!allowed.includes(key)))throw fail(400,'La petición contiene campos no permitidos.');}
function nodeById(data,id){const node=data.tracking.nodes.find(n=>n.id===id);if(!node)throw fail(404,'Rama de seguimiento no encontrada.');return node;}

// El autorizador debe verificar credenciales de integración en cada petición y
// devolver identidad y scopes del servidor. No se fabrica una sesión CRM.
export function createKatyTrackingRouter({store,authorize}){
 if(!store||typeof store.read!=='function'||typeof store.write!=='function'||typeof authorize!=='function')throw Error('Se requieren almacenamiento y autorización de integración.');
 const router=express.Router();
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  try{
   const identity=await authorize(req);
   if(!identity||typeof identity.id!=='string'||!identity.id.trim()||identity.id.length>100||typeof identity.name!=='string'||!identity.name.trim()||identity.name.length>200||!Array.isArray(identity.scopes))throw fail(401,'Sesión de integración requerida.');
   req.trackingIdentity={id:identity.id,name:identity.name,scopes:identity.scopes};next();
  }catch(error){next(error);}
 });
 const handle=(scope,fn)=>async(req,res,next)=>{try{if(!req.trackingIdentity.scopes.includes(scope))throw fail(403,'El acceso de integración no permite esta operación.');await fn(req,res);}catch(error){next(error);}};
 router.get('/projects',handle(READ,async(_req,res)=>{const data=await store.read();res.json({revision:data.revision,projects:data.projects,business_rules:readBusinessRules()});}));
 router.get('/nodes',handle(READ,async(req,res)=>{
  if(Object.keys(req.query).some(k=>k!=='project')||(req.query.project!==undefined&&(typeof req.query.project!=='string'||req.query.project.length>160)))throw fail(400,'Filtro de proyecto inválido.');
  const data=await store.read();res.json({revision:data.revision,nodes:data.tracking.nodes.filter(n=>!req.query.project||n.project===req.query.project)});
 }));
 router.get('/nodes/:id',handle(READ,async(req,res)=>{const data=await store.read();res.json({revision:data.revision,node:nodeById(data,req.params.id),notes:data.tracking.decisions.filter(note=>note.nodeId===req.params.id),business_rules:readBusinessRules()});}));
 router.patch('/nodes/:id',handle(WRITE,async(req,res)=>{
  bodyKeys(req.body,['revision','changes']);const expected=revision(req.body.revision),changes=req.body.changes;
  if(!object(changes)||!Object.keys(changes).length||Object.keys(changes).some(k=>!EDITABLE.has(k)))throw fail(400,'Los campos de la rama no están permitidos.');
  const current=await store.read();if(current.revision!==expected)throw fail(409,'El registro cambió. Lee la revisión vigente antes de guardar.');
  const incoming=structuredClone(current),node=nodeById(incoming,req.params.id);Object.assign(node,changes);
  const saved=await store.write(incoming,expected,{id:req.trackingIdentity.id,name:req.trackingIdentity.name});
  res.json({revision:saved.revision,node:nodeById(saved,req.params.id)});
 }));
 router.post('/nodes/:id/notes',handle(WRITE,async(req,res)=>{
  bodyKeys(req.body,['revision','text']);const expected=revision(req.body.revision),text=req.body.text;
  if(typeof text!=='string'||!text.trim()||text.length>5000)throw fail(400,'La nota debe contener texto de hasta 5.000 caracteres.');
  const current=await store.read();if(current.revision!==expected)throw fail(409,'El registro cambió. Lee la revisión vigente antes de guardar.');
  nodeById(current,req.params.id);const incoming=structuredClone(current);
  const note={id:randomUUID(),nodeId:req.params.id,text:text.trim(),at:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),assignee:''};
  incoming.tracking.decisions.push(note);
  const saved=await store.write(incoming,expected,{id:req.trackingIdentity.id,name:req.trackingIdentity.name});res.status(201).json({revision:saved.revision,note});
 }));
 router.use((error,_req,res,_next)=>{const status=[400,401,403,404,409].includes(error?.status)?error.status:500;res.status(status).json({error:status===500?'No se pudo completar la operación de seguimiento.':error.message});});
 return router;
}
