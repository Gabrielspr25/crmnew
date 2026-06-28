import 'dotenv/config';
import { pool } from './src/db.js';
async function q(t,p){return pool.query(t,p);}

async function setProds(oppId, prods){
  await q('DELETE FROM opportunity_products WHERE opportunity_id=$1',[oppId]);
  for(const [pk,qty,amt] of prods)
    await q('INSERT INTO opportunity_products (opportunity_id,product_key,qty,amount) VALUES ($1,$2,$3,$4)',[oppId,pk,qty,amt]);
}
async function ensureOpp(name, sp){
  const c=(await q('SELECT id FROM clients WHERE name=$1',[name])).rows[0];
  if(!c) return null;
  let o=(await q("SELECT id FROM opportunities WHERE client_id=$1 AND status='activa'",[c.id])).rows[0];
  if(!o){
    o=(await q("INSERT INTO opportunities (client_id,product_key,salesperson,status) VALUES ($1,'fijo_ren',$2,'activa') RETURNING id",[c.id,sp])).rows[0];
    await q("INSERT INTO opportunity_steps (opportunity_id,name,step_order) SELECT $1,t.name,t.step_order FROM product_step_templates t JOIN products p ON p.id=t.product_id WHERE p.key='fijo_ren'",[o.id]);
    await q('UPDATE clients SET salesperson=$1 WHERE id=$2',[sp,c.id]);
  }
  return o.id;
}

let id=await ensureOpp('Gastronomía Mejicana','Gabriel'); if(id) await setProds(id,[['fijo_ren',1,174.99],['movil_new',2,0]]);
id=await ensureOpp('Ferretería Ponce','María Torres'); if(id) await setProds(id,[['movil_new',3,0],['fijo_ren',1,84.99]]);
id=await ensureOpp('Clínica Bayamón','Gabriel'); if(id) await setProds(id,[['fijo_ren',1,64.99]]);
console.log('Asana demo OK');
await pool.end();
