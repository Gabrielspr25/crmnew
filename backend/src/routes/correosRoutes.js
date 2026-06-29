// Correos: lista de clientes con email (activos/cancelados) + envío.
// Igual que el viejo, el flujo principal es "Abrir en Outlook" (mailto BCC, sin SMTP).
// El envío por servidor (SMTP/Office365) queda disponible si se configuran las credenciales.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const correosRouter = Router();

const ACTIVE_SUB = `COALESCE(LOWER(s.status::text),'activo') NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')`;

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

// POST /api/email/send { to, subject, html, text }  (Office365/SMTP — requiere credenciales)
correosRouter.post('/email/send', requireAuth, async (req, res) => {
  const { to, subject, html, text } = req.body || {};
  if (!to || !subject || (!html && !text)) return res.status(400).json({ ok: false, error: 'Faltan campos (to, subject, html/text)' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(400).json({ ok: false, error: 'SMTP no configurado en el servidor (SMTP_USER/SMTP_PASS). Usá "Abrir en Outlook" mientras tanto.' });
  }
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { ciphers: 'SSLv3' },
    });
    const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    res.json({ ok: true, message: 'Correo enviado', messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Error al enviar. Verificá las credenciales SMTP. ' + e.message });
  }
});
