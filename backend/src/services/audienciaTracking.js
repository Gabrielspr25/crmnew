import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const DELIVERY_STATES = ['publicado_verificado', 'local_pendiente_publicacion', 'por_corregir', 'pendiente_desarrollo', 'sin_verificar'];
const inventory = JSON.parse(readFileSync(new URL('../../../docs/audiencia/inventario-seguimiento.json', import.meta.url), 'utf8'));
const fail = message => Object.assign(new Error(message), { status: 400 });
const text = (v, limit=10000) => typeof v === 'string' && v.length <= limit;
const nonempty = (v, limit=160) => text(v,limit) && Boolean(v.trim());
export function validReviewDate(v) { return text(v,10) && (!v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v)); }
export function trackingDefaults() { return structuredClone(inventory); }

export function validateTracking(t) {
  if (!t || t.version!==1 || !Array.isArray(t.nodes) || t.nodes.length>3000 || !Array.isArray(t.agents) || t.agents.length>100 || !Array.isArray(t.decisions) || t.decisions.length>1000 || !Array.isArray(t.history)) throw fail('Registro de seguimiento inválido.');
  const agents=new Set(t.agents.map(a=>a.id));
  if(agents.size!==t.agents.length || !t.agents.every(a=>nonempty(a.id,100)&&nonempty(a.name,100)&&text(a.role,300)&&text(a.project,160)&&text(a.evidence)&&text(a.access,2000))) throw fail('Responsables inválidos.');
  const nodes=new Map(t.nodes.map(n=>[n.id,n]));
  if(nodes.size!==t.nodes.length) throw fail('Identificadores de ramas duplicados.');
  for(const n of t.nodes) {
    if(!nonempty(n.id,100)||!nonempty(n.title,240)||!nonempty(n.project,160)||!text(n.parentId,100)||!['module','area','function','work','step'].includes(n.kind)||!DELIVERY_STATES.includes(n.status)||!['completo','incompleto'].includes(n.fulfillment)||!text(n.description)||!text(n.verification)||!text(n.assignee,100)||(n.assignee&&!agents.has(n.assignee))||!text(n.role,300)||!text(n.nextStep,3000)||!validReviewDate(n.deadline)||!validReviewDate(n.reviewedAt)||!['requirements','missing','corrections','improvements','steps'].every(k=>Array.isArray(n[k])&&n[k].length<=100&&n[k].every(x=>nonempty(x,3000)))||!Array.isArray(n.evidence)||n.evidence.length>100||!n.evidence.every(e=>['produccion','local','documentacion'].includes(e.environment)&&nonempty(e.source,2000)&&validReviewDate(e.date)&&Boolean(e.date)&&nonempty(e.result,5000))) throw fail('Una rama contiene campos, estados, fechas o responsables inválidos.');
    if(n.fulfillment==='completo' && (!n.requirements.length || n.missing.length || n.corrections.length || !n.evidence.length)) throw fail('Cumplimiento completo requiere requisitos y evidencia sin faltantes ni correcciones.');
    if(n.status==='publicado_verificado'&&!n.evidence.some(e=>e.environment==='produccion')) throw fail('Publicado y verificado requiere evidencia de producción.');
    if(n.workState !== undefined && !['pendiente','en_curso','completado','bloqueado'].includes(n.workState)) throw fail('Estado del trabajo inválido.');
    const parent=nodes.get(n.parentId);
    const allowed={module:['area','function'],area:['area','function'],function:['work'],work:['step'],step:['step']};
    if((!n.parentId && n.kind!=='module') || (parent && !allowed[parent.kind].includes(n.kind))) throw fail('El tipo de rama no corresponde a la jerarquía.');
    const seen=new Set([n.id]); let parentId=n.parentId;
    while(parentId) { const p=nodes.get(parentId); if(!p||p.project!==n.project||seen.has(parentId))throw fail('La jerarquía contiene ciclos o referencias inválidas.'); seen.add(parentId); parentId=p.parentId; }
  }
  if(new Set(t.decisions.map(d=>d.id)).size!==t.decisions.length||!t.decisions.every(d=>nonempty(d.id,100)&&nodes.has(d.nodeId)&&nonempty(d.text,5000)&&validReviewDate(d.at)&&Boolean(d.at)&&text(d.assignee,100)&&(!d.assignee||agents.has(d.assignee))))throw fail('Decisiones inválidas.');
  if(!t.history.every(e=>nonempty(e.id,100)&&nonempty(e.at,40)&&nonempty(e.entity,40)&&nonempty(e.entityId,100)&&e.actor&&text(e.actor.id,100)&&text(e.actor.name,200)))throw fail('Historial inválido.');
  return t;
}

export function auditTracking(current, incoming, actor={id:'',name:'Usuario autenticado'}, inventoryInitial=!current.tracking) {
  const previous=current.tracking || trackingDefaults();
  const next=structuredClone(incoming.tracking || previous);
  if(!isDeepStrictEqual(next.history,previous.history))throw fail('El historial de seguimiento solo puede actualizarlo el servidor.');
  validateTracking(next);
  const at=new Date().toISOString(), history=[...previous.history];
  const record=(entity,id,before,after)=>{ if(!isDeepStrictEqual(before,after))history.push({id:randomUUID(),at,actor:{id:String(actor.id||'').slice(0,100),name:String(actor.name||'Usuario autenticado').slice(0,200)},entity,entityId:id,before:before??null,after:after??null}); };
  for(const collection of ['nodes','agents','decisions']) {
    const before=new Map(previous[collection].map(v=>[v.id,v])), after=new Map(next[collection].map(v=>[v.id,v]));
    for(const id of new Set([...before.keys(),...after.keys()]))record(collection,id,before.get(id),after.get(id));
  }
  const previousProjects=new Map(current.projects.map(p=>[p.id,p])), nextProjects=new Map(incoming.projects.map(p=>[p.id,p]));
  for(const id of new Set([...previousProjects.keys(),...nextProjects.keys()]))record('projects',id,previousProjects.get(id),nextProjects.get(id));
  const beforeItems=new Map(current.items.map(i=>[i.id,i]));
  for(const i of incoming.items)record('items',i.id,beforeItems.get(i.id),i);
  for(const i of current.items)if(!incoming.items.some(v=>v.id===i.id))record('items',i.id,i,undefined);
  if(inventoryInitial) record('inventory','initial',null,{version:next.version,nodes:next.nodes.length});
  next.history=history;
  return validateTracking(next);
}
