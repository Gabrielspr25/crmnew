import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth.js';

export const motorOfertasRouter = Router();
motorOfertasRouter.use(requireAuth);

const pendiente = (_req, res) => res.status(503).json({ ok: false, codigo: 'motor_ofertas_pendiente_persistencia' });

motorOfertasRouter.get('/version-vigente', pendiente);
motorOfertasRouter.post('/preview', requireAdmin, pendiente);
motorOfertasRouter.post('/aprobar', requireAdmin, pendiente);
motorOfertasRouter.post('/elegibles', pendiente);
