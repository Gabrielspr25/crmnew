// Adjuntos privados de notas; la sesión viaja siempre en la cabecera.
let asanaAttachmentFiles=[],asanaAttachmentBusy=false;
let asanaAttachmentOpportunityId=null;
let asanaAttachmentObserver=null;
const asanaAttachmentPreviewUrls=new Set();
function asanaAttachmentComposer(){
 return `<div id="asanaAttachmentComposer" class="asana-attachment-composer" style="display:none"><div class="asana-attachment-tools"><button type="button" class="btn ghost" onclick="document.getElementById('asanaAttachmentInput').click()">📎 Adjuntar</button><span class="s">Hasta 5 archivos · 10 MB cada uno · Puedes pegar capturas</span></div><input id="asanaAttachmentInput" type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onchange="selectAsanaAttachments(this.files);this.value=''" aria-label="Adjuntar imágenes y documentos"><div id="asanaAttachmentPending" class="asana-attachment-pending"></div><div id="asanaAttachmentError" class="asana-attachment-error" role="alert"></div></div>`;
}
function prepareAsanaAttachmentComposer(oid){
 if(asanaAttachmentOpportunityId!==oid){clearAsanaAttachmentFiles();asanaAttachmentOpportunityId=oid;}
}
function asanaAttachmentError(message){const el=document.getElementById('asanaAttachmentError');if(el)el.textContent=message;}
function selectAsanaAttachments(files){
 if(asanaAttachmentBusy)return;
 const incoming=Array.from(files||[]),allowed=/\.(jpe?g|png|webp|pdf|docx?|xlsx?)$/i;
 if(asanaAttachmentFiles.length+incoming.length>5){asanaAttachmentError('Puedes adjuntar hasta 5 archivos por nota.');return;}
 if(incoming.some(f=>f.size>10*1024*1024)){asanaAttachmentError('Cada archivo puede tener como máximo 10 MB.');return;}
 if(incoming.some(f=>!allowed.test(f.name)||f.size===0)){asanaAttachmentError('Selecciona imágenes JPG, PNG, WebP, PDF, Word o Excel con contenido.');return;}
 for(const file of incoming)asanaAttachmentFiles.push({file,url:/\.(png|jpe?g|webp)$/i.test(file.name)?URL.createObjectURL(file):null});
 renderAsanaAttachmentPending();asanaAttachmentError('');
}
function pasteAsanaAttachments(event){
 const files=Array.from(event.clipboardData?.items||[]).filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
 if(files.length){event.preventDefault();setAsanaGestionType('nota');selectAsanaAttachments(files);}
}
function renderAsanaAttachmentPending(){
 const el=document.getElementById('asanaAttachmentPending');if(!el)return;
 el.innerHTML=asanaAttachmentFiles.map((a,i)=>`<div class="asana-attachment-chip">${a.url?`<img src="${a.url}" alt="Vista previa">`:'<span aria-hidden="true">📄</span>'}<span class="asana-attachment-name">${esc(a.file.name)}<small>${(a.file.size/1024).toFixed(1)} KB</small></span><button type="button" class="btn ghost" aria-label="Quitar ${esc(a.file.name)}" onclick="removeAsanaAttachment(${i})">✕</button></div>`).join('');
}
function removeAsanaAttachment(index){
 if(asanaAttachmentBusy)return;
 const removed=asanaAttachmentFiles.splice(index,1)[0];if(removed?.url)URL.revokeObjectURL(removed.url);
 renderAsanaAttachmentPending();asanaAttachmentError('');
}
function clearAsanaAttachmentFiles(){
 for(const a of asanaAttachmentFiles)if(a.url)URL.revokeObjectURL(a.url);
 asanaAttachmentFiles=[];
}
async function asanaAttachmentFetch(url,options={}){
 const response=await fetch(API+url,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+token}});
 if(response.status===401){clearSession();showLogin('Tu sesión venció, vuelve a entrar');throw Error('Sesión vencida.');}
 if(!response.ok){let message='No se pudo completar la operación.';try{message=(await response.json()).error||message;}catch{}throw Error(message);}
 return response;
}
async function saveAsanaNoteWithAttachments(oid){
 if(asanaAttachmentBusy)return;
 asanaAttachmentBusy=true;const button=document.getElementById('asanaGestionSubmit'),previous=button?.textContent;
 if(button){button.disabled=true;button.textContent='Subiendo…';}asanaAttachmentError('');
 try{
  const form=new FormData();form.append('body',document.getElementById('asanaLogBody')?.value.trim()||'');
  for(const a of asanaAttachmentFiles)form.append('files',a.file,a.file.name);
  const response=await asanaAttachmentFetch('/api/asana-real/'+oid+'/notes-with-attachments',{method:'POST',body:form});
  await response.json();
  clearAsanaAttachmentFiles();asanaLogTab='nota';asanaAttachmentBusy=false;await router();
 }catch(e){asanaAttachmentError(e.message);}
 finally{asanaAttachmentBusy=false;if(button?.isConnected){button.disabled=false;button.textContent=previous;}}
}
function asanaNoteAttachmentsHtml(oid,note){
 return (note.attachments||[]).length?'<div class="asana-note-attachments">'+note.attachments.map(a=>{
  const url='/api/asana-real/'+oid+'/log/'+note.id+'/attachments/'+a.id;
  const image=String(a.mime_type||'').startsWith('image/');
  return `<div class="asana-note-attachment">${image?`<button type="button" class="asana-attachment-thumb" onclick="openAsanaAttachment(this)" data-url="${url}" data-name="${esc(a.filename)}" data-mime="${esc(a.mime_type)}"><img data-asana-image="${url}" alt="${esc(a.filename)}"></button>`:'<span aria-hidden="true">📄</span>'}<div class="asana-attachment-name">${esc(a.filename)}<small>${(a.size_bytes/1024).toFixed(1)} KB</small><div class="asana-attachment-actions"><button type="button" class="linkbtn" data-url="${url}" data-name="${esc(a.filename)}" data-mime="${esc(a.mime_type)}" onclick="openAsanaAttachment(this)">Abrir</button><button type="button" class="linkbtn" data-url="${url}" data-name="${esc(a.filename)}" onclick="downloadAsanaAttachment(this)">Descargar</button></div></div></div>`;
 }).join('')+'</div>':'';
}
async function loadAsanaAttachmentPreview(img){
 try{
  const response=await asanaAttachmentFetch(img.dataset.asanaImage),blob=await response.blob();
  if(!img.isConnected)return;
  const url=URL.createObjectURL(blob);asanaAttachmentPreviewUrls.add(url);img.src=url;
 }catch{if(img.isConnected)img.alt='Vista previa no disponible';}
}
function releaseAsanaAttachmentPreviews(){
 asanaAttachmentObserver?.disconnect();asanaAttachmentObserver=null;
 for(const url of asanaAttachmentPreviewUrls)URL.revokeObjectURL(url);asanaAttachmentPreviewUrls.clear();
}
function hydrateAsanaAttachments(){
 const images=document.querySelectorAll('[data-asana-image]');
 if('IntersectionObserver' in window){
  asanaAttachmentObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){asanaAttachmentObserver.unobserve(e.target);loadAsanaAttachmentPreview(e.target);}},{rootMargin:'100px'});
  images.forEach(img=>asanaAttachmentObserver.observe(img));
 }else images.forEach(loadAsanaAttachmentPreview);
 renderAsanaAttachmentPending();
 const box=document.getElementById('asanaAttachmentComposer');if(box)box.style.display=asanaGestionType==='nota'?'block':'none';
}
async function downloadAsanaAttachment(button){
 if(button.disabled)return;button.disabled=true;
 try{
  const response=await asanaAttachmentFetch(button.dataset.url+'?download=1'),blob=await response.blob(),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=button.dataset.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){alert(e.message);}finally{button.disabled=false;}
}
async function openAsanaAttachment(button){
 const mime=button.dataset.mime||'';
 if(!mime.startsWith('image/')&&mime!=='application/pdf'){return downloadAsanaAttachment(button);}
 if(button.disabled)return;button.disabled=true;
 try{
  const response=await asanaAttachmentFetch(button.dataset.url),url=URL.createObjectURL(await response.blob());
  const bg=document.createElement('div');bg.className='asana-attachment-viewer';bg.setAttribute('role','dialog');bg.setAttribute('aria-label',button.dataset.name);
  bg.innerHTML=`<div class="asana-attachment-dialog"><div class="asana-attachment-viewer-head"><strong>${esc(button.dataset.name)}</strong><button type="button" class="btn ghost" aria-label="Cerrar vista previa">✕</button></div>${mime.startsWith('image/')?`<img src="${url}" alt="${esc(button.dataset.name)}">`:`<iframe src="${url}" title="${esc(button.dataset.name)}"></iframe>`}</div>`;
  const close=()=>{bg.remove();URL.revokeObjectURL(url);document.removeEventListener('keydown',key);button.focus();};
  const key=e=>{if(e.key==='Escape')close();};
  bg.querySelector('button').onclick=close;bg.onclick=e=>{if(e.target===bg)close();};document.addEventListener('keydown',key);document.body.append(bg);bg.querySelector('button').focus();
 }catch(e){alert(e.message);}finally{button.disabled=false;}
}
