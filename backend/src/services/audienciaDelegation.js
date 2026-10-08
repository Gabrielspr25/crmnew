import { randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const AUDIENCE = 'audiencia-katy';
const SCOPE = 'audiencia:read';
export const DELEGATION_DEFAULT_MINUTES = 30;
export const DELEGATION_MAX_MINUTES = 120;

// Acceso delegado de SOLO LECTURA para el dot de Gabriel.
// - Lo emite únicamente el propietario con su sesión CRM vigente.
// - Se firma con un secreto aleatorio del proceso, distinto de JWT_SECRET: el CRM
//   (requireAuth) nunca lo acepta y un reinicio o una revocación lo invalidan.
// - Solo autoriza GET /api/audiencia/data. No es una sesión del propietario.
export function clampMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return DELEGATION_DEFAULT_MINUTES;
  return Math.min(Math.floor(minutes) || 1, DELEGATION_MAX_MINUTES);
}

export function createAudienciaDelegation({ access, store, now = () => Date.now(), log = console.info }) {
  let secret = randomBytes(32);

  function issue(user, requestedMinutes) {
    access.verify(user, '');
    const minutes = clampMinutes(requestedMinutes);
    const jti = randomUUID();
    const token = jwt.sign({ scope: SCOPE, sub: 'katy', by: String(user.nick || user.nombre || ''), jti }, secret, {
      expiresIn: minutes * 60,
      audience: AUDIENCE,
    });
    const expiresAt = new Date(now() + minutes * 60 * 1000).toISOString();
    log(`[audiencia] acceso delegado de lectura emitido para Katy por ${user.nick || user.nombre}; vence ${expiresAt}; jti ${jti}`);
    return { token, expiresAt, minutes, scope: SCOPE };
  }

  function revokeAll(user) {
    access.verify(user, '');
    secret = randomBytes(32);
    log(`[audiencia] accesos delegados revocados por ${user.nick || user.nombre}`);
    return { revoked: true };
  }

  function claims(token) {
    try {
      const payload = jwt.verify(token, secret, { audience: AUDIENCE });
      return payload.scope === SCOPE && payload.sub === 'katy' ? payload : null;
    } catch {
      return null;
    }
  }

  // Se monta ANTES de requireAuth. Si la cabecera no es un token delegado válido,
  // no hace nada y la petición sigue el camino normal (sesión CRM).
  async function gate(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return next();
    const payload = claims(header.slice(7));
    if (!payload) return next();
    if (req.method !== 'GET' || req.path !== '/data') {
      return res.status(403).json({ error: 'El acceso delegado de Katy es de solo lectura y solo consulta /api/audiencia/data.' });
    }
    try {
      const data = await store.read();
      log(`[audiencia] lectura delegada de Katy; revisión ${data.revision}; jti ${payload.jti}`);
      res.set('Cache-Control', 'no-store');
      return res.json(data);
    } catch (caught) {
      return res.status(caught?.status || 500).json({ error: caught?.message || 'No se pudo leer Audiencia.' });
    }
  }

  return { issue, revokeAll, gate, claims };
}
