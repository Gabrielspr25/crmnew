// Rutas de ventas/comisiones: sincronizar desde Tango y listar.
import { Router } from 'express';
import { query } from '../db.js';
import { fetchVentas, mapVenta } from '../tango.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const salesRouter = Router();

// Clasifica el tipo de Tango en uno de los 7 productos (regla #12).
function classifyProduct(nombre = '') {
  const n = String(nombre).toLowerCase();
  if (/cloud|office\s*365/.test(n)) return 'cloud';
  if (/\btv\b|televis/.test(n)) return 'claro_tv';
  if (/mpls/.test(n)) return 'mpls';
  if (/fijo/.test(n)) return /\bren\b|renov/.test(n) ? 'fijo_ren' : 'fijo_new';
  if (/\bren\b|renov/.test(n)) return 'movil_ren';
  return 'movil_new';
}

// POST /api/sales/sync  { desde, hasta }  (solo admin/supervisor)
salesRouter.post('/sync', requireAuth, requireAdmin, async (req, res) => {
  const { desde, hasta } = req.body || {};
  if (!desde || !hasta) return res.status(400).json({ error: 'Faltan desde/hasta' });

  let ventas;
  try {
    ventas = await fetchVentas({ desde, hasta });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }

  let inserted = 0, updated = 0, autocreated = 0, pending = 0;

  for (const raw of ventas) {
    const v = mapVenta(raw);
    if (!v.tango_venta_id) continue;
    const product_key = classifyProduct(v.ventatipo_nombre);

    // ¿Existe el BAN en el CRM? -> sacamos el client_id
    let clientId = null;
    let reviewReason = null;
    if (v.ban_number) {
      const b = await query('SELECT client_id FROM bans WHERE ban_number = $1', [v.ban_number]);
      if (b.rows[0]) clientId = b.rows[0].client_id;
    }

    // Regla #19: si no existe y Tango trae nombre -> auto-crear; si no -> pendiente
    if (!clientId) {
      const nombre = (v.cliente_nombre || '').trim();
      if (nombre && !/^(sin nombre|null|n\/a)$/i.test(nombre)) {
        const c = await query(
          `INSERT INTO clients (name, salesperson) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING id`,
          [nombre, v.vendor_name]
        );
        if (c.rows[0]) { clientId = c.rows[0].id; autocreated++; }
        else {
          const e = await query('SELECT id FROM clients WHERE LOWER(name) = LOWER($1) LIMIT 1', [nombre]);
          clientId = e.rows[0]?.id || null;
        }
      } else {
        reviewReason = 'cliente_tango_sin_nombre';
        pending++;
      }
    }

    const up = await query(
      `INSERT INTO sales
         (tango_venta_id, client_id, ban_number, phone, product_key, ventatipo_nombre,
          monthly_value, vendor_name, sale_date, review_reason, raw_payload, synced)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       ON CONFLICT (tango_venta_id) DO UPDATE SET
         client_id = EXCLUDED.client_id,
         monthly_value = COALESCE(EXCLUDED.monthly_value, sales.monthly_value),
         review_reason = EXCLUDED.review_reason,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [v.tango_venta_id, clientId, v.ban_number, v.phone, product_key, v.ventatipo_nombre,
       v.monthly_value, v.vendor_name, v.sale_date, reviewReason, v.raw_payload]
    );
    if (up.rows[0]?.inserted) inserted++; else updated++;
  }

  res.json({ ok: true, total: ventas.length, inserted, updated, autocreated, pending });
});

// GET /api/sales?desde=&hasta=  -> lista para el módulo Comisiones
salesRouter.get('/', requireAuth, async (req, res) => {
  const { desde, hasta } = req.query;
  // Vendedor solo ve lo suyo (regla #23)
  const soloVendedor = req.user.rol === 'vendedor';
  const rows = await query(
    `SELECT s.*, COALESCE(c.name, c2.name) AS client_name FROM sales s
       LEFT JOIN clients c ON c.id = s.client_id
       LEFT JOIN bans b ON b.ban_number = s.ban_number
       LEFT JOIN clients c2 ON c2.id = b.client_id
      WHERE ($1::date IS NULL OR s.sale_date >= $1)
        AND ($2::date IS NULL OR s.sale_date <= $2)
        AND ($3::text IS NULL OR s.vendor_name ILIKE $3)
      ORDER BY s.sale_date DESC NULLS LAST`,
    [desde || null, hasta || null, soloVendedor ? req.user.nombre : null]
  );
  res.json(rows.rows);
});

// PATCH /api/sales/:id  -> editar SOLO la comisión del vendedor (regla #20)
salesRouter.patch('/:id', requireAuth, async (req, res) => {
  const { vendor_commission } = req.body || {};
  const r = await query(
    `UPDATE sales SET vendor_commission = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [vendor_commission === '' ? null : vendor_commission, req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Venta no existe' });
  res.json(r.rows[0]);
});

// POST /api/sales/:id/pay  -> marcar "Pagar al vendedor" (solo admin/supervisor, regla #22)
salesRouter.post('/:id/pay', requireAuth, requireAdmin, async (req, res) => {
  const r = await query(
    `UPDATE sales SET paid = NOT paid, paid_at = now(), paid_by = $1 WHERE id = $2 RETURNING *`,
    [req.user.nombre, req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Venta no existe' });
  res.json(r.rows[0]);
});
