// Acciones de escritura sobre data REAL (crm_pro / public): clientes, BANs, suscriptores.
// Respeta los CHECK reales: BAN number = 9 dígitos, phone_number = 10 dígitos,
// status suscriptor IN (activo|cancelado|suspendido), status BAN usa A/C/I/S en produccion.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { applyPlanCodeDefaults } from '../services/planCode.js';
import { resolvePlanRateWithFallback } from '../services/planRateCatalog.js';
import { normalizeOperationalStatus } from '../services/subscriberClassification.js';

export const writeRouter = Router();
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const VALID_SUBSCRIBER_PHONE = /^(787|939|989)\d{7}$/;
const VALID_CLIENT_NOTE_TYPES = new Set(['nota', 'no_renueva', 'pendiente', 'riesgo', 'otro']);
function isMissingClientIdentityValue(value) {
  const v = String(value || '').trim();
  return !v || /^SIN NOMBRE - BAN\s+/i.test(v);
}
function contractEndFromRemainingPayments(v) {
  const n = Number.parseInt(String(v || ''), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
async function wp(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await c.query('SET LOCAL search_path TO public'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; }
  finally { c.release(); }
}

// EDITAR cliente
writeRouter.put('/clients-real/:id', requireAuth, async (req, res) => {
  const body = req.body || {};
  const allowed = [
    'name', 'owner_name', 'contact_person', 'email',
    'phone', 'additional_phone', 'cellular',
    'address', 'city', 'zip_code', 'tax_id', 'business_name'
  ];
  const sets = [], vals = [];
  for (const k of allowed) if (k in body) { vals.push(body[k] === '' ? null : body[k]); sets.push(`${k} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  try {
    const r = await wp(async c => {
      if (body.name && !('business_name' in body)) {
        const current = await c.query(`SELECT business_name FROM clients WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (isMissingClientIdentityValue(current.rows[0]?.business_name)) {
          vals.push(body.name);
          sets.push(`business_name = $${vals.length}`);
        }
      }
      vals.push(req.params.id);
      return c.query(`UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING id`, vals);
    });
    if (!r.rows[0]) return res.status(404).json({ error: 'Cliente no existe' });
    res.json({ ok: true });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// NOTA interna del cliente: no crea oportunidad, no modifica Asana ni estados.
writeRouter.post('/clients-real/:id/notes', requireAuth, async (req, res) => {
  const body = req.body || {};
  const rawType = String(body.type || '').trim();
  const type = VALID_CLIENT_NOTE_TYPES.has(rawType) ? rawType : 'nota';
  const note = String(body.note || '').trim();
  if (!note) return res.status(400).json({ error: 'Escribe una nota antes de guardar' });
  if (note.length > 1200) return res.status(400).json({ error: 'La nota no puede pasar de 1200 caracteres' });
  const createdBy = req.user?.nombre || req.user?.nick || req.user?.email || req.user?.username || 'Usuario';
  try {
    const r = await wp(async c => {
      const client = await c.query(`SELECT id FROM clients WHERE id = $1`, [req.params.id]);
      if (!client.rows[0]) return null;
      return c.query(
        `INSERT INTO client_notes (client_id, type, note, created_by_name)
         VALUES ($1,$2,$3,$4)
         RETURNING id, type, note, created_by_name AS created_by, created_at`,
        [req.params.id, type, note, createdBy]);
    });
    if (!r) return res.status(404).json({ error: 'Cliente no existe' });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '42P01') return res.status(500).json({ error: 'Falta aplicar la migracion de notas del cliente' });
    res.status(500).json({ error: e.message });
  }
});

// ELIMINAR cliente (cascada de BANs/suscriptores según FKs)
writeRouter.delete('/clients-real/:id', requireAuth, async (req, res) => {
  try { await wp(c => c.query(`DELETE FROM clients WHERE id = $1`, [req.params.id])); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// NUEVO BAN
writeRouter.post('/clients-real/:id/bans', requireAuth, async (req, res) => {
  const num = onlyDigits(req.body && req.body.number);
  const acct = (req.body && req.body.account_type) || null;
  if (num.length !== 9) return res.status(400).json({ error: 'El BAN debe tener 9 dígitos' });
  try { const r = await wp(c => c.query(`INSERT INTO bans (client_id, ban_number, status, account_type) VALUES ($1,$2,'A',$3) RETURNING id, ban_number`, [req.params.id, num, acct])); res.status(201).json(r.rows[0]); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// CANCELAR BAN: solo cambia el estado del BAN, no borra suscriptores.
writeRouter.put('/bans-real/:id', requireAuth, async (req, res) => {
  const status = String(req.body?.status || '').trim().toUpperCase();
  if (status !== 'C') return res.status(400).json({ error: 'Solo se permite cancelar el BAN' });
  try {
    const r = await wp(c => c.query(
      `UPDATE bans
          SET status = 'C', updated_at = now()
        WHERE id = $1
        RETURNING id, ban_number, status`,
      [req.params.id],
    ));
    if (!r.rows[0]) return res.status(404).json({ error: 'BAN no existe' });
    res.json({ ok: true, ban: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AGREGAR suscriptor a un BAN
writeRouter.post('/bans-real/:banId/subscribers', requireAuth, async (req, res) => {
  const b = req.body || {}; const ph = onlyDigits(b.phone);
  const planDefaults = applyPlanCodeDefaults({
    plan: b.plan,
    price_code: b.price_code,
    contract_term: b.contract_term,
  });
  if (ph.length !== 10) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos' });
  if (ph.startsWith('100')) return res.status(422).json({ error: 'El codigo interno 100 no es un suscriptor y no se puede guardar' });
  if (!VALID_SUBSCRIBER_PHONE.test(ph)) return res.status(422).json({ error: 'El suscriptor debe comenzar con 787, 939 o 989' });
  if (b.remaining_payments && !b.contract_end_date) b.contract_end_date = contractEndFromRemainingPayments(b.remaining_payments);
  const suppliedMonthlyValue = Number(b.monthly_value);
  const resolvedPlanRate = Number.isFinite(suppliedMonthlyValue) && suppliedMonthlyValue > 0
    ? { value: suppliedMonthlyValue, source: 'manual', ambiguous: false }
    : await resolvePlanRateWithFallback({
      originalCode: b.price_code || b.plan,
      lookupCode: planDefaults.price_code,
    });
  try {
    const r = await wp(async c => {
      const expectedBan = onlyDigits(b.expected_ban_number);
      if (expectedBan) {
        const targetBan = await c.query(`SELECT ban_number FROM bans WHERE id = $1 LIMIT 1`, [req.params.banId]);
        if (!targetBan.rows[0]) {
          const err = new Error('BAN destino no existe');
          err.statusCode = 404;
          throw err;
        }
        const targetBanNumber = onlyDigits(targetBan.rows[0].ban_number);
        if (targetBanNumber !== expectedBan) {
          const err = new Error(`La imagen pertenece al BAN ${expectedBan}, pero estás intentando guardar en el BAN ${targetBanNumber}. No se guardó.`);
          err.statusCode = 409;
          throw err;
        }
      }
      const existing = await c.query(
        `SELECT s.id, s.status AS previous_status, b.ban_number AS previous_ban_number, s.ban_id
           FROM subscribers s
           LEFT JOIN bans b ON b.id = s.ban_id
          WHERE s.phone_norm = $1::text
          LIMIT 1`,
        [ph]
      );
      if (existing.rows[0] && String(existing.rows[0].ban_id) !== String(req.params.banId)) {
        const err = new Error(`El teléfono ya existe en el BAN ${existing.rows[0].previous_ban_number || 'desconocido'}. No se reasignó automáticamente.`);
        err.statusCode = 409;
        err.existing = existing.rows[0];
        throw err;
      }
      return c.query(
        `WITH existing AS (
         SELECT s.id, s.status AS previous_status, b.ban_number AS previous_ban_number
           FROM subscribers s
           LEFT JOIN bans b ON b.id = s.ban_id
          WHERE s.phone_norm = $2::text
          LIMIT 1
       ),
       upsert AS (
          INSERT INTO subscribers (
           ban_id, phone, phone_norm, plan, monthly_value, line_kind, line_type, equipment,
           activation_date, contract_start_date, contract_end_date, contract_term, remaining_payments,
           product_type, price_code, payments_made, status
          )
          VALUES ($1,$2::text,$2::text,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'activo')
         ON CONFLICT (phone_norm) WHERE phone_norm IS NOT NULL AND phone_norm <> ''
         DO UPDATE SET
           ban_id = EXCLUDED.ban_id,
           phone = EXCLUDED.phone,
           plan = COALESCE(EXCLUDED.plan, subscribers.plan),
           monthly_value = COALESCE(EXCLUDED.monthly_value, subscribers.monthly_value),
           line_kind = COALESCE(EXCLUDED.line_kind, subscribers.line_kind),
           line_type = COALESCE(EXCLUDED.line_type, subscribers.line_type),
           equipment = COALESCE(EXCLUDED.equipment, subscribers.equipment),
           activation_date = COALESCE(EXCLUDED.activation_date, subscribers.activation_date),
           contract_start_date = COALESCE(EXCLUDED.contract_start_date, subscribers.contract_start_date),
           contract_end_date = COALESCE(EXCLUDED.contract_end_date, subscribers.contract_end_date),
           contract_term = COALESCE(EXCLUDED.contract_term, subscribers.contract_term),
           remaining_payments = COALESCE(EXCLUDED.remaining_payments, subscribers.remaining_payments),
           product_type = COALESCE(EXCLUDED.product_type, subscribers.product_type),
           price_code = COALESCE(EXCLUDED.price_code, subscribers.price_code),
           payments_made = COALESCE(EXCLUDED.payments_made, subscribers.payments_made),
           status = 'activo',
           cancel_reason = NULL,
           updated_at = now()
         RETURNING id, (xmax = 0) AS inserted
       )
       SELECT upsert.id, upsert.inserted, existing.previous_status, existing.previous_ban_number
         FROM upsert
         LEFT JOIN existing ON true`,
      [
        req.params.banId,
        ph,
        planDefaults.plan || null,
        resolvedPlanRate.value,
        b.line_kind || null,
        b.line_type || null,
        b.equipment || null,
        b.activation_date || null,
        b.contract_start_date || null,
        b.contract_end_date || null,
        planDefaults.contract_term || null,
        b.remaining_payments ? Number(b.remaining_payments) || null : null,
        b.product_type || null,
        planDefaults.price_code || null,
        b.payments_made ? Number(b.payments_made) || null : null,
      ]);
    });
    res.status(r.rows[0]?.inserted ? 201 : 200).json(r.rows[0]);
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message, existing: e.existing || null }); }
});

// EDITAR / cambiar estado suscriptor (status: activo|cancelado|suspendido)
writeRouter.put('/subscribers-real/:id', requireAuth, async (req, res) => {
  if (req.body?.remaining_payments && !req.body.contract_end_date) {
    req.body.contract_end_date = contractEndFromRemainingPayments(req.body.remaining_payments);
  }
  const body = req.body || {};
  if ('status' in body) body.status = normalizeOperationalStatus(body.status);
  if ('plan' in body || 'price_code' in body || 'contract_term' in body) {
    const planDefaults = applyPlanCodeDefaults(body);
    if ('plan' in body) body.plan = planDefaults.plan;
    if (planDefaults.price_code) body.price_code = planDefaults.price_code;
    if (planDefaults.contract_term) body.contract_term = planDefaults.contract_term;
  }
  const sets = [], vals = [];
  if ('phone' in body) {
    const ph = onlyDigits(body.phone);
    if (ph.length !== 10) return res.status(400).json({ error: 'El telefono debe tener 10 digitos' });
    if (ph.startsWith('100')) return res.status(422).json({ error: 'El codigo interno 100 no es un suscriptor y no se puede guardar' });
    if (!VALID_SUBSCRIBER_PHONE.test(ph)) return res.status(422).json({ error: 'El suscriptor debe comenzar con 787, 939 o 989' });
    vals.push(ph); sets.push(`phone = $${vals.length}`);
    vals.push(ph); sets.push(`phone_norm = $${vals.length}`);
  }
  const allowed = ['plan', 'monthly_value', 'status', 'activation_date', 'contract_start_date', 'contract_end_date', 'contract_term', 'remaining_payments', 'cancel_reason', 'line_kind', 'line_type', 'equipment', 'product_type', 'price_code', 'payments_made'];
  for (const k of allowed) if (k in body) { vals.push(body[k] === '' ? null : body[k]); sets.push(`${k} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(req.params.id);
  try {
    const r = await wp(c => c.query(`UPDATE subscribers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING id`, vals));
    if (!r.rows[0]) return res.status(404).json({ error: 'Suscriptor no existe' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese telefono ya existe en otro suscriptor' });
    res.status(500).json({ error: e.message });
  }
});

// REVISION GPON / aumento aplicable por linea fija.
writeRouter.put('/subscribers-real/:id/gpon-review', requireAuth, async (req, res) => {
  const body = req.body || {};
  const gponApplies = body.gpon_applies === true ? true : body.gpon_applies === false ? false : null;
  const note = String(body.gpon_note || '').trim().slice(0, 80) || null;
  const reviewedAt = body.reviewed_at || body.gpon_reviewed_at || new Date().toISOString().slice(0, 10);
  try {
    const r = await wp(async c => {
      const sub = await c.query(
        `SELECT id, COALESCE(LOWER(line_kind::text),
                CASE UPPER(COALESCE(product_type::text,''))
                  WHEN 'O' THEN 'fijo'
                  WHEN 'T' THEN 'fijo'
                  WHEN 'V' THEN 'fijo'
                END,
                '') AS kind
           FROM subscribers
          WHERE id = $1`,
        [req.params.id],
      );
      if (!sub.rows[0]) {
        const err = new Error('Suscriptor no existe');
        err.statusCode = 404;
        throw err;
      }
      if (sub.rows[0].kind !== 'fijo') {
        const err = new Error('La revision GPON solo aplica a lineas fijas');
        err.statusCode = 422;
        throw err;
      }
      return c.query(
        `INSERT INTO subscriber_gpon_reviews (
           subscriber_id, gpon_applies, gpon_note, reviewed_at, reviewed_by
         ) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (subscriber_id) DO UPDATE
           SET gpon_applies = EXCLUDED.gpon_applies,
               gpon_note = EXCLUDED.gpon_note,
               reviewed_at = EXCLUDED.reviewed_at,
               reviewed_by = EXCLUDED.reviewed_by,
               updated_at = now()
         RETURNING subscriber_id, gpon_applies, gpon_note, reviewed_at`,
        [req.params.id, gponApplies, note, reviewedAt, req.user?.usuario || req.user?.nombre || null],
      );
    });
    res.json({ ok: true, review: r.rows[0] });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// ELIMINAR suscriptor
writeRouter.delete('/subscribers-real/:id', requireAuth, async (req, res) => {
  try { await wp(c => c.query(`DELETE FROM subscribers WHERE id = $1`, [req.params.id])); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
