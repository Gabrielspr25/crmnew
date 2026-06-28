// Acciones de escritura sobre data REAL (crm_pro / public): clientes, BANs, suscriptores.
// Respeta los CHECK reales: BAN number = 9 dígitos, phone_number = 10 dígitos,
// status suscriptor IN (activo|cancelado|suspendido), status BAN IN (activo|inactivo|suspendido).
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const writeRouter = Router();
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
async function wp(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await c.query('SET LOCAL search_path TO public'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; }
  finally { c.release(); }
}

// EDITAR cliente
writeRouter.put('/clients-real/:id', requireAuth, async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'additional_phone', 'mobile', 'address', 'city', 'zip_code', 'business_name'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in (req.body || {})) { vals.push(req.body[k] === '' ? null : req.body[k]); sets.push(`${k} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  try { const r = await wp(c => c.query(`UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING id`, vals)); if (!r.rows[0]) return res.status(404).json({ error: 'Cliente no existe' }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ELIMINAR cliente (cascada de BANs/suscriptores según FKs)
writeRouter.delete('/clients-real/:id', requireAuth, async (req, res) => {
  try { await wp(c => c.query(`DELETE FROM clients WHERE id = $1`, [req.params.id])); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// NUEVO BAN
writeRouter.post('/clients-real/:id/bans', requireAuth, async (req, res) => {
  const num = onlyDigits(req.body && req.body.number);
  const acct = (req.body && req.body.account_type) || null;
  if (num.length !== 9) return res.status(400).json({ error: 'El BAN debe tener 9 dígitos' });
  try { const r = await wp(c => c.query(`INSERT INTO bans (client_id, number, ban_number, status, account_type) VALUES ($1,$2,$2,'activo',$3) RETURNING id, ban_number`, [req.params.id, num, acct])); res.status(201).json(r.rows[0]); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// AGREGAR suscriptor a un BAN
writeRouter.post('/bans-real/:banId/subscribers', requireAuth, async (req, res) => {
  const b = req.body || {}; const ph = onlyDigits(b.phone);
  if (ph.length !== 10) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos' });
  try {
    const r = await wp(c => c.query(
      `INSERT INTO subscribers (ban_id, phone, phone_number, plan, monthly_value, line_kind, line_type, equipment, status)
       VALUES ($1,$2,$2,$3,$4,$5,$6,$7,'activo') RETURNING id`,
      [req.params.banId, ph, b.plan || null, Number(b.monthly_value) || null, b.line_kind || null, b.line_type || null, b.equipment || null]));
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// EDITAR / cambiar estado suscriptor (status: activo|cancelado|suspendido)
writeRouter.put('/subscribers-real/:id', requireAuth, async (req, res) => {
  const allowed = ['plan', 'monthly_value', 'status', 'equipment', 'contract_end_date', 'line_kind', 'line_type'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in (req.body || {})) { vals.push(req.body[k] === '' ? null : req.body[k]); sets.push(`${k} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  try { const r = await wp(c => c.query(`UPDATE subscribers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING id`, vals)); if (!r.rows[0]) return res.status(404).json({ error: 'Suscriptor no existe' }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ELIMINAR suscriptor
writeRouter.delete('/subscribers-real/:id', requireAuth, async (req, res) => {
  try { await wp(c => c.query(`DELETE FROM subscribers WHERE id = $1`, [req.params.id])); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
