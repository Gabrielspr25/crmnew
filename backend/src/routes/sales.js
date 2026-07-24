// Rutas de ventas y comisiones. Tango V2 alimenta la bitacora comercial y,
// cuando la venta es PYMES valida, completa el CRM canonico sin borrar datos.
import { Router } from 'express';
import { pool, query } from '../db.js';
import { fetchComisiones, fetchVentas } from '../tango.js';
import { requireAuth, requireAdmin } from '../auth.js';
import {
  classifyTangoCommissionSale,
  mapTangoCommissionSale,
} from '../services/tangoCommissionSync.js';

export const salesRouter = Router();

let syncInFlight = false;

function classifyProduct(nombre = '') {
  const value = String(nombre).toLowerCase();
  if (/cloud|office\s*365/.test(value)) return 'cloud';
  if (/\btv\b|televis/.test(value)) return 'claro_tv';
  if (/mpls/.test(value)) return 'mpls';
  if (/fijo/.test(value)) return /\bren\b|renov/.test(value) ? 'fijo_ren' : 'fijo_new';
  if (/\bren\b|renov/.test(value)) return 'movil_ren';
  return 'movil_new';
}

function isValidSubscriberPhone(value) {
  return /^(787|939|989)\d{7}$/.test(String(value || ''));
}

function accountTypeFor(mapped) {
  if (mapped.lineKind === 'fijo') return 'FIJO';
  if (mapped.lineKind === 'cloud') return 'CLOUD';
  return 'PYMES';
}

function reportMonthFor(mapped, hasta) {
  const source = mapped.saleDate || hasta;
  return `${String(source).slice(0, 7)}-01`;
}

async function resolveSalespersonId(db, vendorName) {
  if (!vendorName) return null;
  const result = await db.query(
    `SELECT id
       FROM public.salespeople
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
      LIMIT 1`,
    [vendorName]
  );
  return result.rows[0]?.id || null;
}

async function resolveClientAndBan(db, mapped) {
  const existingBan = await db.query(
    `SELECT b.id, b.client_id
       FROM public.bans b
      WHERE b.number = $1
      FOR UPDATE`,
    [mapped.banNumber]
  );
  if (existingBan.rows[0]) {
    return {
      clientId: existingBan.rows[0].client_id,
      banId: existingBan.rows[0].id,
      clientCreated: false,
      banCreated: false,
    };
  }

  const existingClient = await db.query(
    `SELECT id
       FROM public.clients
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
         OR LOWER(TRIM(COALESCE(company, ''))) = LOWER(TRIM($1))
      ORDER BY created_at ASC
      LIMIT 1`,
    [mapped.clientName]
  );

  let clientId = existingClient.rows[0]?.id || null;
  let clientCreated = false;
  if (!clientId) {
    const salespersonId = await resolveSalespersonId(db, mapped.vendorName);
    const created = await db.query(
      `INSERT INTO public.clients (name, company, salesperson_id, source, pendiente_validacion)
       VALUES ($1, $1, $2, 'tango_v2', false)
       RETURNING id`,
      [mapped.clientName, salespersonId]
    );
    clientId = created.rows[0].id;
    clientCreated = true;
  }

  const createdBan = await db.query(
    `INSERT INTO public.bans (client_id, number, ban_number, status, account_type, source)
     VALUES ($1, $2, $2, 'activo', $3, 'tango_v2')
     RETURNING id`,
    [clientId, mapped.banNumber, accountTypeFor(mapped)]
  );
  return {
    clientId,
    banId: createdBan.rows[0].id,
    clientCreated,
    banCreated: true,
  };
}

async function saveSalesTrace(db, mapped, relation, reviewReason) {
  const productKey = classifyProduct(mapped.saleTypeName);
  const result = await db.query(
    `INSERT INTO sales
       (tango_venta_id, client_id, ban_number, phone, product_key, ventatipo_nombre,
        monthly_value, company_commission, vendor_commission, vendor_name, sale_date,
        review_reason, raw_payload, synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
     ON CONFLICT (tango_venta_id) DO UPDATE SET
       client_id = COALESCE(EXCLUDED.client_id, sales.client_id),
       ban_number = COALESCE(EXCLUDED.ban_number, sales.ban_number),
       phone = COALESCE(EXCLUDED.phone, sales.phone),
       product_key = COALESCE(EXCLUDED.product_key, sales.product_key),
       ventatipo_nombre = COALESCE(EXCLUDED.ventatipo_nombre, sales.ventatipo_nombre),
       monthly_value = COALESCE(EXCLUDED.monthly_value, sales.monthly_value),
       company_commission = COALESCE(EXCLUDED.company_commission, sales.company_commission),
       vendor_commission = COALESCE(EXCLUDED.vendor_commission, sales.vendor_commission),
       vendor_name = COALESCE(EXCLUDED.vendor_name, sales.vendor_name),
       sale_date = COALESCE(EXCLUDED.sale_date, sales.sale_date),
       review_reason = EXCLUDED.review_reason,
       raw_payload = EXCLUDED.raw_payload,
       updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [
      mapped.tangoVentaId,
      relation?.clientId || null,
      mapped.banNumber,
      mapped.phone,
      productKey,
      mapped.saleTypeName,
      mapped.monthlyValue,
      mapped.companyEarnings,
      mapped.vendorCommission,
      mapped.vendorName,
      mapped.saleDate,
      reviewReason,
      mapped.rawPayload,
    ]
  );
  return result.rows[0]?.inserted ? 'created' : 'updated';
}

async function resolveSubscriber(db, mapped, relation) {
  const bySale = await db.query(
    `SELECT id, ban_id
       FROM public.subscribers
      WHERE tango_ventaid = $1
      LIMIT 1
      FOR UPDATE`,
    [mapped.tangoVentaId]
  );
  if (bySale.rows[0] && bySale.rows[0].ban_id !== relation.banId) {
    return { subscriberId: null, reason: 'venta_tango_asignada_a_otro_ban' };
  }

  if (!isValidSubscriberPhone(mapped.phone)) {
    return { subscriberId: null, reason: 'suscriptor_tango_invalido' };
  }

  const byPhone = await db.query(
    `SELECT id, ban_id
       FROM public.subscribers
      WHERE phone_norm = $1
         OR regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g') = $1
      LIMIT 1
      FOR UPDATE`,
    [mapped.phone]
  );
  const existing = bySale.rows[0] || byPhone.rows[0] || null;
  if (existing && existing.ban_id !== relation.banId) {
    return { subscriberId: null, reason: 'suscriptor_asignado_a_otro_ban' };
  }

  if (existing) {
    await db.query(
      `UPDATE public.subscribers
          SET tango_ventaid = COALESCE(tango_ventaid, $1),
              price_code = COALESCE(NULLIF(price_code, ''), $2),
              plan = COALESCE(NULLIF(plan, ''), $2),
              monthly_value = COALESCE(monthly_value, $3),
              line_kind = COALESCE(NULLIF(line_kind, ''), $4),
              line_type = COALESCE(NULLIF(line_type, ''), $5),
              activation_date = COALESCE(activation_date, $6),
              contract_start_date = COALESCE(contract_start_date, $6),
              updated_at = now()
        WHERE id = $7`,
      [
        mapped.tangoVentaId,
        mapped.priceCode,
        mapped.monthlyValue,
        mapped.lineKind,
        mapped.lineType,
        mapped.saleDate,
        existing.id,
      ]
    );
    return { subscriberId: existing.id, created: false, reason: null };
  }

  const inserted = await db.query(
    `INSERT INTO public.subscribers
       (ban_id, phone_number, phone_norm, phone, status, tango_ventaid, price_code,
        plan, monthly_value, line_kind, line_type, activation_date, contract_start_date)
     VALUES ($1,$2,$2,$2,'activo',$3,$4,$4,$5,$6,$7,$8,$8)
     RETURNING id`,
    [
      relation.banId,
      mapped.phone,
      mapped.tangoVentaId,
      mapped.priceCode,
      mapped.monthlyValue,
      mapped.lineKind,
      mapped.lineType,
      mapped.saleDate,
    ]
  );
  return { subscriberId: inserted.rows[0].id, created: true, reason: null };
}

async function saveCommissionReport(db, subscriberId, mapped, hasta) {
  await db.query(
    `INSERT INTO public.subscriber_reports
       (subscriber_id, report_month, company_earnings, vendor_commission, source,
        external_sale_id, source_activation_date, source_report_month, raw_payload,
        validation_status, validation_notes, portability_bonus)
     VALUES ($1, $2, $3, $4, 'tango_v2', $5, $6, $2, $7, 'confirmed', NULL, $8)
     ON CONFLICT (subscriber_id, report_month) DO UPDATE SET
       company_earnings = EXCLUDED.company_earnings,
       vendor_commission = COALESCE(EXCLUDED.vendor_commission, subscriber_reports.vendor_commission),
       source = 'tango_v2',
       external_sale_id = EXCLUDED.external_sale_id,
       source_activation_date = COALESCE(EXCLUDED.source_activation_date, subscriber_reports.source_activation_date),
       source_report_month = EXCLUDED.source_report_month,
       raw_payload = EXCLUDED.raw_payload,
       validation_status = 'confirmed',
       validation_notes = NULL,
       portability_bonus = COALESCE(EXCLUDED.portability_bonus, subscriber_reports.portability_bonus),
       updated_at = now()`,
    [
      subscriberId,
      reportMonthFor(mapped, hasta),
      mapped.companyEarnings,
      mapped.vendorCommission,
      String(mapped.tangoVentaId),
      mapped.saleDate,
      mapped.rawPayload,
      mapped.portabilityBonus,
    ]
  );
}

async function syncOneSale(mapped, hasta) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const eligibility = classifyTangoCommissionSale(mapped);
    if (!eligibility.accepted) {
      const action = await saveSalesTrace(db, mapped, null, eligibility.reason);
      await db.query('COMMIT');
      return { action, pending: true, reason: eligibility.reason };
    }

    const relation = await resolveClientAndBan(db, mapped);
    const subscriber = await resolveSubscriber(db, mapped, relation);
    const reviewReason = subscriber.reason;
    const action = await saveSalesTrace(db, mapped, relation, reviewReason);
    if (!reviewReason) await saveCommissionReport(db, subscriber.subscriberId, mapped, hasta);
    await db.query('COMMIT');
    return {
      action,
      pending: Boolean(reviewReason),
      reason: reviewReason,
      clientCreated: relation.clientCreated,
      banCreated: relation.banCreated,
      subscriberCreated: subscriber.created === true,
      reportCreated: !reviewReason,
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

function saleIdOf(row) {
  return String(row?.ventaid ?? row?.venta_id ?? row?.id ?? '');
}

// POST /api/sales/sync { desde, hasta }. Solo admin/supervisor. No elimina ni
// cancela registros: Tango completa el CRM y deja trazabilidad en sales/reports.
salesRouter.post('/sync', requireAuth, requireAdmin, async (req, res) => {
  const { desde, hasta } = req.body || {};
  if (!desde || !hasta) return res.status(400).json({ error: 'Faltan desde/hasta' });
  if (syncInFlight) return res.status(409).json({ error: 'Ya hay una sincronizacion Tango en curso' });
  syncInFlight = true;
  try {
    const [ventas, comisiones] = await Promise.all([
      fetchVentas({ desde, hasta }),
      fetchComisiones({ desde, hasta }),
    ]);
    const commissionBySale = new Map(comisiones.map((row) => [saleIdOf(row), row]).filter(([id]) => id));
    const summary = {
      ok: true,
      desde,
      hasta,
      ventas_tango: ventas.length,
      comisiones_tango: comisiones.length,
      ventas_creadas: 0,
      ventas_actualizadas: 0,
      clientes_creados: 0,
      bans_creados: 0,
      suscriptores_creados: 0,
      reportes_actualizados: 0,
      pendientes: 0,
      excluidas: 0,
      errores: [],
    };

    for (const sale of ventas) {
      const mapped = mapTangoCommissionSale(sale, commissionBySale.get(saleIdOf(sale)) || null);
      if (!mapped.tangoVentaId) {
        summary.excluidas++;
        continue;
      }
      const eligibility = classifyTangoCommissionSale(mapped);
      if (['tipo_no_pymes', 'sin_comision_real'].includes(eligibility.reason)) {
        summary.excluidas++;
        continue;
      }
      try {
        const result = await syncOneSale(mapped, hasta);
        if (result.action === 'created') summary.ventas_creadas++;
        else summary.ventas_actualizadas++;
        if (result.clientCreated) summary.clientes_creados++;
        if (result.banCreated) summary.bans_creados++;
        if (result.subscriberCreated) summary.suscriptores_creados++;
        if (result.reportCreated) summary.reportes_actualizados++;
        if (result.pending) summary.pendientes++;
      } catch (error) {
        summary.errores.push({ ventaid: mapped.tangoVentaId, error: String(error.message || error) });
      }
    }
    return res.json(summary);
  } catch (error) {
    return res.status(502).json({ error: `No se pudo consultar Tango V2: ${String(error.message || error)}` });
  } finally {
    syncInFlight = false;
  }
});

// GET /api/sales?desde=&hasta= lista la bitacora comercial de Tango.
salesRouter.get('/', requireAuth, async (req, res) => {
  const { desde, hasta } = req.query;
  const soloVendedor = req.user.rol === 'vendedor';
  const rows = await query(
    `SELECT s.*, COALESCE(c.name, c2.name) AS client_name
       FROM sales s
       LEFT JOIN public.clients c ON c.id = s.client_id
       LEFT JOIN public.bans b ON b.number = s.ban_number
       LEFT JOIN public.clients c2 ON c2.id = b.client_id
      WHERE ($1::date IS NULL OR s.sale_date >= $1)
        AND ($2::date IS NULL OR s.sale_date <= $2)
        AND ($3::text IS NULL OR s.vendor_name ILIKE $3)
      ORDER BY s.sale_date DESC NULLS LAST`,
    [desde || null, hasta || null, soloVendedor ? req.user.nombre : null]
  );
  res.json(rows.rows);
});

salesRouter.patch('/:id', requireAuth, async (req, res) => {
  const { vendor_commission } = req.body || {};
  const result = await query(
    `UPDATE sales SET vendor_commission = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [vendor_commission === '' ? null : vendor_commission, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Venta no existe' });
  res.json(result.rows[0]);
});

salesRouter.post('/:id/pay', requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `UPDATE sales SET paid = NOT paid, paid_at = now(), paid_by = $1 WHERE id = $2 RETURNING *`,
    [req.user.nombre, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Venta no existe' });
  res.json(result.rows[0]);
});
