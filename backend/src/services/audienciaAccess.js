import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function error(message, status) {
  const result = new Error(message);
  result.status = status;
  return result;
}

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

export async function createPasswordHash(password) {
  if (typeof password !== 'string' || password.length < 12) throw error('La segunda contraseña debe tener al menos 12 caracteres.', 400);
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, rawN, rawR, rawP, saltHex, hashHex] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (![N, r, p].every(Number.isSafeInteger)) return false;
  const stored = Buffer.from(hashHex, 'hex');
  if (!stored.length || stored.length !== 64) return false;
  const derived = await scrypt(String(password || ''), Buffer.from(saltHex, 'hex'), stored.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(stored, Buffer.from(derived));
}

export function createAudienceAccess({ ownerNick, ownerName, passwordHash, tokenSecret, credentialStore, tokenTtl = '20m', requireSecondPassword = false }) {
  const owner = normalized(ownerNick);
  const ownerDisplayName = normalized(ownerName);
  const attempts = new Map();
  const ownerConfigured = Boolean((owner || ownerDisplayName) && (!requireSecondPassword || tokenSecret));

  async function configuredPasswordHash() {
    return passwordHash || await credentialStore?.readHash() || '';
  }

  function isOwner(user) {
    const nickMatches = Boolean(owner) && normalized(user?.nick) === owner;
    const nameMatches = Boolean(ownerDisplayName) && normalized(user?.nombre) === ownerDisplayName;
    // Si hay nick configurado, el nombre no permite autorizar otra cuenta.
    return owner ? nickMatches : nameMatches;
  }

  function denyUnlessOwner(user) {
    if (!isOwner(user)) throw error('No encontrado.', 404);
  }

  async function status(user) {
    denyUnlessOwner(user);
    if (!ownerConfigured) return { available: false, setupRequired: false };
    if (!requireSecondPassword) return { available: true, setupRequired: false, secondPasswordRequired: false };
    return { available: true, setupRequired: !(await configuredPasswordHash()) };
  }

  async function setup(user, password) {
    denyUnlessOwner(user);
    if (!requireSecondPassword) throw error('Audiencia usa la sesión del CRM; no requiere segunda contraseña.', 410);
    if (!ownerConfigured) throw error('Audiencia todavía no está configurada en este ambiente.', 503);
    if (passwordHash) throw error('Audiencia ya tiene una segunda contraseña configurada. Inicia sesión con ella.', 409);
    if (!credentialStore) throw error('No existe un almacenamiento privado para configurar Audiencia.', 503);
    const hash = await createPasswordHash(password);
    await credentialStore.initializeHash(hash);
    return { configured: true };
  }

  async function unlock(user, password) {
    denyUnlessOwner(user);
    if (!requireSecondPassword) throw error('Audiencia usa la sesión del CRM; no requiere desbloqueo adicional.', 410);
    if (!ownerConfigured) throw error('Audiencia todavía no está configurada en este ambiente.', 503);
    const activePasswordHash = await configuredPasswordHash();
    if (!activePasswordHash) throw error('Crea primero la segunda contraseña de Audiencia.', 428);
    const key = normalized(user.nick);
    const now = Date.now();
    const state = attempts.get(key) || { count: 0, blockedUntil: 0 };
    if (state.blockedUntil > now) throw error('Audiencia está bloqueada temporalmente. Intenta más tarde.', 429);
    if (!await verifyPassword(password, activePasswordHash)) {
      const count = state.count + 1;
      attempts.set(key, count >= 5 ? { count: 0, blockedUntil: now + 15 * 60 * 1000 } : { count, blockedUntil: 0 });
      throw error('La segunda contraseña no es válida.', 401);
    }
    attempts.delete(key);
    return jwt.sign({ scope: 'audiencia', nick: user.nick }, tokenSecret, { expiresIn: tokenTtl, audience: 'audiencia' });
  }

  function verify(user, token) {
    denyUnlessOwner(user);
    if (!ownerConfigured) throw error('Audiencia todavía no está configurada en este ambiente.', 503);
    if (!requireSecondPassword) return { scope: 'audiencia', nick: user.nick };
    if (!token) throw error('Audiencia sigue bloqueada.', 401);
    try {
      const payload = jwt.verify(token, tokenSecret, { audience: 'audiencia' });
      if (payload.scope !== 'audiencia' || normalized(payload.nick) !== normalized(user.nick)) throw error('La sesión privada no corresponde a esta cuenta.', 403);
      return payload;
    } catch (caught) {
      if (caught?.status) throw caught;
      throw error('La sesión privada venció. Desbloquea Audiencia otra vez.', 401);
    }
  }

  return { isOwner, status, setup, unlock, verify };
}
