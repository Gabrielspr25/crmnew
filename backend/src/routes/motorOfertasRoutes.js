import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAdmin, requireStrictAuth } from '../auth.js';
import { createMotorOfertasHandlers } from '../services/motorOfertasHandlers.js';
import { createMotorOfertasRepository } from '../services/motorOfertasRepository.js';
import { normalizeOfferWorkbooks, inferSourceValidity } from '../services/motorOfertasNormalizer.js';
import { archiveOfferSource, buildSourcesManifest, readArchivedOfferSource } from '../services/motorOfertasSourceArchive.js';
import { evaluateEligibleOffers } from '../services/motorOfertasEligibility.js';
import { buildOfferReviewSnapshot } from '../services/motorOfertasReview.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_UPLOAD_ROOT = process.env.MOTOR_OFERTAS_UPLOAD_DIR
  || path.resolve(__dir, '../../uploads/motor-ofertas');
export const DEFAULT_NORMALIZADOR_VERSION = '1.0.3';

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
  });
}

async function readArchivedOfferSources(sources) {
  const byType = new Map((sources ?? []).map((source) => [source.tipo ?? source.type, source]));
  const financing = byType.get('tabla_financiamiento');
  const prices = byType.get('lista_precios');
  if (!financing || !prices) throw new Error('fuentes_incompletas');
  const [financingBuffer, priceListBuffer] = await Promise.all([
    readArchivedOfferSource({ rootDir: DEFAULT_UPLOAD_ROOT, source: financing }),
    readArchivedOfferSource({ rootDir: DEFAULT_UPLOAD_ROOT, source: prices }),
  ]);
  return { financingBuffer, priceListBuffer };
}

export function createMotorOfertasRouter(dependencies) {
  const handlers = createMotorOfertasHandlers(dependencies);
  const router = Router();
  const upload = createUpload();
  const uploadSources = upload.fields(sourceFields);
  const uploadTable = upload.single('tabla_financiamiento');

  router.use(requireStrictAuth);
  router.get('/version-vigente', handlers.versionVigente);
  router.get('/revision-actual', requireAdmin, handlers.revisionActual);
  router.post('/versiones/:versionId/revision/equivalencias', requireAdmin, handlers.guardarEquivalenciaPropuesta);
  router.post('/versiones/:versionId/revision/business-red', requireAdmin, handlers.guardarBusinessRedPropuesta);
  router.post('/preview', requireAdmin, uploadSources, handlers.preview);
  router.post('/preview-tabla', requireAdmin, uploadTable, handlers.previewTabla);
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
  readArchivedOfferSources,
  readArchivedOfferSource,
  buildOfferReviewSnapshot,
  uploadRoot: DEFAULT_UPLOAD_ROOT,
  normalizadorVersion: DEFAULT_NORMALIZADOR_VERSION,
};

export const motorOfertasRouter = createMotorOfertasRouter(defaultDependencies);
