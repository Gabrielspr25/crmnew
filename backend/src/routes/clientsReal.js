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
// "En seguimiento" visual = oportunidad activa en Asana/SOV2.
const ACTIVE_FOLLOW_UP_EXISTS_SQL = `
  EXISTS (
    SELECT 1
    FROM sales_opportunities so
    WHERE so.client_id = c.id
      AND so.archived_at IS NULL
      AND COALESCE(LOWER(so.status),'activa') = 'activa'
  )`;
const ACTIVE_SUB_STATUS = (a) => `COALESCE(LOWER(${a}.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;
const ACTIVE_CLIENT_RELATION_SQL = `
  EXISTS (SELECT 1 FROM bans b
          WHERE b.client_id = c.id
            AND COALESCE(LOWER(b.status::text),'') IN ('a','activo','active')
            AND (NOT EXISTS (SELECT 1 FROM subscribers s_any WHERE s_any.ban_id = b.id)
                 OR EXISTS (SELECT 1 FROM subscribers s WHERE s.ban_id = b.id
                             AND ${ACTIVE_SUB_STATUS('s')})))`;
const MISSING_CLIENT_IDENTITY_SQL = `(
  (NULLIF(TRIM(COALESCE(c.name,'')),'') IS NULL OR c.name ILIKE 'SIN NOMBRE - BAN %')
  AND (NULLIF(TRIM(COALESCE(c.business_name,'')),'') IS NULL OR c.business_name ILIKE 'SIN NOMBRE - BAN %')
)`;
const INCOMPLETE_CLIENT_SQL = `(
  ${MISSING_CLIENT_IDENTITY_SQL}
  AND EXISTS (
    SELECT 1
    FROM bans b_incomplete
    JOIN subscribers s_incomplete ON s_incomplete.ban_id = b_incomplete.id
    WHERE b_incomplete.client_id = c.id
      AND COALESCE(LOWER(b_incomplete.status::text),'') IN ('a','activo','active')
      AND ${ACTIVE_SUB_STATUS('s_incomplete')}
  )
)`;
const ACTIVE_CLIENT_SQL = `(${VALID_CLIENT_NAME_SQL} AND ${ACTIVE_CLIENT_RELATION_SQL} AND NOT (${ACTIVE_FOLLOW_UP_EXISTS_SQL}) AND NOT (${INCOMPLETE_CLIENT_SQL}))`;
const FOLLOWING_CLIENT_SQL = `(${ACTIVE_FOLLOW_UP_EXISTS_SQL} AND NOT (${INCOMPLETE_CLIENT_SQL}))`;
const CANCELLED_CLIENT_SQL = `(
  EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
  AND NOT (${ACTIVE_CLIENT_RELATION_SQL}))`;
const ALL_CLIENT_SQL = `((${ACTIVE_CLIENT_SQL}) OR (${CANCELLED_CLIENT_SQL}) OR (${FOLLOWING_CLIENT_SQL}) OR (${INCOMPLETE_CLIENT_SQL}))`;
const EMPTY_DUPLICATE_CLIENT_SQL = `(
  NOT EXISTS (SELECT 1 FROM bans b_empty WHERE b_empty.client_id = c.id)
  AND EXISTS (
    SELECT 1
    FROM clients c2
    WHERE c2.id <> c.id
      AND lower(trim(COALESCE(NULLIF(c2.business_name,''), NULLIF(c2.name,''), ''))) =
          lower(trim(COALESCE(NULLIF(c.business_name,''), NULLIF(c.name,''), '')))
      AND EXISTS (SELECT 1 FROM bans b_keep WHERE b_keep.client_id = c2.id)
  )
)`;

// Convergente exige líneas móvil y fijo dentro de los BAN del cliente.
// SOC, precio y account_type no participan en esta clasificación.
const SERVICE_KIND_SQL = (subscriberAlias) => `LOWER(COALESCE(
  NULLIF(${subscriberAlias}.line_kind::text,''),
  CASE UPPER(NULLIF(${subscriberAlias}.product_type::text,''))
    WHEN 'G' THEN 'movil'
    WHEN 'O' THEN 'fijo'
    WHEN 'T' THEN 'fijo'
    WHEN 'V' THEN 'fijo'
    WHEN 'K' THEN 'cloud'
  END,
  ''
))`;
const SERVICE_MOBILE_SQL = (subscriberAlias) => `${SERVICE_KIND_SQL(subscriberAlias)} = 'movil'`;
const SERVICE_FIXED_SQL = (subscriberAlias) => `${SERVICE_KIND_SQL(subscriberAlias)} = 'fijo'`;
const REN_LINE_SQL = (subscriberAlias) => `UPPER(COALESCE(${subscriberAlias}.line_type::text,'')) IN ('REN','RENEWAL','RENOVACION','RENOVACIÓN')`;
const CLIENT_PRODUCT_COUNT_SQL = (subscriberAlias, condition) => `(SELECT COUNT(*)::int
          FROM subscribers ${subscriberAlias} JOIN bans b_${subscriberAlias} ON ${subscriberAlias}.ban_id=b_${subscriberAlias}.id
         WHERE b_${subscriberAlias}.client_id=c.id AND ${ACTIVE_SUB_STATUS(subscriberAlias)} AND ${condition})`;
const SERVICE_CLIENT_SQL = {
  movil: `(EXISTS (SELECT 1 FROM bans b_service JOIN subscribers s_service ON s_service.ban_id=b_service.id
                    WHERE b_service.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_service')}
                      AND ${SERVICE_MOBILE_SQL('s_service')})
            AND NOT EXISTS (SELECT 1 FROM bans b_service JOIN subscribers s_service ON s_service.ban_id=b_service.id
                            WHERE b_service.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_service')}
                              AND ${SERVICE_FIXED_SQL('s_service')}))`,
  fijo: `(EXISTS (SELECT 1 FROM bans b_service JOIN subscribers s_service ON s_service.ban_id=b_service.id
                   WHERE b_service.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_service')}
                      AND ${SERVICE_FIXED_SQL('s_service')})
           AND NOT EXISTS (SELECT 1 FROM bans b_service JOIN subscribers s_service ON s_service.ban_id=b_service.id
                           WHERE b_service.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_service')}
                              AND ${SERVICE_MOBILE_SQL('s_service')}))`,
  convergente: `(EXISTS (SELECT 1 FROM bans b_service JOIN subscribers s_service ON s_service.ban_id=b_service.id
                          WHERE b_service.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_service')}
                            AND ${SERVICE_MOBILE_SQL('s_service')})
                  AND EXISTS (SELECT 1 FROM bans b_service JOIN subscribers s_service ON s_service.ban_id=b_service.id
                              WHERE b_service.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_service')}
                                AND ${SERVICE_FIXED_SQL('s_service')}))`,
};

const serviceCountsJson = () => `(
  SELECT json_build_object(
    'todas', COUNT(*)::int,
    'movil', COUNT(*) FILTER (WHERE ${SERVICE_CLIENT_SQL.movil})::int,
    'fijo', COUNT(*) FILTER (WHERE ${SERVICE_CLIENT_SQL.fijo})::int,
    'convergente', COUNT(*) FILTER (WHERE ${SERVICE_CLIENT_SQL.convergente})::int)
  FROM clients c
  WHERE ${ACTIVE_CLIENT_SQL})`;

// Las tarjetas miden la línea importada. PRODUCT_TYPE respalda line_kind histórico.
const LINE_KIND_SQL = (alias) => SERVICE_KIND_SQL(alias);
const fixedSql = (alias) => `(${LINE_KIND_SQL(alias)} = 'fijo')`;
const mplsSql = (alias) => `(${LINE_KIND_SQL(alias)} = 'mpls')`;
const mobileSql = (alias) => `(${LINE_KIND_SQL(alias)} = 'movil')`;
const tvSql = (alias) => `(${LINE_KIND_SQL(alias)} IN ('claro tv','clarotv','tv'))`;
const cloudSql = (alias) => `(${LINE_KIND_SQL(alias)} = 'cloud')`;
const incompleteSql = (alias) => `(NOT ${mobileSql(alias)} AND NOT ${fixedSql(alias)} AND NOT ${mplsSql(alias)} AND NOT ${tvSql(alias)} AND NOT ${cloudSql(alias)})`;

const RENEWAL_CLIENT_SQL = {
  expired: `(EXISTS (SELECT 1 FROM bans b_renewal JOIN subscribers s_renewal ON s_renewal.ban_id=b_renewal.id
                      WHERE b_renewal.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_renewal')}
                        AND s_renewal.contract_end_date < CURRENT_DATE))`,
  upcoming: `(EXISTS (SELECT 1 FROM bans b_renewal JOIN subscribers s_renewal ON s_renewal.ban_id=b_renewal.id
                       WHERE b_renewal.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_renewal')}
                         AND s_renewal.contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'))`,
  missing: `(EXISTS (SELECT 1 FROM bans b_renewal JOIN subscribers s_renewal ON s_renewal.ban_id=b_renewal.id
                      WHERE b_renewal.client_id=c.id AND ${ACTIVE_SUB_STATUS('s_renewal')}
                        AND s_renewal.contract_end_date IS NULL))`,
};

const lineMetricJson = (tabCond) => `(
  SELECT json_build_object(
    'active_lines_count', COUNT(l.subscriber_id)::int,
    'mobile_lines',  COUNT(*) FILTER (WHERE ${mobileSql('l')})::int,
    'mobile_monthly_value', COALESCE(SUM(CASE WHEN ${mobileSql('l')} THEN COALESCE(l.monthly_value,0) ELSE 0 END),0)::numeric,
    'fixed_lines',   COUNT(*) FILTER (WHERE ${fixedSql('l')})::int,
    'fixed_monthly_value', COALESCE(SUM(CASE WHEN ${fixedSql('l')} THEN COALESCE(l.monthly_value,0) ELSE 0 END),0)::numeric,
    'suspended_lines', COUNT(*) FILTER (WHERE COALESCE(LOWER(l.line_status::text),'') IN ('s','suspendido','suspended'))::int,
    'mpls_lines',    COUNT(*) FILTER (WHERE ${mplsSql('l')})::int,
    'claro_tv_lines',COUNT(*) FILTER (WHERE ${tvSql('l')})::int,
    'cloud_lines',   COUNT(*) FILTER (WHERE ${cloudSql('l')})::int,
    'incomplete_lines', COUNT(*) FILTER (WHERE ${incompleteSql('l')})::int)
  FROM scoped_lines l JOIN clients c ON c.id = l.client_id WHERE ${tabCond})`;

// GET /api/clients-real?tab=all|active|cancelled|following|incomplete&q=texto
clientsRealRouter.get('/clients-real', requireAuth, async (req, res) => {
  const { tab, q, service, renewal } = req.query;
  // Durante la búsqueda solo cambia la tabla. Las tarjetas globales se mantienen
  // desde la última carga completa y no se recalculan por cada tecla.
  const includeStats = String(req.query.summary || '1') !== '0';
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const per = Math.min(100, Math.max(1, parseInt(String(req.query.per || '50'), 10) || 50));
  const offset = (page - 1) * per;
  const conds = [];
  const params = [];
  const hasSearch = Boolean(q && q.trim());
  if (hasSearch) {
    conds.push(ALL_CLIENT_SQL);
    params.push(`%${q.trim()}%`);
    conds.push(`(
      c.name ILIKE $${params.length}
      OR c.business_name ILIKE $${params.length}
      OR c.owner_name ILIKE $${params.length}
      OR c.contact_person ILIKE $${params.length}
      OR c.email ILIKE $${params.length}
      OR CAST(c.phone AS text) ILIKE $${params.length}
      OR CAST(c.cellular AS text) ILIKE $${params.length}
      OR EXISTS (SELECT 1 FROM bans bq WHERE bq.client_id = c.id AND CAST(bq.ban_number AS text) ILIKE $${params.length})
      OR EXISTS (SELECT 1 FROM subscribers sq JOIN bans bqs ON sq.ban_id = bqs.id WHERE bqs.client_id = c.id AND CAST(sq.phone AS text) ILIKE $${params.length})
    )`);
    conds.push(`NOT (${EMPTY_DUPLICATE_CLIENT_SQL})`);
  } else if (tab === 'all') {
    conds.push(ALL_CLIENT_SQL);
  } else if (tab === 'cancelled') {
    conds.push(CANCELLED_CLIENT_SQL);
  } else if (tab === 'following') {
    conds.push(FOLLOWING_CLIENT_SQL);
  } else if (tab === 'incomplete') {
    conds.push(INCOMPLETE_CLIENT_SQL);
  } else {
    conds.push(ACTIVE_CLIENT_SQL); // default = activos
  }
  if (!hasSearch && SERVICE_CLIENT_SQL[service]) conds.push(SERVICE_CLIENT_SQL[service]);
  if (!hasSearch && tab !== 'cancelled' && RENEWAL_CLIENT_SQL[renewal]) conds.push(RENEWAL_CLIENT_SQL[renewal]);
  const whereClause = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const clientOrderSql = hasSearch || tab === 'all'
    ? 'created_at DESC'
    : tab === 'cancelled'
    ? 'last_activity DESC NULLS LAST, created_at DESC'
    : `CASE
         WHEN primary_contract_end_date < CURRENT_DATE THEN 0
         WHEN primary_contract_end_date IS NOT NULL THEN 1
         ELSE 2
       END,
       active_opportunity_value DESC NULLS LAST,
       primary_contract_end_date ASC NULLS LAST,
        fixed_monthly_value DESC NULLS LAST,
        active_subscriber_count DESC,
        primary_sale_date ASC NULLS LAST,
        created_at DESC`;
  const clientRowsSql = `SELECT c.id, c.name, c.business_name, c.business_name AS company,
              c.email, c.owner_name, c.contact_person,
              c.phone, c.cellular AS mobile, c.cellular,
              c.city, c.source AS base, c.created_at, c.salesperson_id,
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(c.business_name,''), NULLIF(c.name,''), c.id::text)), '\\s+', ' ', 'g')) AS client_group_key,
        (SELECT COUNT(*) FROM bans b WHERE b.client_id=c.id) AS ban_count,
        (SELECT COUNT(*) FROM bans b WHERE b.client_id=c.id AND COALESCE(LOWER(b.status::text),'') IN ('a','activo','active')) AS active_ban_count,
        (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id=b.id WHERE b.client_id=c.id AND ${ACTIVE_SUB_STATUS('s')}) AS active_subscriber_count,
        (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id=b.id WHERE b.client_id=c.id) AS subscriber_count,
        (SELECT string_agg(CAST(b.ban_number AS text), ', ' ORDER BY CAST(b.ban_number AS text)) FROM bans b WHERE b.client_id=c.id) AS ban_numbers,
        (SELECT s.phone FROM subscribers s JOIN bans b ON s.ban_id=b.id WHERE b.client_id=c.id
           AND ${ACTIVE_SUB_STATUS('s')} ORDER BY s.contract_end_date ASC NULLS LAST LIMIT 1) AS primary_subscriber_phone,
        (SELECT MIN(s.contract_end_date) FROM subscribers s JOIN bans b ON s.ban_id=b.id
           WHERE b.client_id=c.id AND s.contract_end_date IS NOT NULL AND ${ACTIVE_SUB_STATUS('s')}) AS primary_contract_end_date,
        (SELECT MIN(COALESCE(s.contract_start_date, s.activation_date)) FROM subscribers s JOIN bans b ON s.ban_id=b.id
           WHERE b.client_id=c.id AND ${ACTIVE_SUB_STATUS('s')}) AS primary_sale_date,
        (SELECT COALESCE(SUM(s.monthly_value) FILTER (WHERE ${fixedSql('s')}),0)::numeric
           FROM subscribers s JOIN bans b ON s.ban_id=b.id
          WHERE b.client_id=c.id AND ${ACTIVE_SUB_STATUS('s')}) AS fixed_monthly_value,
        (SELECT COALESCE(SUM(COALESCE(so.expected_monthly_value,0)),0)::numeric
           FROM sales_opportunities so
          WHERE so.client_id=c.id
            AND so.archived_at IS NULL
            AND COALESCE(LOWER(so.status),'activa') = 'activa') AS active_opportunity_value,
        (SELECT COUNT(*)::int FROM sales_opportunities so
          WHERE so.client_id=c.id AND so.archived_at IS NULL
            AND COALESCE(LOWER(so.status),'activa') = 'activa') AS active_opportunity_count,
        (SELECT b.account_type FROM bans b WHERE b.client_id=c.id AND COALESCE(LOWER(b.status::text),'') IN ('a','activo','active') LIMIT 1) AS primary_service_type,
        (SELECT string_agg(DISTINCT b.account_type, ', ') FROM bans b WHERE b.client_id=c.id AND b.account_type IS NOT NULL) AS all_service_types,
        ${CLIENT_PRODUCT_COUNT_SQL('s_mnew', `${SERVICE_MOBILE_SQL('s_mnew')} AND NOT ${REN_LINE_SQL('s_mnew')}`)} AS mobile_new_count,
        ${CLIENT_PRODUCT_COUNT_SQL('s_mren', `${SERVICE_MOBILE_SQL('s_mren')} AND ${REN_LINE_SQL('s_mren')}`)} AS mobile_ren_count,
        ${CLIENT_PRODUCT_COUNT_SQL('s_fnew', `${SERVICE_FIXED_SQL('s_fnew')} AND NOT ${REN_LINE_SQL('s_fnew')}`)} AS fixed_new_count,
        ${CLIENT_PRODUCT_COUNT_SQL('s_fren', `${SERVICE_FIXED_SQL('s_fren')} AND ${REN_LINE_SQL('s_fren')}`)} AS fixed_ren_count,
        ${CLIENT_PRODUCT_COUNT_SQL('s_tv', `LOWER(COALESCE(s_tv.line_kind::text,'')) IN ('tv','claro tv','clarotv')`)} AS claro_tv_count,
        ${CLIENT_PRODUCT_COUNT_SQL('s_cloud', `${SERVICE_KIND_SQL('s_cloud')} = 'cloud'`)} AS cloud_count,
        ${CLIENT_PRODUCT_COUNT_SQL('s_mpls', `LOWER(COALESCE(s_mpls.line_kind::text,'')) = 'mpls'`)} AS mpls_count,
        sp.name AS vendor_name,
        (SELECT MAX(GREATEST(COALESCE(s2.updated_at,s2.created_at), COALESCE(b2.updated_at,b2.created_at)))
           FROM subscribers s2 JOIN bans b2 ON s2.ban_id=b2.id WHERE b2.client_id=c.id) AS last_activity
        FROM clients c
        LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
        ${whereClause}`;

  const conn = await pool.connect();
  try {
    // SET LOCAL solo dura la transacción y se revierte al COMMIT/ROLLBACK,
    // así NO contamina la conexión cuando vuelve al pool (bug aprendido).
    await conn.query('BEGIN');
    await conn.query('SET LOCAL search_path TO public'); // leer tablas REALES

    const total = await conn.query(
      `WITH client_rows AS (${clientRowsSql})
       SELECT COUNT(*)::int AS total FROM (SELECT client_group_key FROM client_rows GROUP BY client_group_key) grouped_total`,
      params);

    const clients = await conn.query(
      `WITH client_rows AS (${clientRowsSql})
       SELECT
        (array_agg(id ORDER BY created_at DESC))[1] AS id,
        (array_agg(name ORDER BY created_at DESC))[1] AS name,
        (array_agg(business_name ORDER BY created_at DESC))[1] AS business_name,
        (array_agg(company ORDER BY created_at DESC))[1] AS company,
        (array_agg(email ORDER BY created_at DESC))[1] AS email,
        (array_agg(owner_name ORDER BY created_at DESC))[1] AS owner_name,
        (array_agg(contact_person ORDER BY created_at DESC))[1] AS contact_person,
        (array_agg(phone ORDER BY created_at DESC))[1] AS phone,
        (array_agg(mobile ORDER BY created_at DESC))[1] AS mobile,
        (array_agg(cellular ORDER BY created_at DESC))[1] AS cellular,
        (array_agg(city ORDER BY created_at DESC))[1] AS city,
        (array_agg(base ORDER BY created_at DESC))[1] AS base,
        MAX(created_at) AS created_at,
        (array_agg(salesperson_id ORDER BY created_at DESC))[1] AS salesperson_id,
        client_group_key,
        array_agg(id ORDER BY created_at DESC) AS client_ids,
        COUNT(*)::int AS client_record_count,
        SUM(ban_count)::int AS ban_count,
        SUM(active_ban_count)::int AS active_ban_count,
        SUM(active_subscriber_count)::int AS active_subscriber_count,
        SUM(subscriber_count)::int AS subscriber_count,
        string_agg(ban_numbers, ', ' ORDER BY created_at DESC) AS ban_numbers,
        (array_agg(primary_subscriber_phone ORDER BY primary_contract_end_date ASC NULLS LAST))[1] AS primary_subscriber_phone,
        MIN(primary_contract_end_date) AS primary_contract_end_date,
        MIN(primary_sale_date) AS primary_sale_date,
        SUM(fixed_monthly_value)::numeric AS fixed_monthly_value,
        SUM(active_opportunity_value)::numeric AS active_opportunity_value,
        SUM(active_opportunity_count)::int AS active_opportunity_count,
        (array_agg(primary_service_type ORDER BY created_at DESC))[1] AS primary_service_type,
        string_agg(all_service_types, ', ' ORDER BY created_at DESC) AS all_service_types,
        SUM(mobile_new_count)::int AS mobile_new_count,
        SUM(mobile_ren_count)::int AS mobile_ren_count,
        SUM(fixed_new_count)::int AS fixed_new_count,
        SUM(fixed_ren_count)::int AS fixed_ren_count,
        SUM(claro_tv_count)::int AS claro_tv_count,
        SUM(cloud_count)::int AS cloud_count,
        SUM(mpls_count)::int AS mpls_count,
        CASE WHEN COUNT(DISTINCT vendor_name) FILTER (WHERE vendor_name IS NOT NULL) > 1 THEN 'Varios'
             ELSE (array_agg(vendor_name ORDER BY created_at DESC))[1]
        END AS vendor_name,
        MAX(last_activity) AS last_activity
       FROM client_rows
       GROUP BY client_group_key
        ORDER BY ${clientOrderSql}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, per, offset]);

    const stats = includeStats ? await conn.query(
      `WITH scoped_lines AS (
         SELECT c.id AS client_id, s_metric.id AS subscriber_id, s_metric.line_kind, s_metric.product_type,
                s_metric.status AS line_status, s_metric.monthly_value, s_metric.contract_end_date, b_metric.account_type
         FROM clients c
         JOIN bans b_metric ON b_metric.client_id = c.id
         JOIN subscribers s_metric ON s_metric.ban_id = b_metric.id
         WHERE ${ACTIVE_SUB_STATUS('s_metric')})
       SELECT
        (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL}) AS active_count,
        (SELECT COUNT(*)::int FROM clients c WHERE ${CANCELLED_CLIENT_SQL}) AS cancelled_count,
        (SELECT COUNT(*)::int FROM clients c WHERE ${FOLLOWING_CLIENT_SQL}) AS following_count,
        (SELECT COUNT(*)::int FROM clients c WHERE ${INCOMPLETE_CLIENT_SQL}) AS incomplete_count,
        (SELECT COUNT(*)::int FROM subscribers s_cancelled WHERE NOT ${ACTIVE_SUB_STATUS('s_cancelled')}) AS cancelled_lines_count,
        ${serviceCountsJson()} AS service_counts,
        json_build_object(
          'expired_clients', (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL} AND ${RENEWAL_CLIENT_SQL.expired}),
          'upcoming_clients', (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL} AND ${RENEWAL_CLIENT_SQL.upcoming}),
          'missing_date_clients', (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL} AND ${RENEWAL_CLIENT_SQL.missing})
        ) AS renewal_alert,
        json_build_object(
          'active',     ${lineMetricJson(ACTIVE_CLIENT_SQL)},
          'cancelled',  ${lineMetricJson(CANCELLED_CLIENT_SQL)},
          'following',  ${lineMetricJson(FOLLOWING_CLIENT_SQL)},
            'incomplete', ${lineMetricJson(INCOMPLETE_CLIENT_SQL)}) AS line_metrics`)
      : { rows: [] };

    await conn.query('COMMIT');
    res.json({ clients: clients.rows, total: total.rows[0]?.total || 0, page, per, stats: includeStats ? stats.rows[0] : null });
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch {}
    console.error('[clients-real]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Resumen pesado separado: la tabla de Clientes puede aparecer sin esperarlo.
clientsRealRouter.get('/clients-real/stats', requireAuth, async (_req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('SET LOCAL search_path TO public');
    const stats = await conn.query(
      `WITH scoped_lines AS (
         SELECT c.id AS client_id, s_metric.id AS subscriber_id, s_metric.line_kind, s_metric.product_type,
                s_metric.status AS line_status, s_metric.monthly_value, s_metric.contract_end_date, b_metric.account_type
         FROM clients c
         JOIN bans b_metric ON b_metric.client_id = c.id
         JOIN subscribers s_metric ON s_metric.ban_id = b_metric.id
         WHERE ${ACTIVE_SUB_STATUS('s_metric')})
       SELECT
        (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL}) AS active_count,
        (SELECT COUNT(*)::int FROM clients c WHERE ${CANCELLED_CLIENT_SQL}) AS cancelled_count,
        (SELECT COUNT(*)::int FROM clients c WHERE ${FOLLOWING_CLIENT_SQL}) AS following_count,
        (SELECT COUNT(*)::int FROM clients c WHERE ${INCOMPLETE_CLIENT_SQL}) AS incomplete_count,
        (SELECT COUNT(*)::int FROM subscribers s_cancelled WHERE NOT ${ACTIVE_SUB_STATUS('s_cancelled')}) AS cancelled_lines_count,
        ${serviceCountsJson()} AS service_counts,
        json_build_object(
          'expired_clients', (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL} AND ${RENEWAL_CLIENT_SQL.expired}),
          'upcoming_clients', (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL} AND ${RENEWAL_CLIENT_SQL.upcoming}),
          'missing_date_clients', (SELECT COUNT(*)::int FROM clients c WHERE ${ACTIVE_CLIENT_SQL} AND ${RENEWAL_CLIENT_SQL.missing})
        ) AS renewal_alert,
        json_build_object(
          'active',     ${lineMetricJson(ACTIVE_CLIENT_SQL)},
          'cancelled',  ${lineMetricJson(CANCELLED_CLIENT_SQL)},
          'following',  ${lineMetricJson(FOLLOWING_CLIENT_SQL)},
          'incomplete', ${lineMetricJson(INCOMPLETE_CLIENT_SQL)}) AS line_metrics`);
    await conn.query('COMMIT');
    res.json({ stats: stats.rows[0] || {} });
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch {}
    console.error('[clients-real/stats]', e.message);
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// FICHA del cliente con data REAL (cliente + BANs + suscriptores)
clientsRealRouter.get('/clients-real/:id', requireAuth, async (req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('SET LOCAL search_path TO public');
    const c = await conn.query(
      `SELECT c.id, c.name, c.business_name, c.business_name AS company, c.email,
              c.owner_name, c.contact_person,
              c.phone, c.additional_phone, c.cellular AS mobile, c.cellular,
              c.address, c.city, c.zip_code, c.tax_id, c.source AS base, c.created_at,
              c.pendiente_validacion, c.salesperson_id, sp.name AS vendor_name,
              (SELECT so.id FROM sales_opportunities so
                 WHERE so.client_id = c.id AND so.archived_at IS NULL
                 ORDER BY so.created_at DESC LIMIT 1) AS opportunity_id
         FROM clients c LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
        WHERE c.id = $1`, [req.params.id]);
    if (!c.rows[0]) { await conn.query('ROLLBACK'); return res.status(404).json({ error: 'Cliente no existe' }); }
    const bans = await conn.query(
      `SELECT id, ban_number, account_type, status, credit_class, source
         FROM bans WHERE client_id = $1 ORDER BY ban_number`, [req.params.id]);
    const subs = await conn.query(
      `SELECT s.id, s.phone, s.plan, s.monthly_value, s.status, s.line_kind, s.line_type,
              s.activation_date, s.contract_start_date, s.contract_term, s.remaining_payments, s.contract_end_date,
              s.cancel_reason, s.tango_ventaid, s.equipment, s.product_type, s.price_code, s.item_id, s.payments_made,
              gr.gpon_applies, gr.gpon_note, gr.reviewed_at AS gpon_reviewed_at,
              b.ban_number, b.id AS ban_id
         FROM subscribers s JOIN bans b ON b.id = s.ban_id
         LEFT JOIN subscriber_gpon_reviews gr ON gr.subscriber_id = s.id
        WHERE b.client_id = $1 ORDER BY b.ban_number, s.phone`, [req.params.id]);
    let ventasTango = { rows: [] };
    const salesTable = await conn.query(`
      SELECT COALESCE(
        to_regclass('ventaspro_nuevo.sales')::text,
        to_regclass('public.sales')::text
      ) AS table_name`);
    if (salesTable.rows[0]?.table_name) {
      ventasTango = await conn.query(
        `SELECT id, tango_venta_id, ban_number, phone, product_key, ventatipo_nombre,
                monthly_value, company_commission, vendor_commission, vendor_name,
                sale_date, synced, paid, paid_at, paid_by, review_reason, created_at
           FROM ${salesTable.rows[0].table_name}
          WHERE client_id = $1
             OR ban_number IN (SELECT ban_number FROM bans WHERE client_id = $1)
          ORDER BY sale_date DESC NULLS LAST, created_at DESC`, [req.params.id]);
    }
    // Comisiones del cliente = subscriber_reports sincronizados/validados desde Tango
    const ventas = await conn.query(
      `SELECT b.ban_number, s.phone, to_char(sr.report_month,'YYYY-MM') AS mes,
              s.monthly_value, sr.company_earnings, sr.vendor_commission, sr.validation_status
         FROM subscriber_reports sr
         JOIN subscribers s ON s.id = sr.subscriber_id
         JOIN bans b ON b.id = s.ban_id
        WHERE b.client_id = $1
        ORDER BY sr.report_month DESC, b.ban_number`, [req.params.id]);
    let clientNotes = { rows: [] };
    const hasClientNotes = await conn.query(`SELECT to_regclass('public.client_notes') AS t`);
    if (hasClientNotes.rows[0].t) {
      clientNotes = await conn.query(
        `SELECT id, COALESCE(type, 'nota') AS type, note,
                COALESCE(created_by_name, created_by::text, 'Usuario') AS created_by,
                created_at
           FROM client_notes
          WHERE client_id = $1
          ORDER BY created_at DESC
          LIMIT 100`, [req.params.id]);
    }
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
    let comparativas = { rows: [] };
    const comparativasTable = await conn.query(`
      SELECT COALESCE(
        to_regclass('ventaspro_nuevo.comparativas')::text,
        to_regclass('public.comparativas')::text
      ) AS table_name`);
    if (comparativasTable.rows[0]?.table_name) {
      comparativas = await conn.query(
        `SELECT id, client_id, name, current_total, offer_total, created_by, created_at
           FROM ${comparativasTable.rows[0].table_name}
          WHERE client_id = $1
          ORDER BY created_at DESC
          LIMIT 50`, [req.params.id]);
    }
    await conn.query('COMMIT');
    res.json({ ...c.rows[0], bans: bans.rows, subscribers: subs.rows, ventas: ventas.rows, ventas_tango: ventasTango.rows, historial, client_notes: clientNotes.rows, comparativas: comparativas.rows });
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch {}
    console.error('[clients-real/:id]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});
