import { randomUUID } from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function validateReferralUpdate(body={}){
 const values={};
 if(Object.hasOwn(body,'referred_by_name')){
  if(body.referred_by_name!==null&&typeof body.referred_by_name!=='string')throw fail('Referido por debe ser texto');
  const name=(body.referred_by_name||'').trim();
  if([...name].length>200)throw fail('Referido por admite hasta 200 caracteres');
  if(/[\u0000-\u001f\u007f]/.test(name))throw fail('Referido por debe ser un nombre en una sola línea');
  values.referred_by_name=name||null;
 }
 if(Object.hasOwn(body,'salesperson_id')){
  const seller=body.salesperson_id;
  if(seller!==null&&seller!==''&&(typeof seller!=='string'||!UUID.test(seller)))throw fail('Vendedor inválido');
  values.salesperson_id=seller||null;
 }
 if(!Object.keys(values).length)throw fail('Nada para actualizar');
 return values;
}

// El llamador debe abrir una transacción: referido y asignación se guardan juntos.
export async function updateOpportunityReferral(c,id,body,{canAssign=false,sellerId=null,username='Sistema'}={}){
 if(!UUID.test(id))throw fail('Oportunidad inválida');
 const values=validateReferralUpdate(body);
 const anchor=await c.query('SELECT client_id FROM sales_opportunities WHERE id=$1 AND archived_at IS NULL',[id]);
 if(!anchor.rows[0])throw fail('Oportunidad activa no encontrada',404);
 // Orden compartido con la edición de Clientes: cliente, luego oportunidades.
 await c.query('SELECT id FROM clients WHERE id=$1 FOR UPDATE',[anchor.rows[0].client_id]);
 const found=await c.query(`SELECT id, client_id, salesperson_id, referred_by_name FROM sales_opportunities WHERE id=$1 AND archived_at IS NULL FOR UPDATE`,[id]);
 const row=found.rows[0];
 if(!row)throw fail('Oportunidad activa no encontrada',404);
 if(!canAssign&&(!sellerId||row.salesperson_id!==sellerId))throw fail('No puedes modificar un seguimiento asignado a otro vendedor.',403);
 if(Object.hasOwn(body,'expected_referred_by_name')&&body.expected_referred_by_name!==(row.referred_by_name||null))throw fail('El referido cambió mientras editabas. Cierra el editor y actualiza la pantalla.',409);
 const assignmentChanged=Object.hasOwn(values,'salesperson_id')&&values.salesperson_id!==(row.salesperson_id||null);
 if(assignmentChanged&&!canAssign)throw fail('Solo administración puede cambiar el vendedor asignado.',403);
 if(Object.hasOwn(values,'salesperson_id')&&Object.hasOwn(body,'expected_salesperson_id')&&body.expected_salesperson_id!==(row.salesperson_id||null))throw fail('El vendedor cambió mientras editabas. Cierra el editor y actualiza la pantalla.',409);
 if(assignmentChanged&&values.salesperson_id){
  const seller=await c.query('SELECT id FROM salespeople WHERE id=$1',[values.salesperson_id]);
  if(!seller.rows[0])throw fail('Vendedor no existe');
 }
 if(assignmentChanged){
  await c.query('UPDATE clients SET salesperson_id = $1, updated_at = now() WHERE id = $2',[values.salesperson_id,row.client_id]);
  await c.query('UPDATE sales_opportunities SET salesperson_id = $1, updated_at = now() WHERE client_id = $2 AND archived_at IS NULL',[values.salesperson_id,row.client_id]);
 }
 const referralChanged=Object.hasOwn(values,'referred_by_name')&&values.referred_by_name!==(row.referred_by_name||null);
 if(referralChanged){
  await c.query('UPDATE sales_opportunities SET referred_by_name = $1, updated_at = now() WHERE id = $2',[values.referred_by_name,id]);
 }
 if(assignmentChanged)await c.query('UPDATE sales_opportunities SET updated_at = clock_timestamp() WHERE id = $1',[id]);
 if(referralChanged||assignmentChanged){
  const detail=[referralChanged?'Referido por: '+(values.referred_by_name||'sin referido'):null,assignmentChanged?'Asignación de vendedor actualizada desde Asana':null].filter(Boolean).join('. ');
  await c.query('INSERT INTO opportunity_notes (id, opportunity_id, note, created_by_username, created_at) VALUES ($1,$2,$3,$4,now())',[randomUUID(),id,'[NOTA] '+detail,username]);
 }
 return {ok:true,id,referred_by_name:Object.hasOwn(values,'referred_by_name')?values.referred_by_name:row.referred_by_name||null,salesperson_id:Object.hasOwn(values,'salesperson_id')?values.salesperson_id:row.salesperson_id||null};
}
