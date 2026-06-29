// Servidor del sistema nuevo VentasPro.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, requireAuth, devLogin } from './auth.js';
import { salesRouter } from './routes/sales.js';
import { clientsRouter } from './routes/clients.js';
import { linesRouter } from './routes/lines.js';
import { catalogRouter } from './routes/catalog.js';
import { oppsRouter } from './routes/opportunities.js';
import { goalsRouter } from './routes/goals.js';
import { miscRouter } from './routes/misc.js';
import { comisionesRouter } from './routes/comisionesReal.js';
import { clientsRealRouter } from './routes/clientsReal.js';
import { asanaRealRouter } from './routes/asanaReal.js';
import { writeRouter } from './routes/writeRoutes.js';
import { ocrRouter } from './routes/ocrRoutes.js';
import { importRouter } from './routes/importRoutes.js';
import { equiposRouter } from './routes/equiposRoutes.js';
import { planesRouter } from './routes/planesRoutes.js';
import { prospectosRouter } from './routes/prospectosRoutes.js';
import { correosRouter } from './routes/correosRoutes.js';
import { placesRouter } from './routes/places.js';


const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir el frontend (app.html, propuesta-template.html, etc.) -> http://localhost:4000
const __dir = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(__dir, '../../frontend');
app.use(express.static(FRONT, {
  etag: false,
  setHeaders: (res, fp) => {
    if (fp.endsWith('.html')) res.setHeader('Cache-Control', 'no-store, must-revalidate');
  },
}));
app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.join(FRONT, 'app.html'));
});

// Salud
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ventaspro-nuevo' }));

// Login con Tango (público) + quién soy
app.post('/api/auth/login', login);
if (process.env.DEV_LOGIN === '1') app.post('/api/auth/dev-login', devLogin); // solo local
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

// Módulos
app.use('/api/clients', clientsRouter);   // clientes
app.use('/api', linesRouter);             // /bans, /subscribers
app.use('/api', catalogRouter);           // /categories, /products, /step-templates
app.use('/api', oppsRouter);              // seguimiento: oportunidades + pasos + bitácora
app.use('/api/goals', goalsRouter);       // metas + cumplimiento
app.use('/api', miscRouter);              // comparativas + historial
app.use('/api', comisionesRouter);        // COMISIONES con data real de crm_pro
app.use('/api', clientsRealRouter);       // CLIENTES con data real de crm_pro (tarjetas + lista)
app.use('/api', asanaRealRouter);         // ASANA SEG. con data real de crm_pro (SOV2)
app.use('/api', writeRouter);             // ESCRITURA real: clientes/BANs/suscriptores
app.use('/api', ocrRouter);               // OCR: subir/pegar imagen -> suscriptores
app.use('/api', importRouter);            // Importador: actualización masiva desde Excel
app.use('/api', equiposRouter);           // Admin de Equipos: lista de precios PYMES/CORP
app.use('/api/planes-modulos', planesRouter); // Admin de Planes: CRUD + constructor de ofertas (PDF)
app.use('/api', prospectosRouter);        // Prospección masiva Google Places -> public.prospectos
app.use('/api', correosRouter);           // Correos: clientes con email + envío (mailto/SMTP)
app.use('/api/sales', salesRouter);       // ventas / comisiones
app.use('/api/places', placesRouter);     // búsqueda de Google Places


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[ventaspro-nuevo] backend en :${PORT}`));
