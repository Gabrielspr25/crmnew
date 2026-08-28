// Asana Seg. con DATA REAL de crm_pro (SOV2): sales_opportunities + opportunity_lines + opportunity_steps.
// Lee del schema public (real). Usa BEGIN + SET LOCAL search_path para NO contaminar el pool.
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { isSeller, sellerScope } from '../services/sellerScope.js';

export const asanaRealRouter = Router();
let asanaListCache = { at: 0, rows: null };

async function withPublic(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL search_path TO public');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    c.release();
  }
}

const CLIENT_NAME = `COALESCE(NULLIF(TRIM(c.name),''), NULLIF(TRIM(c.business_name),''), '—')`;
// Asana es una vista operativa: no debe mostrar oportunidades de clientes sin identidad usable.
const VALID_ASANA_CLIENT_SQL = `(NULLIF(TRIM(COALESCE(c.name, c.business_name, '')), '') IS NOT NULL
  AND LOWER(TRIM(COALESCE(c.name, c.business_name, ''))) NOT IN ('—', '-', 'null', 'sin nombre'))`;
const QTY_KEYS = `('movil_ren','movil_new','claro_tv','cloud')`;   // columnas por cantidad de líneas
// Misma regla de Clientes: suspendida sigue siendo una linea activa de cartera.
const ACTIVE_OR_SUSPENDED_SUB_SQL = (alias) => `COALESCE(LOWER(${alias}.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;
const ACTIVE_BAN_SQL = (alias) => `COALESCE(LOWER(${alias}.status::text),'a') IN ('a','activo','active')`;
const MONEY_KEYS = `('fijo_ren','fijo_new','mpls')`;               // columnas por dinero
const VALID_LOG_TYPES = new Set(['llamada', 'nota']);
// Una oportunidad solo existe si proviene de una linea real del cliente o si el
// vendedor agrego cantidad, monto o telefono. Esto excluye marcadores viejos
// vacios que antes creaban pasos para todos los productos.
const MEANINGFUL_OPPORTUNITY_LINE_SQL = (alias) => `(
  ${alias}.subscriber_id IS NOT NULL
  OR NULLIF(TRIM(COALESCE(${alias}.phone,'')), '') IS NOT NULL
  OR COALESCE(${alias}.quantity_value,0) > 0
  OR COALESCE(${alias}.money_value,0) > 0
  OR COALESCE(${alias}.target_monthly_value,0) > 0
)`;

function productKeyParts(productKey) {
  const parts = {
    fijo_ren: { product_type: 'FIJO', sale_type: 'REN' },
    fijo_new: { product_type: 'FIJO', sale_type: 'NEW' },
    movil_ren: { product_type: 'MOVIL', sale_type: 'REN' },
    movil_new: { product_type: 'MOVIL', sale_type: 'NEW' },
    claro_tv: { product_type: 'CLARO_TV', sale_type: 'NEW' },
    cloud: { product_type: 'CLOUD', sale_type: 'NEW' },
    mpls: { product_type: 'MPLS', sale_type: 'NEW' },
  };
  return parts[productKey] || null;
}

function productLineKind(productKey) {
  if (productKey === 'fijo_ren' || productKey === 'fijo_new') return 'fijo';
  if (productKey === 'movil_ren' || productKey === 'movil_new') return 'movil';
  if (productKey === 'claro_tv') return 'tv';
  if (productKey === 'cloud') return 'cloud';
  if (productKey === 'mpls') return 'mpls';
  return null;
}

function productLineType(productKey) {
  return productKey && productKey.endsWith('_ren') ? 'REN' : 'NEW';
}

function cleanText(value) {
  return String(value || '').trim();
}

function usernameForUser(user) {
  return cleanText(user?.nombre || user?.username || user?.usuario || user?.email || 'Sistema');
}

function hasOperationalClientName(value) {
  const name = cleanText(value).toLowerCase();
  return Boolean(name) && !['—', '-', 'null', 'sin nombre'].includes(name);
}

function cleanDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

async function sellerIdForUser(c, user) {
  if (!isSeller(user)) return null;
  const name = sellerScope(user);
  if (!name) return null;
  const r = await c.query(`SELECT id FROM salespeople WHERE LOWER(TRIM(name))=LOWER(TRIM($1)) LIMIT 1`, [name]);
  return r.rows[0]?.id || null;
}

async function sellerCanOpenOpportunity(c, opportunityId, user) {
  if (!isSeller(user)) return true;
  const sellerId = await sellerIdForUser(c, user);
  if (!sellerId) return false;
  const r = await c.query(
    `SELECT 1 FROM sales_opportunities WHERE id=$1 AND salesperson_id=$2 AND archived_at IS NULL`,
    [opportunityId, sellerId]
  );
  return Boolean(r.rows[0]);
}

// Convierte la cartera activa del CRM al producto operativo de Asana.
// Solo se usa al enviar un cliente existente a seguimiento: las líneas
// manuales de la oportunidad nunca se reemplazan ni se duplican.
const CLIENT_PORTFOLIO_PRODUCT_SQL = (alias) => `CASE
  WHEN LOWER(COALESCE(${alias}.line_kind::text,'')) = 'cloud'
       OR UPPER(COALESCE(${alias}.product_type::text,'')) = 'K' THEN 'cloud'
  WHEN LOWER(COALESCE(${alias}.line_kind::text,'')) = 'mpls'
       OR UPPER(COALESCE(${alias}.product_type::text,'')) = 'T' THEN 'mpls'
  WHEN LOWER(COALESCE(${alias}.line_kind::text,'')) IN ('claro tv','clarotv','tv') THEN 'claro_tv'
  WHEN LOWER(COALESCE(${alias}.line_kind::text,'')) = 'fijo'
       OR UPPER(COALESCE(${alias}.product_type::text,'')) IN ('O','V') THEN 'fijo_ren'
  WHEN LOWER(COALESCE(${alias}.line_kind::text,'')) IN ('movil','móvil','mobile')
       OR UPPER(COALESCE(${alias}.product_type::text,'')) = 'G' THEN 'movil_ren'
  ELSE NULL
END`;

async function seedClientActiveLines(c, opportunityId, clientId) {
  await c.query(
    `INSERT INTO opportunity_lines (
       opportunity_id, client_id, ban_id, subscriber_id, line_mode, product_key,
       phone, current_plan, target_plan, current_monthly_value, target_monthly_value,
       quantity_value, money_value, product_type, sale_type, status
     )
     SELECT $1, $2, portfolio.ban_id, portfolio.subscriber_id, 'existente_renovar', portfolio.product_key,
            portfolio.phone, portfolio.plan, portfolio.plan, portfolio.monthly_value, portfolio.monthly_value,
            CASE WHEN portfolio.product_key IN ('movil_ren','claro_tv','cloud') THEN 1 ELSE NULL END,
            CASE WHEN portfolio.product_key IN ('fijo_ren','mpls') THEN portfolio.monthly_value ELSE NULL END,
            CASE portfolio.product_key
              WHEN 'movil_ren' THEN 'MOVIL'
              WHEN 'fijo_ren' THEN 'FIJO'
              WHEN 'claro_tv' THEN 'CLARO_TV'
              WHEN 'cloud' THEN 'CLOUD'
              WHEN 'mpls' THEN 'MPLS'
            END,
            'REN', 'incluida'
       FROM (
         SELECT s.id AS subscriber_id, b.id AS ban_id, s.phone, s.plan, s.monthly_value,
                ${CLIENT_PORTFOLIO_PRODUCT_SQL('s')} AS product_key
           FROM bans b
           JOIN subscribers s ON s.ban_id = b.id
          WHERE b.client_id = $2
            AND ${ACTIVE_OR_SUSPENDED_SUB_SQL('s')}
       ) AS portfolio
      WHERE portfolio.product_key IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
            FROM opportunity_lines ol
           WHERE ol.opportunity_id = $1
             AND ol.subscriber_id = portfolio.subscriber_id
        )`,
    [opportunityId, clientId]
  );
}

function logPrefix(type) {
  if (type === 'llamada') return '[LLAMADA]';
  if (type === 'paso') return '[PASO]';
  return '[NOTA]';
}

function scheduledCallPrefix(scheduledCallAt) {
  return `[LLAMADA_AGENDADA:${scheduledCallAt}]`;
}

function parseScheduledCall(note) {
  const raw = String(note || '');
  const match = raw.match(/^\[LLAMADA_AGENDADA:([^\]]+)\]\s*/i);
  if (!match) return { scheduled_call_at: null, scheduled_status: null };
  const date = new Date(match[1]);
  return {
    scheduled_call_at: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    scheduled_status: 'pendiente',
  };
}

function normalizeLogRow(row) {
  const scheduled = parseScheduledCall(row.note || row.body);
  return {
    ...row,
    body: String(row.body || '').replace(/^\[LLAMADA_AGENDADA:[^\]]+\]\s*/i, ''),
    scheduled_call_at: row.scheduled_call_at || scheduled.scheduled_call_at,
    scheduled_status: row.scheduled_status || scheduled.scheduled_status,
  };
}

function logTypeSql(noteExpr = 'n.note') {
  return `CASE
    WHEN ${noteExpr} ILIKE '[LLAMADA%' THEN 'llamada'
    WHEN ${noteExpr} ILIKE '[PASO]%' THEN 'paso'
    ELSE 'nota'
  END`;
}

async function ensureOpportunityNotes(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS opportunity_notes (
      id UUID PRIMARY KEY,
      opportunity_id UUID NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
      product_key TEXT NULL,
      step_id UUID NULL REFERENCES opportunity_steps(id) ON DELETE SET NULL,
      step_name TEXT NULL,
      note TEXT NOT NULL,
      scheduled_call_at TIMESTAMP NULL,
      scheduled_status TEXT NOT NULL DEFAULT 'pendiente',
      created_by_username TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_opportunity_notes_opportunity_created ON opportunity_notes(opportunity_id, created_at DESC)`);
}

// Caminito = los PASOS CONFIGURADOS del sistema nuevo (product_step_templates),
// los mismos que se editan en "Configurar pasos". NADA de crm_workflow_templates viejo.
async function fetchWorkflowTemplateSteps(c, productKey) {
  if (!productKey) return [];
  const r = await c.query(
    `SELECT t.name AS name, t.step_order
       FROM ventaspro_nuevo.product_step_templates t
       JOIN ventaspro_nuevo.products p ON p.id = t.product_id
      WHERE p.key = $1 AND t.active = true
      ORDER BY t.step_order`,
    [productKey]
  );
  return r.rows;
}

async function ensureOpportunityWorkflowSteps(c, opportunityId) {
  const products = await c.query(
    `SELECT DISTINCT ol.product_key
       FROM opportunity_lines ol
      WHERE ol.opportunity_id = $1
        AND ol.product_key IS NOT NULL
        AND ${MEANINGFUL_OPPORTUNITY_LINE_SQL('ol')}
      ORDER BY product_key`,
    [opportunityId]
  );

  for (const row of products.rows) {
    const productKey = row.product_key;
    const templateSteps = await fetchWorkflowTemplateSteps(c, productKey); // pasos CONFIGURADOS
    const configuredNames = templateSteps.map((s) => cleanText(s.name).toLowerCase()).filter(Boolean);

    if (configuredNames.length === 0) {
      // producto sin pasos configurados -> caminito vacío (borra cualquier paso viejo)
      await c.query(`DELETE FROM opportunity_steps WHERE opportunity_id = $1 AND product_key = $2`, [opportunityId, productKey]);
      continue;
    }

    // Borrar los pasos VIEJOS/genéricos que ya no están en la config actual
    await c.query(
      `DELETE FROM opportunity_steps
        WHERE opportunity_id = $1 AND product_key = $2
          AND LOWER(TRIM(name)) <> ALL($3::text[])`,
      [opportunityId, productKey, configuredNames]
    );

    // Qué pasos configurados ya existen (para no duplicar y preservar avance)
    const existing = await c.query(
      `SELECT LOWER(TRIM(name)) AS name_key
         FROM opportunity_steps
        WHERE opportunity_id = $1 AND product_key = $2`,
      [opportunityId, productKey]
    );
    const existingNames = new Set(existing.rows.map((step) => step.name_key).filter(Boolean));

    for (const [index, step] of templateSteps.entries()) {
      const nameKey = cleanText(step.name).toLowerCase();
      if (!nameKey || existingNames.has(nameKey)) continue;
      const nextOrder = await c.query(
        `SELECT COALESCE(MAX(step_order),0)+1 AS n
           FROM opportunity_steps
          WHERE opportunity_id = $1`,
        [opportunityId]
      );
      await c.query(
        `INSERT INTO opportunity_steps (
           id, opportunity_id, product_key, step_order, name, status, source, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'product_step_templates',now(),now())`,
        [
          randomUUID(),
          opportunityId,
          productKey,
          Number(nextOrder.rows[0]?.n || step.step_order || index + 1),
          step.name,
          existingNames.size === 0 && index === 0 ? 'en_progreso' : 'pendiente',
        ]
      );
      existingNames.add(nameKey);
    }
  }
}

async function closeOpportunityToPool(c, opportunityId) {
  const o = await c.query(
    `UPDATE sales_opportunities SET status='cerrada_no_trabajar', archived_at=now(), closed_at=now()
      WHERE id=$1 AND archived_at IS NULL RETURNING client_id`, [opportunityId]);
  if (!o.rows[0]) return false;
  await c.query(`UPDATE clients SET salesperson_id = NULL WHERE id = $1`, [o.rows[0].client_id]);
  return true;
}

// LISTA: oportunidades activas con la MISMA estructura de tu Asana real (SOV2):
// por producto -> { quantity_value, money_value, subscriber_count, current_step }
asanaRealRouter.get('/asana-real', requireAuth, async (req, res) => {
  try {
    const seller = isSeller(req.user) ? sellerScope(req.user) : null;
    if (!seller && asanaListCache.rows && Date.now() - asanaListCache.at < 30000) return res.json(asanaListCache.rows);
    const r = await withPublic(c => c.query(`
      SELECT o.id, o.client_id, o.status, o.title,
        ${CLIENT_NAME} AS client_name,
        c.pendiente_validacion AS client_pending_validation,
        COALESCE(c.phone, c.cellular) AS client_phone,
        (SELECT count(DISTINCT b.id)::int
           FROM bans b
           JOIN subscribers s ON s.ban_id = b.id
          WHERE b.client_id = o.client_id
            AND ${ACTIVE_BAN_SQL('b')}
            AND ${ACTIVE_OR_SUSPENDED_SUB_SQL('s')}) AS ban_count,
        (SELECT string_agg(DISTINCT b.ban_number::text, ', ' ORDER BY b.ban_number::text)
           FROM bans b
           JOIN subscribers s ON s.ban_id = b.id
          WHERE b.client_id = o.client_id
            AND ${ACTIVE_BAN_SQL('b')}
            AND ${ACTIVE_OR_SUSPENDED_SUB_SQL('s')}
            AND NULLIF(TRIM(b.ban_number::text),'') IS NOT NULL) AS ban_numbers,
        (SELECT COUNT(DISTINCT s.id)::int
           FROM subscribers s
           JOIN bans b ON b.id = s.ban_id
          WHERE b.client_id = o.client_id
            AND ${ACTIVE_BAN_SQL('b')}
            AND ${ACTIVE_OR_SUSPENDED_SUB_SQL('s')}) AS subscriber_count,
        COALESCE(sp.name,'Sin asignar') AS vendor_name,
        COALESCE((SELECT json_object_agg(t.pk, t.jb) FROM (
            SELECT ol.product_key AS pk, json_build_object(
              'quantity_value', SUM(COALESCE(ol.quantity_value,0))::numeric,
              'money_value', SUM(COALESCE(ol.money_value, ol.target_monthly_value, 0))::numeric,
              'subscriber_count', COUNT(*)::int,
              'current_step', (SELECT json_build_object('name', s.name) FROM opportunity_steps s
                                 WHERE s.opportunity_id = o.id AND s.product_key = ol.product_key AND s.completed_at IS NULL
                                 ORDER BY s.step_order LIMIT 1)
            ) AS jb
            FROM opportunity_lines ol
            WHERE ol.opportunity_id = o.id AND ol.product_key IS NOT NULL
              AND ${MEANINGFUL_OPPORTUNITY_LINE_SQL('ol')}
            GROUP BY ol.product_key) t), '{}') AS products,
        (SELECT COALESCE(SUM(COALESCE(ol.quantity_value,0)),0)::numeric FROM opportunity_lines ol WHERE ol.opportunity_id = o.id AND ol.product_key IN ${QTY_KEYS} AND ${MEANINGFUL_OPPORTUNITY_LINE_SQL('ol')}) AS total_lines,
        (SELECT COALESCE(SUM(COALESCE(ol.money_value, ol.target_monthly_value, 0)),0)::numeric FROM opportunity_lines ol WHERE ol.opportunity_id = o.id AND ol.product_key IN ${MONEY_KEYS} AND ${MEANINGFUL_OPPORTUNITY_LINE_SQL('ol')}) AS total_money
      FROM (
        SELECT DISTINCT ON (so.client_id) so.*
        FROM sales_opportunities so
        WHERE so.archived_at IS NULL
          AND COALESCE(LOWER(so.status),'activa') = 'activa'
        ORDER BY so.client_id, so.updated_at DESC NULLS LAST, so.created_at DESC NULLS LAST, so.id
      ) o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
      WHERE ${VALID_ASANA_CLIENT_SQL}
        AND ($1::text IS NULL OR LOWER(TRIM(sp.name))=LOWER(TRIM($1)))
      ORDER BY client_name`, [seller || null]));
    asanaListCache = seller ? asanaListCache : { at: Date.now(), rows: r.rows };
    res.json(r.rows);
  } catch (e) {
    console.error('[asana-real]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DETALLE: oportunidad + pasos (caminito) + líneas (productos negociados)
// BUSCADOR: cartera operativa que aun no esta en seguimiento.
// Solo devuelve clientes identificables con lineas activas o suspendidas.
asanaRealRouter.get('/asana-real/client-search', requireAuth, async (req, res) => {
  const q = cleanText(req.query?.q);
  if (q.length < 2) return res.json([]);
  try {
    const pattern = `%${q}%`;
    const r = await withPublic(c => c.query(
      `SELECT c.id,
              ${CLIENT_NAME} AS client_name,
              string_agg(DISTINCT b.ban_number::text, ', ' ORDER BY b.ban_number::text) AS ban_numbers,
              COUNT(DISTINCT s.id)::int AS active_subscriber_count,
              (
                SELECT so.id
                  FROM sales_opportunities so
                 WHERE so.client_id = c.id
                   AND so.archived_at IS NULL
                   AND COALESCE(LOWER(so.status), 'activa') = 'activa'
                 ORDER BY so.updated_at DESC NULLS LAST, so.created_at DESC NULLS LAST, so.id
                 LIMIT 1
              ) AS opportunity_id
         FROM clients c
         JOIN bans b ON b.client_id = c.id
         JOIN subscribers s ON s.ban_id = b.id
        WHERE ${VALID_ASANA_CLIENT_SQL}
          AND ${ACTIVE_OR_SUSPENDED_SUB_SQL('s')}
          AND (
            c.name ILIKE $1
            OR c.business_name ILIKE $1
            OR c.email ILIKE $1
            OR b.ban_number::text ILIKE $1
            OR s.phone::text ILIKE $1
          )
        GROUP BY c.id, c.name, c.business_name
        ORDER BY client_name
        LIMIT 12`,
      [pattern]
    ));
    res.json(r.rows);
  } catch (e) {
    console.error('[asana-real/client-search]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.get('/asana-real/alerts/calls', requireAuth, async (_req, res) => {
  try {
    const rows = await withPublic(async c => {
      await ensureOpportunityNotes(c);
      const r = await c.query(
        `SELECT n.id, n.opportunity_id, n.note, n.scheduled_call_at, n.scheduled_status,
                regexp_replace(n.note, '^\\[(LLAMADA_AGENDADA:[^\\]]+|LLAMADA|NOTA|PASO)\\]\\s*', '', 'i') AS body,
                COALESCE(n.created_by_username, 'Sistema') AS user_name,
                n.created_at,
                ${CLIENT_NAME} AS client_name,
                COALESCE(sp.name,'Sin asignar') AS salesperson
           FROM opportunity_notes n
           JOIN sales_opportunities o ON o.id = n.opportunity_id
           JOIN clients c ON c.id = o.client_id
           LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
          WHERE o.archived_at IS NULL
            AND (n.scheduled_call_at IS NOT NULL OR n.note ILIKE '[LLAMADA_AGENDADA:%')
            AND COALESCE(n.scheduled_status,'pendiente') = 'pendiente'
          ORDER BY n.created_at DESC, n.id DESC
          LIMIT 100`
      );
      return r.rows.map(normalizeLogRow)
        .filter(row => row.scheduled_call_at)
        .sort((a, b) => new Date(a.scheduled_call_at) - new Date(b.scheduled_call_at))
        .slice(0, 20);
    });
    res.json(rows);
  } catch (e) {
    console.error('[asana-real/alerts/calls]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.get('/asana-real/agenda', requireAuth, async (req, res) => {
  try {
    const requestedTeam = cleanText(req.query?.scope).toLowerCase() === 'team';
    const teamScope = requestedTeam && !isSeller(req.user);
    const username = usernameForUser(req.user);
    const items = await withPublic(async c => {
      const taskScopeSql = teamScope
        ? 'TRUE'
        : 'LOWER(TRIM(t.assigned_to_username)) = LOWER(TRIM($1))';
      const tasks = await c.query(
        `SELECT t.id, 'tarea'::text AS item_type, t.title, t.notes, t.due_at,
                t.priority, t.status, t.assigned_to_username, t.client_id,
                t.opportunity_id, t.step_id, ${CLIENT_NAME} AS client_name,
                o.title AS opportunity_title, os.name AS step_name
           FROM asana_tasks t
           LEFT JOIN clients c ON c.id = t.client_id
           LEFT JOIN sales_opportunities o ON o.id = t.opportunity_id
           LEFT JOIN opportunity_steps os ON os.id = t.step_id
          WHERE t.status = 'pendiente' AND ${taskScopeSql}
          ORDER BY t.due_at, CASE t.priority WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END
          LIMIT 200`,
        teamScope ? [] : [username]
      );

      const callScopeSql = teamScope
        ? 'TRUE'
        : `LOWER(TRIM(COALESCE(sp.name, n.created_by_username, 'Sistema'))) = LOWER(TRIM($1))`;
      const calls = await c.query(
        `SELECT n.id, n.note, 'llamada'::text AS item_type,
                regexp_replace(n.note, '^\\[(LLAMADA_AGENDADA:[^\\]]+|LLAMADA|NOTA|PASO)\\]\\s*', '', 'i') AS title,
                NULL::text AS notes, n.scheduled_call_at AS due_at,
                'normal'::text AS priority, COALESCE(n.scheduled_status,'pendiente') AS status,
                COALESCE(sp.name, n.created_by_username, 'Sistema') AS assigned_to_username,
                o.client_id, n.opportunity_id, NULL::uuid AS step_id,
                ${CLIENT_NAME} AS client_name, o.title AS opportunity_title, NULL::text AS step_name
           FROM opportunity_notes n
           JOIN sales_opportunities o ON o.id = n.opportunity_id
           JOIN clients c ON c.id = o.client_id
           LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
          WHERE o.archived_at IS NULL
            AND (n.scheduled_call_at IS NOT NULL OR n.note ILIKE '[LLAMADA_AGENDADA:%')
            AND COALESCE(n.scheduled_status,'pendiente') = 'pendiente'
            AND ${callScopeSql}
          ORDER BY n.scheduled_call_at
          LIMIT 100`,
        teamScope ? [] : [username]
      );
      return [...tasks.rows, ...calls.rows.map(normalizeLogRow)]
        .filter(item => item.due_at)
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    });
    res.json({ scope: teamScope ? 'team' : 'mine', can_view_team: !isSeller(req.user), items });
  } catch (e) {
    console.error('[asana-real/agenda]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.post('/asana-real/tasks', requireAuth, async (req, res) => {
  const title = cleanText(req.body?.title);
  const notes = cleanText(req.body?.notes) || null;
  const priority = cleanText(req.body?.priority).toLowerCase() || 'normal';
  const dueDate = new Date(req.body?.due_at);
  const opportunityId = cleanText(req.body?.opportunity_id) || null;
  const clientIdInput = cleanText(req.body?.client_id) || null;
  const stepId = cleanText(req.body?.step_id) || null;
  if (!title) return res.status(400).json({ error: 'Escribe el titulo de la tarea' });
  if (Number.isNaN(dueDate.getTime())) return res.status(400).json({ error: 'Selecciona una fecha valida' });
  if (!['baja', 'normal', 'alta'].includes(priority)) return res.status(400).json({ error: 'Prioridad invalida' });

  try {
    const row = await withPublic(async c => {
      const currentUsername = usernameForUser(req.user);
      const assigned = isSeller(req.user)
        ? sellerScope(req.user) || currentUsername
        : cleanText(req.body?.assigned_to_username) || currentUsername;
      let clientId = clientIdInput;

      if (opportunityId) {
        if (!await sellerCanOpenOpportunity(c, opportunityId, req.user)) return { forbidden: true };
        const opportunity = await c.query(
          `SELECT id, client_id FROM sales_opportunities WHERE id=$1 AND archived_at IS NULL`,
          [opportunityId]
        );
        if (!opportunity.rows[0]) return { invalidOpportunity: true };
        clientId = opportunity.rows[0].client_id;
      } else if (clientId) {
        const client = await c.query(`SELECT id FROM clients WHERE id=$1`, [clientId]);
        if (!client.rows[0]) return { invalidClient: true };
      }

      if (stepId) {
        if (!opportunityId) return { invalidStep: true };
        const step = await c.query(
          `SELECT id FROM opportunity_steps WHERE id=$1 AND opportunity_id=$2 AND completed_at IS NULL`,
          [stepId, opportunityId]
        );
        if (!step.rows[0]) return { invalidStep: true };
      }

      const inserted = await c.query(
        `INSERT INTO asana_tasks (
           id, title, notes, due_at, priority, status, assigned_to_username,
           created_by_username, client_id, opportunity_id, step_id, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,'pendiente',$6,$7,$8,$9,$10,now(),now())
         RETURNING *`,
        [randomUUID(), title, notes, dueDate.toISOString(), priority, assigned, currentUsername,
          clientId, opportunityId, stepId]
      );
      return inserted.rows[0];
    });
    if (row?.forbidden) return res.status(403).json({ error: 'No puedes crear tareas para otra oportunidad.' });
    if (row?.invalidOpportunity) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    if (row?.invalidClient) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (row?.invalidStep) return res.status(400).json({ error: 'El paso no pertenece a la oportunidad o ya esta completo' });
    res.status(201).json(row);
  } catch (e) {
    console.error('[asana-real/tasks]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.patch('/asana-real/tasks/:taskId', requireAuth, async (req, res) => {
  const status = cleanText(req.body?.status).toLowerCase();
  if (!['pendiente', 'completada', 'cancelada'].includes(status)) {
    return res.status(400).json({ error: 'Estado de tarea invalido' });
  }
  try {
    const result = await withPublic(async c => {
      const username = usernameForUser(req.user);
      const task = await c.query(`SELECT * FROM asana_tasks WHERE id=$1`, [req.params.taskId]);
      if (!task.rows[0]) return null;
      if (isSeller(req.user)
        && cleanText(task.rows[0].assigned_to_username).toLowerCase() !== cleanText(sellerScope(req.user) || username).toLowerCase()) {
        return { forbidden: true };
      }
      const updated = await c.query(
        `UPDATE asana_tasks
            SET status=$2,
                completed_at=CASE WHEN $2='completada' THEN now() ELSE NULL END,
                updated_at=now()
          WHERE id=$1 RETURNING *`,
        [req.params.taskId, status]
      );
      let suggestedNextStep = null;
      if (status === 'completada' && task.rows[0].step_id && task.rows[0].opportunity_id) {
        const completed = await c.query(
          `UPDATE opportunity_steps SET completed_at=COALESCE(completed_at,now()), updated_at=now()
            WHERE id=$1 AND opportunity_id=$2
            RETURNING product_key, step_order`,
          [task.rows[0].step_id, task.rows[0].opportunity_id]
        );
        if (completed.rows[0]) {
          const next = await c.query(
            `SELECT id, name, product_key, step_order
               FROM opportunity_steps
              WHERE opportunity_id=$1 AND completed_at IS NULL
                AND product_key IS NOT DISTINCT FROM $2
                AND step_order > $3
              ORDER BY step_order LIMIT 1`,
            [task.rows[0].opportunity_id, completed.rows[0].product_key, completed.rows[0].step_order]
          );
          suggestedNextStep = next.rows[0] || null;
        }
      }
      return { task: updated.rows[0], suggested_next_step: suggestedNextStep };
    });
    if (!result) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (result.forbidden) return res.status(403).json({ error: 'No puedes modificar una tarea de otro vendedor.' });
    res.json(result);
  } catch (e) {
    console.error('[asana-real/tasks/:taskId]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.patch('/asana-real/agenda/calls/:noteId', requireAuth, async (req, res) => {
  const status = cleanText(req.body?.status || 'completada').toLowerCase();
  if (!['completada','cancelada'].includes(status)) {
    return res.status(400).json({ error: 'Estado de llamada no valido' });
  }
  try {
    const result = await withPublic(async c => {
      const note = await c.query(
        `SELECT n.id, n.opportunity_id
           FROM opportunity_notes n
          WHERE n.id=$1 AND (n.scheduled_call_at IS NOT NULL OR n.note ILIKE '[LLAMADA_AGENDADA:%')`,
        [req.params.noteId]
      );
      if (!note.rows[0]) return null;
      if (!await sellerCanOpenOpportunity(c, note.rows[0].opportunity_id, req.user)) return { forbidden: true };
      const updated = await c.query(
        `UPDATE opportunity_notes SET scheduled_status = $2 WHERE id=$1 RETURNING id, scheduled_status`,
        [req.params.noteId, status]
      );
      return updated.rows[0];
    });
    if (!result) return res.status(404).json({ error: 'Llamada agendada no encontrada' });
    if (result.forbidden) return res.status(403).json({ error: 'No puedes modificar una llamada de otro vendedor.' });
    res.json(result);
  } catch (e) {
    console.error('[asana-real/agenda/calls/:noteId]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.get('/asana-real/:id', requireAuth, async (req, res) => {
  try {
    const data = await withPublic(async c => {
      if (!await sellerCanOpenOpportunity(c, req.params.id, req.user)) return { forbidden: true };
      const o = await c.query(
        `SELECT o.id, o.client_id, o.title, o.status, o.opportunity_type, o.expected_monthly_value,
                ${CLIENT_NAME} AS client_name, COALESCE(sp.name,'—') AS salesperson
           FROM sales_opportunities o
           JOIN clients c ON c.id = o.client_id
           LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
              WHERE o.id = $1`, [req.params.id]);
      if (!o.rows[0]) return null;
      await ensureOpportunityWorkflowSteps(c, req.params.id);
      const steps = await c.query(
        `SELECT os.id, os.product_key, os.name, os.step_order, (os.completed_at IS NOT NULL) AS done
           FROM opportunity_steps os
          WHERE os.opportunity_id = $1
            AND (
              os.product_key IS NULL
              OR EXISTS (
                SELECT 1
                  FROM opportunity_lines ol
                 WHERE ol.opportunity_id = os.opportunity_id
                   AND ol.product_key = os.product_key
                   AND ${MEANINGFUL_OPPORTUNITY_LINE_SQL('ol')}
              )
            )
          ORDER BY os.product_key NULLS LAST, os.step_order, os.created_at`, [req.params.id]);
      const lines = await c.query(
        `SELECT ol.id, ol.product_key, ol.phone, COALESCE(ol.quantity_value,1)::int AS qty,
                COALESCE(ol.money_value, ol.target_monthly_value, 0)::numeric AS amount,
                ol.current_plan, ol.target_plan, ol.status
           FROM opportunity_lines ol
          WHERE ol.opportunity_id = $1
            AND ${MEANINGFUL_OPPORTUNITY_LINE_SQL('ol')}
          ORDER BY ol.created_at`, [req.params.id]);
      await ensureOpportunityNotes(c);
      const log = await c.query(
        `SELECT id, opportunity_id, product_key, step_id, step_name,
                ${logTypeSql('note')} AS type,
                regexp_replace(note, '^\\[(LLAMADA_AGENDADA:[^\\]]+|LLAMADA|NOTA|PASO)\\]\\s*', '', 'i') AS body,
                COALESCE(created_by_username, 'Sistema') AS user_name,
                created_at
           FROM opportunity_notes
          WHERE opportunity_id = $1
          ORDER BY created_at DESC, id DESC`, [req.params.id]);
      return { ...o.rows[0], steps: steps.rows, lines: lines.rows, log: log.rows.map(normalizeLogRow) };
    });
    if (!data) return res.status(404).json({ error: 'Oportunidad no existe' });
    if (data.forbidden) return res.status(403).json({ error: 'No puedes abrir un seguimiento asignado a otro vendedor.' });
    res.json(data);
  } catch (e) {
    console.error('[asana-real/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// COMPLETAR paso
asanaRealRouter.post('/asana-real/:id/steps/:stepId/done', requireAuth, async (req, res) => {
  try {
    const r = await withPublic(async c => {
      if (!await sellerCanOpenOpportunity(c, req.params.id, req.user)) return { forbidden: true };
      const step = await c.query(
        `UPDATE opportunity_steps SET completed_at = now(), updated_at = now()
          WHERE id = $1 AND opportunity_id = $2 AND completed_at IS NULL
          RETURNING id, product_key, name`, [req.params.stepId, req.params.id]);
      if (!step.rows[0]) return null;
      await ensureOpportunityNotes(c);
      await c.query(
        `INSERT INTO opportunity_notes (
           id, opportunity_id, product_key, step_id, step_name, note, created_by_username, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
        [randomUUID(), req.params.id, step.rows[0].product_key || null, step.rows[0].id, step.rows[0].name,
          `${logPrefix('paso')} Completó el paso: ${step.rows[0].name}`, req.user?.nombre || 'Sistema']);
      await c.query(`UPDATE sales_opportunities SET updated_at = now() WHERE id = $1`, [req.params.id]);
      return step;
    });
    if (r?.forbidden) return res.status(403).json({ error: 'No puedes abrir un seguimiento asignado a otro vendedor.' });
    if (!r?.rows?.[0]) return res.status(404).json({ error: 'Paso no existe' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// REGISTRAR llamada o nota en la bitácora SOV2 real
asanaRealRouter.post('/asana-real/:id/log', requireAuth, async (req, res) => {
  try {
    const type = cleanText(req.body?.type).toLowerCase();
    const body = cleanText(req.body?.body || req.body?.note);
    const scheduled_call_at = cleanText(req.body?.scheduled_call_at);
    if (!VALID_LOG_TYPES.has(type)) return res.status(400).json({ error: 'type debe ser llamada o nota' });
    if (!body) return res.status(400).json({ error: 'Escribe una nota o resumen de llamada' });
    let scheduledIso = null;
    if (scheduled_call_at) {
      if (type !== 'llamada') return res.status(400).json({ error: 'Solo las llamadas se pueden agendar' });
      const scheduledDate = new Date(scheduled_call_at);
      if (Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ error: 'Fecha de llamada inválida' });
      scheduledIso = scheduledDate.toISOString();
    }
    const row = await withPublic(async c => {
      if (!await sellerCanOpenOpportunity(c, req.params.id, req.user)) return { forbidden: true };
      const exists = await c.query(
        `SELECT id FROM sales_opportunities WHERE id = $1 AND archived_at IS NULL`, [req.params.id]);
      if (!exists.rows[0]) return null;
      await ensureOpportunityNotes(c);
      const r = await c.query(
          `INSERT INTO opportunity_notes (
             id, opportunity_id, note, scheduled_call_at, scheduled_status, created_by_username, created_at
           ) VALUES ($1,$2,$3,$4,'pendiente',$5,now())
           RETURNING id, opportunity_id, ${logTypeSql('note')} AS type,
                     regexp_replace(note, '^\\[(LLAMADA_AGENDADA:[^\\]]+|LLAMADA|NOTA|PASO)\\]\\s*', '', 'i') AS body,
                     scheduled_call_at, scheduled_status,
                     COALESCE(created_by_username, 'Sistema') AS user_name, created_at`,
        [randomUUID(), req.params.id, `${scheduledIso ? scheduledCallPrefix(scheduledIso) : logPrefix(type)} ${body}`,
          scheduledIso, req.user?.nombre || 'Sistema']);
      await c.query(`UPDATE sales_opportunities SET updated_at = now() WHERE id = $1`, [req.params.id]);
      return normalizeLogRow(r.rows[0]);
    });
    if (!row) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    if (row.forbidden) return res.status(403).json({ error: 'No puedes abrir un seguimiento asignado a otro vendedor.' });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CERRAR → al pool (regla SOV2: archiva oportunidad + cliente sin vendedor)
asanaRealRouter.post('/asana-real/:id/close', requireAuth, async (req, res) => {
  try {
    const done = await withPublic(async c => {
      if (!await sellerCanOpenOpportunity(c, req.params.id, req.user)) return { forbidden: true };
      return { done: await closeOpportunityToPool(c, req.params.id) };
    });
    if (done?.forbidden) return res.status(403).json({ error: 'No puedes abrir un seguimiento asignado a otro vendedor.' });
    if (!done?.done) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

asanaRealRouter.delete('/asana-real/:id', requireAuth, async (req, res) => {
  try {
    const done = await withPublic(async c => {
      if (!await sellerCanOpenOpportunity(c, req.params.id, req.user)) return { forbidden: true };
      return { done: await closeOpportunityToPool(c, req.params.id) };
    });
    if (done?.forbidden) return res.status(403).json({ error: 'No puedes abrir un seguimiento asignado a otro vendedor.' });
    if (!done?.done) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CLIENTE VOZ: crea cliente provisional + oportunidad + línea + nota (desde el dictado parseado)
asanaRealRouter.post('/asana-real/voz', requireAuth, async (req, res) => {
  const { empresa, telefono, ban_number, subscriber, product_key, qty, monto, nota } = req.body || {};
  const name = cleanText(empresa || '');
  if (!name) return res.status(400).json({ error: 'Falta la empresa o nombre del cliente' });
  const PK = ['fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls'];
  const pk = PK.includes(product_key) ? product_key : null;
  if (!pk) return res.status(400).json({ error: 'Selecciona el producto de la oportunidad' });
  const banDigits = cleanDigits(ban_number);
  if (!banDigits || banDigits.length !== 9) return res.status(400).json({ error: 'El BAN debe tener 9 digitos' });
  const subscriberDigits = cleanDigits(subscriber || telefono);
  if (!subscriberDigits || subscriberDigits.length !== 10) return res.status(400).json({ error: 'El suscriptor debe tener 10 digitos' });
  if (subscriberDigits.startsWith('100')) return res.status(422).json({ error: 'El codigo interno 100 no es un suscriptor valido' });
  if (!/^(787|939|989)\d{7}$/.test(subscriberDigits)) return res.status(422).json({ error: 'El suscriptor debe comenzar con 787, 939 o 989' });
  const isMoney = ['fijo_ren', 'fijo_new', 'mpls'].includes(pk);
  const lineKind = productLineKind(pk);
  const lineType = productLineType(pk);
  try {
    const out = await withPublic(async c => {
      const existing = await c.query(
        `SELECT c.id, c.name, c.business_name,
                (
                  SELECT so.id
                    FROM sales_opportunities so
                   WHERE so.client_id = c.id
                     AND so.archived_at IS NULL
                   ORDER BY so.created_at DESC NULLS LAST, so.id
                   LIMIT 1
                ) AS opportunity_id
           FROM clients c
          WHERE LOWER(TRIM(COALESCE(c.name,''))) = LOWER(TRIM($1))
             OR LOWER(TRIM(COALESCE(c.business_name,''))) = LOWER(TRIM($1))
             OR EXISTS (
               SELECT 1
                 FROM bans b
                 JOIN subscribers s ON s.ban_id = b.id
                WHERE b.client_id = c.id
                  AND (b.ban_number = $2 OR regexp_replace(COALESCE(s.phone,''), '\\D', '', 'g') = $3)
             )
          ORDER BY c.created_at DESC NULLS LAST, c.id
          LIMIT 1`,
        [name, banDigits, subscriberDigits]);
      if (existing.rows[0]) {
        const displayName = existing.rows[0].name || existing.rows[0].business_name || name;
        return {
          duplicate: true,
          error: existing.rows[0].opportunity_id
            ? `Cliente ya existe y ya tiene seguimiento activo: ${displayName}`
            : `Cliente ya existe en CRM: ${displayName}`,
          client_id: existing.rows[0].id,
          opportunity_id: existing.rows[0].opportunity_id || null,
        };
      }
      const cli = await c.query(
        `INSERT INTO clients (name, phone, pendiente_validacion) VALUES ($1,$2,true) RETURNING id`,
        [name, subscriberDigits]);
      const clientId = cli.rows[0].id;
      const ban = await c.query(
        `INSERT INTO bans (client_id, ban_number, status, source)
         VALUES ($1,$2,'A','cliente_voz') RETURNING id`,
        [clientId, banDigits]);
      const banId = ban.rows[0].id;
      const sub = await c.query(
        `INSERT INTO subscribers (ban_id, phone, phone_norm, status, line_kind, line_type)
         VALUES ($1,$2,$2,'activo',$3,$4) RETURNING id`,
        [banId, subscriberDigits, lineKind, lineType]);
      const subscriberId = sub.rows[0].id;
      const opp = await c.query(
        `INSERT INTO sales_opportunities (client_id, title, opportunity_type, status, source, created_by)
         VALUES ($1,$2,'manual','activa','cliente_voz',$3) RETURNING id`,
        [clientId, 'Oportunidad por voz - ' + name, req.user?.nombre || req.user?.nick || 'Cliente Voz']);
      const oppId = opp.rows[0].id;
      await c.query(
        `INSERT INTO opportunity_lines (
           opportunity_id, client_id, ban_id, subscriber_id, line_mode, phone,
           product_key, quantity_value, money_value, product_type, sale_type
         )
         VALUES ($1,$2,$3,$4,'manual_con_ban_suscriptor',$5,$6,$7,$8,$9,$10)`,
        [
          oppId, clientId, banId, subscriberId, subscriberDigits, pk,
          isMoney ? null : (Number(qty) || 1),
          isMoney ? (Number(monto) || null) : null,
          productKeyParts(pk)?.product_type || null,
          productKeyParts(pk)?.sale_type || null,
        ]);
      await ensureOpportunityNotes(c);
      const notaTxt = cleanText(nota || '');
      if (notaTxt) {
        await c.query(
          `INSERT INTO opportunity_notes (id, opportunity_id, product_key, note, created_by_username, created_at)
           VALUES ($1,$2,$3,$4,$5,now())`,
          [randomUUID(), oppId, pk, '[NOTA] ' + notaTxt, req.user?.nombre || 'Cliente Voz']);
      }
      return { opportunity_id: oppId, client_id: clientId };
    });
    if (out?.duplicate) return res.status(409).json(out);
    res.status(201).json(out);
  } catch (e) {
    console.error('[asana-voz]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ENVIAR A SEGUIMIENTO desde cliente existente (Flujo 3): crea oportunidad si no tiene una activa
asanaRealRouter.post('/asana-real/from-client', requireAuth, async (req, res) => {
  const { client_id } = req.body || {};
  if (!client_id) return res.status(400).json({ error: 'Falta client_id' });
  try {
    const out = await withPublic(async c => {
      const sellerId = await sellerIdForUser(c, req.user);
      if (isSeller(req.user) && !sellerId) return { seller_not_configured: true };
      const cli = await c.query(
        `SELECT COALESCE(NULLIF(TRIM(name),''), NULLIF(TRIM(business_name),'')) AS name
           FROM clients WHERE id = $1`, [client_id]);
      if (!cli.rows[0]) return null;
      if (!hasOperationalClientName(cli.rows[0].name)) return { invalid_client: true };
      const ex = await c.query(
        `SELECT id, source, salesperson_id FROM sales_opportunities WHERE client_id = $1 AND archived_at IS NULL LIMIT 1`, [client_id]);
      if (ex.rows[0]) {
        if (sellerId && ex.rows[0].salesperson_id && ex.rows[0].salesperson_id !== sellerId) return { assigned_to_other: true };
        if (sellerId) {
          await c.query(`UPDATE sales_opportunities SET salesperson_id=$1,updated_at=now() WHERE id=$2`, [sellerId, ex.rows[0].id]);
          await c.query(`UPDATE clients SET salesperson_id=$1 WHERE id=$2`, [sellerId, client_id]);
        }
        if (String(ex.rows[0].source || '').toLowerCase() === 'desde_cliente') {
          await seedClientActiveLines(c, ex.rows[0].id, client_id);
          await ensureOpportunityWorkflowSteps(c, ex.rows[0].id);
        }
        return { opportunity_id: ex.rows[0].id, already: true };
      }
      const opp = await c.query(
        `INSERT INTO sales_opportunities (client_id, salesperson_id, title, opportunity_type, status, source)
         VALUES ($1,$2,$3,'manual','activa','desde_cliente') RETURNING id`,
        [client_id, sellerId, 'Seguimiento · ' + cli.rows[0].name]);
      if (sellerId) await c.query(`UPDATE clients SET salesperson_id=$1 WHERE id=$2`, [sellerId, client_id]);
      await seedClientActiveLines(c, opp.rows[0].id, client_id);
      await ensureOpportunityWorkflowSteps(c, opp.rows[0].id);
      return { opportunity_id: opp.rows[0].id, already: false };
    });
    if (!out) return res.status(404).json({ error: 'Cliente no existe' });
    if (out.invalid_client) {
      return res.status(422).json({ error: 'El cliente no tiene empresa ni nombre. Complétalo antes de enviarlo a seguimiento.' });
    }
    if (out.seller_not_configured) return res.status(403).json({ error: 'Tu usuario vendedor no está vinculado a un vendedor del CRM. Solicita la configuración al supervisor.' });
    if (out.assigned_to_other) return res.status(403).json({ error: 'No puedes abrir un seguimiento asignado a otro vendedor.' });
    res.json(out);
  } catch (e) {
    console.error('[from-client]', e.message);
    res.status(500).json({ error: e.message });
  }
});
