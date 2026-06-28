// Endpoints de catálogos: categorías, productos y plantillas de pasos (Asana pasos).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const catalogRouter = Router();

// GET /api/categories
catalogRouter.get('/categories', requireAuth, async (_req, res) => {
  const r = await query('SELECT * FROM categories ORDER BY sort_order, name');
  res.json(r.rows);
});

// GET /api/products
catalogRouter.get('/products', requireAuth, async (_req, res) => {
  const r = await query(
    `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.sort_order`);
  res.json(r.rows);
});

// GET /api/products/:key/steps  -> plantilla de pasos de ese producto (Asana pasos)
catalogRouter.get('/products/:key/steps', requireAuth, async (req, res) => {
  const r = await query(
    `SELECT t.* FROM product_step_templates t
       JOIN products p ON p.id = t.product_id
      WHERE p.key = $1 ORDER BY t.step_order`, [req.params.key]);
  res.json(r.rows);
});

// POST /api/products/:key/steps  -> crear paso (solo admin)
catalogRouter.post('/products/:key/steps', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Falta el nombre del paso' });
  const p = await query('SELECT id FROM products WHERE key = $1', [req.params.key]);
  if (!p.rows[0]) return res.status(404).json({ error: 'Producto no existe' });
  const ord = await query(
    'SELECT COALESCE(MAX(step_order),0)+1 AS n FROM product_step_templates WHERE product_id = $1', [p.rows[0].id]);
  const r = await query(
    `INSERT INTO product_step_templates (product_id, name, step_order) VALUES ($1,$2,$3) RETURNING *`,
    [p.rows[0].id, name, ord.rows[0].n]);
  res.status(201).json(r.rows[0]);
});

// PUT /api/step-templates/:id  -> editar / activar-desactivar paso
catalogRouter.put('/step-templates/:id', requireAuth, requireAdmin, async (req, res) => {
  const allowed = ['name', 'step_order', 'active'];
  const sets = [], vals = [];
  for (const k of allowed) {
    if (k in (req.body || {})) { vals.push(req.body[k]); sets.push(`${k} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  const r = await query(
    `UPDATE product_step_templates SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!r.rows[0]) return res.status(404).json({ error: 'Paso no existe' });
  res.json(r.rows[0]);
});

// DELETE /api/step-templates/:id  -> borrar paso
catalogRouter.delete('/step-templates/:id', requireAuth, requireAdmin, async (req, res) => {
  const r = await query('DELETE FROM product_step_templates WHERE id = $1 RETURNING id', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Paso no existe' });
  res.json({ ok: true });
});

// ---- Categorías: crear / editar / borrar ----
catalogRouter.post('/categories', requireAuth, requireAdmin, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const ord = await query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM categories');
  const r = await query(
    'INSERT INTO categories (name, description, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [name.trim(), description || null, ord.rows[0].n]);
  res.status(201).json(r.rows[0]);
});

catalogRouter.put('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  const allowed = ['name', 'description', 'sort_order'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in (req.body || {})) { vals.push(req.body[k]); sets.push(`${k} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  const r = await query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!r.rows[0]) return res.status(404).json({ error: 'Categoría no existe' });
  res.json(r.rows[0]);
});

catalogRouter.delete('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  const used = await query('SELECT COUNT(*)::int AS n FROM products WHERE category_id = $1', [req.params.id]);
  if (used.rows[0].n > 0) return res.status(409).json({ error: `No se puede borrar: tiene ${used.rows[0].n} producto(s). Movelos primero.` });
  const r = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Categoría no existe' });
  res.json({ ok: true });
});

// ---- Productos: editar (nombre, categoría, tipo, valor de ingreso) ----
catalogRouter.put('/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const allowed = ['name', 'category_id', 'kind', 'income_value', 'active', 'sort_order'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in (req.body || {})) { vals.push(req.body[k]); sets.push(`${k} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  const r = await query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!r.rows[0]) return res.status(404).json({ error: 'Producto no existe' });
  res.json(r.rows[0]);
});
