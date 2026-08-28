import { normalizeRole } from '../auth.js';

export function isSeller(user) {
  return normalizeRole(user?.rol) === 'vendedor';
}

export function sellerScope(user) {
  return String(user?.nombre || user?.nick || '').trim();
}

export function requireCampaignAdmin(req, res, next) {
  if (isSeller(req.user)) {
    return res.status(403).json({ ok: false, error: 'El perfil vendedor solo puede usar correo 1 a 1.' });
  }
  next();
}
