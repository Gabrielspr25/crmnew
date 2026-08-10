// Importador (actualización masiva): recibe filas mapeadas y hace upsert en
// clientes/BANs/suscriptores (public). "El archivo manda": actualiza lo existente.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { logAudit } from './misc.js';
import { applyPlanCodeDefaults } from '../services/planCode.js';
import { resolvePlanMonthlyValueFromCatalog } from '../services/planRateCatalog.js';
import { normalizeImportedSubscriber } from '../services/subscriberClassification.js';

export const importRouter = Router();
const dig = (s) => String(s || '').replace(/\D/g, '');
const txt = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

// estado suscriptor: activo|cancelado (acepta letras sueltas A/C/S del formato PS de Claro).
// Regla del negocio: suspendido cuenta como ACTIVO (la línea sigue en la cartera).
function normStatus(s) {
  const x = String(s || '').toLowerCase().trim();
  if (!x) return null;
  if (x.includes('cancel') || x === 'c') return 'cancelado';
  if (x.includes('activ') || x === 'a' || x === 's' || x.includes('suspend')) return 'activo';
  if (x.includes('no_renueva') || x.includes('no renueva')) return 'activo';
  return null;
}
// fecha: acepta serial de Excel (45123), "30-Dec-21", ISO o cualquier cosa que Date entienda -> 'YYYY-MM-DD'
const MESES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function normDate(v) {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).trim();
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
  }
  const m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
  if (m && MESES[m[2].toLowerCase()]) {
    let y = Number(m[3]); if (y < 100) y += y < 50 ? 2000 : 1900;
    return `${y}-${String(MESES[m[2].toLowerCase()]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function normMoney(v) {
  if (v == null || String(v).trim() === '') return null;
  const cleaned = String(v).replace(/[$,\s]/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}
// Estado BAN: produccion solo acepta A (activo) o C (cancelado).
function normBanStatus(s) {
  const x = String(s || '').toLowerCase().trim();
  if (!x) return null;
  if (x === 'c' || x.includes('cancel') || x === 'i' || x.includes('inactiv')) return 'C';
  if (x === 's' || x.includes('suspend')) return 'A';
  if (x === 'a' || x.includes('activ')) return 'A';
  return null;
}

// campos de cliente que el importador puede escribir: claveImport -> columna BD
const CLI = [['company', 'business_name'], ['email', 'email'], ['phone', 'phone'], ['cellular', 'cellular'],
  ['additional_phone', 'additional_phone'], ['address', 'address'], ['city', 'city'], ['zip_code', 'zip_code'],
  ['contact_person', 'contact_person'], ['source', 'source'], ['tax_id', 'tax_id'], ['cli_notes', 'notes']];
// campos de suscriptor: claveImport -> columna BD
const SUB = [['plan', 'plan'], ['monthly_value', 'monthly_value'], ['contract_end_date', 'contract_end_date'],
  ['activation_date', 'activation_date'], ['equipment', 'equipment'], ['product_type', 'product_type'], ['item_id', 'item_id'], ['soc', 'price_code'],
  // formato PS de Claro (oficial): entra todo sin mapeo manual
  ['installment_from', 'payments_made'], ['installment_total', 'contract_term'],
  ['remaining_payments', 'remaining_payments'], ['line_kind', 'line_kind'], ['contract_start_date', 'contract_start_date']];
const SUB_DATES = new Set(['activation_date', 'contract_end_date', 'contract_start_date']);
const SUB_INTS = new Set(['payments_made', 'contract_term', 'remaining_payments']);

function appendSubscriberFieldsFromRow(r, vals, target, mode) {
  const defaults = applyPlanCodeDefaults({
    plan: txt(r.plan) || txt(r.soc),
    price_code: txt(r.soc),
    contract_term: txt(r.installment_total),
    product_type: txt(r.product_type),
    line_kind: txt(r.line_kind),
  });
  SUB.forEach(([k, col]) => {
    let v = txt(r[k]);
    if (col === 'plan') v = txt(r.plan) || txt(r.soc);
    if (col === 'price_code') v = defaults.price_code;
    if (col === 'contract_term') v = txt(r.installment_total) || defaults.contract_term;
    if (v != null) {
      if (col === 'monthly_value') {
        const amount = normMoney(v);
        // El archivo no gobierna precios: cero o vacio significan sin precio,
        // no deben reemplazar una renta valida ya almacenada.
        v = Number.isFinite(amount) && amount > 0 ? amount : null;
      }
      if (SUB_INTS.has(col)) v = Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : null;
      if (SUB_DATES.has(col)) v = normDate(v);
      if (v != null) {
        vals.push(v);
        target.push(mode === 'set' ? `${col} = $${vals.length}` : col);
      }
    }
  });
}

function pushPsRemainingPayments(r, vals, target) {
  if (txt(r.remaining_payments) != null) return;
  const paid = Number.parseInt(txt(r.installment_from) || '', 10);
  const total = Number.parseInt(txt(r.installment_total) || '', 10);
  if (Number.isFinite(paid) && Number.isFinite(total) && total >= paid) {
    vals.push(total - paid);
    target.push(`remaining_payments = $${vals.length}`);
  }
}

function appendPsRemainingPayments(r, vals, cols) {
  if (txt(r.remaining_payments) != null) return;
  const paid = Number.parseInt(txt(r.installment_from) || '', 10);
  const total = Number.parseInt(txt(r.installment_total) || '', 10);
  if (Number.isFinite(paid) && Number.isFinite(total) && total >= paid) {
    vals.push(total - paid);
    cols.push('remaining_payments');
  }
}

function subscriberValuesFromRow(r) {
  const vals = [], cols = [];
  appendSubscriberFieldsFromRow(r, vals, cols, 'col');
  appendPsRemainingPayments(r, vals, cols);
  return Object.fromEntries(cols.map((column, index) => [column, vals[index]]));
}

function positiveMonthlyValue(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function fillMissingMonthlyValueFromCatalog(r, desired, current = null) {
  const currentMonthlyValue = positiveMonthlyValue(current?.monthly_value);
  if (desired.monthly_value == null && currentMonthlyValue == null) {
    const catalogRate = await resolvePlanMonthlyValueFromCatalog([
      txt(r.soc) || txt(r.plan),
      desired.price_code,
      current?.price_code,
      current?.plan,
    ]);
    if (catalogRate.value != null) desired.monthly_value = catalogRate.value;
  }
  return desired;
}

function comparableImportValue(value, column) {
  if (value == null) return '';
  if (SUB_DATES.has(column) && value instanceof Date) return value.toISOString().slice(0, 10);
  if (SUB_DATES.has(column) && typeof value === 'string') return value.slice(0, 10);
  return String(value).trim();
}

function changedSubscriberFields(current, desired) {
  return Object.entries(desired)
    .filter(([column, value]) => comparableImportValue(current[column], column) !== comparableImportValue(value, column))
    .map(([campo, nuevo]) => ({ campo, anterior: current[campo] ?? null, nuevo }));
}

// POST /api/import/preview -> compara las filas con la BD (sin escribir): cuántas actualizan vs crean
importRouter.post('/import/preview', requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const out = { total: rows.length, sub_update: 0, sub_new: 0, ban_match: 0, ban_new: 0, cli_match: 0, cli_new: 0, sin_dato: 0 };
  const names = [...new Set(rows.map(r => String(r.name || '').trim().toLowerCase()).filter(Boolean))];
  const bans = [...new Set(rows.map(r => dig(r.ban)).filter(b => b.length === 9))];
  const phones = [...new Set(rows.map(r => dig(r.sub_phone)).filter(p => p.length === 10))];
  const c = await pool.connect();
  try {
    const exNames = names.length ? new Set((await c.query(`SELECT DISTINCT lower(name) AS n FROM public.clients WHERE lower(name) = ANY($1)`, [names])).rows.map(x => x.n)) : new Set();
    const exBans = bans.length ? new Set((await c.query(`SELECT ban_number FROM public.bans WHERE ban_number = ANY($1)`, [bans])).rows.map(x => x.ban_number)) : new Set();
    const currentSubscribers = phones.length ? (await c.query(`SELECT s.phone, b.ban_number
        FROM public.subscribers s LEFT JOIN public.bans b ON b.id = s.ban_id
       WHERE s.phone = ANY($1)`, [phones])).rows : [];
    const subscribersByPhone = new Map(currentSubscribers.map(row => [row.phone, row]));
    const exPhones = new Set(subscribersByPhone.keys());
    // Suscriptores son líneas únicas. BAN y cliente se muestran como entidades
    // únicas para que el resumen no multiplique un mismo BAN por cada línea.
    out.sub_update = phones.filter(phone => exPhones.has(phone)).length;
    out.sub_new = phones.filter(phone => !exPhones.has(phone)).length;
    out.sub_move_ban = rows.filter(r => {
      const phone = dig(r.sub_phone), ban = dig(r.ban), current = subscribersByPhone.get(phone);
      return current && ban.length === 9 && current.ban_number !== ban;
    }).length;
    out.ban_match = bans.filter(ban => exBans.has(ban)).length;
    out.ban_new = bans.filter(ban => !exBans.has(ban)).length;
    out.cli_match = names.filter(name => exNames.has(name)).length;
    out.cli_new = names.filter(name => !exNames.has(name)).length;
    for (const r of rows) {
      const name = String(r.name || '').trim(), ban = dig(r.ban), phone = dig(r.sub_phone);
      if (!name && ban.length !== 9 && phone.length !== 10) out.sin_dato++;
    }
    // bajas: lo que está en la BD pero NO vino en el archivo (solo tiene sentido con archivos completos de cartera)
    if (phones.length >= 100) {
      const ms = await c.query(`SELECT COUNT(*)::int AS n FROM public.subscribers WHERE status IS DISTINCT FROM 'cancelado' AND NOT (phone = ANY($1))`, [phones]);
      out.subs_ausentes = ms.rows[0].n;
    }
    if (bans.length >= 100) {
      const mb = await c.query(`SELECT COUNT(*)::int AS n FROM public.bans WHERE status IS DISTINCT FROM 'C' AND NOT (ban_number = ANY($1))`, [bans]);
      out.bans_ausentes = mb.rows[0].n;
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); } finally { c.release(); }
});

// POST /api/import/apply { rows:[{name,company,email,...,ban,account_type,ban_status,sub_phone,plan,...}] }
importRouter.post('/import/apply', requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No hay filas para importar' });
  const out = {
    clientes_creados: 0, clientes_actualizados: 0,
    bans_creados: 0, bans_actualizados: 0,
    subs_creados: 0, subs_actualizados: 0,
    subs_reasignados_ban: 0, sin_cambios: 0,
    bans_estado_recalculado: 0, omitidas: 0,
    detalles: [], errores: [],
  };
  const bansTocados = new Set(); // para recalcular estado del BAN según sus líneas al final
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    async function updateClientFromRow(clientId, r, displayName) {
      if (!clientId) return [];
      const valuesByColumn = new Map();
      const companyName = txt(r.company) || displayName;
      if (displayName) valuesByColumn.set('name', displayName);
      if (companyName) valuesByColumn.set('business_name', companyName);
      CLI.forEach(([k, col]) => {
        const v = txt(r[k]);
        if (v != null) valuesByColumn.set(col, v);
      });
      if (!valuesByColumn.size) return [];
      const current = (await c.query(
        `SELECT ${[...valuesByColumn.keys()].join(', ')} FROM public.clients WHERE id = $1`, [clientId],
      )).rows[0] || {};
      const changes = changedSubscriberFields(current, Object.fromEntries(valuesByColumn));
      if (!changes.length) return [];
      const sets = [], vals = [];
      for (const { campo, nuevo } of changes) {
        vals.push(nuevo);
        sets.push(`${campo} = $${vals.length}`);
      }
      vals.push(clientId);
      await c.query(`UPDATE public.clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
      return changes;
    }

    for (let i = 0; i < rows.length; i++) {
      // Una falla comercial o de datos de una fila no puede abortar la cartera completa.
      // PostgreSQL marca la transaccion como fallida hasta volver al SAVEPOINT.
      await c.query(`SAVEPOINT import_row_${i}`);
      const countersBeforeRow = {
        clientes_creados: out.clientes_creados,
        clientes_actualizados: out.clientes_actualizados,
        bans_creados: out.bans_creados,
        bans_actualizados: out.bans_actualizados,
        subs_creados: out.subs_creados,
        subs_actualizados: out.subs_actualizados,
        subs_reasignados_ban: out.subs_reasignados_ban,
        sin_cambios: out.sin_cambios,
        omitidas: out.omitidas,
      };
      const r = normalizeImportedSubscriber(rows[i] || {});
      try {
        const ban = dig(r.ban), subPhone = dig(r.sub_phone);
        const name = txt(r.name) || txt(r.company) || (ban.length === 9 && subPhone.length === 10 ? `SIN NOMBRE - BAN ${ban}` : null);
        const rowChanges = [];
        let clientId = null;

        // ----- Cliente -----
        if (ban.length === 9) {
          const f = await c.query(`SELECT client_id AS id FROM public.bans WHERE ban_number = $1 LIMIT 1`, [ban]);
          if (f.rows[0]) clientId = f.rows[0].id;
        }
        if (!clientId && subPhone.length === 10) {
          const f = await c.query(
            `SELECT b.client_id AS id
               FROM public.subscribers s
               JOIN public.bans b ON b.id = s.ban_id
              WHERE s.phone = $1
              LIMIT 1`, [subPhone]);
          if (f.rows[0]) clientId = f.rows[0].id;
        }
        if (!clientId && name) {
          const f = await c.query(`SELECT id FROM public.clients WHERE name ILIKE $1 OR business_name ILIKE $1 LIMIT 1`, [name]);
          if (f.rows[0]) clientId = f.rows[0].id;
        }

        if (clientId) {
          const changes = await updateClientFromRow(clientId, r, name);
          if (changes.length) {
            out.clientes_actualizados++;
            rowChanges.push(...changes.map(change => ({ entidad: 'cliente', ...change })));
          }
        } else if (name) {
          const f = await c.query(`SELECT id FROM public.clients WHERE name ILIKE $1 OR business_name ILIKE $1 LIMIT 1`, [name]);
          if (f.rows[0]) {
            clientId = f.rows[0].id;
            const changes = await updateClientFromRow(clientId, r, name);
            if (changes.length) {
              out.clientes_actualizados++;
              rowChanges.push(...changes.map(change => ({ entidad: 'cliente', ...change })));
            }
          } else {
            const cols = ['name', 'business_name'], vals = [name, txt(r.company) || name];
            CLI.forEach(([k, col]) => {
              const v = txt(r[k]);
              if (v != null && !cols.includes(col)) { vals.push(v); cols.push(col); }
            });
            cols.push('pendiente_validacion'); const ph = cols.map((_, j) => (cols[j] === 'pendiente_validacion' ? 'true' : '$' + (j + 1)));
            const ins = await c.query(`INSERT INTO public.clients (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING id`, vals);
            clientId = ins.rows[0].id; out.clientes_creados++;
            rowChanges.push(
              { entidad: 'cliente', campo: 'name', anterior: null, nuevo: name },
              { entidad: 'cliente', campo: 'business_name', anterior: null, nuevo: txt(r.company) || name },
            );
          }
        }

        // ----- BAN -----
        let banId = null;
        if (ban.length === 9) {
          const banStatus = normBanStatus(r.ban_status);
          let bf;
          if (clientId) bf = await c.query(`SELECT id FROM public.bans WHERE ban_number=$1 AND client_id=$2 LIMIT 1`, [ban, clientId]);
          else bf = await c.query(`SELECT id, client_id FROM public.bans WHERE ban_number=$1 LIMIT 1`, [ban]);
          if (bf.rows[0]) {
            banId = bf.rows[0].id; if (!clientId) clientId = bf.rows[0].client_id;
            const desired = {};
            const at = txt(r.account_type); if (at != null) desired.account_type = at;
            const cc = txt(r.credit_class); if (cc != null) desired.credit_class = cc;
            if (banStatus) desired.status = banStatus;
            const current = (await c.query(`SELECT account_type, credit_class, status FROM public.bans WHERE id = $1`, [banId])).rows[0] || {};
            const changes = changedSubscriberFields(current, desired);
            if (changes.length) {
              const sets = [], vals = [];
              for (const { campo, nuevo } of changes) { vals.push(nuevo); sets.push(`${campo} = $${vals.length}`); }
              vals.push(banId);
              await c.query(`UPDATE public.bans SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
              out.bans_actualizados++;
              rowChanges.push(...changes.map(change => ({ entidad: 'BAN', ...change })));
            }
          } else if (clientId) {
            const ins = await c.query(`INSERT INTO public.bans (client_id, ban_number, status, account_type, credit_class) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [clientId, ban, banStatus || 'A', txt(r.account_type), txt(r.credit_class)]);
            banId = ins.rows[0].id; out.bans_creados++;
            rowChanges.push(
              { entidad: 'BAN', campo: 'ban_number', anterior: null, nuevo: ban },
              { entidad: 'BAN', campo: 'status', anterior: null, nuevo: banStatus || 'A' },
            );
          }
        }

        // ----- Suscriptor -----
        let detalleSuscriptor = null;
        if (subPhone.length === 10) {
          const subStatus = normStatus(r.status);
          const sf = await c.query(`SELECT s.*, b.ban_number AS ban_actual
              FROM public.subscribers s
              LEFT JOIN public.bans b ON b.id = s.ban_id
             WHERE s.phone=$1 LIMIT 1`, [subPhone]);
          if (sf.rows[0]) {
                const desired = await fillMissingMonthlyValueFromCatalog(r, subscriberValuesFromRow(r), sf.rows[0]);
            if (subStatus) desired.status = subStatus;
            const changes = changedSubscriberFields(sf.rows[0], desired);
            const sets = [], vals = [];
            if (banId && sf.rows[0].ban_id !== banId) {
              vals.push(banId);
              sets.push(`ban_id = $${vals.length}`);
              changes.unshift({ campo: 'BAN', anterior: sf.rows[0].ban_actual ?? null, nuevo: ban });
              bansTocados.add(sf.rows[0].ban_id);
              out.subs_reasignados_ban++;
            }
            for (const { campo, nuevo } of changes.filter(change => change.campo !== 'BAN')) {
              vals.push(nuevo);
              sets.push(`${campo} = $${vals.length}`);
            }
            if (sets.length) {
              vals.push(sf.rows[0].id);
              await c.query(`UPDATE public.subscribers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
              out.subs_actualizados++;
              detalleSuscriptor = { fila: i + 1, BAN: ban || null, suscriptor: subPhone, accion: changes.some(change => change.campo === 'BAN') ? 'reasignado_BAN' : 'actualizado', cambios: changes.map(change => ({ entidad: 'suscriptor', ...change })) };
            } else out.sin_cambios++;
          } else if (banId) {
            const cols = ['ban_id', 'phone', 'status'], vals = [banId, subPhone, subStatus || 'activo'];
                const desired = await fillMissingMonthlyValueFromCatalog(r, subscriberValuesFromRow(r));
            for (const [column, value] of Object.entries(desired)) { cols.push(column); vals.push(value); }
            await c.query(`INSERT INTO public.subscribers (${cols.join(',')}) VALUES (${cols.map((_, j) => '$' + (j + 1)).join(',')})`, vals);
            out.subs_creados++;
            detalleSuscriptor = {
              fila: i + 1, BAN: ban || null, suscriptor: subPhone, accion: 'creado',
              cambios: [
                { entidad: 'suscriptor', campo: 'BAN', anterior: null, nuevo: ban },
                { entidad: 'suscriptor', campo: 'status', anterior: null, nuevo: subStatus || 'activo' },
                ...Object.entries(desired).map(([campo, nuevo]) => ({ entidad: 'suscriptor', campo, anterior: null, nuevo })),
              ],
            };
          } else out.omitidas++;
        } else if (!name && ban.length !== 9) out.omitidas++;
        if (banId) bansTocados.add(banId);
        if (detalleSuscriptor) {
          detalleSuscriptor.cambios = [...rowChanges, ...detalleSuscriptor.cambios];
          out.detalles.push(detalleSuscriptor);
        } else if (rowChanges.length) {
          out.detalles.push({ fila: i + 1, BAN: ban || null, suscriptor: subPhone || null, accion: 'actualizado', cambios: rowChanges });
        }
        await c.query(`RELEASE SAVEPOINT import_row_${i}`);
      } catch (e) {
        await c.query(`ROLLBACK TO SAVEPOINT import_row_${i}`).catch(() => {});
        Object.assign(out, countersBeforeRow);
        out.errores.push({ fila: i + 1, error: e.message });
      }
    }
    // Estado del BAN automático: activo si le queda alguna línea activa, si no cancelado.
    if (bansTocados.size) {
      const rec = await c.query(`UPDATE public.bans b SET status = CASE
          WHEN EXISTS (SELECT 1 FROM public.subscribers s WHERE s.ban_id = b.id AND s.status = 'activo') THEN 'A'
          ELSE 'C' END, updated_at = now()
        WHERE b.id = ANY($1)`, [[...bansTocados]]);
      out.bans_estado_recalculado = rec.rowCount;
    }
    await c.query('COMMIT');
    try {
      await logAudit({ ip: req.ip,
        user_name: req.user?.nombre || req.user?.nick || 'Sistema',
        type: 'import_apply',
        entity: 'importador',
        detail: `Importador aplicado: ${rows.length} filas, ${out.subs_actualizados} suscriptores actualizados, ${out.subs_creados} nuevos, ${out.clientes_actualizados} clientes actualizados, ${out.clientes_creados} clientes nuevos.`,
        meta: {
          total_filas: rows.length,
          clientes_creados: out.clientes_creados,
          clientes_actualizados: out.clientes_actualizados,
          bans_creados: out.bans_creados,
          bans_actualizados: out.bans_actualizados,
          subs_creados: out.subs_creados,
          subs_actualizados: out.subs_actualizados,
          bans_estado_recalculado: out.bans_estado_recalculado,
          omitidas: out.omitidas,
          errores: out.errores.length,
        },
      });
    } catch (e) {
      console.warn('[import/audit] no se pudo registrar auditoria:', e.message);
    }
    res.json(out);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('[import/apply]', e);
    res.status(500).json({ error: e.message });
  }
  finally { c.release(); }
});

// POST /api/import/bajas { rows } -> marca cancelado/inactivo lo que NO vino en el archivo.
// Protección: exige un archivo grande (cartera completa) para no cancelar media base con un archivo parcial.
importRouter.post('/import/bajas', requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const phones = [...new Set(rows.map(r => dig(r.sub_phone)).filter(p => p.length === 10))];
  const bans = [...new Set(rows.map(r => dig(r.ban)).filter(b => b.length === 9))];
  if (phones.length < 100 || bans.length < 100) {
    return res.status(400).json({ error: 'El archivo es muy chico para tratarlo como cartera completa (mínimo 100 líneas y 100 BANs). Las bajas no se aplicaron.' });
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rs = await c.query(`UPDATE public.subscribers SET status = 'cancelado', updated_at = now()
      WHERE status IS DISTINCT FROM 'cancelado' AND NOT (phone = ANY($1))`, [phones]);
    const rb = await c.query(`UPDATE public.bans SET status = 'C', updated_at = now()
      WHERE status IS DISTINCT FROM 'C' AND NOT (ban_number = ANY($1))`, [bans]);
    await c.query('COMMIT');
    try {
      await logAudit({ ip: req.ip,
        user_name: req.user?.nombre || req.user?.nick || 'Sistema',
        type: 'import_bajas',
        entity: 'importador',
        detail: `Bajas aplicadas desde importador: ${rs.rowCount} lineas canceladas, ${rb.rowCount} BANs cancelados.`,
        meta: { subs_cancelados: rs.rowCount, bans_cancelados: rb.rowCount, archivo_telefonos: phones.length, archivo_bans: bans.length },
      });
    } catch (e) {
      console.warn('[import/audit] no se pudo registrar auditoria de bajas:', e.message);
    }
    res.json({ subs_cancelados: rs.rowCount, bans_inactivados: rb.rowCount });
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('[import/bajas]', e);
    res.status(500).json({ error: e.message });
  }
  finally { c.release(); }
});
