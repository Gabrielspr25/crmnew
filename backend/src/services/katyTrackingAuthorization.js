import jwt from 'jsonwebtoken';

const ALLOWED=new Set(['tracking:read','tracking:write']);
const unauthorized=()=>Object.assign(new Error('La credencial de integración no es válida.'),{status:401});

// Verificador del recurso: claves/issuer/subjects vienen de configuración
// confiable del servidor, nunca de un cuerpo, token o URL aportados por Katy.
export function createTrackingAuthorization({issuer,audience,verificationKey,subjects}){
 if(typeof issuer!=='string'||!issuer.startsWith('https://')||typeof audience!=='string'||!audience.startsWith('https://')||!verificationKey||!subjects||typeof subjects!=='object')throw Error('Falta la configuración de identidad de integración.');
 const identities=new Map(Object.entries(subjects).map(([subject,identity])=>[subject,{id:identity.id,name:identity.name}]));
 return async function authorize(req){
  const header=req.headers?.authorization;
  if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>16384)throw unauthorized();
  try{
   const claims=jwt.verify(header.slice(7),verificationKey,{algorithms:['RS256'],issuer,audience});
   if(!claims||typeof claims!=='object'||!Number.isInteger(claims.exp)||typeof claims.sub!=='string')throw unauthorized();
   const identity=identities.get(claims.sub);
   if(!identity)throw unauthorized();
   const scopes=typeof claims.scope==='string'?[...new Set(claims.scope.split(/\s+/).filter(s=>ALLOWED.has(s)))]:[];
   if(!scopes.length)throw unauthorized();
   return {...identity,scopes};
  }catch{throw unauthorized();}
 };
}
