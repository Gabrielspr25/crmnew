import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAttachment,MAX_ATTACHMENT_BYTES,MAX_ATTACHMENTS} from '../src/services/asanaAttachmentFiles.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64');
test('imagen PNG real conserva formato y limpia el nombre',()=>{
 const r=validateAttachment({originalname:'../captura.png',buffer:png,size:png.length});
 assert.equal(r.filename,'captura.png');assert.equal(r.mime,'image/png');assert.equal(r.size,png.length);
});
test('rechaza HTML disfrazado de imagen y extensiones ejecutables',()=>{
 assert.throws(()=>validateAttachment({originalname:'captura.png',buffer:Buffer.from('<html>'),size:6}),/contenido/i);
 assert.throws(()=>validateAttachment({originalname:'archivo.exe',buffer:png,size:png.length}),/formato/i);
});
test('limite aprobado de cinco archivos y diez MB por archivo',()=>{
 assert.equal(MAX_ATTACHMENTS,5);assert.equal(MAX_ATTACHMENT_BYTES,10*1024*1024);
 assert.throws(()=>validateAttachment({originalname:'grande.png',buffer:png,size:MAX_ATTACHMENT_BYTES+1}),/10 MB/);
});
test('PDF real y legacy Office por firma',()=>{
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
 assert.equal(validateAttachment({originalname:'documento.pdf',buffer:pdf,size:pdf.length}).mime,'application/pdf');
 const ole=Buffer.concat([Buffer.from('d0cf11e0a1b11ae1','hex'),Buffer.alloc(504)]);
 assert.equal(validateAttachment({originalname:'documento.doc',buffer:ole,size:ole.length}).mime,'application/msword');
});
