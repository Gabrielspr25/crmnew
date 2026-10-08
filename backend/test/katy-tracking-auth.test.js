import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {createTrackingAuthorization} from '../src/services/katyTrackingAuthorization.js';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const options={issuer:'https://auth.example.test',audience:'https://crm.example.test/api/tracking/v1',verificationKey:keys.publicKey,subjects:{'katy-owner-1':{id:'katy',name:'Katy'}}};
const token=(payload={},config={})=>jwt.sign({scope:'tracking:read tracking:write',...payload},keys.privateKey,{algorithm:'RS256',issuer:options.issuer,audience:options.audience,subject:'katy-owner-1',expiresIn:'5m',...config});
test('credencial de integración devuelve identidad configurada y permisos acotados',async()=>{
 const authorize=createTrackingAuthorization(options);const identity=await authorize({headers:{authorization:'Bearer '+token({scope:'tracking:read crm:admin',name:'Gabriel'})}});
 assert.deepEqual(identity,{id:'katy',name:'Katy',scopes:['tracking:read']});
});
test('rechaza expiración, otro recurso, otro emisor, otra identidad y clave inválida',async()=>{
 const authorize=createTrackingAuthorization(options);
 for(const config of [{expiresIn:-1},{audience:'otro'},{issuer:'otro'},{subject:'otro'}])await assert.rejects(()=>authorize({headers:{authorization:'Bearer '+token({},config)}}),error=>error.status===401);
 await assert.rejects(()=>authorize({headers:{authorization:'Bearer '+jwt.sign({scope:'tracking:read'},'clave-crm',{algorithm:'HS256'})}}),error=>error.status===401);
 await assert.rejects(()=>authorize({headers:{}}),error=>error.status===401);
});
test('una credencial sin vencimiento o sin scopes no abre la API',async()=>{
 const authorize=createTrackingAuthorization(options);
 const missingExpiration=jwt.sign({scope:'tracking:read'},keys.privateKey,{algorithm:'RS256',issuer:options.issuer,audience:options.audience,subject:'katy-owner-1'});
 for(const t of [missingExpiration,token({scope:'crm:admin'})])await assert.rejects(()=>authorize({headers:{authorization:'Bearer '+t}}),error=>error.status===401);
});
