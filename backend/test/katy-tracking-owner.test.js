import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {createTrackingOwnerVerifier} from '../src/services/katyTrackingOwner.js';
test('solo una sesión vigente del propietario puede consentir integración',async()=>{
 const secret='test-only-katy-owner-secret',verify=createTrackingOwnerVerifier({secret,access:{status:async user=>{if(user.nick!=='owner')throw Error();return {available:true};}}});
 const request=claims=>({headers:{authorization:'Bearer '+jwt.sign(claims,secret,{expiresIn:'5m'})}});
 assert.deepEqual(await verify(request({nick:'owner',nombre:'Propietario'})),{id:'owner',name:'Propietario'});
 await assert.rejects(()=>verify(request({nick:'other',nombre:'Propietario'})));
 await assert.rejects(()=>verify({headers:{authorization:'Bearer '+jwt.sign({nick:'owner'},secret)}}));
 await assert.rejects(()=>verify({headers:{authorization:'Bearer '+jwt.sign({nick:'owner'},secret,{expiresIn:-1})}}));
});
