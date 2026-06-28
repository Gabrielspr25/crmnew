// Endpoints de BANs y Suscriptores (líneas).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const linesRouter = Router();

// POST /api/bans  -> crear BAN para un cliente
linesRouter.post('/bans', requireAuth, async (req, res) => {
  const { client_id, ban_number, account_type } = req.body || {};
  if (!client_id || !ban_number) return res.status(400).json({ error: 'Falta client_id o ban_number' });
  try {
    const r = await query(
      `INSERT INTO bans (client_id, ban_number, account_type) VALUES ($1,$2,$3) RETURNING *`,
      [client_id, ban_number, account_type]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'Ese BAN ya existe' });
    throw e;
  }
});

// POST /api/subscribers  -> agregar línea a un BAN
linesRouter.post('/subscribers', requireAuth, async (req, res) => {
  const { ban_id, phone, plan_code, monthly_value } = req.body || {};
  if (!ban_id || !phone) return res.status(400).json({ error: 'Falta ban_id o phone' });
  // Regla #4: no permitir la misma línea (teléfono) en otro BAN si está activa.
  const dup = await query(
    `SELECT 1 FROM subscribers WHERE phone = $1 AND status = 'activa' AND ban_id <> $2`, [phone, ban_id]);
  if (dup.rows[0]) return res.status(409).json({ error: 'Ese teléfono ya está activo en otro BAN' });
  try {
    const r = await query(
      `INSERT INTO subscribers (ban_id, phone, plan_code, monthly_value) VALUES ($1,$2,$3,$4) RETURNING *`,
      [ban_id, phone, plan_code, monthly_value]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'Esa línea ya existe en el BAN' });
    throw e;
  }
});

// PUT /api/subscribers/:id  -> actualizar / cambiar estado (activa/no_renueva/cancelada)
linesRouter.put('/subscribers/:id', requireAuth, async (req, res) => {
  const allowed = ['phone','plan_code','monthly_value','status','cancel_reason'];
  const sets = [], vals = [];
  for (const k of allowed) {
    if (k in (req.body || {})) { vals.push(req.body[k]); sets.push(`${k} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  const r = await query(
    `UPDATE subscribers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);
  if (!r.rows[0]) return res.status(404).json({ error: 'Línea no existe' });
  res.json(r.rows[0]);
});
