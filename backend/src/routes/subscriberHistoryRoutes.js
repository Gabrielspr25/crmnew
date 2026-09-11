import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  listSubscriberHistory,
  recordSubscriberManualNote,
  updateSubscriberHistoryComment,
} from '../services/subscriberHistoryService.js';

export const subscriberHistoryRouter = Router();

async function listHistory(req, res) {
  const c = await pool.connect();
  try {
    const exists = await c.query('SELECT id FROM public.subscribers WHERE id = $1', [req.params.id]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'Suscriptor no existe' });
    const history = await listSubscriberHistory({
      db: c,
      subscriberId: req.params.id,
      source: req.query.source || 'todos',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(history);
  } catch (e) {
    if (e.code === '42P01') return res.status(500).json({ error: 'Falta aplicar la migracion de historial de suscriptores' });
    res.status(500).json({ error: e.message });
  } finally {
    c.release();
  }
}

subscriberHistoryRouter.get('/subscribers/:id/history', requireAuth, listHistory);
subscriberHistoryRouter.get('/subscribers-real/:id/history', requireAuth, listHistory);

subscriberHistoryRouter.post('/subscribers-real/:id/history/manual-note', requireAuth, async (req, res) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL search_path TO public');
    const exists = await c.query('SELECT id FROM public.subscribers WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!exists.rows[0]) {
      await c.query('ROLLBACK');
      return res.status(404).json({ error: 'Suscriptor no existe' });
    }
    const item = await recordSubscriberManualNote({
      db: c,
      subscriberId: req.params.id,
      comment: req.body?.comment,
      noteDate: req.body?.date,
      user: req.user,
    });
    await c.query('COMMIT');
    res.status(201).json({ ok: true, item });
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    if (['Escribe una nota antes de guardar', 'Selecciona la fecha de la nota'].includes(e.message)) return res.status(422).json({ error: e.message });
    if (e.code === '42P01') return res.status(500).json({ error: 'Falta aplicar la migracion de historial de suscriptores' });
    res.status(500).json({ error: e.message });
  } finally {
    c.release();
  }
});

subscriberHistoryRouter.patch('/subscriber-history/:historyId/comment', requireAuth, async (req, res) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL search_path TO public');
    const updated = await updateSubscriberHistoryComment({
      db: c,
      historyId: req.params.historyId,
      comment: req.body?.comment,
      user: req.user,
    });
    if (!updated) {
      await c.query('ROLLBACK');
      return res.status(404).json({ error: 'Evento de historial no existe' });
    }
    await c.query('COMMIT');
    res.json({ ok: true, item: updated });
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    if (e.code === '42P01') return res.status(500).json({ error: 'Falta aplicar la migracion de historial de suscriptores' });
    res.status(500).json({ error: e.message });
  } finally {
    c.release();
  }
});
