// Importador (actualización masiva): recibe filas mapeadas y hace upsert en
// clientes/BANs/suscriptores (public). "El archivo manda": actualiza lo existente.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const importRouter = Router();
const dig = (s) => String(s || '').replace(/\D/g, '');
const txt = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

// estado suscriptor: activo|cancelado|suspendido
function normStatus(s) {
  const x = String(s || '').toLowerCase().trim();
  if (!x) return null;
  if (x.includes('cancel') || x === 'c') return 'cancelado';
  if (x.includes('suspend') || x.includes('no_renueva') || x.includes('no renueva')) return 'suspendido';
  if (x.includes('activ') || x === 'a') return 'activo';
  return null;
}
// estado BAN: activo|inactivo|suspendido
function normBanStatus(s) {
  const x = String(s || '').toLowerCase().trim();
  if (!x) return null;
  if (x.includes('inactiv')) return 'inactivo';
  if (x.includes('suspend')) return 'suspendido';
  if (x.includes('activ')) return 'activo';
  return null;
}

// campos de cliente que el importador puede escribir: claveImport -> columna BD
const CLI = [['company', 'company'], ['email', 'email'], ['phone', 'phone'], ['mobile', 'mobile'],
  ['additional_phone', 'additional_phone'], ['address', 'address'], ['city', 'city'], ['zip_code', 'zip_code'],
  ['contact_person', 'contact_person'], ['source', 'source'], ['tax_id', 'tax_id'], ['cli_notes', 'notes']];
// campos de suscriptor: claveImport -> columna BD
const SUB = [['plan', 'plan'], ['monthly_value', 'monthly_value'], ['contract_end_date', 'contract_end_date'],
  ['equipment', 'equipment'], ['imei', 'imei'], ['subscriber_name', 'subscriber_name_remote'], ['sub_notes', 'notes']];

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
    const exBans = bans.length ? new Set((await c.query(`SELECT number FROM public.bans WHERE number = ANY($1)`, [bans])).rows.map(x => x.number)) : new Set();
    const exPhones = phones.length ? new Set((await c.query(`SELECT phone_number FROM public.subscribers WHERE phone_number = ANY($1)`, [phones])).rows.map(x => x.phone_number)) : new Set();
    for (const r of rows) {
      const name = String(r.name || '').trim(), ban = dig(r.ban), phone = dig(r.sub_phone);
      if (name) { exNames.has(name.toLowerCase()) ? out.cli_match++ : out.cli_new++; }
      if (ban.length === 9) { exBans.has(ban) ? out.ban_match++ : out.ban_new++; }
      if (phone.length === 10) { exPhones.has(phone) ? out.sub_update++ : out.sub_new++; }
      if (!name && ban.length !== 9 && phone.length !== 10) out.sin_dato++;
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); } finally { c.release(); }
});

// POST /api/import/apply { rows:[{name,company,email,...,ban,account_type,ban_status,sub_phone,plan,...}] }
importRouter.post('/import/apply', requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No hay filas para importar' });
  const out = { clientes_creados: 0, clientes_actualizados: 0, bans_creados: 0, subs_creados: 0, subs_actualizados: 0, omitidas: 0, errores: [] };
  const c = await pool.connect();
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      try {
        const name = txt(r.name), ban = dig(r.ban), subPhone = dig(r.sub_phone);
        let clientId = null;

        // ----- Cliente -----
        if (name) {
          const f = await c.query(`SELECT id FROM public.clients WHERE name ILIKE $1 LIMIT 1`, [name]);
          if (f.rows[0]) {
            clientId = f.rows[0].id;
            const sets = [], vals = [];
            CLI.forEach(([k, col]) => { const v = txt(r[k]); if (v != null) { vals.push(v); sets.push(`${col} = $${vals.length}`); } });
            if (sets.length) { vals.push(clientId); await c.query(`UPDATE public.clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals); out.clientes_actualizados++; }
          } else {
            const cols = ['name'], vals = [name];
            CLI.forEach(([k, col]) => { const v = txt(r[k]); if (v != null) { vals.push(v); cols.push(col); } });
            cols.push('pendiente_validacion'); const ph = cols.map((_, j) => (cols[j] === 'pendiente_validacion' ? 'true' : '$' + (j + 1)));
            const ins = await c.query(`INSERT INTO public.clients (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING id`, vals);
            clientId = ins.rows[0].id; out.clientes_creados++;
          }
        }

        // ----- BAN -----
        let banId = null;
        if (ban.length === 9) {
          const banStatus = normBanStatus(r.ban_status);
          let bf;
          if (clientId) bf = await c.query(`SELECT id FROM public.bans WHERE number=$1 AND client_id=$2 LIMIT 1`, [ban, clientId]);
          else bf = await c.query(`SELECT id, client_id FROM public.bans WHERE number=$1 LIMIT 1`, [ban]);
          if (bf.rows[0]) {
            banId = bf.rows[0].id; if (!clientId) clientId = bf.rows[0].client_id;
            const sets = [], vals = [];
            const at = txt(r.account_type); if (at != null) { vals.push(at); sets.push(`account_type = $${vals.length}`); }
            if (banStatus) { vals.push(banStatus); sets.push(`status = $${vals.length}`); }
            if (sets.length) { vals.push(banId); await c.query(`UPDATE public.bans SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals); }
          } else if (clientId) {
            const ins = await c.query(`INSERT INTO public.bans (client_id, number, ban_number, status, account_type) VALUES ($1,$2,$2,$3,$4) RETURNING id`, [clientId, ban, banStatus || 'activo', txt(r.account_type)]);
            banId = ins.rows[0].id; out.bans_creados++;
          }
        }

        // ----- Suscriptor -----
        if (subPhone.length === 10) {
          const subStatus = normStatus(r.status);
          const sf = banId
            ? await c.query(`SELECT id FROM public.subscribers WHERE phone_number=$1 AND ban_id=$2 LIMIT 1`, [subPhone, banId])
            : await c.query(`SELECT id FROM public.subscribers WHERE phone_number=$1 LIMIT 1`, [subPhone]);
          if (sf.rows[0]) {
            const sets = [], vals = [];
            SUB.forEach(([k, col]) => { let v = txt(r[k]); if (v != null) { if (col === 'monthly_value') v = Number(v) || null; if (v != null) { vals.push(v); sets.push(`${col} = $${vals.length}`); } } });
            if (subStatus) { vals.push(subStatus); sets.push(`status = $${vals.length}`); }
            if (sets.length) { vals.push(sf.rows[0].id); await c.query(`UPDATE public.subscribers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals); }
            out.subs_actualizados++;
          } else if (banId) {
            const cols = ['ban_id', 'phone', 'phone_number', 'status'], vals = [banId, subPhone, subPhone, subStatus || 'activo'];
            SUB.forEach(([k, col]) => { let v = txt(r[k]); if (v != null) { if (col === 'monthly_value') v = Number(v) || null; if (v != null) { vals.push(v); cols.push(col); } } });
            await c.query(`INSERT INTO public.subscribers (${cols.join(',')}) VALUES (${cols.map((_, j) => '$' + (j + 1)).join(',')})`, vals);
            out.subs_creados++;
          } else out.omitidas++;
        } else if (!name && ban.length !== 9) out.omitidas++;
      } catch (e) { out.errores.push({ fila: i + 1, error: e.message }); }
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { c.release(); }
});
