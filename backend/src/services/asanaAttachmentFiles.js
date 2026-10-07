import path from 'node:path';
export const MAX_ATTACHMENT_BYTES=10*1024*1024;
export const MAX_ATTACHMENTS=5;
const formats={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.doc':'application/msword','.xls':'application/vnd.ms-excel','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export function attachmentError(message,status=422){return Object.assign(new Error(message),{status});}
function zipNames(buffer){
 let end=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw attachmentError('El contenido del documento Office no es válido.');
 const count=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);
 if(count>2000||offset>=end)throw attachmentError('El contenido del documento Office no es válido.');
 const names=[];let pos=offset,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||buffer.readUInt32LE(pos)!==0x02014b50)throw attachmentError('El contenido del documento Office no es válido.');
  const n=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32);
  if(pos+46+n+extra+comment>end)throw attachmentError('El contenido del documento Office no es válido.');
  total+=buffer.readUInt32LE(pos+24);if(total>100*1024*1024)throw attachmentError('El documento Office es demasiado grande al descomprimir.');
  names.push(buffer.subarray(pos+46,pos+46+n).toString('utf8'));pos+=46+n+extra+comment;
 }
 return names;
}
export function validateAttachment(file){
 const filename=path.posix.basename(String(file.originalname||'').replaceAll('\\','/')).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180);
 const ext=path.extname(filename).toLowerCase(),mime=formats[ext],buffer=file.buffer;
 if(!mime)throw attachmentError('Formato permitido: JPG, PNG, WebP, PDF, Word o Excel.');
 if(!Buffer.isBuffer(buffer)||buffer.length===0)throw attachmentError('El archivo está vacío.');
 if(file.size>MAX_ATTACHMENT_BYTES||buffer.length>MAX_ATTACHMENT_BYTES)throw attachmentError('Cada archivo puede tener como máximo 10 MB.',413);
 let valid=false;
 if(ext==='.png')valid=buffer.length>=24&&buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 if(['.jpg','.jpeg'].includes(ext))valid=buffer.length>4&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255&&buffer.at(-2)===255&&buffer.at(-1)===217;
 if(ext==='.webp')valid=buffer.length>=16&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 if(ext==='.pdf')valid=buffer.toString('ascii',0,5)==='%PDF-'&&buffer.subarray(-2048).includes(Buffer.from('%%EOF'));
 if(['.doc','.xls'].includes(ext))valid=buffer.length>=512&&buffer.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
 if(['.docx','.xlsx'].includes(ext)&&buffer.length>=22&&buffer.readUInt32LE(0)===0x04034b50){
  const names=zipNames(buffer);valid=names.includes('[Content_Types].xml')&&names.includes(ext==='.docx'?'word/document.xml':'xl/workbook.xml')&&!names.some(n=>/vbaProject\.bin$/i.test(n));
 }
 if(!valid)throw attachmentError('El contenido del archivo no corresponde a su formato.');
 return {filename,mime,size:buffer.length,ext};
}
