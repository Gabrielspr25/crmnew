// Endpoints de Clientes (lista, ficha completa, crear, actualizar).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const clientsRouter = Router();

// GET /api/clients  -> lista con resumen (BANs y líneas activas)
clientsRouter.get('/', requireAuth, async (_req, res) => {
  const r = await query(`
    SELECT c.*,
      (SELECT count(*) FROM bans b WHERE b.client_id = c.id)::int AS ban_count,
      (SELECT count(*) FROM subscribers s
         JOIN bans b ON b.id = s.ban_id
        WHERE b.client_id = c.id AND s.status = 'activa')::int AS active_lines
    FROM clients c
    ORDER BY c.name ASC
    LIMIT 500`);
  res.json(r.rows);
});

// GET /api/clients/:id  -> ficha completa (con BANs y líneas)
clientsRouter.get('/:id', requireAuth, async (req, res) => {
  const c = await query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!c.rows[0]) return res.status(404).json({ error: 'Cliente no existe' });
  const bans = await query('SELECT * FROM bans WHERE client_id = $1 ORDER BY ban_number', [req.params.id]);
  const subs = await query(
    `SELECT s.* FROM subscribers s JOIN bans b ON b.id = s.ban_id
      WHERE b.client_id = $1 ORDER BY s.phone`, [req.params.id]);
  res.json({ ...c.rows[0], bans: bans.rows, subscribers: subs.rows });
});

// POST /api/clients  -> crear
clientsRouter.post('/', requireAuth, async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Falta la empresa' });
  const existing = await query(
    `SELECT c.id, c.name, c.business_name
       FROM clients c
      WHERE LOWER(TRIM(COALESCE(c.name,''))) = LOWER(TRIM($1))
         OR LOWER(TRIM(COALESCE(c.business_name,''))) = LOWER(TRIM($1))
      ORDER BY c.created_at DESC NULLS LAST, c.id
      LIMIT 1`,
    [name]
  );
  if (existing.rows[0]) {
    const displayName = existing.rows[0].name || existing.rows[0].business_name || name;
    return res.status(409).json({
      error: `Cliente ya existe en CRM: ${displayName}`,
      client_id: existing.rows[0].id
    });
  }
  const r = await query(
    `INSERT INTO clients (name, owner_name, contact_person, email, phone, additional_phone, cellular,
        address, city, zip_code, tax_id, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [name, b.owner_name, b.contact_person, b.email, b.phone, b.additional_phone, b.cellular,
     b.address, b.city, b.zip_code, b.tax_id, b.source]);
  res.status(201).json(r.rows[0]);
});

// PUT /api/clients/:id  -> actualizar (solo los campos enviados)
clientsRouter.put('/:id', requireAuth, async (req, res) => {
  const allowed = ['name','owner_name','contact_person','email','phone','additional_phone','cellular',
                   'address','city','zip_code','tax_id','source'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in (req.body || {})) { vals.push(req.body[k]); sets.push(`${k} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  const r = await query(
    `UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);
  if (!r.rows[0]) return res.status(404).json({ error: 'Cliente no existe' });
  res.json(r.rows[0]);
});
