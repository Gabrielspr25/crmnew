import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const reportsAiRouter = Router();

const blockedSqlPattern = /\b(select|insert|update|delete|drop|alter|truncate|grant|revoke|copy|create)\b|--|\/\*|\*\/|;/i;

function normalizeQuestion(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function detectReportIntent(question) {
  const q = normalizeQuestion(question);
  if (!q) return null;
  if (blockedSqlPattern.test(q)) return { blocked: true };
  if (/gpon|fibra|aumento/.test(q)) return { key: 'fixed_gpon' };
  if (/vencid|renovar|renovacion|renovaciones/.test(q)) return { key: 'renewals' };
  if (/convergen/.test(q)) return { key: 'convergence' };
  if (/movil|mobile|celular/.test(q)) return { key: 'mobile' };
  if (/fijo|internet|telefono|linea fija/.test(q)) return { key: 'fixed' };
  return { key: 'general' };
}

const lineKindExpr = `LOWER(COALESCE(s.line_kind::text,
  CASE UPPER(COALESCE(s.product_type::text,''))
    WHEN 'G' THEN 'movil'
    WHEN 'O' THEN 'fijo'
    WHEN 'T' THEN 'fijo'
    WHEN 'V' THEN 'fijo'
    WHEN 'K' THEN 'cloud'
  END,
  ''))`;

const baseSelect = `
  SELECT
    c.id AS client_id,
    COALESCE(NULLIF(c.business_name,''), NULLIF(c.name,''), 'Sin nombre') AS cliente,
    c.email,
    b.ban_number,
    s.phone,
    s.plan,
    s.price_code,
    COALESCE(s.monthly_value,0)::numeric AS monthly_value,
    to_char(s.contract_end_date,'YYYY-MM-DD') AS contract_end_date,
    ${lineKindExpr} AS line_kind,
    gr.gpon_applies,
    gr.gpon_note,
    gr.reviewed_at AS gpon_reviewed_at
  FROM public.subscribers s
  JOIN public.bans b ON b.id = s.ban_id
  JOIN public.clients c ON c.id = b.client_id
  LEFT JOIN public.subscriber_gpon_reviews gr ON gr.subscriber_id = s.id
`;

const activeWhere = `COALESCE(LOWER(s.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;

const reportQueries = {
  fixed_gpon: {
    title: 'Fijos GPON / aumento',
    where: `${activeWhere} AND ${lineKindExpr} = 'fijo'`,
    order: `gr.reviewed_at NULLS FIRST, COALESCE(s.monthly_value,0) DESC, c.business_name NULLS LAST`,
    summary: 'Lineas fijas activas con revision GPON/aumento, priorizando las no revisadas y mayor renta.',
  },
  renewals: {
    title: 'Lineas vencidas o proximas a renovar',
    where: `${activeWhere} AND (s.contract_end_date IS NULL OR s.contract_end_date <= CURRENT_DATE + INTERVAL '30 days')`,
    order: `s.contract_end_date NULLS FIRST, COALESCE(s.monthly_value,0) DESC`,
    summary: 'Lineas activas sin fecha, vencidas o dentro de 30 dias.',
  },
  convergence: {
    title: 'Clientes convergentes',
    where: `${activeWhere} AND EXISTS (
      SELECT 1 FROM public.bans bm JOIN public.subscribers sm ON sm.ban_id = bm.id
      WHERE bm.client_id = c.id AND COALESCE(LOWER(sm.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')
        AND LOWER(COALESCE(sm.line_kind::text, CASE UPPER(COALESCE(sm.product_type::text,'')) WHEN 'G' THEN 'movil' END, '')) = 'movil'
    ) AND EXISTS (
      SELECT 1 FROM public.bans bf JOIN public.subscribers sf ON sf.ban_id = bf.id
      WHERE bf.client_id = c.id AND COALESCE(LOWER(sf.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')
        AND LOWER(COALESCE(sf.line_kind::text, CASE UPPER(COALESCE(sf.product_type::text,'')) WHEN 'O' THEN 'fijo' WHEN 'T' THEN 'fijo' WHEN 'V' THEN 'fijo' END, '')) = 'fijo'
    )`,
    order: `c.business_name NULLS LAST, b.ban_number, s.phone`,
    summary: 'Lineas activas de clientes que tienen movil y fijo activos.',
  },
  mobile: {
    title: 'Lineas moviles activas',
    where: `${activeWhere} AND ${lineKindExpr} = 'movil'`,
    order: `COALESCE(s.monthly_value,0) DESC, c.business_name NULLS LAST`,
    summary: 'Lineas moviles activas ordenadas por renta mensual.',
  },
  fixed: {
    title: 'Lineas fijas activas',
    where: `${activeWhere} AND ${lineKindExpr} = 'fijo'`,
    order: `COALESCE(s.monthly_value,0) DESC, c.business_name NULLS LAST`,
    summary: 'Lineas fijas activas ordenadas por renta mensual.',
  },
  general: {
    title: 'Resumen general de lineas activas',
    where: activeWhere,
    order: `COALESCE(s.monthly_value,0) DESC, c.business_name NULLS LAST`,
    summary: 'Lineas activas del CRM segun la pregunta recibida.',
  },
};

reportsAiRouter.post('/reports-ai/query', requireAuth, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const intent = detectReportIntent(question);
  if (!intent) return res.status(400).json({ error: 'Escribe una pregunta de reporte.' });
  if (intent.blocked) return res.status(400).json({ error: 'La caja de reportes solo acepta preguntas, no SQL ni comandos.' });

  const report = reportQueries[intent.key] || reportQueries.general;
  const limit = Math.min(Math.max(Number(req.body?.limit) || 50, 1), 200);
  try {
    const result = await pool.query(
      `${baseSelect}
        WHERE ${report.where}
        ORDER BY ${report.order}
        LIMIT $1`,
      [limit],
    );
    res.json({
      ok: true,
      question,
      intent: intent.key,
      title: report.title,
      summary: report.summary,
      count: result.rowCount,
      rows: result.rows.map((row) => ({
        cliente: row.cliente,
        email: row.email,
        ban_number: row.ban_number,
        phone: row.phone,
        plan: row.plan,
        price_code: row.price_code,
        monthly_value: row.monthly_value,
        contract_end_date: row.contract_end_date,
        line_kind: row.line_kind,
        gpon_applies: row.gpon_applies,
        gpon_note: row.gpon_note,
        gpon_reviewed_at: row.gpon_reviewed_at,
      })),
    });
  } catch (error) {
    console.error('[reports-ai/query]', error.message);
    res.status(500).json({ error: 'No se pudo generar el reporte.' });
  }
});
