import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth.js';
import { pool } from '../db.js';
import { loadAdminControlModules } from '../services/adminControlService.js';
import { loadProjectPlan, validateClosureChecklist, closureChecklistLabels } from '../services/projectPlanService.js';

export function createAdminControlRouter({ db = pool, environmentLabel = process.env.ADMIN_CONTROL_ENVIRONMENT_LABEL, loadPlan = loadProjectPlan } = {}) {
  const router = Router();
  router.get('/closure-checklist', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const plan = await loadPlan();
      const checklist = plan?.closure_checklist;
      if (!validateClosureChecklist(checklist).ok) return res.status(503).json({ error: 'Sin verificar' });
      res.json({
        ...checklist,
        items: checklist.items.map(item => ({ ...item, ...closureChecklistLabels(item) })),
      });
    } catch {
      res.status(503).json({ error: 'Sin verificar' });
    }
  });
  router.get('/modules', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json(await loadAdminControlModules({ db, environmentLabel }));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export const adminControlRouter = createAdminControlRouter();
