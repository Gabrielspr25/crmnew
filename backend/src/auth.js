// Login con Tango + middleware de sesión (JWT propio del CRM).
import jwt from 'jsonwebtoken';
import { verifyLogin } from './tango.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';

// POST /api/auth/login  { usuario, password }
export async function login(req, res) {
  const usuario = String(req.body?.usuario || req.body?.username || '').trim();
  const password = req.body?.password;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Faltan usuario y/o clave' });
  }

  let result;
  try {
    result = await verifyLogin(usuario, password);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar a Tango' });
  }

  const ok = result?.valid === true || result?.success === true || result?.ok === true;
  const perfil =
    result?.usuario ||
    result?.user ||
    result?.profile ||
    result?.data?.usuario ||
    result?.data?.user ||
    result?.data ||
    null;
  if (!ok || !perfil) {
    return res.status(401).json({ error: 'Usuario o clave incorrectos' });
  }
  // Regla del doc: rechazar inactivos o vencidos.
  if (perfil.activo === false || perfil.vencido === true) {
    return res.status(403).json({ error: 'Usuario inactivo o vencido en Tango' });
  }

  const user = {
    nick: perfil.nick || perfil.username || perfil.usuario || usuario,
    nombre: [perfil.nombre || perfil.name, perfil.apellido || perfil.lastName].filter(Boolean).join(' ').trim(),
    email: perfil.email || null,
    rol: (perfil.rol || perfil.role || 'vendedor').toLowerCase(),
    tienda_id: perfil.tienda_id || perfil.tiendaId || null,
  };
  const token = jwt.sign(user, SECRET, { expiresIn: '12h' });
  return res.json({ token, user });
}

// ⚠️ SOLO PARA PROBAR LOCAL (sin Tango). Se activa con DEV_LOGIN=1 en .env.
// QUITAR / dejar apagado en producción — entrega un token sin validar nada.
export function devLogin(_req, res) {
  const user = { nick: 'dev', nombre: 'Admin Dev', email: 'dev@local', rol: 'admin', tienda_id: null };
  const token = jwt.sign(user, SECRET, { expiresIn: '12h' });
  res.json({ token, user });
}

// Middleware: exige sesión válida.
// ⚠️ Con DEV_LOGIN=1 (solo local) NUNCA devuelve 401: si no hay token válido entra como Admin Dev.
// Al deployar: poner DEV_LOGIN=0 (o borrarlo) y el login de Tango vuelve a ser obligatorio.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), SECRET);
      return next();
    } catch { /* token inválido: cae al bypass dev o al 401 */ }
  }
  if (process.env.DEV_LOGIN === '1') {
    req.user = { nick: 'dev', nombre: 'Admin Dev', email: 'dev@local', rol: 'admin', tienda_id: null };
    return next();
  }
  return res.status(401).json({ error: header ? 'Sesión inválida o vencida' : 'No autenticado' });
}

// Middleware estricto para flujos que nunca pueden usar DEV_LOGIN.
export function requireStrictAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesion invalida o vencida' });
  }
}

// Middleware: exige rol admin o supervisor.
export function requireAdmin(req, res, next) {
  if (!['admin', 'supervisor'].includes(req.user?.rol)) {
    return res.status(403).json({ error: 'Solo admin/supervisor' });
  }
  next();
}
