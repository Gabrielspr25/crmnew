import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAdmin, requireStrictAuth } from '../auth.js';
import { createMotorOfertasHandlers } from '../services/motorOfertasHandlers.js';
import { createMotorOfertasRepository } from '../services/motorOfertasRepository.js';
import { normalizeOfferWorkbooks, inferSourceValidity } from '../services/motorOfertasNormalizer.js';
import { archiveOfferSource, buildSourcesManifest } from '../services/motorOfertasSourceArchive.js';
import { evaluateEligibleOffers } from '../services/motorOfertasEligibility.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_UPLOAD_ROOT = process.env.MOTOR_OFERTAS_UPLOAD_DIR
  || path.resolve(__dir, '../../uploads/motor-ofertas');

const sourceFields = Object.freeze([
  { name: 'tabla_financiamiento', maxCount: 1 },
  { name: 'lista_precios', maxCount: 1 },
]);

function createUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 2, fields: 4, parts: 6 },
    fileFilter: (_req, file, callback) => {
      const allowed = path.extname(file.originalname).toLowerCase() === '.xlsx';
      callback(allowed ? null : new Error('tipo_archivo_invalido'), allowed);
    },
  }).fields(sourceFields);
}

export function createMotorOfertasRouter(dependencies) {
  const handlers = createMotorOfertasHandlers(dependencies);
  const router = Router();
  const uploadSources = createUpload();

  router.use(requireStrictAuth);
  router.get('/version-vigente', handlers.versionVigente);
  router.post('/preview', requireAdmin, uploadSources, handlers.preview);
  router.post('/aprobar', requireAdmin, handlers.aprobar);
  router.post('/elegibles', handlers.elegibles);
  router.use((error, _req, res, _next) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return res.status(422).json({ error: 'archivo_demasiado_grande' });
    return res.status(422).json({ error: 'multipart_invalido' });
  });
  return router;
}

const defaultDependencies = {
  repository: createMotorOfertasRepository({ pool }),
  normalizeOfferWorkbooks,
  archiveOfferSource,
  buildSourcesManifest,
  inferSourceValidity,
  evaluateEligibleOffers,
  uploadRoot: DEFAULT_UPLOAD_ROOT,
  normalizadorVersion: '1.0.0',
};

export const motorOfertasRouter = createMotorOfertasRouter(defaultDependencies);
