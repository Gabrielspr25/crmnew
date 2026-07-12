// Endpoints de Comparativas e Historial (bitácora del sistema).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const miscRouter = Router();

// ---------- COMPARATIVAS ----------

// POST /api/comparativas  -> guardar una comparativa
miscRouter.post('/comparativas', requireAuth, async (req, res) => {
  const { client_id, name, current_total, offer_total, lines, notes, payload, source } = req.body || {};
  const packedLines = payload
    ? { source: source || 'constructor_ofertas', payload, lines: lines || [] }
    : lines;
  const r = await query(
    `INSERT INTO public.comparativas (client_id, name, current_total, offer_total, lines, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [client_id || null, name || null, current_total || null, offer_total || null,
     packedLines ? JSON.stringify(packedLines) : null, notes || null, req.user.nombre || req.user.nick]);
  res.status(201).json(r.rows[0]);
});

// GET /api/comparativas?client_id=  -> listado (historial)
miscRouter.get('/comparativas', requireAuth, async (req, res) => {
  const { client_id } = req.query;
  const r = await query(
    `SELECT id, client_id, name, current_total, offer_total, created_by, created_at
     FROM public.comparativas
      WHERE ($1::uuid IS NULL OR client_id = $1::uuid)
      ORDER BY created_at DESC LIMIT 100`, [client_id || null]);
  res.json(r.rows);
});

// GET /api/comparativas/:id  -> una comparativa completa
miscRouter.get('/comparativas/:id', requireAuth, async (req, res) => {
  const r = await query('SELECT * FROM public.comparativas WHERE id = $1', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Comparativa no existe' });
  res.json(r.rows[0]);
});

// GET /api/export/full -> exportacion completa de tablas operativas del CRM.
miscRouter.get('/export/full', requireAuth, async (req, res) => {
  const tables = await query(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema IN ('public','ventaspro_nuevo')
        AND table_name NOT IN ('spatial_ref_sys')
      ORDER BY table_schema, table_name`
  );
  const data = {};
  for (const t of tables.rows) {
    const key = `${t.table_schema}.${t.table_name}`;
    const sql = `SELECT * FROM "${t.table_schema}"."${t.table_name}"`;
    const rows = await query(sql);
    data[key] = rows.rows;
  }
  res.setHeader('Content-Disposition', `attachment; filename="crm-export-${new Date().toISOString().slice(0,10)}.json"`);
  res.json({
    generated_at: new Date().toISOString(),
    generated_by: req.user?.nick || req.user?.nombre || null,
    tables: data,
  });
});

// ---------- HISTORIAL (bitácora) ----------

// GET /api/audit?type=&user=&limit=  -> bitácora del sistema
miscRouter.get('/audit', requireAuth, async (req, res) => {
  const { type, user, limit } = req.query;
  const r = await query(
    `SELECT * FROM ventaspro_nuevo.audit_log
      WHERE ($1::text IS NULL OR type = $1)
        AND ($2::text IS NULL OR user_name ILIKE $2)
      ORDER BY created_at DESC
      LIMIT $3`, [type || null, user ? `%${user}%` : null, Number(limit) || 100]);
  res.json(r.rows);
});

// Helper para registrar en la bitácora desde cualquier parte.
export async function logAudit({ user_name, type, detail, entity, meta }) {
  await query(
    `INSERT INTO ventaspro_nuevo.audit_log (user_name, type, detail, entity, meta)
     VALUES ($1,$2,$3,$4,$5)`,
    [user_name || null, type, detail || null, entity || null, meta ? JSON.stringify(meta) : null]);
}
