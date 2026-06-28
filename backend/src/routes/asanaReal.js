// Asana Seg. con DATA REAL de crm_pro (SOV2): sales_opportunities + opportunity_lines + opportunity_steps.
// Lee del schema public (real). Usa BEGIN + SET LOCAL search_path para NO contaminar el pool.
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const asanaRealRouter = Router();

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
const QTY_KEYS = `('movil_ren','movil_new','claro_tv','cloud')`;   // columnas por cantidad de líneas
const MONEY_KEYS = `('fijo_ren','fijo_new','mpls')`;               // columnas por dinero
const VALID_LOG_TYPES = new Set(['llamada', 'nota']);

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

function logPrefix(type) {
  if (type === 'llamada') return '[LLAMADA]';
  if (type === 'paso') return '[PASO]';
  return '[NOTA]';
}

function logTypeSql(noteExpr = 'n.note') {
  return `CASE
    WHEN ${noteExpr} ILIKE '[LLAMADA]%' THEN 'llamada'
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
      await c.query(
        `INSERT INTO opportunity_steps (
           id, opportunity_id, product_key, step_order, name, status, source, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'product_step_templates',now(),now())`,
        [
          randomUUID(),
          opportunityId,
          productKey,
          Number(step.step_order || index + 1),
          step.name,
          existingNames.size === 0 && index === 0 ? 'en_progreso' : 'pendiente',
        ]
      );
      existingNames.add(nameKey);
    }
  }
}

// LISTA: oportunidades activas con la MISMA estructura de tu Asana real (SOV2):
// por producto -> { quantity_value, money_value, subscriber_count, current_step }
asanaRealRouter.get('/asana-real', requireAuth, async (req, res) => {
  try {
    const r = await withPublic(c => c.query(`
      SELECT o.id, o.client_id, o.status, o.title,
        ${CLIENT_NAME} AS client_name,
        c.pendiente_validacion AS client_pending_validation,
        COALESCE(c.phone, c.mobile, c.cellular) AS client_phone,
        (SELECT count(*) FROM bans b WHERE b.client_id = o.client_id)::int AS ban_count,
        (SELECT count(*) FROM subscribers s JOIN bans b ON b.id = s.ban_id WHERE b.client_id = o.client_id)::int AS subscriber_count,
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
        (SELECT COALESCE(SUM(COALESCE(ol.money_value, ol.target_monthly_value, 0)),0)::numeric FROM opportunity_lines ol WHERE ol.opportunity_id = o.id AND ol.product_key IN ${MONEY_KEYS}) AS total_money
      FROM (
        SELECT DISTINCT ON (so.client_id) so.*
        FROM sales_opportunities so
        WHERE so.archived_at IS NULL
          AND COALESCE(LOWER(so.status),'activa') = 'activa'
        ORDER BY so.client_id, so.updated_at DESC NULLS LAST, so.created_at DESC NULLS LAST, so.id
      ) o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
      ORDER BY client_name`));
    res.json(r.rows);
  } catch (e) {
    console.error('[asana-real]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DETALLE: oportunidad + pasos (caminito) + líneas (productos negociados)
asanaRealRouter.get('/asana-real/:id', requireAuth, async (req, res) => {
  try {
    const data = await withPublic(async c => {
      const o = await c.query(
        `SELECT o.id, o.title, o.status, o.opportunity_type, o.expected_monthly_value,
                ${CLIENT_NAME} AS client_name, COALESCE(sp.name,'—') AS salesperson
           FROM sales_opportunities o
           JOIN clients c ON c.id = o.client_id
           LEFT JOIN salespeople sp ON sp.id = o.salesperson_id
              WHERE o.id = $1`, [req.params.id]);
      if (!o.rows[0]) return null;
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
                regexp_replace(note, '^\\[(LLAMADA|NOTA|PASO)\\]\\s*', '', 'i') AS body,
                COALESCE(created_by_username, 'Sistema') AS user_name,
                created_at
           FROM opportunity_notes
          WHERE opportunity_id = $1
          ORDER BY created_at DESC, id DESC`, [req.params.id]);
      return { ...o.rows[0], steps: steps.rows, lines: lines.rows, log: log.rows };
    });
    if (!data) return res.status(404).json({ error: 'Oportunidad no existe' });
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
    if (!VALID_LOG_TYPES.has(type)) return res.status(400).json({ error: 'type debe ser llamada o nota' });
    if (!body) return res.status(400).json({ error: 'Escribe una nota o resumen de llamada' });
    const row = await withPublic(async c => {
      const exists = await c.query(
        `SELECT id FROM sales_opportunities WHERE id = $1 AND archived_at IS NULL`, [req.params.id]);
      if (!exists.rows[0]) return null;
      await ensureOpportunityNotes(c);
      const r = await c.query(
        `INSERT INTO opportunity_notes (
           id, opportunity_id, note, created_by_username, created_at
         ) VALUES ($1,$2,$3,$4,now())
         RETURNING id, opportunity_id, ${logTypeSql('note')} AS type,
                   regexp_replace(note, '^\\[(LLAMADA|NOTA|PASO)\\]\\s*', '', 'i') AS body,
                   COALESCE(created_by_username, 'Sistema') AS user_name, created_at`,
        [randomUUID(), req.params.id, `${logPrefix(type)} ${body}`, req.user?.nombre || 'Sistema']);
      await c.query(`UPDATE sales_opportunities SET updated_at = now() WHERE id = $1`, [req.params.id]);
      return r.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CERRAR → al pool (regla SOV2: archiva oportunidad + cliente sin vendedor)
asanaRealRouter.post('/asana-real/:id/close', requireAuth, async (req, res) => {
  try {
    const done = await withPublic(async c => {
      const o = await c.query(
        `UPDATE sales_opportunities SET status='cerrada', archived_at=now(), closed_at=now()
          WHERE id=$1 AND archived_at IS NULL RETURNING client_id`, [req.params.id]);
      if (!o.rows[0]) return false;
      await c.query(`UPDATE clients SET salesperson_id = NULL WHERE id = $1`, [o.rows[0].client_id]);
      return true;
    });
    if (!done) return res.status(404).json({ error: 'Oportunidad activa no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CLIENTE VOZ: crea cliente provisional + oportunidad + línea + nota (desde el dictado parseado)
asanaRealRouter.post('/asana-real/voz', requireAuth, async (req, res) => {
  const { empresa, telefono, product_key, qty, monto, nota } = req.body || {};
  const name = cleanText(empresa || '');
  if (!name) return res.status(400).json({ error: 'Falta la empresa o nombre del cliente' });
  const PK = ['fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls'];
  const pk = PK.includes(product_key) ? product_key : null;
  const isMoney = ['fijo_ren', 'fijo_new', 'mpls'].includes(pk);
  try {
    const out = await withPublic(async c => {
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
      const ex = await c.query(
        `SELECT id FROM sales_opportunities WHERE client_id = $1 AND archived_at IS NULL LIMIT 1`, [client_id]);
      if (ex.rows[0]) return { opportunity_id: ex.rows[0].id, already: true };
      const cli = await c.query(
        `SELECT COALESCE(NULLIF(TRIM(name),''), NULLIF(TRIM(business_name),''), 'Cliente') AS name
           FROM clients WHERE id = $1`, [client_id]);
      if (!cli.rows[0]) return null;
      const opp = await c.query(
        `INSERT INTO sales_opportunities (client_id, title, opportunity_type, status, source)
         VALUES ($1,$2,'manual','activa','desde_cliente') RETURNING id`,
        [client_id, 'Seguimiento · ' + cli.rows[0].name]);
      return { opportunity_id: opp.rows[0].id, already: false };
    });
    if (!out) return res.status(404).json({ error: 'Cliente no existe' });
    res.json(out);
  } catch (e) {
    console.error('[from-client]', e.message);
    res.status(500).json({ error: e.message });
  }
});
