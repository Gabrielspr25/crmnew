// Solo lectura por defecto; --process-document habilita una prueba local acotada sin publicacion.
import express from '../backend/node_modules/express/index.js';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { allowDocumentWrite, installUploadGuard, trackDrafts } from './admin-document-preview-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, 'backend/.env'), quiet: true });
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.PGHOST || 'localhost')) {
  throw new Error('Esta vista previa requiere una base local, no produccion.');
}
process.env.DEV_LOGIN = '1';
const documentArg = process.argv.find(arg => arg.startsWith('--process-document='));
const documentPath = documentArg ? path.resolve(documentArg.slice('--process-document='.length)) : null;
if (documentPath && (!documentPath.startsWith(root + path.sep) || path.extname(documentPath).toLowerCase() !== '.pdf')) throw new Error('El PDF de prueba debe estar dentro de newcrm.');
const sha = documentPath ? createHash('sha256').update(await readFile(documentPath)).digest('hex') : null;
process.env.ADMIN_CONTROL_ENVIRONMENT_LABEL = sha ? 'Local (prueba documental sin publicacion)' : 'Local (vista previa de solo lectura)';
const { pool } = await import('../backend/src/db.js');
pool.options.options += sha ? ' -c statement_timeout=10000' : ' -c default_transaction_read_only=on -c statement_timeout=10000';
const { devLogin, requireAuth } = await import('../backend/src/auth.js');
const { adminControlRouter } = await import('../backend/src/routes/adminControlRoutes.js');
const { fuentesComercialesRouter } = await import('../backend/src/routes/fuentesComercialesRoutes.js');
const { planesRouter } = await import('../backend/src/routes/planesRoutes.js');
const { equiposRouter } = await import('../backend/src/routes/equiposRoutes.js');
const { motorOfertasRouter } = await import('../backend/src/routes/motorOfertasRoutes.js');
const app = express();
const drafts = new Set();
if (sha) installUploadGuard(fuentesComercialesRouter, sha);
app.use(express.json({ limit: '1mb' }));
app.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST' && req.path === '/api/auth/dev-login') return devLogin(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) {
    let allowed = false;
    try { allowed = !!sha && await allowDocumentWrite(req, { db: pool, sha, drafts }); } catch {}
    if (!allowed) return res.status(405).json({ error: 'Prueba local: publicacion y escrituras no autorizadas bloqueadas.' });
    const json = res.json.bind(res);
    res.json = payload => { if (res.statusCode < 300) trackDrafts(payload, drafts); return json(payload); };
  }
  next();
});
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.get('/api/health', (_req, res) => res.json({ ok: true, preview: true, read_only: !sha, publication_enabled: false }));
app.use('/api/admin-control', adminControlRouter);
app.use('/api/fuentes-comerciales', fuentesComercialesRouter);
app.use('/api/planes-modulos', planesRouter);
app.use('/api/ofertas-movil', motorOfertasRouter);
app.use('/api/motor-ofertas', motorOfertasRouter);
app.use('/api', equiposRouter);
app.use('/constructor', express.static(path.join(root, 'Planes para web')));
app.use(express.static(path.join(root, 'frontend')));
app.get('/', (_req, res) => res.sendFile(path.join(root, 'frontend/app.html')));
const port = Number(process.env.ADMIN_PREVIEW_PORT || 4173);
app.listen(port, '127.0.0.1', () => console.log('Vista previa local, publicacion bloqueada: http://127.0.0.1:' + port + '/#/ofertas'));
