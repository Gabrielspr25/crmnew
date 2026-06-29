// Importador (actualización masiva): recibe filas mapeadas y hace upsert en
// clientes/BANs/suscriptores (public). "El archivo manda": actualiza lo existente.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const importRouter = Router();
const dig = (s) => String(s || '').replace(/\D/g, '');
function normStatus(s) {
  const x = String(s || '').toLowerCase().trim();
  if (!x) return null;
  if (x.includes('cancel') || x === 'c') return 'cancelado';
  if (x.includes('suspend') || x.includes('no_renueva') || x.includes('no renueva')) return 'suspendido';
  if (x.includes('activ') || x === 'a') return 'activo';
  return null;
}

// POST /api/import/apply { rows:[{empresa,ban,phone,plan,monthly_value,contract_end_date,status,account_type}] }
importRouter.post('/import/apply', requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No hay filas para importar' });
  const out = { clientes_creados: 0, bans_creados: 0, subs_creados: 0, subs_actualizados: 0, omitidas: 0, errores: [] };
  const c = await pool.connect();
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      try {
        let clientId = null;
        const empresa = String(r.empresa || '').trim();
        if (empresa) {
          const f = await c.query(`SELECT id FROM public.clients WHERE name ILIKE $1 LIMIT 1`, [empresa]);
          if (f.rows[0]) clientId = f.rows[0].id;
          else { const ins = await c.query(`INSERT INTO public.clients (name, pendiente_validacion) VALUES ($1,true) RETURNING id`, [empresa]); clientId = ins.rows[0].id; out.clientes_creados++; }
        }
        let banId = null;
        const ban = dig(r.ban);
        if (ban.length === 9) {
          let bf;
          if (clientId) bf = await c.query(`SELECT id FROM public.bans WHERE number=$1 AND client_id=$2 LIMIT 1`, [ban, clientId]);
          else bf = await c.query(`SELECT id, client_id FROM public.bans WHERE number=$1 LIMIT 1`, [ban]);
          if (bf.rows[0]) { banId = bf.rows[0].id; if (!clientId) clientId = bf.rows[0].client_id; }
          else if (clientId) { const ins = await c.query(`INSERT INTO public.bans (client_id, number, ban_number, status, account_type) VALUES ($1,$2,$2,'activo',$3) RETURNING id`, [clientId, ban, r.account_type || null]); banId = ins.rows[0].id; out.bans_creados++; }
        }
        const phone = dig(r.phone);
        if (phone.length === 10) {
          const sf = banId
            ? await c.query(`SELECT id FROM public.subscribers WHERE phone_number=$1 AND ban_id=$2 LIMIT 1`, [phone, banId])
            : await c.query(`SELECT id FROM public.subscribers WHERE phone_number=$1 LIMIT 1`, [phone]);
          const f = {
            plan: r.plan != null && r.plan !== '' ? String(r.plan) : null,
            monthly_value: r.monthly_value != null && r.monthly_value !== '' ? Number(r.monthly_value) : null,
            contract_end_date: r.contract_end_date || null,
            status: normStatus(r.status),
          };
          if (sf.rows[0]) {
            const sets = [], vals = [];
            Object.keys(f).forEach((k) => { if (f[k] != null) { vals.push(f[k]); sets.push(`${k} = $${vals.length}`); } });
            if (sets.length) { vals.push(sf.rows[0].id); await c.query(`UPDATE public.subscribers SET ${sets.join(', ')}, updated_at=now() WHERE id=$${vals.length}`, vals); }
            out.subs_actualizados++;
          } else if (banId) {
            await c.query(`INSERT INTO public.subscribers (ban_id, phone, phone_number, plan, monthly_value, contract_end_date, status) VALUES ($1,$2,$2,$3,$4,$5,$6)`,
              [banId, phone, f.plan, f.monthly_value, f.contract_end_date, f.status || 'activo']);
            out.subs_creados++;
          } else out.omitidas++;
        } else if (!empresa && !ban) out.omitidas++;
      } catch (e) { out.errores.push({ fila: i + 1, error: e.message }); }
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { c.release(); }
});
