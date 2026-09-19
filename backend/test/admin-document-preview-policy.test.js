import test from 'node:test';
import assert from 'node:assert/strict';
import { installUploadGuard, allowDocumentWrite, trackDrafts } from '../../scripts/admin-document-preview-policy.mjs';
import { createHash } from 'node:crypto';
const buffer=Buffer.from('official-test-fixture');
const sha=createHash('sha256').update(buffer).digest('hex');
function response(){return {code:200,payload:null,status(code){this.code=code;return this;},json(p){this.payload=p;return this;}};}

test('solo permite el PDF seleccionado y familia Fijo/TV, nunca auto-publica', async()=>{
  let called=0;
  const layer={handle(req,res){called++;assert.equal(req.body.publicacion_modo,'borrador');return res.json({ok:true});}};
  const router={stack:[{route:{path:'/',methods:{post:true},stack:[layer]}}]};
  installUploadGuard(router,sha);
  for(const familia of ['equipos','inalambrico_iot','affinity']){
    const res=response();await layer.handle({body:{familia},file:{buffer,originalname:'oficial.pdf'}},res);
    assert.equal(res.code,403);
  }
  const bad=response();await layer.handle({body:{familia:'fijos'},file:{buffer:Buffer.from('otro'),originalname:'oficial.pdf'}},bad);
  assert.equal(bad.code,403);
  await layer.handle({body:{familia:'fijos'},file:{buffer,originalname:'oficial.pdf'}},response());
  assert.equal(called,1);
});

test('publicar siempre bloqueado; aprobar solo borradores creados durante la prueba', async()=>{
  const drafts=new Set(), id='11111111-1111-4111-8111-111111111111';
  const db={query:async()=>({rows:[{sha256:sha,familia:'fijos'}]})};
  const check=path=>allowDocumentWrite({method:'POST',path},{db,sha,drafts});
  assert.equal(await check(`/api/fuentes-comerciales/bases-informativas/${id}/publicar`),false);
  assert.equal(await check(`/api/fuentes-comerciales/${id}/equipos-publicar`),false);
  assert.equal(await check(`/api/fuentes-comerciales/bases-informativas/${id}/aprobar`),false);
  assert.equal(await check(`/api/fuentes-comerciales/${id}/preview-base`),true);
  trackDrafts({publicaciones:[{id,estado:'borrador',categoria:'claro_tv'}]},drafts);
  assert.equal(await check(`/api/fuentes-comerciales/bases-informativas/${id}/aprobar`),true);
  assert.equal(await check('/api/planes-modulos/apply/fijos'),false);
});
