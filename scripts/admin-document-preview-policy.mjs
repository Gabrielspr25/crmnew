import { createHash } from 'node:crypto';

// Solo el servidor local de prueba instala este control, despues del multer existente.
export function installUploadGuard(router, sha) {
  const route = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post)?.route;
  if (!route?.stack?.length) throw new Error('No se encontro la carga existente; prueba deshabilitada.');
  const layer = route.stack.at(-1), handle = layer.handle;
  layer.handle = function guardedUpload(req, res, next) {
    const file = req.file;
    if (!['fijos', 'claro_tv'].includes(req.body?.familia) || !file?.buffer
      || !/\.pdf$/i.test(file.originalname) || createHash('sha256').update(file.buffer).digest('hex') !== sha) {
      return res.status(403).json({ error: 'Prueba local: solo el PDF oficial autorizado de Fijo/TV.' });
    }
    req.body.publicacion_modo = 'borrador';
    return handle(req, res, next);
  };
}

export async function allowDocumentWrite(req, { db, sha, drafts }) {
  if (req.method !== 'POST') return false;
  if (req.path === '/api/fuentes-comerciales') return true;
  const base = '/api/fuentes-comerciales/';
  const source = req.path.match(new RegExp(`^${base}([0-9a-f-]{36})/preview-base(?:/borradores)?$`, 'i'));
  if (source) {
    const { rows } = await db.query('SELECT sha256, familia FROM public.fuentes_comerciales WHERE id=$1', [source[1]]);
    return rows.some(row => row.sha256 === sha && ['fijos', 'claro_tv'].includes(row.familia));
  }
  const transition = req.path.match(new RegExp(`^${base}bases-informativas/([0-9a-f-]{36})/(validar|aprobar)$`, 'i'));
  return !!transition && drafts.has(transition[1]);
}

export function trackDrafts(payload, drafts) {
  for (const row of payload?.publicaciones || []) {
    if (row.estado === 'borrador' && ['fijo','claro_tv'].includes(row.categoria)) drafts.add(row.id);
  }
}
