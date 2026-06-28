import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pool } from '../src/db.js';

const APPLY = process.argv.includes('--apply');
const REPLACE_CONFLICTS = process.argv.includes('--replace-conflicts');
const REMOTE = process.env.IMPORT_REMOTE || 'root@143.244.191.139';

const ACTIVE_SUB_STATUS = "COALESCE(LOWER(s.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')";

const exportSql = `
WITH follow_clients AS (
  SELECT DISTINCT f.client_id
  FROM follow_up_prospects f
  JOIN clients c ON c.id = f.client_id
  WHERE f.completed_date IS NULL
    AND COALESCE(f.is_active::text,'true') IN ('true','1','t')
    AND COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NOT NULL
    AND EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)
), active_bans AS (
  SELECT DISTINCT b.*
  FROM follow_clients fc
  JOIN bans b ON b.client_id = fc.client_id
  JOIN subscribers s ON s.ban_id = b.id
  WHERE ${ACTIVE_SUB_STATUS}
), active_subscribers AS (
  SELECT s.*, b.client_id, b.ban_number, b.account_type
  FROM active_bans b
  JOIN subscribers s ON s.ban_id = b.id
  WHERE ${ACTIVE_SUB_STATUS}
), active_followups AS (
  SELECT DISTINCT ON (f.client_id) f.*
  FROM follow_up_prospects f
  JOIN follow_clients fc ON fc.client_id = f.client_id
  WHERE f.completed_date IS NULL
    AND COALESCE(f.is_active::text,'true') IN ('true','1','t')
  ORDER BY f.client_id, f.updated_at DESC NULLS LAST, f.created_at DESC NULLS LAST, f.id DESC
)
SELECT json_build_object(
  'clients', COALESCE((SELECT json_agg(to_jsonb(c) ORDER BY COALESCE(c.name,c.business_name)) FROM clients c JOIN follow_clients fc ON fc.client_id = c.id), '[]'::json),
  'bans', COALESCE((SELECT json_agg(to_jsonb(b) ORDER BY b.client_id, b.ban_number) FROM active_bans b), '[]'::json),
  'subscribers', COALESCE((SELECT json_agg(to_jsonb(s) ORDER BY s.client_id, s.ban_number, s.phone) FROM active_subscribers s), '[]'::json),
  'follow_ups', COALESCE((SELECT json_agg(to_jsonb(f) ORDER BY f.client_id) FROM active_followups f), '[]'::json)
)::text;
`;

function cleanDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function cleanStatus(value, activeValue = 'activo') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (['a', 'activo', 'active'].includes(raw)) return activeValue;
  if (['c', 'cancelado', 'cancelled', 'inactive', 'inactivo'].includes(raw)) return 'cancelado';
  if (['suspendido', 'suspended'].includes(raw)) return 'suspendido';
  return activeValue;
}

function normalizedLineKind(value) {
  return String(value ?? '').toLowerCase();
}

function isMobileLine(line) {
  const lineKind = normalizedLineKind(line.line_kind);
  return lineKind.includes('movil') || lineKind.includes('mobile');
}

function isFixedLine(line) {
  return normalizedLineKind(line.line_kind).includes('fijo');
}

function needsTangoReview(line) {
  return !String(line.plan ?? '').trim() && !normalizedLineKind(line.line_kind).trim();
}

function isShortFixedCode(line) {
  const currentPlan = String(line.plan ?? line.current_plan ?? '').trim().toUpperCase();
  return /^C?\d{4,10}$/.test(currentPlan);
}

function classificationNote(line, productKey) {
  if (productKey) return null;
  if (needsTangoReview(line)) return 'REQUIERE_REVISION_TANGO: sin plan/tipo de venta; consultar Tango V2 /ventas por telefono y BAN';
  return 'Linea activa sin producto clasificable por reglas actuales';
}

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

function normalizeAccountTypes(data) {
  const subscribersByBan = new Map();
  for (const sub of data.subscribers) {
    const arr = subscribersByBan.get(sub.ban_id) || [];
    arr.push(sub);
    subscribersByBan.set(sub.ban_id, arr);
  }

  for (const ban of data.bans) {
    const accountType = String(ban.account_type ?? '').toLowerCase();
    const lines = subscribersByBan.get(ban.id) || [];
    if (accountType === 'pymes' && lines.some(isMobileLine) && lines.some(isFixedLine)) {
      ban.account_type = 'CONVERGENTE';
    }
  }

  const accountTypeByBan = new Map(data.bans.map((ban) => [ban.id, ban.account_type]));
  for (const sub of data.subscribers) {
    sub.account_type = accountTypeByBan.get(sub.ban_id) || sub.account_type;
  }

  return data;
}

function classifyProduct(line) {
  const accountType = String(line.account_type ?? '').toLowerCase();
  const lineKind = normalizedLineKind(line.line_kind);
  const phone = cleanDigits(line.phone ?? line.phone_number);
  if (phone.startsWith('989')) return 'cloud';
  if (phone.startsWith('130')) return 'mpls';
  if (isShortFixedCode(line)) return 'fijo_ren';
  if (accountType.includes('mpls') || lineKind.includes('mpls')) return 'mpls';
  if (accountType.includes('claro tv') || accountType.includes('clarotv') || lineKind.includes('claro tv') || lineKind.includes('clarotv')) return 'claro_tv';
  if (accountType.includes('cloud') || lineKind.includes('cloud')) return 'cloud';
  if (lineKind.includes('fijo') || accountType.includes('fijo')) return 'fijo_ren';
  if (
    lineKind.includes('movil') ||
    lineKind.includes('mobile') ||
    accountType.includes('movil') ||
    accountType.includes('móvil') ||
    accountType.includes('mobile') ||
    (accountType.includes('converg') && (lineKind.includes('movil') || lineKind.includes('móvil') || lineKind.includes('mobile')))
  ) {
    return 'movil_ren';
  }
  return null;
}

function readRemotePayload() {
  const result = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', REMOTE, 'sudo -u postgres psql -d crm_pro -At'],
    { input: exportSql, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`No se pudo exportar producción: ${result.stderr || result.stdout}`);
  }
  const text = result.stdout.trim();
  if (!text.startsWith('{')) {
    throw new Error(`Export inesperado: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

function summarize(data) {
  const productCounts = {};
  for (const sub of data.subscribers) {
    const key = classifyProduct(sub) || 'sin_clasificar';
    productCounts[key] = (productCounts[key] || 0) + 1;
  }
  return {
    clients: data.clients.length,
    bans: data.bans.length,
    subscribers: data.subscribers.length,
    followUps: data.follow_ups.length,
    productCounts,
  };
}

async function assertNoShapeProblems(data) {
  const badBans = data.bans.filter((ban) => cleanDigits(ban.ban_number).length !== 9);
  const badPhones = data.subscribers.filter((sub) => cleanDigits(sub.phone).length !== 10);
  if (badBans.length || badPhones.length) {
    throw new Error(`Datos fuera del contrato limpio: badBans=${badBans.length}, badPhones=${badPhones.length}`);
  }

  const clientIds = data.clients.map((client) => client.id);
  await pool.query('SET search_path TO public');
  const { rows: conflicts } = await pool.query(
    `SELECT b.id::text, b.number, b.client_id::text
       FROM public.bans b
      WHERE b.number = ANY($1::text[])
        AND b.id <> ALL($2::uuid[])`,
    [data.bans.map((ban) => cleanDigits(ban.ban_number)), data.bans.map((ban) => ban.id)]
  );
  if (conflicts.length && !REPLACE_CONFLICTS) {
    throw new Error(`BAN ya existe local con otro id: ${JSON.stringify(conflicts.slice(0, 5))}`);
  }

  return { clientIds, conflicts };
}

async function importData(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO public');
    const clientIds = data.clients.map((item) => item.id);
    const banNumbers = data.bans.map((ban) => cleanDigits(ban.ban_number));

    if (REPLACE_CONFLICTS) {
      const { rows: conflictClients } = await client.query(
        `SELECT DISTINCT b.client_id
           FROM bans b
          WHERE b.number = ANY($1::text[])
            AND b.id <> ALL($2::uuid[])`,
        [banNumbers, data.bans.map((ban) => ban.id)]
      );
      const conflictClientIds = conflictClients.map((row) => row.client_id);
      if (conflictClientIds.length) {
        await client.query(
          `DELETE FROM clients
            WHERE id = ANY($1::uuid[])
              AND id <> ALL($2::uuid[])`,
          [conflictClientIds, clientIds]
        );
      }
    }

    await client.query(
      `DELETE FROM opportunity_steps WHERE opportunity_id IN (SELECT id FROM sales_opportunities WHERE client_id = ANY($1::uuid[]))`,
      [clientIds]
    );
    await client.query(`DELETE FROM opportunity_lines WHERE client_id = ANY($1::uuid[])`, [clientIds]);
    await client.query(`DELETE FROM sales_opportunities WHERE client_id = ANY($1::uuid[])`, [clientIds]);
    await client.query(`DELETE FROM follow_up_prospects WHERE client_id = ANY($1::uuid[])`, [clientIds]);

    for (const row of data.clients) {
      const name = String(row.name || row.business_name || row.company || 'Cliente sin nombre').trim();
      await client.query(
        `INSERT INTO clients (
          id, name, company, email, phone, mobile, address, city, zip_code,
          salesperson_id, pipeline_status_id, notes, created_at, updated_at, tax_id,
          business_name, additional_phone, cellular, contact_person, owner_name, source, pendiente_validacion
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          NULL,NULL,$10,COALESCE($11::timestamp, now()),COALESCE($12::timestamp, now()),$13,
          $14,$15,$16,$17,$18,$19,false
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          company = EXCLUDED.company,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          mobile = EXCLUDED.mobile,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          zip_code = EXCLUDED.zip_code,
          notes = EXCLUDED.notes,
          updated_at = now(),
          tax_id = EXCLUDED.tax_id,
          business_name = EXCLUDED.business_name,
          additional_phone = EXCLUDED.additional_phone,
          cellular = EXCLUDED.cellular,
          contact_person = EXCLUDED.contact_person,
          owner_name = EXCLUDED.owner_name,
          source = EXCLUDED.source`,
        [
          row.id, name, row.company, row.email, row.phone, row.mobile, row.address, row.city, row.zip_code,
          row.notes, row.created_at, row.updated_at, row.tax_id, row.business_name, row.additional_phone,
          row.cellular, row.contact_person, row.owner_name, row.source || 'seguimiento_produccion',
        ]
      );
    }

    for (const row of data.bans) {
      const number = cleanDigits(row.ban_number);
      await client.query(
        `INSERT INTO bans (
          id, client_id, number, status, last_updated, created_at, account_type,
          ban_start_service, ban_number, updated_at, source
        ) VALUES (
          $1,$2,$3,$4,COALESCE($5::timestamp, now()),COALESCE($6::timestamp, now()),$7,
          $8,$9,COALESCE($10::timestamp, now()),$11
        )
        ON CONFLICT (id) DO UPDATE SET
          client_id = EXCLUDED.client_id,
          number = EXCLUDED.number,
          status = EXCLUDED.status,
          account_type = EXCLUDED.account_type,
          ban_number = EXCLUDED.ban_number,
          updated_at = now(),
          source = EXCLUDED.source`,
        [
          row.id, row.client_id, number, cleanStatus(row.status, 'activo'), row.updated_at, row.created_at,
          row.account_type, row.activation_date || row.ban_start_service, number, row.updated_at, row.source || 'seguimiento_produccion',
        ]
      );
    }

    for (const row of data.subscribers) {
      const phone = cleanDigits(row.phone);
      await client.query(
        `INSERT INTO subscribers (
          id, ban_id, phone_number, status, contract_end_date, created_at, updated_at,
          plan, monthly_value, phone_norm, phone, line_type, line_kind,
          remaining_payments, tango_ventaid, contract_term, cancel_reason
        ) VALUES (
          $1,$2,$3,$4,$5,COALESCE($6::timestamp, now()),COALESCE($7::timestamp, now()),
          $8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )
        ON CONFLICT (id) DO UPDATE SET
          ban_id = EXCLUDED.ban_id,
          phone_number = EXCLUDED.phone_number,
          status = EXCLUDED.status,
          contract_end_date = EXCLUDED.contract_end_date,
          updated_at = now(),
          plan = EXCLUDED.plan,
          monthly_value = EXCLUDED.monthly_value,
          phone_norm = EXCLUDED.phone_norm,
          phone = EXCLUDED.phone,
          line_type = EXCLUDED.line_type,
          line_kind = EXCLUDED.line_kind,
          remaining_payments = EXCLUDED.remaining_payments,
          tango_ventaid = EXCLUDED.tango_ventaid,
          contract_term = EXCLUDED.contract_term,
          cancel_reason = EXCLUDED.cancel_reason`,
        [
          row.id, row.ban_id, phone, cleanStatus(row.status, 'activo'), row.contract_end_date,
          row.created_at, row.updated_at, row.plan, row.monthly_value, phone, phone,
          row.line_type, row.line_kind, row.remaining_payments, row.tango_ventaid, row.contract_term, row.cancel_reason,
        ]
      );
    }

    for (const row of data.follow_ups) {
      const name = data.clients.find((item) => item.id === row.client_id)?.name || row.company_name || 'Seguimiento';
      await client.query(
        `INSERT INTO follow_up_prospects (
          id, client_id, company_name, fijo_ren, fijo_new, movil_nueva, movil_renovacion,
          claro_tv, cloud, mpls, call_count, is_completed, completed_date, total_amount,
          notes, contact_phone, contact_email, is_active, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,NULL,$12,$13,$14,$15,true,
          COALESCE($16::timestamp, now()),COALESCE($17::timestamp, now())
        )`,
        [
          row.id, row.client_id, name, row.fijo_ren || 0, row.fijo_new || 0, row.movil_nueva || 0,
          row.movil_renovacion || 0, row.claro_tv || 0, row.cloud || 0, row.mpls || 0, row.call_count || 0,
          row.total_amount || 0, row.notes, row.contact_phone, row.contact_email, row.created_at, row.updated_at,
        ]
      );
    }

    const subscribersByClient = new Map();
    for (const row of data.subscribers) {
      const arr = subscribersByClient.get(row.client_id) || [];
      arr.push(row);
      subscribersByClient.set(row.client_id, arr);
    }

    for (const row of data.clients) {
      const name = String(row.name || row.business_name || row.company || 'Cliente').trim();
      const opportunityId = randomUUID();
      await client.query(
        `INSERT INTO sales_opportunities (
          id, client_id, salesperson_id, title, description, opportunity_type, status,
          priority, expected_monthly_value, source, created_at, updated_at, product_type, sale_type
        ) VALUES (
          $1,$2,NULL,$3,$4,'mixta','activa','media',$5,'import_followup_clean',now(),now(),'mixta','renovacion'
        )`,
        [opportunityId, row.id, `Seguimiento - ${name}`, 'Import limpio desde seguimiento activo productivo', 0]
      );

      const presentProducts = new Set();
      for (const sub of subscribersByClient.get(row.id) || []) {
        const productKey = classifyProduct(sub);
        const isMoney = productKey === 'fijo_ren' || productKey === 'fijo_new' || productKey === 'mpls';
        if (productKey) presentProducts.add(productKey);
        await client.query(
          `INSERT INTO opportunity_lines (
            id, opportunity_id, client_id, ban_id, subscriber_id, line_mode,
            phone, current_plan, current_monthly_value, target_monthly_value,
            status, notes, product_key, money_value, quantity_value, product_type, sale_type
          ) VALUES (
            $1,$2,$3,$4,$5,'existente_renovar',$6,$7,$8,$9,'incluida',$10,$11,$12,$13,$14,'renovacion'
          )`,
          [
            randomUUID(), opportunityId, row.id, sub.ban_id, sub.id, cleanDigits(sub.phone), sub.plan,
            sub.monthly_value, sub.monthly_value, classificationNote(sub, productKey),
            productKey, isMoney ? sub.monthly_value || 0 : 0, isMoney ? 0 : 1, productKey,
          ]
        );
      }

      for (const productKey of [...presentProducts].sort()) {
        const parts = productKeyParts(productKey);
        if (!parts) continue;
        const template = await client.query(
          `SELECT s.step_name AS name, s.step_order
             FROM crm_workflow_templates t
             JOIN crm_workflow_template_steps s ON s.template_id = t.id
            WHERE t.is_active = true
              AND UPPER(t.product_type) = $1
              AND UPPER(t.sale_type) = $2
            ORDER BY s.step_order`,
          [parts.product_type, parts.sale_type]
        );
        for (const [index, step] of template.rows.entries()) {
          const order = await client.query(
            `SELECT COALESCE(MAX(step_order), 0) + 1 AS next_order
               FROM opportunity_steps
              WHERE opportunity_id = $1`,
            [opportunityId]
          );
          await client.query(
            `INSERT INTO opportunity_steps (
              id, opportunity_id, step_order, name, description, status, source, product_key, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,NULL,$5,'crm_workflow_templates',$6,now(),now())`,
            [
              randomUUID(),
              opportunityId,
              Number(order.rows[0]?.next_order || step.step_order || index + 1),
              step.name,
              index === 0 ? 'en_progreso' : 'pendiente',
              productKey,
            ]
          );
        }
      }
    }

    await client.query(`SELECT setval('follow_up_prospects_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM follow_up_prospects), 1), true)`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const data = normalizeAccountTypes(readRemotePayload());
const summary = summarize(data);
const shape = await assertNoShapeProblems(data);
console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', replaceConflicts: REPLACE_CONFLICTS, summary, conflicts: shape.conflicts.length }, null, 2));

if (APPLY) {
  await importData(data);
  console.log(JSON.stringify({ imported: true, summary }, null, 2));
}

await pool.end();
