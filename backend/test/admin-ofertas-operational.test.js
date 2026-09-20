import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
function fn(name) {
  const start = html.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, `Falta ${name}`);
  let code = '';
  for (const line of html.slice(start).split('\n')) {
    code += line + '\n';
    try { new vm.Script(`(${code})`); return code; } catch {}
  }
  throw new Error(name);
}
function context(names, extra = {}) {
  const ctx = vm.createContext({ Date, fcBaseGeneration: 0, ofTab: 'claro_tv', fcBaseTab: 'claro_tv', fcBaseFuente: null, OF_ALERTA_DIAS: 30, OF_TABS: [['claro_tv','Claro TV'],['lista_precios','Lista de Precios']], ...extra });
  vm.runInContext(names.map(fn).join('\n'), ctx);
  return ctx;
}
const evidence = { modules: [{ key: 'claro_tv', publication: {label:'Version 14 publicada', version:14, validity:'Sin verificar'}, pending:{label:'Fuente pendiente de analizar',source_id:'nuevo'}, documents:[{id:'publicado',name:'Base oficial.pdf',role:'Publicada'},{id:'nuevo',name:'Nuevo.pdf',role:'Pendiente'}], alerts:[], actions:[], verification:{status:'Sin verificar'} }] };

test('ausencia en propuesta no se presenta como baja autorizada', () => {
  const ctx=context(['esc','fcRenderBasePreviewBody'],{fcBasePreview:{previews:{claro_tv:{publicable:true,diferencias:{registros:{eliminados:[{registro:{codigo:'40942H',descripcion:'STB',precio:40}}]}}}}}});
  const markup=ctx.fcRenderBasePreviewBody();
  assert.match(markup,/Ausente en propuesta/);
  assert.match(markup,/no autoriza eliminar/i);
  assert.match(markup,/40942H/);
});

test('cola separa version publicada de nueva fuente y no inventa Al dia', () => {
  const ctx = context(['ofBuildCenterRows']);
  const rows = ctx.ofBuildCenterRows(evidence);
  assert.equal(rows[0].publication.version, 14);
  assert.equal(rows[0].pending.source_id, 'nuevo');
  assert.equal(rows[0].attention, true);
  assert.equal(rows[1].badge, 'Sin verificar');
  assert.doesNotMatch(rows.map(r => r.badge).join(' '), /Al d[ií]a|Falta fuente|Fuente sin publicar/);
});

test('Operacion no repite el resumen de evidencia encima del formulario', () => {
  assert.doesNotMatch(html, /id="ofOperationalState"/);
  assert.doesNotMatch(html, /function ofRenderOperationalState\(/);
  assert.doesNotMatch(fn('ofRenderCenterQueue'), /Publicado actualmente/);
});

test('fallo de reanalisis limpia comparacion y aprobacion previas sin tocar publicacion', async () => {
  const ctx = context(['fcGenerarBasePreview'], {
    $:()=>null, fcBaseModuleKey:'claro_tv',fcBaseCompanionIds:[],fcBaseFuente:{id:'nuevo'},
    fcBasePreview:{previews:{claro_tv:{publicable:true}}},fcBaseDrafts:{claro_tv:{estado:'aprobada'}},
    fcBaseFechaDetectada:()=> '2026-03-30',fcBasePreviewRequestBody:()=>({}),fcRenderBasePanel:()=>{},
    fcMensajeApi:e=>e.message,esc:s=>s,alert:()=>{},api:async()=>{throw new Error('PDF invalido');},
    ofCenterEvidence:evidence,
  });
  await ctx.fcGenerarBasePreview();
  assert.equal(ctx.fcBasePreview,null);
  assert.equal(Object.keys(ctx.fcBaseDrafts).length,0);
  assert.equal(ctx.ofCenterEvidence.modules[0].publication.version,14);
});

test('guardar usa comparacion revisada y no permite duplicar un borrador activo', async () => {
  let calls=0;
  const ctx=context(['fcGuardarBaseBorrador'], {fcBaseFuente:{id:'f'},fcBasePreview:{fecha_actualizacion_base:'2026-03-30'},fcBaseDrafts:{claro_tv:{id:'d',estado:'validada'}},fcBaseTab:'claro_tv',fcBaseBusy:false,fcBaseModuleKey:'claro_tv',fcRenderBasePanel:()=>{},fcLoadBaseHistorial:()=>{},api:async()=>{calls++;return {};},fcBasePreviewRequestBody:()=>({}),esc:s=>s,alert:()=>{}});
  await ctx.fcGuardarBaseBorrador();
  assert.equal(calls,0);
});

test('carga nunca solicita publicacion automatica y recibir no significa aprobar', () => {
  assert.match(fn('ofAnalizarCatalogoBase'), /fd.append\('publicacion_modo','borrador'\)/);
  assert.doesNotMatch(fn('ofRenderVigenciaAlertas'), /la alerta se limpia sola/);
  assert.doesNotMatch(fn('ofRenderProcessSteps'), /i<2/);
});

test('vigencia documental no se infiere del nombre ni se usa como fecha base', () => {
  const ctx=context(['ofCatalogoBaseFechaDetectada'],{$:()=>({value:''}),ovDetectarVigenciaHasta:()=> '2026-03-30'});
  assert.equal(ctx.ofCatalogoBaseFechaDetectada('fijo',{files:[{name:'planes-260330.pdf'}]}),'');
  assert.doesNotMatch(fn('ofAnalizarCatalogoBase'), /fcBasePreviewRequestBody\(fechaDetectada\)/);
});

test('historial no sustituye una comparacion nueva por un borrador viejo', async () => {
  let hydrated=0;
  const el={innerHTML:''};
  const ctx=context(['fcLoadBaseHistorial'],{$:()=>el,api:async()=>({publicaciones:[]}),fcHydrateBaseDraftsFromHistorial:()=>{hydrated++;},fcBaseModuleKey:'claro_tv',fcRenderBasePanel:()=>{},esc:s=>s,fcMensajeApi:e=>e.message});
  await ctx.fcLoadBaseHistorial();
  assert.equal(hydrated,0);
  assert.match(el.innerHTML,/Historial de bases informativas/);
});

test('un 409 al guardar no se anuncia como borrador guardado', async()=>{
  const ctx=context(['fcGuardarBaseBorrador'],{fcBaseFuente:{id:'f'},fcBasePreview:{fecha_actualizacion_base:'2026-03-30'},fcBaseDrafts:{},fcBaseTab:'claro_tv',fcBaseBusy:false,fcBaseModuleKey:'claro_tv',fcRenderBasePanel:()=>{},fcLoadBaseHistorial:()=>{},api:async()=>({ok:false,codigo:'comparacion_desactualizada'}),fcBasePreviewRequestBody:()=>({}),fcMensajeApi:e=>e.message,esc:s=>s,alert:()=>{}});
  await ctx.fcGuardarBaseBorrador();
  assert.match(ctx.fcBaseMessage,/No se pudo guardar/);
  assert.doesNotMatch(ctx.fcBaseMessage,/Borrador guardado/);
});

test('Ofertas no llama analisis a leer solo nombres de archivos',()=>{
  const el={innerHTML:''};
  const ctx=context(['ovAnalizar'],{$:()=>el,ovFiles:()=>[{name:'Ofertas.xlsx'},{name:'Terminos.pdf'}],ovDetectarVigenciaHasta:()=> '2026-09-17',esc:s=>s});
  ctx.ovAnalizar('ofertas_moviles');
  assert.match(el.innerHTML,/Sin analizar/);
  assert.match(el.innerHTML,/no.*archivad/i);
  assert.doesNotMatch(el.innerHTML,/recibidos|leidos|Analisis parcial/);
});

test('guardar envia la huella de la comparacion revisada',()=>{
  const ctx=context(['fcBasePreviewRequestBody'],{fcBaseModuleKey:'claro_tv',fcBasePreview:{preview_fingerprint:'a'.repeat(64)}});
  assert.equal(ctx.fcBasePreviewRequestBody('2026-03-30').preview_fingerprint,'a'.repeat(64));
});

test('API conserva codigo de error de comparacion para no culpar al documento nuevo',async()=>{
  const ctx=context(['api'],{API:'',token:'test',fetch:async()=>({status:422,ok:false,json:async()=>({codigo:'snapshot_publicado_no_comparable'})})});
  await assert.rejects(ctx.api('/api/fuentes-comerciales/f/preview-base'),/snapshot_publicado_no_comparable/);
});
