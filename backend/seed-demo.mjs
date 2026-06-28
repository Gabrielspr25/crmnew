// Datos de demo para ver las pantallas con contenido (UTF-8 correcto).
import 'dotenv/config';
import { pool } from './src/db.js';

async function q(t, p) { return pool.query(t, p); }

// Cliente Gastronomía -> BAN + 2 líneas
const g = (await q("SELECT id FROM clients WHERE name = 'Gastronomía Mejicana'")).rows[0];
if (g) {
  const ban = (await q(
    `INSERT INTO bans (client_id, ban_number, account_type) VALUES ($1,'782913588','fijo')
     ON CONFLICT (ban_number) DO UPDATE SET account_type='fijo' RETURNING id`, [g.id])).rows[0];
  for (const [ph, plan, val] of [['7877967141','GPON BUS Pro',74.99], ['7877967142','Móvil 5G',50.00]]) {
    await q(`INSERT INTO subscribers (ban_id, phone, plan_code, monthly_value) VALUES ($1,$2,$3,$4)
             ON CONFLICT (ban_id, phone) DO NOTHING`, [ban.id, ph, plan, val]);
  }
  // Enviar a seguimiento (fijo_ren) si no está
  const has = (await q("SELECT id FROM opportunities WHERE client_id=$1 AND status='activa'", [g.id])).rows[0];
  if (!has) {
    const opp = (await q(
      `INSERT INTO opportunities (client_id, product_key, salesperson, status)
       VALUES ($1,'fijo_ren','Gabriel','activa') RETURNING id`, [g.id])).rows[0];
    await q(`INSERT INTO opportunity_steps (opportunity_id, name, step_order)
             SELECT $1, t.name, t.step_order FROM product_step_templates t
             JOIN products p ON p.id=t.product_id WHERE p.key='fijo_ren' ORDER BY t.step_order`, [opp.id]);
    await q("UPDATE opportunity_steps SET done=true, done_at=now() WHERE opportunity_id=$1 AND step_order=1", [opp.id]);
    await q(`INSERT INTO opportunity_log (opportunity_id,type,body,user_name) VALUES
             ($1,'paso','Completó el paso: LLAMAR','Gabriel'),
             ($1,'nota','Cliente interesado en renovar, le preparo propuesta.','Gabriel')`, [opp.id]);
    await q('UPDATE clients SET salesperson=$1 WHERE id=$2', ['Gabriel', g.id]);
  }
}

// Ventas de demo (para Comisiones)
await q("DELETE FROM sales WHERE tango_venta_id IN (90001,90002,90003)");
for (const [vid, ban, ph, pk, mv, emp, ven, vn] of [
  [90001,'782913588','7877967141','fijo_ren',174.99,577.47,null,'Gabriel'],
  [90002,'823688026','7872184546','movil_new',50.00,59.99,null,'Dayana'],
  [90003,'823688026','7872194375','movil_new',50.00,59.99,null,'Dayana'],
]) {
  await q(`INSERT INTO sales (tango_venta_id,ban_number,phone,product_key,monthly_value,company_commission,vendor_commission,vendor_name,sale_date,synced)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,true)`, [vid,ban,ph,pk,mv,emp,ven,vn]);
}

// Metas de demo
for (const [pk, t] of [['fijo_ren',20],['fijo_new',8],['movil_new',40],['movil_ren',15]]) {
  await q(`INSERT INTO goals (scope,product_key,month,target_qty) VALUES ('negocio',$1,date_trunc('month',CURRENT_DATE),$2)
           ON CONFLICT (scope,salesperson,product_key,month) DO UPDATE SET target_qty=EXCLUDED.target_qty`, [pk, t]);
}

console.log('Demo cargada OK.');
await pool.end();
