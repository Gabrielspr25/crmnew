import {createAsanaAttachmentsRouter,listAsanaAttachments} from './asanaAttachments.js';
// Asana Seg. con DATA REAL de crm_pro (SOV2): sales_opportunities + opportunity_lines + opportunity_steps.
// Lee del schema public (real). Usa BEGIN + SET LOCAL search_path para NO contaminar el pool.
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { updateOpportunityReferral } from '../services/asanaReferral.js';
import { reconcileOpportunity, opportunitySalesContext } from '../services/opportunityConfirmedSales.js';
import { clientNameKeySql } from '../services/clientIdentity.js';

export const asanaRealRouter = Router();
asanaRealRouter.use(createAsanaAttachmentsRouter({pool,requireAuth}));

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
const clientGroupKeySql = (alias) => clientNameKeySql(
  `COALESCE(NULLIF(${alias}.business_name,''), NULLIF(${alias}.name,''), ${alias}.id::text)`
);
// Asana es una vista operativa: no debe mostrar oportunidades de clientes sin identidad usable.
const VALID_ASANA_CLIENT_SQL = `(NULLIF(TRIM(COALESCE(c.name, c.business_name, '')), '') IS NOT NULL
  AND LOWER(TRIM(COALESCE(c.name, c.business_name, ''))) NOT IN ('—', '-', 'null', 'sin nombre'))`;
const QTY_KEYS = `('movil_ren','movil_new','claro_tv','cloud','mpls')`;   // columnas por cantidad de líneas
const MONEY_KEYS = `('fijo_ren','fijo_new')`;               // columnas por dinero
const VALID_LOG_TYPES = new Set(['llamada', 'nota']);
const ASANA_PRIORITY_NOTE_PREFIX = '[ASANA_PRIORITY:';
const ASANA_CALL_STATUS_PREFIX = '[ASANA_CALL_STATUS:';
const VALID_ASANA_PRIORITIES = new Set(['alta', 'media', 'baja']);

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

function cleanText(value) {
  return String(value || '').trim();
}

function hasOperationalClientName(value) {
  const name = cleanText(value).toLowerCase();
  return Boolean(name) && !['—', '-', 'null', 'sin nombre'].includes(name);
}

function cleanDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function logPrefix(type) {
  if (type === 'llamada') return '[LLAMADA]';
  if (type === 'paso') return '[PASO]';
  return '[NOTA]';
}

function logTypeSql(noteExpr = 'n.note') {
  return `CASE
    WHEN ${noteExpr} ILIKE '[LLAMADA]%' THEN 'llamada'
    WHEN ${noteExpr} ILIKE '[LLAMADA_AGENDADA:%' THEN 'llamada'
    WHEN ${noteExpr} ILIKE '[PASO]%' THEN 'paso'
    ELSE 'nota'
  END`;
}

async function resolveAsanaClientGroup(c, clientId) {
  const grouped = await c.query(
    `SELECT COALESCE(NULLIF(TRIM(c_anchor.name),''), NULLIF(TRIM(c_anchor.business_name),'')) AS name,
            array_agg(c_group.id ORDER BY c_group.created_at DESC, c_group.id) AS client_ids
       FROM clients c_anchor
       JOIN clients c_group
         ON ${clientGroupKeySql('c_group')} = ${clientGroupKeySql('c_anchor')}
      WHERE c_anchor.id = $1
      GROUP BY c_anchor.id, c_anchor.name, c_anchor.business_name`,
    [clientId]
  );
  return grouped.rows[0] || null;
}

function scheduledCallSql(noteExpr = 'n.note') {
  return `CASE
    WHEN ${noteExpr} ~ '^\\[LLAMADA_AGENDADA:[^\\]]+\\]'
    THEN NULLIF(substring(${noteExpr} FROM '^\\[LLAMADA_AGENDADA:([^\\]]+)\\]'), '')::timestamptz
    ELSE NULL
  END`;
}

function cleanLogBodySql(noteExpr = 'note') {
  return `regexp_replace(
    regexp_replace(${noteExpr}, '^\\[(LLAMADA|NOTA|PASO|ASANA_PRIORITY:[^\\]]+)\\]\\s*', '', 'i'),
    '^\\[LLAMADA_AGENDADA:[^\\]]+\\]\\s*',
    '',
    'i'
  )`;
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
    `SELECT DISTINCT product_key
       FROM opportunity_lines
      WHERE opportunity_id = $1
        AND product_key IS NOT NULL
      ORDER BY product_key`,
    [opportunityId]
  );

  const anchor=await c.query('SELECT created_at FROM sales_opportunities WHERE id=$1',[opportunityId]);
  const context=await opportunitySalesContext(c,opportunityId);
  const pending=reconcileOpportunity(anchor.rows[0]||{},context.lines,context.sales,context.subscribers);
  const productRows=[...new Set([...products.rows.map(r=>r.product_key),...Object.keys(pending.products)])].map(product_key=>({product_key}));
  for (const row of productRows) {
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

async function fetchScheduledCalls(c, includeHistory = false) {
  const r = await c.query(`
    SELECT n.id, n.opportunity_id, ${CLIENT_NAME} AS client_name,
           COALESCE(sp.name,'Sin asignar') AS salesperson,
           ${scheduledCallSql('n.note')} AS scheduled_call_at,
           ${cleanLogBodySql('n.note')} AS body,
           ${cleanLogBodySql('n.note')} AS title,
           n.created_at, 'llamada' AS type, 'llamada' AS item_type,
           COALESCE(latest.status, n.scheduled_status, 'pendiente') AS status,
           ${scheduledCallSql('n.note')} AS due_at, o.client_id
      FROM opportunity_notes n
      JOIN sales_opportunities o ON o.id = n.opportunity_id
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
      LEFT JOIN LATERAL (
        SELECT substring(done.note from ':([a-z]+)\\]') AS status
          FROM opportunity_notes done
         WHERE done.opportunity_id=n.opportunity_id
           AND done.note LIKE '${ASANA_CALL_STATUS_PREFIX}' || n.id::text || ':%'
         ORDER BY done.created_at DESC, done.id DESC LIMIT 1
      ) latest ON TRUE
     WHERE n.note ~ '^\\[LLAMADA_AGENDADA:[^\\]]+\\]'
       AND n.deleted_at IS NULL AND o.archived_at IS NULL
       AND ($1::boolean OR COALESCE(latest.status,n.scheduled_status,'pendiente')='pendiente')
     ORDER BY due_at, n.created_at`, [includeHistory]);
  return r.rows;
}

async function saveAsanaPriority(req) {
  const priority = cleanText(req.body?.priority).toLowerCase();
  const storedPriority = priority || 'automatica';
  if (storedPriority !== 'automatica' && !VALID_ASANA_PRIORITIES.has(storedPriority)) return { badRequest: true };
  return withPublic(async c => {
    const exists = await c.query(
      `SELECT id FROM sales_opportunities WHERE id = $1 AND archived_at IS NULL`, [req.params.id]);
    if (!exists.rows[0]) return null;
    await ensureOpportunityNotes(c);
    const r = await c.query(
      `INSERT INTO opportunity_notes (
         id, opportunity_id, note, created_by_username, created_at
       ) VALUES ($1,$2,$3,$4,now())
       RETURNING id, opportunity_id, created_at`,
      [randomUUID(), req.params.id, `${ASANA_PRIORITY_NOTE_PREFIX}${storedPriority}] Prioridad ${storedPriority}`, req.user?.nombre || 'Sistema']);
    await c.query(`UPDATE sales_opportunities SET updated_at = now() WHERE id = $1`, [req.params.id]);
    return { ...r.rows[0], manual_priority: storedPriority === 'automatica' ? null : storedPriority };
  });
}

// LISTA: oportunidades activas con la MISMA estructura de tu Asana real (SOV2):
// por producto -> { quantity_value, money_value, subscriber_count, current_step }
asanaRealRouter.get('/asana-real', requireAuth, async (req, res) => {
  try {
    const r = await withPublic(async c => {
      await ensureOpportunityNotes(c);
      const listed = await c.query(`
        WITH client_groups AS (
          SELECT c_group.id AS client_id,
                 ${clientGroupKeySql('c_group')} AS client_group_key
            FROM clients c_group
        ),
        active_opportunities AS (
          SELECT DISTINCT ON (cg.client_group_key) so.*, cg.client_group_key
          FROM sales_opportunities so
          JOIN client_groups cg ON cg.client_id = so.client_id
          WHERE so.archived_at IS NULL
            AND COALESCE(LOWER(so.status),'activa') = 'activa'
          ORDER BY cg.client_group_key, so.updated_at DESC NULLS LAST, so.created_at DESC NULLS LAST, so.id
        ),
        priority_notes AS (
          SELECT DISTINCT ON (n.opportunity_id)
                 n.opportunity_id,
                 NULLIF(LOWER(NULLIF(substring(n.note FROM '^\\[ASANA_PRIORITY:(alta|media|baja|automatica)\\]'), '')), 'automatica') AS manual_priority
            FROM opportunity_notes n
           WHERE n.note ~* '^\\[ASANA_PRIORITY:(alta|media|baja|automatica)\\]'
           ORDER BY n.opportunity_id, n.created_at DESC, n.id DESC
        ),
        activity AS (
          SELECT o.id AS opportunity_id,
                 MIN(${scheduledCallSql('n.note')}) FILTER (WHERE ${scheduledCallSql('n.note')} >= now() - interval '1 day') AS next_due_at,
                 MAX(GREATEST(COALESCE(n.created_at, o.created_at), COALESCE(s.updated_at, s.created_at, o.created_at), COALESCE(o.updated_at, o.created_at))) AS last_activity_at
            FROM active_opportunities o
            LEFT JOIN opportunity_notes n ON n.opportunity_id = o.id
            LEFT JOIN opportunity_steps s ON s.opportunity_id = o.id
           GROUP BY o.id
        ),
        list AS (
          SELECT o.id, o.created_at, o.client_id, o.status, o.title, o.salesperson_id, o.referred_by_name,
            ${CLIENT_NAME} AS client_name,
            c.pendiente_validacion AS client_pending_validation,
            COALESCE(c.phone, c.cellular) AS client_phone,
            (SELECT COUNT(DISTINCT b.id)
               FROM bans b
               JOIN client_groups grouped_client ON grouped_client.client_id = b.client_id
              WHERE grouped_client.client_group_key = o.client_group_key)::int AS ban_count,
            (SELECT string_agg(DISTINCT b.ban_number::text, ', ' ORDER BY b.ban_number::text)
               FROM bans b
               JOIN client_groups grouped_client ON grouped_client.client_id = b.client_id
              WHERE grouped_client.client_group_key = o.client_group_key
                AND NULLIF(TRIM(b.ban_number::text),'') IS NOT NULL) AS ban_numbers,
            (SELECT COUNT(DISTINCT s.id)
               FROM subscribers s
               JOIN bans b ON b.id = s.ban_id
               JOIN client_groups grouped_client ON grouped_client.client_id = b.client_id
              WHERE grouped_client.client_group_key = o.client_group_key)::int AS subscriber_count,
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
                GROUP BY ol.product_key) t), '{}') AS products,
            (SELECT COALESCE(SUM(COALESCE(ol.quantity_value,0)),0)::numeric FROM opportunity_lines ol WHERE ol.opportunity_id = o.id AND ol.product_key IN ${QTY_KEYS}) AS total_lines,
            (SELECT COALESCE(SUM(COALESCE(ol.money_value, ol.target_monthly_value, 0)),0)::numeric FROM opportunity_lines ol WHERE ol.opportunity_id = o.id AND ol.product_key IN ${MONEY_KEYS}) AS total_money,
            pn.manual_priority,
            a.next_due_at,
            COALESCE(a.last_activity_at, o.updated_at, o.created_at) AS last_activity_at,
            CASE
              WHEN pn.manual_priority = 'alta' THEN 'today'
              WHEN pn.manual_priority = 'media' THEN 'week'
              WHEN pn.manual_priority = 'baja' THEN 'waiting'
              WHEN a.next_due_at <= date_trunc('day', now()) + interval '1 day' THEN 'today'
              WHEN a.next_due_at <= date_trunc('day', now()) + interval '7 days' THEN 'week'
              ELSE 'none'
            END AS priority_bucket,
            CASE
              WHEN pn.manual_priority = 'alta' THEN 0
              WHEN pn.manual_priority = 'media' THEN 1
              WHEN pn.manual_priority = 'baja' THEN 2
              WHEN a.next_due_at <= date_trunc('day', now()) + interval '1 day' THEN 0
              WHEN a.next_due_at <= date_trunc('day', now()) + interval '7 days' THEN 1
              ELSE 3
            END AS priority_bucket_rank,
            CASE
              WHEN a.next_due_at <= date_trunc('day', now()) + interval '1 day' THEN 0
              WHEN a.next_due_at <= date_trunc('day', now()) + interval '7 days' THEN 1
              ELSE 2
            END AS urgency_rank,
            CASE pn.manual_priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 WHEN 'baja' THEN 2 ELSE 3 END AS manual_priority_rank
          FROM active_opportunities o
          JOIN clients c ON c.id = o.client_id
          LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
          LEFT JOIN priority_notes pn ON pn.opportunity_id = o.id
          LEFT JOIN activity a ON a.opportunity_id = o.id
          WHERE ${VALID_ASANA_CLIENT_SQL}
        )
        SELECT * FROM list
        ORDER BY priority_bucket_rank, urgency_rank, manual_priority_rank, total_money DESC NULLS LAST, last_activity_at ASC NULLS FIRST, client_name`);
      for(const row of listed.rows){
        const context=await opportunitySalesContext(c,row.id);
        const pending=reconcileOpportunity(row,context.lines,context.sales,context.subscribers);
        for(const [key,product] of Object.entries(pending.products))product.current_step=row.products?.[key]?.current_step||null;
        Object.assign(row,{products:pending.products,total_lines:pending.total_lines,total_money:pending.total_money,review_count:pending.review_count,reviews:pending.reviews,sold_count:pending.sold_count});
      }
      return listed;

    });
    res.json(r.rows);
  } catch (e) {
    console.error('[asana-real]', e.message);
    res.status(500).json({ error: e.message });
  }
});

asanaRealRouter.get('/asana-real/alerts/calls', requireAuth, async (_req, res) => {
  try {
    const items = await withPublic(fetchScheduledCalls);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

asanaRealRouter.get('/asana-real/agenda', requireAuth, async (_req, res) => {
  try {
    const items = await withPublic(c => fetchScheduledCalls(c, true));
    res.json({ items, can_view_team: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

asanaRealRouter.patch('/asana-real/agenda/calls/:id', requireAuth, async (req, res) => {
  try {
    const status = cleanText(req.body?.status).toLowerCase();
    if (!['completada', 'cancelada'].includes(status)) return res.status(400).json({ error: 'status debe ser completada o cancelada' });
    const row = await withPublic(async c => {
      await ensureOpportunityNotes(c);
      const call = await c.query(
        `SELECT id, opportunity_id FROM opportunity_notes WHERE id = $1 AND note ~ '^\\[LLAMADA_AGENDADA:[^\\]]+\\]'`,
        [req.params.id]);
      if (!call.rows[0]) return null;
      await c.query(
        `INSERT INTO opportunity_notes (id, opportunity_id, note, created_by_username, created_at)
         VALUES ($1,$2,$3,$4,now())`,
        [randomUUID(), call.rows[0].opportunity_id, `${ASANA_CALL_STATUS_PREFIX}${req.params.id}:${status}] Llamada ${status}`, req.user?.nombre || 'Sistema']);
      return { id: req.params.id, status };
    });
    if (!row) return res.status(404).json({ error: 'Llamada agendada no encontrada' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DETALLE: oportunidad + pasos (caminito) + líneas (productos negociados)
asanaRealRouter.patch('/asana-real/:id/referral', requireAuth, async (req, res) => {
  try {
    const data = await withPublic(async c => {
      const canAssign = ['admin','supervisor'].includes(String(req.user?.rol || '').trim().toLowerCase());
      const username = String(req.user?.nombre || req.user?.nick || 'Sistema').trim();
      const seller = canAssign ? null : await c.query('SELECT id FROM salespeople WHERE LOWER(TRIM(name))=LOWER(TRIM($1)) LIMIT 1', [username]);
      return updateOpportunityReferral(c, req.params.id, req.body, {canAssign, sellerId: seller?.rows[0]?.id || null, username});
    });
    res.json(data);
  } catch (e) {
    console.error('[asana-real/:id/referral]', e.message);
    res.status(e.status || 500).json({error: e.status ? e.message : 'No se pudo guardar el referido y la asignación.'});
  }
});

asanaRealRouter.get('/asana-real/:id', requireAuth, async (req, res) => {
  try {
    const data = await withPublic(async c => {
      const o = await c.query(
        `SELECT o.id, o.title, o.status, o.created_at, o.opportunity_type, o.expected_monthly_value, o.salesperson_id, o.referred_by_name,
                ${CLIENT_NAME} AS client_name, COALESCE(sp.name,'—') AS salesperson
           FROM sales_opportunities o
           JOIN clients c ON c.id = o.client_id
           LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
              WHERE o.id = $1`, [req.params.id]);
      if (!o.rows[0]) return null;
      const attachments=await listAsanaAttachments(c,req.params.id,req.user,{hideForbidden:true});
      await ensureOpportunityWorkflowSteps(c, req.params.id);
      const steps = await c.query(
        `SELECT id, product_key, name, step_order, (completed_at IS NOT NULL) AS done
           FROM opportunity_steps WHERE opportunity_id = $1 ORDER BY product_key NULLS LAST, step_order, created_at`, [req.params.id]);
      const lines = await c.query(
        `SELECT id, product_key, phone, COALESCE(quantity_value,1)::int AS qty,
                COALESCE(money_value, target_monthly_value, 0)::numeric AS amount,
                current_plan, target_plan, status
           FROM opportunity_lines WHERE opportunity_id = $1 ORDER BY created_at`, [req.params.id]);
      await ensureOpportunityNotes(c);
      const log = await c.query(
        `SELECT id, opportunity_id, product_key, step_id, step_name,
                ${logTypeSql('note')} AS type,
                ${cleanLogBodySql('note')} AS body,
                ${scheduledCallSql('note')} AS scheduled_call_at,
                COALESCE(created_by_username, 'Sistema') AS user_name,
                created_at
           FROM opportunity_notes
          WHERE opportunity_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC, id DESC`, [req.params.id]);
      const context=await opportunitySalesContext(c,req.params.id);
      const pending=reconcileOpportunity(o.rows[0],context.lines,context.sales,context.subscribers);
      return { ...o.rows[0], steps: steps.rows, lines: pending.lines, review_count:pending.review_count,reviews:pending.reviews,sold_count:pending.sold_count, log: log.rows.map(n=>({...n,attachments:attachments.filter(a=>a.note_id===n.id)})) };
    });
    if (!data) return res.status(404).json({ error: 'Oportunidad no existe' });
    res.json(data);
  } catch (e) {
    console.error('[asana-real/:id]', e.message);
    res.status(e.status||500).json({ error: e.status?e.message:"No se pudo abrir el seguimiento." });
  }
});

// COMPLETAR paso
asanaRealRouter.post('/asana-real/:id/steps/:stepId/done', requireAuth, async (req, res) => {
  try {
    const r = await withPublic(async c => {
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
    if (!r?.rows?.[0]) return res.status(404).json({ error: 'Paso no existe' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// REGISTRAR llamada o nota en la bitácora SOV2 real
asanaRealRouter.post('/asana-real/:id/log', requireAuth, async (req, res) => {
  try {
    const type = cleanText(req.body?.type).toLowerCase();
    const body = cleanText(req.body?.body || req.body?.note);
    const scheduledAt = cleanText(req.body?.scheduled_call_at);
    if (!VALID_LOG_TYPES.has(type)) return res.status(400).json({ error: 'type debe ser llamada o nota' });
    if (!body) return res.status(400).json({ error: 'Escribe una nota o resumen de llamada' });
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ error: 'Fecha de llamada inválida' });
    const row = await withPublic(async c => {
      const exists = await c.query(
        `SELECT id FROM sales_opportunities WHERE id = $1 AND archived_at IS NULL`, [req.params.id]);
      if (!exists.rows[0]) return null;
      await ensureOpportunityNotes(c);
      const notePrefix = scheduledDate
        ? `[LLAMADA_AGENDADA:${scheduledDate.toISOString()}]`
        : logPrefix(type);
      const r = await c.query(
        `INSERT INTO opportunity_notes (
           id, opportunity_id, note, created_by_username, created_at
         ) VALUES ($1,$2,$3,$4,now())
         RETURNING id, opportunity_id, ${logTypeSql('note')} AS type,
                   ${cleanLogBodySql('note')} AS body,
                   ${scheduledCallSql('note')} AS scheduled_call_at,
                   COALESCE(created_by_username, 'Sistema') AS user_name, created_at`,
        [randomUUID(), req.params.id, `${notePrefix} ${body}`, req.user?.nombre || 'Sistema']);
      await c.query(`UPDATE sales_opportunities SET updated_at = now() WHERE id = $1`, [req.params.id]);
      return r.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

asanaRealRouter.post('/asana-real/:id/priority', requireAuth, async (req, res) => {
  try {
    const row = await saveAsanaPriority(req);
    if (row?.badRequest) return res.status(400).json({ error: 'priority debe ser automatica|alta|media|baja' });
    if (!row) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

asanaRealRouter.patch('/asana-real/:id/priority', requireAuth, async (req, res) => {
  try {
    const row = await saveAsanaPriority(req);
    if (row?.badRequest) return res.status(400).json({ error: 'priority debe ser automatica|alta|media|baja' });
    if (!row) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CERRAR → al pool (regla SOV2: archiva oportunidad + cliente sin vendedor)
asanaRealRouter.post('/asana-real/:id/close', requireAuth, async (req, res) => {
  try {
    const done = await withPublic(c => closeOpportunityToPool(c, req.params.id));
    if (!done) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

asanaRealRouter.delete('/asana-real/:id', requireAuth, async (req, res) => {
  try {
    const done = await withPublic(c => closeOpportunityToPool(c, req.params.id));
    if (!done) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CLIENTE VOZ: crea cliente provisional + oportunidad + línea + nota (desde el dictado parseado)
asanaRealRouter.post('/asana-real/voz', requireAuth, async (req, res) => {
  const { empresa, telefono, product_key, qty, monto, nota } = req.body || {};
  const name = cleanText(empresa || '');
  if (!name) return res.status(400).json({ error: 'Falta la empresa o nombre del cliente' });
  const phoneDigits = cleanDigits(telefono);
  const PK = ['fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls'];
  const pk = PK.includes(product_key) ? product_key : null;
  const isMoney = ['fijo_ren', 'fijo_new', 'mpls'].includes(pk);
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
             OR ($2::text IS NOT NULL AND regexp_replace(COALESCE(c.phone,''), '\\D', '', 'g') = $2)
             OR ($2::text IS NOT NULL AND regexp_replace(COALESCE(c.cellular,''), '\\D', '', 'g') = $2)
          ORDER BY c.created_at DESC NULLS LAST, c.id
          LIMIT 1`,
        [name, phoneDigits]);
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
        [name, telefono ? cleanText(telefono) : null]);
      const clientId = cli.rows[0].id;
      const opp = await c.query(
        `INSERT INTO sales_opportunities (client_id, title, opportunity_type, status, source)
         VALUES ($1,$2,'manual','activa','cliente_voz') RETURNING id`,
        [clientId, 'Oportunidad por voz · ' + name]);
      const oppId = opp.rows[0].id;
      if (pk) {
        await c.query(
          `INSERT INTO opportunity_lines (opportunity_id, client_id, line_mode, product_key, quantity_value, money_value)
           VALUES ($1,$2,'nueva_sin_numero',$3,$4,$5)`,
          [oppId, clientId, pk, isMoney ? null : (Number(qty) || null), isMoney ? (Number(monto) || null) : null]);
      }
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
      const group = await resolveAsanaClientGroup(c, client_id);
      if (!group) return null;
      if (!hasOperationalClientName(group.name)) return { invalid_client: true };
      const ex = await c.query(
        `SELECT so.id
           FROM sales_opportunities so
          WHERE so.client_id = ANY($1::uuid[])
            AND so.archived_at IS NULL
          ORDER BY so.updated_at DESC NULLS LAST, so.created_at DESC NULLS LAST
          LIMIT 1`, [group.client_ids]);
      if (ex.rows[0]) return { opportunity_id: ex.rows[0].id, already: true };
      const opp = await c.query(
        `INSERT INTO sales_opportunities (client_id, title, opportunity_type, status, source)
         VALUES ($1,$2,'manual','activa','desde_cliente') RETURNING id`,
        [client_id, 'Seguimiento · ' + group.name]);
      return { opportunity_id: opp.rows[0].id, already: false };
    });
    if (!out) return res.status(404).json({ error: 'Cliente no existe' });
    if (out.invalid_client) {
      return res.status(422).json({ error: 'El cliente no tiene empresa ni nombre. Complétalo antes de enviarlo a seguimiento.' });
    }
    res.json(out);
  } catch (e) {
    console.error('[from-client]', e.message);
    res.status(500).json({ error: e.message });
  }
});
