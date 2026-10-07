import {Router} from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {attachmentError,validateAttachment,MAX_ATTACHMENTS,MAX_ATTACHMENT_BYTES} from '../services/asanaAttachmentFiles.js';
const defaultRoot=fileURLToPath(new URL('../../uploads/asana-notes/',import.meta.url));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const metadata='a.id,a.note_id,a.filename,a.mime_type,a.size_bytes,a.created_at,a.created_by_username';
const admin=user=>['admin','supervisor','administrador','administrator','super admin','super_admin','superadmin'].includes(String(user?.rol||'').trim().toLowerCase());
export async function authorizeAsanaAttachments(db,id,user,{lock=false,active=false}={}){
 if(!uuid.test(String(id)))throw attachmentError('Seguimiento inválido.',400);
 const r=await db.query(`SELECT o.id,o.archived_at,sp.name AS vendor FROM public.sales_opportunities o LEFT JOIN public.salespeople sp ON sp.id=o.salesperson_id WHERE o.id=$1 ${lock?'FOR UPDATE OF o':''}`,[id]);
 const o=r.rows[0];if(!o||(active&&o.archived_at))throw attachmentError('Seguimiento activo no encontrado.',404);
 const name=String(user?.nombre||user?.nick||'').trim().toLowerCase();
 if(!admin(user)&&(!name||name!==String(o.vendor||'').trim().toLowerCase()))throw attachmentError('No puedes acceder a los adjuntos de otro vendedor.',403);
 return o;
}
export async function listAsanaAttachments(db,id,user,{hideForbidden=false}={}){
 try{await authorizeAsanaAttachments(db,id,user);}catch(e){if(hideForbidden&&e.status===403)return [];throw e;}
 return (await db.query(`SELECT ${metadata} FROM public.opportunity_note_attachments a JOIN public.opportunity_notes n ON n.id=a.note_id AND n.opportunity_id=a.opportunity_id WHERE a.opportunity_id=$1 AND n.deleted_at IS NULL ORDER BY a.created_at,a.id`,[id])).rows;
}
export function createAsanaAttachmentsRouter({pool,requireAuth,uploadDir=process.env.ASANA_ATTACHMENTS_DIR||defaultRoot}){
 const router=Router(),root=path.resolve(uploadDir);
 const upload=multer({storage:multer.memoryStorage(),limits:{files:MAX_ATTACHMENTS,fileSize:MAX_ATTACHMENT_BYTES,fields:1,fieldSize:16000,parts:MAX_ATTACHMENTS+2}}).array('files',MAX_ATTACHMENTS);
 const scoped=async(req,res,next)=>{try{await authorizeAsanaAttachments(pool,req.params.id,req.user,{active:req.method!=='GET'});next();}catch(e){next(e);}};
 router.post('/asana-real/:id/notes-with-attachments',requireAuth,scoped,upload,async(req,res,next)=>{
  let db,committed=false;const written=[];
  try{
   const files=req.files||[];if(!files.length)throw attachmentError('Selecciona al menos un archivo.',400);
   const validated=files.map(validateAttachment),body=String(req.body?.body||'').trim();
   if(body.length>8000)throw attachmentError('La nota admite hasta 8000 caracteres.');
   const username=String(req.user?.nombre||req.user?.nick||'Sistema').trim();
   db=await pool.connect();await db.query('BEGIN');
   await authorizeAsanaAttachments(db,req.params.id,req.user,{lock:true,active:true});
   const noteId=randomUUID(),text=body||'Archivos adjuntos';
   await db.query(`INSERT INTO public.opportunity_notes(id,opportunity_id,note,created_by_username,created_at) VALUES($1,$2,$3,$4,now())`,[noteId,req.params.id,'[NOTA] '+text,username]);
   await fs.mkdir(root,{recursive:true,mode:0o700});
   const attachments=[];
   for(let i=0;i<files.length;i++){
    const a=validated[i],id=randomUUID(),key=id+a.ext,target=path.join(root,key);
    written.push(target);await fs.writeFile(target,files[i].buffer,{flag:'wx',mode:0o600});
    const r=await db.query(`INSERT INTO public.opportunity_note_attachments(id,note_id,opportunity_id,filename,storage_key,mime_type,size_bytes,created_by_username) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,note_id,filename,mime_type,size_bytes,created_at,created_by_username`,[id,noteId,req.params.id,a.filename,key,a.mime,a.size,username]);
    attachments.push(r.rows[0]);
   }
   await db.query('UPDATE public.sales_opportunities SET updated_at=now() WHERE id=$1',[req.params.id]);
   await db.query('COMMIT');committed=true;
   res.status(201).json({id:noteId,opportunity_id:req.params.id,type:'nota',body:text,user_name:username,attachments});
  }catch(e){
   if(db&&!committed)await db.query('ROLLBACK').catch(()=>{});
   if(!committed)await Promise.all(written.map(p=>fs.unlink(p).catch(()=>{})));
   next(e);
  }finally{db?.release();}
 });
 router.delete('/asana-real/:id/log/:noteId',requireAuth,scoped,async(req,res,next)=>{
  let db;
  try{
   if(!uuid.test(req.params.noteId))throw attachmentError('Nota inválida.',400);
   db=await pool.connect();await db.query('BEGIN');await authorizeAsanaAttachments(db,req.params.id,req.user,{lock:true,active:true});
   const r=await db.query('UPDATE public.opportunity_notes SET deleted_at=now() WHERE id=$1 AND opportunity_id=$2 AND deleted_at IS NULL RETURNING id',[req.params.noteId,req.params.id]);
   if(!r.rows.length)throw attachmentError('Nota no encontrada.',404);
   await db.query('COMMIT');res.json({ok:true});
  }catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});next(e);}finally{db?.release();}
 });
 router.get('/asana-real/:id/log/:noteId/attachments',requireAuth,scoped,async(req,res,next)=>{
  try{
   if(!uuid.test(req.params.noteId))throw attachmentError('Nota inválida.',400);
   const note=await pool.query('SELECT id FROM public.opportunity_notes WHERE id=$1 AND opportunity_id=$2 AND deleted_at IS NULL',[req.params.noteId,req.params.id]);
   if(!note.rows.length)throw attachmentError('Nota no encontrada.',404);
   const rows=await listAsanaAttachments(pool,req.params.id,req.user);
   res.json(rows.filter(r=>r.note_id===req.params.noteId));
  }catch(e){next(e);}
 });
 router.get('/asana-real/:id/log/:noteId/attachments/:attachmentId',requireAuth,scoped,async(req,res,next)=>{
  try{
   if(!uuid.test(req.params.noteId)||!uuid.test(req.params.attachmentId))throw attachmentError('Adjunto inválido.',400);
   const r=await pool.query(`SELECT a.* FROM public.opportunity_note_attachments a JOIN public.opportunity_notes n ON n.id=a.note_id AND n.opportunity_id=a.opportunity_id WHERE a.id=$1 AND a.note_id=$2 AND a.opportunity_id=$3 AND n.deleted_at IS NULL`,[req.params.attachmentId,req.params.noteId,req.params.id]);
   const a=r.rows[0];if(!a)throw attachmentError('Adjunto no encontrado.',404);
   if(!/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|pdf|doc|docx|xls|xlsx)$/i.test(a.storage_key))throw attachmentError('Adjunto no disponible.',404);
   const target=path.join(root,a.storage_key);await fs.access(target);
   res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"});
   res.type(a.mime_type);
   if(req.query.download==='1'||!a.mime_type.startsWith('image/')&&a.mime_type!=='application/pdf')res.download(target,a.filename,e=>{if(e&&!res.headersSent)next(e);});
   else res.sendFile(target,e=>{if(e&&!res.headersSent)next(e);});
  }catch(e){if(e.code==='ENOENT')next(attachmentError('El archivo no está disponible.',404));else next(e);}
 });
 router.use((e,_req,res,_next)=>{
  const status=e instanceof multer.MulterError?413:e.status||500;
  if(status===500)console.error('[asana-adjuntos]',e.code||e.name);
  res.status(status).json({error:e instanceof multer.MulterError?'Puedes adjuntar hasta 5 archivos de 10 MB cada uno.':status===500?'No se pudieron guardar o abrir los adjuntos.':e.message});
 });
 return router;
}
