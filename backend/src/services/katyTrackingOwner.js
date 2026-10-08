import jwt from 'jsonwebtoken';

export function createTrackingOwnerVerifier({secret,access}){
 if(!secret||typeof access?.status!=='function')throw Error('Falta configuración del propietario CRM.');
 return async req=>{
  const header=req.headers.authorization;
  if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>16384)throw Error('Sesión requerida.');
  const user=jwt.verify(header.slice(7),secret,{algorithms:['HS256']});
  if(!Number.isInteger(user.exp)||!user.nick)throw Error('Sesión inválida.');
  const status=await access.status(user);if(!status.available)throw Error('Propietario no configurado.');
  return {id:user.nick,name:user.nombre||user.nick};
 };
}
