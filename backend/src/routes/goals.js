// Endpoints de Metas (cargar metas + ver cumplimiento).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { isSeller, sellerScope } from '../services/sellerScope.js';

export const goalsRouter = Router();

// GET /api/goals?month=YYYY-MM-01
goalsRouter.get('/', requireAuth, async (req, res) => {
  const { month } = req.query;
  const seller = isSeller(req.user) ? sellerScope(req.user) : null;
  const r = await query(
    `SELECT * FROM goals
      WHERE ($1::date IS NULL OR date_trunc('month', month) = date_trunc('month', $1::date))
        AND ($2::text IS NULL OR (scope='vendedor' AND LOWER(TRIM(salesperson))=LOWER(TRIM($2))))
      ORDER BY scope, salesperson NULLS FIRST, product_key`, [month || null, seller || null]);
  res.json(r.rows);
});

// POST /api/goals { scope, salesperson, product_key, month, target_qty }  (admin)
goalsRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { scope, salesperson, product_key, month, target_qty } = req.body || {};
  if (!scope || !product_key || !month) return res.status(400).json({ error: 'Faltan scope, product_key o month' });
  const qty = Number(target_qty) || 0;
  const sp = salesperson || null;

  // Meta del negocio (salesperson NULL): el índice único trata los NULL como distintos,
  // así que el upsert no funciona -> hacemos update-or-insert explícito (sin duplicar).
  if (sp === null) {
    const upd = await query(
      `UPDATE goals SET target_qty = $1, updated_at = now()
        WHERE scope = $2 AND salesperson IS NULL AND product_key = $3
          AND date_trunc('month', month) = date_trunc('month', $4::date)
        RETURNING *`, [qty, scope, product_key, month]);
    if (upd.rows[0]) return res.json(upd.rows[0]);
    const ins = await query(
      `INSERT INTO goals (scope, salesperson, product_key, month, target_qty)
       VALUES ($1, NULL, $2, $3, $4) RETURNING *`, [scope, product_key, month, qty]);
    return res.json(ins.rows[0]);
  }

  const r = await query(
    `INSERT INTO goals (scope, salesperson, product_key, month, target_qty)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (scope, salesperson, product_key, month)
     DO UPDATE SET target_qty = EXCLUDED.target_qty, updated_at = now()
     RETURNING *`,
    [scope, sp, product_key, month, qty]);
  res.json(r.rows[0]);
});

// GET /api/goals/cumplimiento?month=YYYY-MM-01  -> vendido vs meta por producto
goalsRouter.get('/cumplimiento', requireAuth, async (req, res) => {
  const { month } = req.query;
  const seller = isSeller(req.user) ? sellerScope(req.user) : null;
  const r = await query(
    `SELECT p.key, p.name, p.kind, p.income_value,
        COALESCE(g.target_qty, 0) AS target_qty,
        (SELECT count(*) FROM sales s
           WHERE s.product_key = p.key
             AND ($1::date IS NULL OR date_trunc('month', s.sale_date) = date_trunc('month', $1::date))
             AND ($2::text IS NULL OR LOWER(TRIM(s.vendor_name))=LOWER(TRIM($2))))::int AS sold_qty
       FROM products p
       LEFT JOIN goals g ON g.product_key = p.key AND g.scope = CASE WHEN $2::text IS NULL THEN 'negocio' ELSE 'vendedor' END
            AND ($2::text IS NULL OR LOWER(TRIM(g.salesperson))=LOWER(TRIM($2)))
            AND ($1::date IS NULL OR date_trunc('month', g.month) = date_trunc('month', $1::date))
      ORDER BY p.sort_order`, [month || null, seller || null]);

  let metaTotal = 0, vendidoTotal = 0;
  const productos = r.rows.map((p) => {
    const meta_money = Number(p.target_qty) * Number(p.income_value);
    const sold_money = Number(p.sold_qty) * Number(p.income_value);
    metaTotal += meta_money; vendidoTotal += sold_money;
    return {
      key: p.key, name: p.name, kind: p.kind,
      target_qty: Number(p.target_qty), sold_qty: p.sold_qty,
      meta_money: Math.round(meta_money * 100) / 100,
      sold_money: Math.round(sold_money * 100) / 100,
      pct: meta_money > 0 ? Math.round((sold_money / meta_money) * 100) : 0,
    };
  });
  res.json({
    month: month || null,
    productos,
    meta_total: Math.round(metaTotal * 100) / 100,
    vendido_total: Math.round(vendidoTotal * 100) / 100,
    falta: Math.round((metaTotal - vendidoTotal) * 100) / 100,
    pct_total: metaTotal > 0 ? Math.round((vendidoTotal / metaTotal) * 100) : 0,
  });
});
