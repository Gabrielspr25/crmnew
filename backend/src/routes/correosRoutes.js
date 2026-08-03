// Correos: lista de clientes con email (activos/cancelados) + envío.
// Igual que el viejo, el flujo principal es "Abrir en Outlook" (mailto BCC, sin SMTP).
// El envío por servidor (SMTP/Office365) queda disponible si se configuran las credenciales.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { campaignSubject, extractCrmCode, folderForClassification } from '../services/correosCampaigns.js';

export const correosRouter = Router();

const __dir = path.dirname(fileURLToPath(import.meta.url));
const CLARO_LOGO = path.resolve(__dir, '../../../frontend/img/claro-empresas.png');
const ACTIVE_SUB = `COALESCE(LOWER(s.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;

function agentAuth(req, res, next) {
  const configured = process.env.CORREOS_AGENT_TOKEN;
  if (!configured || req.get('x-correos-agent-token') !== configured) {
    return res.status(401).json({ ok: false, error: 'Agente de correos no autorizado' });
  }
  next();
}

function campaignCode() {
  return `CRM-CAMP-${Date.now().toString(36).toUpperCase()}`;
}

// GET /api/correos/clientes -> clientes con email + flag activo
correosRouter.get('/correos/clientes', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id,
              COALESCE(NULLIF(TRIM(c.name),''), NULLIF(TRIM(c.business_name),'')) AS name,
              c.email, c.city,
              EXISTS (SELECT 1 FROM public.subscribers s JOIN public.bans b ON s.ban_id=b.id
                      WHERE b.client_id=c.id AND ${ACTIVE_SUB}) AS activo
       FROM public.clients c
       WHERE c.email IS NOT NULL AND TRIM(c.email) <> '' AND position('@' in c.email) > 1
       ORDER BY name`);
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

correosRouter.get('/correos/campaigns', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT c.*, COUNT(r.id)::int AS recipients,
      COUNT(r.id) FILTER (WHERE r.status='sent')::int AS sent,
      COUNT(r.id) FILTER (WHERE r.status='failed')::int AS failed
      FROM public.email_campaigns c LEFT JOIN public.email_campaign_recipients r ON r.campaign_id=c.id
      GROUP BY c.id ORDER BY c.created_at DESC`);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

correosRouter.post('/correos/clients/:id/drafts', requireAuth, async (req, res) => {
  const { subject = 'Revisión de su cuenta Claro Empresas', html = '' } = req.body || {};
  try {
    const { rows } = await pool.query(`SELECT c.id, COALESCE(NULLIF(TRIM(c.name),''),NULLIF(TRIM(c.business_name),'')) AS name, c.email,
      COALESCE(string_agg(DISTINCT b.ban_number::text, ', '), '') AS bans,
      COUNT(s.id) FILTER (WHERE ${ACTIVE_SUB})::int AS active_subscribers,
      COALESCE(SUM(s.monthly_value) FILTER (WHERE ${ACTIVE_SUB}), 0) AS monthly_value
      FROM public.clients c LEFT JOIN public.bans b ON b.client_id=c.id LEFT JOIN public.subscribers s ON s.ban_id=b.id
      WHERE c.id=$1 GROUP BY c.id`, [req.params.id]);
    const client = rows[0];
    if (!client) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    const code = `CRM-CLI-${String(client.id).replace(/-/g, '').slice(0, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const body = html || `<p>Hola,</p><p>Mi nombre es Gabriel Sánchez y soy el coordinador de Claro Empresas.</p><p>Estamos revisando la cuenta <strong>${client.name}</strong>${client.bans ? `, BAN ${client.bans}` : ''}, que actualmente incluye <strong>${client.active_subscribers}</strong> suscriptores activos.</p><p>Deseamos coordinar una conversación para revisar beneficios y alternativas para esta cuenta.</p><p>Saludos cordiales,</p>`;
    const { rows: draftRows } = await pool.query(`INSERT INTO public.email_client_drafts (client_id,draft_code,subject,html_body,created_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`, [client.id, code, campaignSubject(subject, code), body, req.user?.email || req.user?.nick || 'crm']);
    res.status(201).json({ ok: true, data: { ...draftRows[0], client } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

correosRouter.post('/correos/campaigns', requireAuth, async (req, res) => {
  const { name, subject, html, starts_at, ends_at, batch_size = 100, interval_minutes = 30 } = req.body || {};
  if (!name || !subject || !html || !starts_at || !ends_at) return res.status(400).json({ ok: false, error: 'Faltan nombre, asunto, contenido o fechas' });
  if (Number(batch_size) < 1 || Number(batch_size) > 100 || Number(interval_minutes) < 5) return res.status(400).json({ ok: false, error: 'Programación inválida' });
  const code = campaignCode();
  try {
    const { rows } = await pool.query(`INSERT INTO public.email_campaigns
      (campaign_code,name,subject_template,html_template,starts_at,ends_at,batch_size,interval_minutes,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [code, String(name).trim(), campaignSubject(subject, code), html, starts_at, ends_at, Number(batch_size), Number(interval_minutes), req.user?.email || req.user?.nick || 'crm']);
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

correosRouter.post('/correos/campaigns/:id/recipients', requireAuth, async (req, res) => {
  const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
  if (!recipients.length) return res.status(400).json({ ok: false, error: 'Seleccioná al menos un cliente' });
  try {
    const values = recipients.map((r) => [req.params.id, r.client_id, String(r.email || '').trim().toLowerCase()]).filter((r) => r[1] && r[2]);
    if (!values.length) return res.status(400).json({ ok: false, error: 'Destinatarios inválidos' });
    const chunks = values.map((_, i) => `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3})`).join(',');
    const { rowCount } = await pool.query(`INSERT INTO public.email_campaign_recipients (campaign_id,client_id,recipient_email) VALUES ${chunks}
      ON CONFLICT (campaign_id,recipient_email) DO NOTHING`, values.flat());
    res.json({ ok: true, added: rowCount });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

correosRouter.get('/correos/agent/queue', agentAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`WITH next AS (
      SELECT r.id FROM public.email_campaign_recipients r JOIN public.email_campaigns c ON c.id=r.campaign_id
      WHERE c.status='scheduled' AND now() BETWEEN c.starts_at AND c.ends_at
        AND (r.status='pending' OR (r.status='claimed' AND r.claimed_at < now() - interval '2 hours'))
      ORDER BY r.created_at FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE public.email_campaign_recipients r SET status='claimed', claimed_at=now()
      FROM next, public.email_campaigns c WHERE r.id=next.id AND c.id=r.campaign_id
      RETURNING r.id AS recipient_id,r.client_id,r.recipient_email,c.id AS campaign_id,c.campaign_code,c.subject_template,c.html_template`, [limit]);
    await client.query('COMMIT');
    res.json({ ok: true, data: rows });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ ok: false, error: e.message }); }
  finally { client.release(); }
});

correosRouter.get('/correos/agent/tracking/:code', agentAuth, async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  try {
    if (code.startsWith('CRM-CAMP-')) {
      const { rows } = await pool.query('SELECT id AS campaign_id FROM public.email_campaigns WHERE campaign_code=$1', [code]);
      if (rows[0]) return res.json({ ok: true, data: rows[0] });
    }
    if (code.startsWith('CRM-CLI-')) {
      const { rows } = await pool.query('SELECT id AS draft_id, client_id FROM public.email_client_drafts WHERE draft_code=$1', [code]);
      if (rows[0]) return res.json({ ok: true, data: rows[0] });
    }
    res.status(404).json({ ok: false, error: 'Código CRM no registrado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

correosRouter.post('/correos/agent/events', agentAuth, async (req, res) => {
  const { outlook_entry_id, event_type, campaign_id = null, client_id = null, draft_id = null, recipient_id = null, occurred_at = null, details = {}, subject = '' } = req.body || {};
  const allowed = new Set(['sent', 'reply', 'failed', 'interested', 'meeting', 'no_contact', 'pending_review']);
  if (!outlook_entry_id || !allowed.has(event_type) || (!campaign_id && !client_id)) return res.status(400).json({ ok: false, error: 'Evento de Outlook inválido' });
  if (!extractCrmCode(subject)) return res.status(400).json({ ok: false, error: 'El asunto no pertenece al CRM' });
  try {
    const { rows } = await pool.query(`INSERT INTO public.email_events
      (outlook_entry_id,event_type,campaign_id,client_id,draft_id,recipient_id,mailbox_folder,occurred_at,details)
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()),$9)
      ON CONFLICT (outlook_entry_id) DO NOTHING RETURNING id`,
    [outlook_entry_id,event_type,campaign_id,client_id,draft_id,recipient_id,folderForClassification(event_type),occurred_at,details]);
    if (recipient_id && ['sent', 'failed'].includes(event_type)) await pool.query(`UPDATE public.email_campaign_recipients SET status=$2, sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END, last_error=$3 WHERE id=$1`, [recipient_id, event_type, details?.error || null]);
    res.json({ ok: true, duplicate: !rows.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/email/send { to, subject, html, text }  (Office365/SMTP — requiere credenciales)
correosRouter.post('/email/send', requireAuth, async (req, res) => {
  const { to, subject, html, text } = req.body || {};
  if (!to || !subject || (!html && !text)) return res.status(400).json({ ok: false, error: 'Faltan campos (to, subject, html/text)' });
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  if (!process.env.SMTP_USER || !smtpPass) {
    return res.status(400).json({ ok: false, error: 'SMTP no configurado en el servidor (SMTP_USER y SMTP_PASS o SMTP_PASSWORD). Usá "Abrir en Outlook" mientras tanto.' });
  }
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: smtpPass },
      tls: { ciphers: 'SSLv3' },
    });
    const mail = { from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html };
    if (html && fs.existsSync(CLARO_LOGO)) {
      mail.attachments = [{ filename: 'claro-empresas.png', path: CLARO_LOGO, cid: 'claroLogo' }];
    }
    const info = await transporter.sendMail(mail);
    res.json({ ok: true, message: 'Correo enviado', messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Error al enviar. Verificá las credenciales SMTP. ' + e.message });
  }
});
