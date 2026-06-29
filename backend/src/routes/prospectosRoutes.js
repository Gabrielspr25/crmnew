// Prospección masiva con Google Places: barre rubros x municipios de PR,
// junta TODOS los negocios posibles en public.prospectos (tabla aparte, no clients),
// y trata de extraer redes sociales entrando a la web de cada negocio.
// El mapeo contra clients reales es una fase posterior.
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const prospectosRouter = Router();

// ─── Catálogos ────────────────────────────────────────────────────────────────
// Lista amplia de rubros (que no se escape ningún negocio, "aunque venda pan").
export const RUBROS = [
  'supermercado', 'colmado', 'panadería', 'repostería', 'carnicería', 'pescadería', 'frutería',
  'farmacia', 'ferretería', 'materiales de construcción', 'mueblería', 'tienda de ropa', 'boutique',
  'zapatería', 'joyería', 'óptica', 'librería', 'papelería', 'juguetería', 'floristería',
  'tienda de regalos', 'bazar', 'quincalla', 'tienda por departamento', 'agropecuaria', 'vivero',
  'restaurante', 'cafetería', 'fonda', 'pizzería', 'comida rápida', 'food truck', 'bar', 'pub',
  'heladería', 'juguería', 'panadería y repostería', 'catering',
  'taller mecánico', 'gomera', 'hojalatería y pintura', 'lavado de autos', 'venta de autos',
  'piezas de auto', 'concesionario', 'motora',
  'clínica', 'dentista', 'laboratorio clínico', 'veterinaria', 'centro médico', 'fisioterapia',
  'spa', 'salón de belleza', 'barbería', 'salón de uñas', 'tatuajes',
  'abogado', 'contable', 'notaría', 'agencia de seguros', 'banco', 'cooperativa', 'financiera',
  'bienes raíces', 'arquitecto', 'ingeniero', 'agencia de viajes',
  'plomería', 'electricista', 'herrería', 'ebanistería', 'aire acondicionado', 'paneles solares',
  'escuela', 'colegio', 'academia', 'cuido de niños', 'tutoría',
  'reparación de celulares', 'reparación de computadoras', 'tienda de electrónicos',
  'gimnasio', 'hotel', 'hospedaje', 'lavandería', 'imprenta', 'mudanzas', 'funeraria',
  'iglesia', 'gasolinera', 'fotografía', 'eventos', 'seguridad', 'limpieza', 'pinturas',
];

// 78 municipios de Puerto Rico
export const MUNICIPIOS = [
  'Adjuntas', 'Aguada', 'Aguadilla', 'Aguas Buenas', 'Aibonito', 'Añasco', 'Arecibo', 'Arroyo',
  'Barceloneta', 'Barranquitas', 'Bayamón', 'Cabo Rojo', 'Caguas', 'Camuy', 'Canóvanas', 'Carolina',
  'Cataño', 'Cayey', 'Ceiba', 'Ciales', 'Cidra', 'Coamo', 'Comerío', 'Corozal', 'Culebra', 'Dorado',
  'Fajardo', 'Florida', 'Guánica', 'Guayama', 'Guayanilla', 'Guaynabo', 'Gurabo', 'Hatillo',
  'Hormigueros', 'Humacao', 'Isabela', 'Jayuya', 'Juana Díaz', 'Juncos', 'Lajas', 'Lares',
  'Las Marías', 'Las Piedras', 'Loíza', 'Luquillo', 'Manatí', 'Maricao', 'Maunabo', 'Mayagüez',
  'Moca', 'Morovis', 'Naguabo', 'Naranjito', 'Orocovis', 'Patillas', 'Peñuelas', 'Ponce', 'Quebradillas',
  'Rincón', 'Río Grande', 'Sabana Grande', 'Salinas', 'San Germán', 'San Juan', 'San Lorenzo',
  'San Sebastián', 'Santa Isabel', 'Toa Alta', 'Toa Baja', 'Trujillo Alto', 'Utuado', 'Vega Alta',
  'Vega Baja', 'Vieques', 'Villalba', 'Yabucoa', 'Yauco',
];

// ─── Estado del barrido (en memoria; un solo job a la vez) ─────────────────────
let job = null; // {running, stop, started_at, finished_at, rubro, municipio, queries, found, saved, redes_found, errors, total_combos, combos_done}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Google Places (Text Search v1) con paginación ─────────────────────────────
async function fetchPlaces(textQuery, pageToken) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY no configurada');
  const body = { textQuery, languageCode: 'es', regionCode: 'PR' };
  if (pageToken) body.pageToken = pageToken;
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // Básico (nivel Enterprise por el teléfono): nombre, dirección, ciudad, rubro, teléfono. Sin web/rating para no encarecer.
      'X-Goog-FieldMask': 'nextPageToken,places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.addressComponents,places.types',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { places: d.places || [], nextPageToken: d.nextPageToken || null };
}

function compAddr(p) {
  let city = '', zip = '';
  for (const c of (p.addressComponents || [])) {
    if (c.types?.includes('locality')) city = c.longText || city;
    if (!city && (c.types?.includes('administrative_area_level_1') || c.types?.includes('administrative_area_level_2'))) city = c.longText || city;
    if (c.types?.includes('postal_code')) zip = c.longText || zip;
  }
  return { city, zip };
}

// Extraer redes sociales entrando a la web del negocio
const RED_PATTERNS = [
  ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-/%]+/i],
  ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/%]+/i],
  ['linkedin', /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[A-Za-z0-9_.\-/%]+/i],
  ['twitter', /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_.\-/%]+/i],
  ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/[A-Za-z0-9_.\-/%@]+/i],
  ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/[A-Za-z0-9_.\-/%@]+/i],
  ['whatsapp', /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[A-Za-z0-9_.\-/%?=]+/i],
];
async function scrapeRedes(url) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VentasProBot/1.0)' } });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 500000);
    const redes = {};
    for (const [name, re] of RED_PATTERNS) {
      const m = html.match(re);
      if (m) {
        let u = m[0].replace(/["'\\)]+$/, '');
        // descartar links genéricos de share/login
        if (/\/(sharer|share|login|tr\?|plugins)/i.test(u)) continue;
        redes[name] = u;
      }
    }
    return Object.keys(redes).length ? redes : null;
  } catch { return null; }
}

async function upsertProspecto(c, p, rubro) {
  const { city, zip } = compAddr(p);
  const r = await c.query(
    `INSERT INTO public.prospectos
      (google_id, name, address, city, zip_code, phone, rubro, google_types)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (google_id) DO UPDATE SET
       phone=COALESCE(EXCLUDED.phone, public.prospectos.phone),
       address=COALESCE(EXCLUDED.address, public.prospectos.address),
       city=COALESCE(EXCLUDED.city, public.prospectos.city), updated_at=NOW()
     RETURNING (xmax = 0) AS inserted, id`,
    [p.id, p.displayName?.text || 'Sin nombre', p.formattedAddress || '', city, zip,
     p.nationalPhoneNumber || null, rubro, p.types || null]);
  return r.rows[0];
}

async function runHarvest(rubros, municipios, maxPages) {
  job.total_combos = rubros.length * municipios.length;
  const c = await pool.connect();
  try {
    for (const municipio of municipios) {
      for (const rubro of rubros) {
        if (job.stop) { job.stopped = true; return; }
        job.rubro = rubro; job.municipio = municipio;
        let pageToken = null, pages = 0;
        do {
          try {
            const { places, nextPageToken } = await fetchPlaces(`${rubro} en ${municipio}, Puerto Rico`, pageToken);
            job.queries++;
            for (const p of places) {
              if (!p.id) continue;
              job.found++;
              const row = await upsertProspecto(c, p, rubro);
              if (row.inserted) job.saved++;
            }
            pageToken = nextPageToken; pages++;
            if (pageToken) await sleep(1200); // dar tiempo al pageToken
          } catch (e) { job.errors++; job.last_error = e.message; pageToken = null; }
        } while (pageToken && pages < maxPages && !job.stop);
        job.combos_done++;
      }
    }
  } finally { c.release(); job.running = false; job.finished_at = new Date().toISOString(); }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────
// catálogos + conteos
prospectosRouter.get('/prospectos/meta', requireAuth, async (_req, res) => {
  try {
    const tot = await pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE redes IS NOT NULL)::int AS con_redes, count(*) FILTER (WHERE mapeado)::int AS mapeados FROM public.prospectos`);
    res.json({ ok: true, rubros: RUBROS, municipios: MUNICIPIOS, total_rubros: RUBROS.length, total_municipios: MUNICIPIOS.length, ...tot.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// listar prospectos
prospectosRouter.get('/prospectos', requireAuth, async (req, res) => {
  try {
    const { rubro, city, search, limit } = req.query;
    let sql = `SELECT * FROM public.prospectos WHERE 1=1`; const params = [];
    if (rubro) { params.push(rubro); sql += ` AND rubro=$${params.length}`; }
    if (city) { params.push(city); sql += ` AND city ILIKE $${params.length}`; }
    if (search) { params.push(`%${String(search).toLowerCase()}%`); sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(address) LIKE $${params.length})`; }
    sql += ` ORDER BY created_at DESC LIMIT ${Math.min(Number(limit) || 500, 2000)}`;
    const r = await pool.query(sql, params);
    res.json({ ok: true, total: r.rows.length, data: r.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// estado del barrido
prospectosRouter.get('/prospectos/harvest/status', requireAuth, (_req, res) => res.json({ ok: true, job: job || { running: false } }));

// arrancar barrido (background). body: {rubros?, municipios?, max_pages?}  sin rubros/municipios = TODOS
prospectosRouter.post('/prospectos/harvest', requireAuth, async (req, res) => {
  if (job && job.running) return res.status(409).json({ ok: false, error: 'Ya hay un barrido en curso' });
  const rubros = Array.isArray(req.body?.rubros) && req.body.rubros.length ? req.body.rubros : RUBROS;
  const municipios = Array.isArray(req.body?.municipios) && req.body.municipios.length ? req.body.municipios : MUNICIPIOS;
  const maxPages = Math.min(Number(req.body?.max_pages) || 3, 3);
  job = { running: true, stop: false, stopped: false, started_at: new Date().toISOString(), finished_at: null, rubro: '', municipio: '', queries: 0, found: 0, saved: 0, redes_found: 0, errors: 0, last_error: null, total_combos: rubros.length * municipios.length, combos_done: 0 };
  runHarvest(rubros, municipios, maxPages); // sin await: corre en background
  res.json({ ok: true, message: `Barrido iniciado: ${rubros.length} rubros x ${municipios.length} municipios`, job });
});

// detener barrido
prospectosRouter.post('/prospectos/harvest/stop', requireAuth, (_req, res) => {
  if (job && job.running) { job.stop = true; return res.json({ ok: true, message: 'Deteniendo…' }); }
  res.json({ ok: true, message: 'No hay barrido en curso' });
});
