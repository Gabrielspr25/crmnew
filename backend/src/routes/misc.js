// Endpoints de Comparativas e Historial (bitácora del sistema).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const miscRouter = Router();

// ---------- COMPARATIVAS ----------
// La tabla vive en ventaspro_nuevo (migracion 2026-07-06-ventaspro-nuevo-base.sql); public.comparativas no
// existe ni en local ni en produccion, y consultarla dejaba el guardado colgado.
const COMPARATIVAS = 'ventaspro_nuevo.comparativas';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Express 4 no captura errores de handlers async: sin esto la peticion queda colgada.
const conErrores = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'No se pudo procesar la comparativa', detalle: error.message });
  }
};

// POST /api/comparativas  -> guardar una comparativa
miscRouter.post('/comparativas', requireAuth, conErrores(async (req, res) => {
  const { client_id, name, current_total, offer_total, lines, notes, payload, source } = req.body || {};
  if (client_id && !UUID.test(String(client_id))) return res.status(400).json({ ok: false, error: 'client_id invalido' });
  const packedLines = payload
    ? { source: source || 'constructor_ofertas', payload, lines: lines || [] }
    : lines;
  const r = await query(
    `INSERT INTO ${COMPARATIVAS} (client_id, name, current_total, offer_total, lines, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [client_id || null, name || null, current_total ?? null, offer_total ?? null,
     packedLines ? JSON.stringify(packedLines) : null, notes || null, req.user.nombre || req.user.nick]);
  res.status(201).json(r.rows[0]);
}));

// GET /api/comparativas?client_id=  -> listado (historial)
miscRouter.get('/comparativas', requireAuth, conErrores(async (req, res) => {
  const { client_id } = req.query;
  if (client_id && !UUID.test(String(client_id))) return res.status(400).json({ ok: false, error: 'client_id invalido' });
  const r = await query(
    `SELECT id, client_id, name, current_total, offer_total, created_by, created_at
     FROM ${COMPARATIVAS}
      WHERE ($1::uuid IS NULL OR client_id = $1::uuid)
      ORDER BY created_at DESC LIMIT 100`, [client_id || null]);
  res.json(r.rows);
}));

// GET /api/comparativas/:id  -> una comparativa completa
miscRouter.get('/comparativas/:id', requireAuth, conErrores(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Comparativa no existe' });
  const r = await query(`SELECT * FROM ${COMPARATIVAS} WHERE id = $1`, [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Comparativa no existe' });
  res.json(r.rows[0]);
}));

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
export async function logAudit({ user_name, type, detail, entity, meta, ip }) {
  await query(
    `INSERT INTO ventaspro_nuevo.audit_log (user_name, type, detail, entity, meta, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user_name || null, type, detail || null, entity || null, meta ? JSON.stringify(meta) : null, ip || null]);
}
