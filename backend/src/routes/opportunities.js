// Endpoints de Seguimiento (oportunidades + caminito de pasos + bitácora).
import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth } from '../auth.js';

export const oppsRouter = Router();

// POST /api/clients/:id/seguimiento  { product_key, salesperson }
// Envía el cliente a seguimiento: crea oportunidad + copia los pasos del producto.
oppsRouter.post('/clients/:id/seguimiento', requireAuth, async (req, res) => {
  const { product_key, salesperson } = req.body || {};
  if (!product_key) return res.status(400).json({ error: 'Falta product_key' });

  const cli = await query('SELECT id FROM clients WHERE id = $1', [req.params.id]);
  if (!cli.rows[0]) return res.status(404).json({ error: 'Cliente no existe' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let opp;
    try {
      const r = await client.query(
        `INSERT INTO opportunities (client_id, product_key, salesperson, status)
         VALUES ($1,$2,$3,'activa') RETURNING *`,
        [req.params.id, product_key, salesperson || req.user.nombre]);
      opp = r.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') return res.status(409).json({ error: 'El cliente ya está en seguimiento' });
      throw e;
    }
    // Copiar los pasos activos del template del producto -> caminito
    await client.query(
      `INSERT INTO opportunity_steps (opportunity_id, name, step_order)
       SELECT $1, t.name, t.step_order
         FROM product_step_templates t JOIN products p ON p.id = t.product_id
        WHERE p.key = $2 AND t.active = true ORDER BY t.step_order`,
      [opp.id, product_key]);
    // Asignar vendedor al cliente
    await client.query('UPDATE clients SET salesperson = $1 WHERE id = $2',
      [salesperson || req.user.nombre, req.params.id]);
    await client.query('COMMIT');
    res.status(201).json(opp);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// GET /api/opportunities  -> Asana del día (activas, con paso actual y avance)
oppsRouter.get('/opportunities', requireAuth, async (req, res) => {
  const soloVendedor = req.user.rol === 'vendedor';
  const r = await query(
    `SELECT o.*, c.name AS client_name,
        (SELECT count(*) FROM opportunity_steps s WHERE s.opportunity_id = o.id)::int AS total_steps,
        (SELECT count(*) FROM opportunity_steps s WHERE s.opportunity_id = o.id AND s.done)::int AS done_steps,
        (SELECT s.name FROM opportunity_steps s WHERE s.opportunity_id = o.id AND NOT s.done
           ORDER BY s.step_order LIMIT 1) AS current_step,
        COALESCE((SELECT json_object_agg(op.product_key, json_build_object('qty',op.qty,'amount',op.amount))
                    FROM opportunity_products op WHERE op.opportunity_id = o.id), '{}') AS productos,
        (SELECT COALESCE(SUM(op.qty),0)::int FROM opportunity_products op WHERE op.opportunity_id = o.id) AS total_lineas,
        (SELECT COALESCE(SUM(op.amount),0) FROM opportunity_products op WHERE op.opportunity_id = o.id) AS total_money
       FROM opportunities o JOIN clients c ON c.id = o.client_id
      WHERE o.status = 'activa'
        AND ($1::text IS NULL OR o.salesperson = $1)
      ORDER BY c.name`,
    [soloVendedor ? req.user.nombre : null]);
  res.json(r.rows);
});

// GET /api/opportunities/:id  -> caminito (pasos) + bitácora
oppsRouter.get('/opportunities/:id', requireAuth, async (req, res) => {
  const o = await query('SELECT * FROM opportunities WHERE id = $1', [req.params.id]);
  if (!o.rows[0]) return res.status(404).json({ error: 'Oportunidad no existe' });
  const steps = await query('SELECT * FROM opportunity_steps WHERE opportunity_id = $1 ORDER BY step_order', [req.params.id]);
  const log = await query('SELECT * FROM opportunity_log WHERE opportunity_id = $1 ORDER BY created_at DESC', [req.params.id]);
  res.json({ ...o.rows[0], steps: steps.rows, log: log.rows });
});

// POST /api/opportunities/:id/log  { type:'llamada'|'nota', body }
oppsRouter.post('/opportunities/:id/log', requireAuth, async (req, res) => {
  const { type, body } = req.body || {};
  if (!['llamada', 'nota'].includes(type)) return res.status(400).json({ error: 'type debe ser llamada o nota' });
  const r = await query(
    `INSERT INTO opportunity_log (opportunity_id, type, body, user_name) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, type, body || '', req.user.nombre]);
  res.status(201).json(r.rows[0]);
});

// POST /api/opportunities/:id/steps/:stepId/done  -> avanzar paso (+ se anota solo)
oppsRouter.post('/opportunities/:id/steps/:stepId/done', requireAuth, async (req, res) => {
  const s = await query(
    `UPDATE opportunity_steps SET done = true, done_at = now()
      WHERE id = $1 AND opportunity_id = $2 RETURNING *`,
    [req.params.stepId, req.params.id]);
  if (!s.rows[0]) return res.status(404).json({ error: 'Paso no existe' });
  // Bitácora automática del avance
  await query(
    `INSERT INTO opportunity_log (opportunity_id, type, body, user_name)
     VALUES ($1, 'paso', $2, $3)`,
    [req.params.id, `Completó el paso: ${s.rows[0].name}`, req.user.nombre]);
  res.json(s.rows[0]);
});

// PUT /api/opportunities/:id/productos  { productos:[{product_key,qty,amount}] }
// Define los productos negociados (lo que se está trabajando en la oportunidad).
oppsRouter.put('/opportunities/:id/productos', requireAuth, async (req, res) => {
  const productos = (req.body && req.body.productos) || [];
  await query('DELETE FROM opportunity_products WHERE opportunity_id = $1', [req.params.id]);
  for (const p of productos) {
    await query(
      `INSERT INTO opportunity_products (opportunity_id, product_key, qty, amount) VALUES ($1,$2,$3,$4)`,
      [req.params.id, p.product_key, Number(p.qty) || 0, Number(p.amount) || 0]);
  }
  res.json({ ok: true, count: productos.length });
});

// POST /api/opportunities/:id/close  -> cerrar y devolver al pool (regla #15)
oppsRouter.post('/opportunities/:id/close', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const o = await client.query(
      `UPDATE opportunities SET status = 'cerrada', archived_at = now()
        WHERE id = $1 AND status = 'activa' RETURNING client_id`, [req.params.id]);
    if (!o.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Oportunidad activa no encontrada' }); }
    // Vuelve al pool: cliente sin vendedor
    await client.query('UPDATE clients SET salesperson = NULL WHERE id = $1', [o.rows[0].client_id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
