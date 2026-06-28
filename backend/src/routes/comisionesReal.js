// Comisiones con DATA REAL de crm_pro (subscriber_reports = lo sincronizado de Tango).
// Lee del schema public (real), por eso califica las tablas con public.*
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const comisionesRouter = Router();

const BASE = `
  SELECT sr.subscriber_id, to_char(sr.report_month,'YYYY-MM-DD') AS report_month,
         cl.name AS empresa, COALESCE(sp.name,'—') AS vendedor,
         b.ban_number, s.phone, s.monthly_value,
         CASE WHEN s.line_kind='fijo'  AND s.line_type='REN' THEN 'fijo_ren'
              WHEN s.line_kind='fijo'  THEN 'fijo_new'
              WHEN s.line_kind='movil' AND s.line_type='REN' THEN 'movil_ren'
              WHEN s.line_kind='movil' THEN 'movil_new'
              WHEN s.line_kind='tv'    THEN 'claro_tv'
              WHEN s.line_kind='cloud' THEN 'cloud'
              WHEN s.line_kind='mpls'  THEN 'mpls'
              ELSE COALESCE(s.line_kind,'otro') END AS product_key,
         sr.company_earnings, sr.vendor_commission, sr.portability_bonus,
         sr.validation_status, (COALESCE(sr.paid_amount,0) > 0) AS paid
    FROM public.subscriber_reports sr
    JOIN public.subscribers s ON s.id = sr.subscriber_id
    JOIN public.bans b        ON b.id = s.ban_id
    JOIN public.clients cl    ON cl.id = b.client_id
    LEFT JOIN public.salespeople sp ON sp.id = cl.salesperson_id`;

// GET /api/comisiones?month=YYYY-MM-01  (si no hay month, usa el último mes con datos)
comisionesRouter.get('/comisiones', requireAuth, async (req, res) => {
  const { month } = req.query;
  const soloV = req.user.rol === 'vendedor';
  const r = await query(
    `${BASE}
      WHERE date_trunc('month', sr.report_month) =
            COALESCE(date_trunc('month', $1::date),
                     (SELECT max(date_trunc('month', report_month)) FROM public.subscriber_reports))
        AND ($2::text IS NULL OR sp.name ILIKE $2)
      ORDER BY cl.name, b.ban_number`,
    [month || null, soloV ? `%${req.user.nombre}%` : null]);
  res.json(r.rows);
});

// Meses disponibles (para el selector)
comisionesRouter.get('/comisiones/meses', requireAuth, async (_req, res) => {
  const r = await query(
    `SELECT to_char(date_trunc('month',report_month),'YYYY-MM-01') AS mes, count(*)::int AS n
       FROM public.subscriber_reports GROUP BY 1 ORDER BY 1 DESC`);
  res.json(r.rows);
});

// Vendedores que vienen de Tango (los del campo vendedor de las comisiones) — REGLA: vendedores de Tango
comisionesRouter.get('/vendedores', requireAuth, async (_req, res) => {
  const r = await query(
    `SELECT DISTINCT sp.name
       FROM public.subscriber_reports sr
       JOIN public.subscribers s ON s.id = sr.subscriber_id
       JOIN public.bans b        ON b.id = s.ban_id
       JOIN public.clients cl     ON cl.id = b.client_id
       JOIN public.salespeople sp ON sp.id = cl.salesperson_id
      WHERE NULLIF(TRIM(sp.name),'') IS NOT NULL
      ORDER BY sp.name`);
  res.json(r.rows.map((x) => x.name));
});

// PATCH /api/comisiones/:subId/:month  { vendor_commission }  -> edita SOLO comisión vendedor
comisionesRouter.patch('/comisiones/:subId/:month', requireAuth, async (req, res) => {
  const { vendor_commission } = req.body || {};
  const r = await query(
    `UPDATE public.subscriber_reports SET vendor_commission = $1, updated_at = now()
      WHERE subscriber_id = $2 AND date_trunc('month',report_month) = date_trunc('month',$3::date)
      RETURNING vendor_commission`,
    [vendor_commission === '' ? null : vendor_commission, req.params.subId, req.params.month]);
  if (!r.rows[0]) return res.status(404).json({ error: 'No existe' });
  res.json(r.rows[0]);
});

// POST /api/comisiones/:subId/:month/pay  -> marcar pagado (admin/supervisor)
comisionesRouter.post('/comisiones/:subId/:month/pay', requireAuth, requireAdmin, async (req, res) => {
  const r = await query(
    `UPDATE public.subscriber_reports
        SET paid_amount = CASE WHEN COALESCE(paid_amount,0)>0 THEN 0 ELSE vendor_commission END,
            paid_date = now()
      WHERE subscriber_id = $1 AND date_trunc('month',report_month) = date_trunc('month',$2::date)
      RETURNING (COALESCE(paid_amount,0)>0) AS paid`,
    [req.params.subId, req.params.month]);
  if (!r.rows[0]) return res.status(404).json({ error: 'No existe' });
  res.json(r.rows[0]);
});
