import express from 'express';
import {readBusinessRules} from '../services/businessRules.js';

function sendError(res, caught) {
  return res.status(caught?.status || 500).json({ error: caught?.message || 'No se pudo completar la operación de Audiencia.' });
}

function audienceToken(req) {
  const value = req.headers['x-audiencia-token'];
  return typeof value === 'string' ? value : '';
}

export function createAudienciaRouter({ access, store, delegation }) {
  const router = express.Router();

  router.get('/access', async (req, res) => {
    try {
      const status = await access.status(req.user);
      return res.json({ ...status, locked: status.secondPasswordRequired !== false });
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  router.post('/setup', async (req, res) => {
    try {
      await access.setup(req.user, req.body?.password);
      return res.status(201).json({ configured: true });
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  router.post('/unlock', async (req, res) => {
    try {
      const token = await access.unlock(req.user, req.body?.password);
      return res.json({ token, expiresInSeconds: 1200 });
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  router.post('/delegations', (req, res) => {
    try {
      access.verify(req.user, audienceToken(req));
      if (!delegation) return res.status(503).json({ error: 'El acceso delegado no está disponible.' });
      return res.status(201).json(delegation.issue(req.user, req.body?.minutes));
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  router.delete('/delegations', (req, res) => {
    try {
      access.verify(req.user, audienceToken(req));
      if (!delegation) return res.status(503).json({ error: 'El acceso delegado no está disponible.' });
      return res.json(delegation.revokeAll(req.user));
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  router.get('/data', async (req, res) => {
    try {
      access.verify(req.user, audienceToken(req));
      return res.json({...await store.read(),business_rules:readBusinessRules()});
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  router.put('/data', async (req, res) => {
    try {
      access.verify(req.user, audienceToken(req));
      const expectedRevision = req.body?.revision;
      const {business_rules:_ignored,...payload}=req.body||{};
      const saved=await store.write(payload, expectedRevision, {
        id: String(req.user?.id || req.user?.nick || ''),
        name: String(req.user?.nombre || req.user?.nick || 'Usuario autenticado'),
      });
      return res.json({...saved,business_rules:readBusinessRules()});
    } catch (caught) {
      return sendError(res, caught);
    }
  });

  return router;
}
