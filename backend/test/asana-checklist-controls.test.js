import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../frontend/app.html',import.meta.url),'utf8');
function context(extra={}){
 const ctx={esc:String,fmtPhone:String,cliEquipmentLabel:v=>v||'',asanaChecklistControls:{},...extra};
 vm.runInNewContext(source.slice(source.indexOf('function asanaNotesNewestFirst'),source.indexOf('async function viewAsana')),ctx);return ctx;
}
test('modal único incluye prioridad vigente y calendario operativo sin perder líneas ni notas',()=>{
 const ctx=context();const html=ctx.asanaChecklistHtml({id:'opp',client_name:'Ejemplo',lines:[{phone:'7870000001',state:'pendiente'}],notes:[{body:'Nota real',created_at:'2026-10-08'}]},{priority:'alta',scheduled_call_at:'2026-10-15T13:00:00Z'});
 assert.match(html,/id="asanaChecklistPriority"/);assert.match(html,/value="alta" selected/);
 assert.match(html,/id="asanaChecklistDate"[^>]*type="date"/);assert.match(html,/id="asanaChecklistTime"[^>]*type="time"/);
 assert.match(html,/asanaChecklistSchedule/);assert.match(html,/Llamada agendada/);assert.match(html,/7870000001/);assert.match(html,/Nota real/);
 assert.doesNotMatch(html,/agendarLlamadaDesdeCliente|openForm/);
});
test('agenda dentro del modal reutiliza guardado, conserva ventana y muestra fecha confirmada',async()=>{
 const elements={asanaChecklistDate:{value:'2026-10-20'},asanaChecklistTime:{value:'11:00'},asanaChecklistReason:{value:'Llamar cliente'},asanaChecklistScheduleStatus:{textContent:''},asanaChecklistScheduled:{textContent:''}};
 const calls=[];const ctx=context({$:id=>elements[id],guardarLlamadaAsana:async(id,values)=>{calls.push({id,values});return '2026-10-20T15:00:00Z';},router:async()=>calls.push('refresh')});
 const button={dataset:{opportunityId:'opp'},disabled:false,isConnected:true};await ctx.asanaChecklistSchedule(button);
 assert.equal(calls[0].id,'opp');assert.equal(calls[0].values.date,'2026-10-20');assert.equal(calls[0].values.time,'11:00');assert.match(elements.asanaChecklistScheduled.textContent,/20/);assert.equal(button.disabled,false);
});
test('prioridad dentro del modal reutiliza operación existente y acepta Automática',async()=>{
 const calls=[],status={textContent:''};const ctx=context({$:()=>status,cambiarPrioridadAsana:async(id,value)=>{calls.push([id,value]);return true;}});
 const control={dataset:{opportunityId:'opp'},value:'',disabled:false};await ctx.asanaChecklistPriority(control);
 assert.deepEqual(calls,[['opp','']]);assert.match(status.textContent,/guardada/i);assert.equal(control.disabled,false);
});

test('guardado compartido rechaza fecha vacía o pasada y mantiene la misma operación de agenda',async()=>{
 const writes=[],ctx={api:async(url,options)=>writes.push({url,options})};
 vm.runInNewContext(source.slice(source.indexOf('async function guardarLlamadaAsana'),source.indexOf('function agendarLlamadaDesdeCliente')),ctx);
 await assert.rejects(()=>ctx.guardarLlamadaAsana('opp',{date:''}),/Selecciona la fecha/);
 await assert.rejects(()=>ctx.guardarLlamadaAsana('opp',{date:'2000-01-01',time:'09:00'}),/futura/);assert.equal(writes.length,0);
 const saved=await ctx.guardarLlamadaAsana('opp',{date:'2099-10-20',time:'11:30',body:'  Motivo real  '});
 assert.equal(writes.length,1);assert.equal(writes[0].url,'/api/asana-real/opp/log');assert.equal(writes[0].options.body.type,'llamada');assert.equal(writes[0].options.body.body,'Motivo real');assert.equal(writes[0].options.body.scheduled_call_at,saved);
});

test('Nueva nota muestra el campo existente y le da foco dentro de la misma ventana',()=>{
 let focused=false,scrolled=false;const editor={hidden:true,scrollIntoView:()=>scrolled=true},field={focus:()=>focused=true};
 const ctx=context({$:id=>id==='asanaChecklistNoteEditor'?editor:field,setAsanaGestionType:type=>assert.equal(type,'nota')});
 const html=ctx.asanaChecklistHtml({id:'opp',notes:[],lines:[]});assert.match(html,/\+ Nueva nota/);assert.match(html,/id="asanaLogBody"/);assert.match(html,/submitAsanaChecklistNote/);
 ctx.asanaChecklistNote();assert.equal(editor.hidden,false);assert.equal(focused,true);assert.equal(scrolled,true);
});

test('fallo al agendar conserva formulario y muestra el error sin abrir otra ventana',async()=>{
 const status={textContent:''},field={value:'2026-10-20'},button={dataset:{opportunityId:'opp'},isConnected:true};
 const ctx=context({$:id=>id==='asanaChecklistScheduleStatus'?status:field,guardarLlamadaAsana:async()=>{throw Error('No se pudo guardar');}});
 await ctx.asanaChecklistSchedule(button);assert.equal(status.textContent,'No se pudo guardar');assert.equal(button.disabled,false);assert.equal(field.value,'2026-10-20');
});

test('guardar nota usa el flujo existente y actualiza notas manteniendo borrador de llamada',async()=>{
 const calls=[],modal={innerHTML:''},elements={asanaLogBody:{value:'Nota de prueba'},asanaChecklistDate:{value:'2026-10-20'},asanaChecklistTime:{value:'11:00'},asanaChecklistReason:{value:'Motivo'},asanaChecklistNoteEditor:{hidden:false},asanaChecklistModal:modal};
 const ctx=context({$:id=>elements[id],asanaAttachmentFiles:[],addAsanaLog:async(...args)=>calls.push(args),api:async()=>({id:'opp',lines:[],notes:[{body:'Nota de prueba',created_at:'2026-10-08'}]}),router:async()=>{}});
 await ctx.submitAsanaChecklistNote({dataset:{opportunityId:'opp'},disabled:false,isConnected:true});
 assert.deepEqual(calls,[['opp','nota',false]]);assert.match(modal.innerHTML,/Nota de prueba/);assert.match(modal.innerHTML,/value="2026-10-20"/);assert.equal(elements.asanaLogBody.value,'Nota de prueba');
});

 test('refrescar la lista conserva e hidrata adjuntos mientras el modal siga abierto',()=>{
 const start=source.indexOf("if(route==='opp')");
 const revised=source.indexOf("if(route==='opp'||");
 const offset=revised>=0?revised:start;
 const end=source.indexOf('clearAsanaAttachmentFiles();',offset)+'clearAsanaAttachmentFiles();'.length;
 const block=source.slice(offset,end);let modal=true,hydrated=0,files=['imagen.png'];
 const ctx={route:'asana',asanaGestionType:'nota',$:()=>modal?{}:null,setAsanaGestionType:()=>{},hydrateAsanaAttachments:()=>hydrated++,clearAsanaAttachmentFiles:()=>files=[]};
 vm.runInNewContext(block,ctx);assert.equal(files.length,1);assert.equal(hydrated,1);
 modal=false;vm.runInNewContext(block,ctx);assert.equal(files.length,0);
 });
