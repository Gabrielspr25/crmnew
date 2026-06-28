// Clientes con DATA REAL de crm_pro (schema public).
// Reusa la lógica PROBADA del sistema viejo (clientController.getClients),
// ordenada en un solo lugar. NADA de data demo.
//
// Importante: el pool del sistema nuevo arranca con search_path = ventaspro_nuevo.
// Acá forzamos `SET search_path TO public` en la conexión para leer las tablas reales
// (clients, bans, subscribers, follow_up_prospects, salespeople) sin tener que
// calificar cada tabla.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const clientsRealRouter = Router();

// ---- Definiciones de cada "tarjeta" (copiadas del sistema viejo, ya validadas) ----
const VALID_CLIENT_NAME_SQL = `(c.name IS NOT NULL AND c.name <> '' AND c.name <> 'NULL')`;
// "En seguimiento" visual = follow_up_prospects activo + cliente valido + BAN.
const ACTIVE_FOLLOW_UP_EXISTS_SQL = `
  EXISTS (
    SELECT 1
    FROM follow_up_prospects f
    WHERE f.client_id = c.id
      AND f.completed_date IS NULL
      AND COALESCE(f.is_active::text, 'true') IN ('true', '1', 't')
  )`;
const ACTIVE_CLIENT_RELATION_SQL = `
  EXISTS (SELECT 1 FROM bans b
          WHERE b.client_id = c.id
            AND COALESCE(LOWER(b.status::text),'') IN ('a','activo','active')
            AND (NOT EXISTS (SELECT 1 FROM subscribers s_any WHERE s_any.ban_id = b.id)
                 OR EXISTS (SELECT 1 FROM subscribers s WHERE s.ban_id = b.id
                            AND COALESCE(LOWER(s.status::text),'activo')
                                NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora'))))`;
const PYMES_CLIENT_SQL = `
  EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id
          AND LOWER(COALESCE(b.account_type,'')) LIKE '%pyme%')`;
const INCOMPLETE_CLIENT_SQL = `((c.name IS NULL OR c.name='' OR c.name='NULL') OR (${PYMES_CLIENT_SQL}))`;
const ACTIVE_CLIENT_SQL = `(${VALID_CLIENT_NAME_SQL} AND ${ACTIVE_CLIENT_RELATION_SQL} AND NOT (${ACTIVE_FOLLOW_UP_EXISTS_SQL}))`;
const FOLLOWING_CLIENT_SQL = `(
  COALESCE(NULLIF(TRIM(c.name),''), NULLIF(TRIM(c.business_name),'')) IS NOT NULL
  AND ${ACTIVE_FOLLOW_UP_EXISTS_SQL}
  AND EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id))`;
const CANCELLED_CLIENT_SQL = `(
  ${VALID_CLIENT_NAME_SQL}
  AND EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
  AND NOT (${ACTIVE_CLIENT_RELATION_SQL}))`;
const ACTIVE_SUB_STATUS = (a) => `COALESCE(LOWER(${a}.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;

// ---- Clasificación de líneas por familia (texto libre del viejo) ----
const fixedSql = `(LOWER(COALESCE(l.account_type,'')) LIKE '%fijo%'
  OR (LOWER(COALESCE(l.account_type,'')) LIKE '%converg%' AND COALESCE(LOWER(l.line_kind::text),'') LIKE '%fijo%'))`;
const mplsSql = `(LOWER(COALESCE(l.account_type,'')) LIKE '%mpls%' OR COALESCE(LOWER(l.line_kind::text),'') LIKE '%mpls%')`;
const mobileSql = `(LOWER(COALESCE(l.account_type,'')) LIKE '%movil%' OR LOWER(COALESCE(l.account_type,'')) LIKE '%móvil%'
  OR LOWER(COALESCE(l.account_type,'')) LIKE '%mobile%'
  OR (LOWER(COALESCE(l.account_type,'')) LIKE '%converg%'
      AND (COALESCE(LOWER(l.line_kind::text),'') LIKE '%movil%' OR COALESCE(LOWER(l.line_kind::text),'') LIKE '%móvil%' OR COALESCE(LOWER(l.line_kind::text),'') LIKE '%mobile%')))`;
const tvSql = `(LOWER(COALESCE(l.account_type,'')) LIKE '%claro tv%' OR LOWER(COALESCE(l.account_type,'')) LIKE '%clarotv%'
  OR COALESCE(LOWER(l.line_kind::text),'') LIKE '%claro tv%' OR COALESCE(LOWER(l.line_kind::text),'') LIKE '%clarotv%')`;
const cloudSql = `(LOWER(COALESCE(l.account_type,'')) LIKE '%cloud%' OR COALESCE(LOWER(l.line_kind::text),'') LIKE '%cloud%')`;
const incompleteSql = `(NOT ${mobileSql} AND NOT ${fixedSql} AND NOT ${mplsSql} AND NOT ${tvSql} AND NOT ${cloudSql})`;

const lineMetricJson = (tabCond) => `(
  SELECT json_build_object(
    'active_lines_count', COUNT(l.subscriber_id)::int,
    'mobile_lines',  COUNT(*) FILTER (WHERE ${mobileSql})::int,
    'fixed_lines',   COUNT(*) FILTER (WHERE ${fixedSql})::int,
    'fixed_monthly_value', COALESCE(SUM(CASE WHEN ${fixedSql} THEN COALESCE(l.monthly_value,0) ELSE 0 END),0)::numeric,
    'mpls_lines',    COUNT(*) FILTER (WHERE ${mplsSql})::int,
    'claro_tv_lines',COUNT(*) FILTER (WHERE ${tvSql})::int,
    'cloud_lines',   COUNT(*) FILTER (WHERE ${cloudSql})::int,
    'incomplete_lines', COUNT(*) FILTER (WHERE ${incompleteSql})::int)
  FROM scoped_lines l JOIN clients c ON c.id = l.client_id WHERE ${tabCond})`;

// GET /api/clients-real?tab=active|cancelled|following|incomplete&q=texto
clientsRealRouter.get('/clients-real', requireAuth, async (req, res) => {
  const { tab, q } = req.query;
  const conds = [];
  const params = [];
  if (tab === 'cancelled') conds.push(CANCELLED_CLIENT_SQL);
  else if (tab === 'following') conds.push(FOLLOWING_CLIENT_SQL);
  else if (tab === 'incomplete') conds.push(INCOMPLETE_CLIENT_SQL);
  else conds.push(ACTIVE_CLIENT_SQL); // default = activos
  if (q && q.trim()) { params.push(`%${q.trim()}%`); conds.push(`c.name ILIKE $${params.length}`); }
  const whereClause = 'WHERE ' + conds.join(' AND ');

  const conn = await pool.connect();
  try {
    // SET LOCAL solo dura la transacción y se revierte al COMMIT/ROLLBACK,
    // así NO contamina la conexión cuando vuelve al pool (bug aprendido).
    await conn.query('BEGIN');
    await conn.query('SET LOCAL search_path TO public'); // leer tablas REALES

    const clients = await conn.query(
      `SELECT c.id, c.name, c.business_name, c.company, c.phone, c.mobile, c.cellular,
              c.city, c.source AS base, c.created_at, c.salesperson_id,
        (SELECT COUNT(*) FROM bans b WHERE b.client_id=c.id) AS ban_count,
        (SELECT COUNT(*) FROM bans b WHERE b.client_id=c.id AND COALESCE(LOWER(b.status::text),'') IN ('a','activo','active')) AS active_ban_count,
        (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id=b.id WHERE b.client_id=c.id AND ${ACTIVE_SUB_STATUS('s')}) AS active_subscriber_count,
        (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id=b.id WHERE b.client_id=c.id) AS subscriber_count,
        (SELECT string_agg(CAST(b.ban_number AS text), ', ') FROM bans b WHERE b.client_id=c.id) AS ban_numbers,
        (SELECT s.phone FROM subscribers s JOIN bans b ON s.ban_id=b.id WHERE b.client_id=c.id
           AND ${ACTIVE_SUB_STATUS('s')} ORDER BY s.contract_end_date ASC NULLS LAST LIMIT 1) AS primary_subscriber_phone,
        (SELECT MIN(s.contract_end_date) FROM subscribers s JOIN bans b ON s.ban_id=b.id
           WHERE b.client_id=c.id AND s.contract_end_date IS NOT NULL AND ${ACTIVE_SUB_STATUS('s')}) AS primary_contract_end_date,
        (SELECT b.account_type FROM bans b WHERE b.client_id=c.id AND COALESCE(LOWER(b.status::text),'') IN ('a','activo','active') LIMIT 1) AS primary_service_type,
        (SELECT string_agg(DISTINCT b.account_type, ', ') FROM bans b WHERE b.client_id=c.id AND b.account_type IS NOT NULL) AS all_service_types,
        sp.name AS vendor_name,
        (SELECT MAX(GREATEST(COALESCE(s2.updated_at,s2.created_at), COALESCE(b2.updated_at,b2.created_at)))
           FROM subscribers s2 JOIN bans b2 ON s2.ban_id=b2.id WHERE b2.client_id=c.id) AS last_activity
       FROM clients c
       LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
       ${whereClause}
       ORDER BY primary_contract_end_date ASC NULLS LAST, c.created_at DESC`,
      params);

    const stats = await conn.query(
      `WITH scoped_lines AS (
         SELECT c.id AS client_id, s_metric.id AS subscriber_id, s_metric.line_kind,
                s_metric.monthly_value, s_metric.contract_end_date, b_metric.account_type
         FROM clients c
         JOIN bans b_metric ON b_metric.client_id = c.id
         JOIN subscribers s_metric ON s_metric.ban_id = b_metric.id
         WHERE ${ACTIVE_SUB_STATUS('s_metric')})
       SELECT
        (SELECT COUNT(l.subscriber_id)::int FROM scoped_lines l JOIN clients c ON c.id=l.client_id WHERE ${ACTIVE_CLIENT_SQL})    AS active_count,
        (SELECT COUNT(l.subscriber_id)::int FROM scoped_lines l JOIN clients c ON c.id=l.client_id WHERE ${CANCELLED_CLIENT_SQL}) AS cancelled_count,
        (SELECT COUNT(l.subscriber_id)::int FROM scoped_lines l JOIN clients c ON c.id=l.client_id WHERE ${FOLLOWING_CLIENT_SQL}) AS following_count,
        (SELECT COUNT(l.subscriber_id)::int FROM scoped_lines l JOIN clients c ON c.id=l.client_id WHERE ${INCOMPLETE_CLIENT_SQL}) AS incomplete_count,
        json_build_object(
          'active',     ${lineMetricJson(ACTIVE_CLIENT_SQL)},
          'cancelled',  ${lineMetricJson(CANCELLED_CLIENT_SQL)},
          'following',  ${lineMetricJson(FOLLOWING_CLIENT_SQL)},
          'incomplete', ${lineMetricJson(INCOMPLETE_CLIENT_SQL)}) AS line_metrics`);

    await conn.query('COMMIT');
    res.json({ clients: clients.rows, stats: stats.rows[0] });
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch {}
    console.error('[clients-real]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// FICHA del cliente con data REAL (cliente + BANs + suscriptores)
clientsRealRouter.get('/clients-real/:id', requireAuth, async (req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('SET LOCAL search_path TO public');
    const c = await conn.query(
      `SELECT c.id, c.name, c.business_name, c.company, c.email,
              c.phone, c.additional_phone, c.mobile, c.cellular,
              c.address, c.city, c.zip_code, c.source AS base, c.created_at,
              c.pendiente_validacion, c.salesperson_id, sp.name AS vendor_name,
              (SELECT so.id FROM sales_opportunities so
                 WHERE so.client_id = c.id AND so.archived_at IS NULL
                 ORDER BY so.created_at DESC LIMIT 1) AS opportunity_id
         FROM clients c LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
        WHERE c.id = $1`, [req.params.id]);
    if (!c.rows[0]) { await conn.query('ROLLBACK'); return res.status(404).json({ error: 'Cliente no existe' }); }
    const bans = await conn.query(
      `SELECT id, ban_number, account_type, status FROM bans WHERE client_id = $1 ORDER BY ban_number`, [req.params.id]);
    const subs = await conn.query(
      `SELECT s.id, s.phone, s.plan, s.monthly_value, s.status, s.line_kind, s.line_type,
              s.contract_end_date, s.equipment, b.ban_number, b.id AS ban_id
         FROM subscribers s JOIN bans b ON b.id = s.ban_id
        WHERE b.client_id = $1 ORDER BY b.ban_number, s.phone`, [req.params.id]);
    // Ventas del cliente = sus comisiones (Tango)
    const ventas = await conn.query(
      `SELECT b.ban_number, s.phone, to_char(sr.report_month,'YYYY-MM') AS mes,
              s.monthly_value, sr.company_earnings, sr.vendor_commission, sr.validation_status
         FROM subscriber_reports sr
         JOIN subscribers s ON s.id = sr.subscriber_id
         JOIN bans b ON b.id = s.ban_id
        WHERE b.client_id = $1
        ORDER BY sr.report_month DESC, b.ban_number`, [req.params.id]);
    // Historial de gestiones = bitácora de Asana de las oportunidades del cliente
    let historial = [];
    const hasNotes = await conn.query(`SELECT to_regclass('public.opportunity_notes') AS t`);
    if (hasNotes.rows[0].t) {
      const h = await conn.query(
        `SELECT n.note, n.product_key, n.step_name, n.created_by_username, n.created_at
           FROM opportunity_notes n
           JOIN sales_opportunities o ON o.id = n.opportunity_id
          WHERE o.client_id = $1
          ORDER BY n.created_at DESC`, [req.params.id]);
      historial = h.rows;
    }
    await conn.query('COMMIT');
    res.json({ ...c.rows[0], bans: bans.rows, subscribers: subs.rows, ventas: ventas.rows, historial });
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch {}
    console.error('[clients-real/:id]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});
