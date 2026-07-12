// Cliente del API Tango V2 Externa.
// Solo usamos 2 endpoints (regla #30): /auth/verify (login) y /ventas.

const BASE = (process.env.TANGO_API_BASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.TANGO_API_KEY || '';

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${KEY}`,
    'x-api-key': KEY,
    Accept: 'application/json',
    ...extra,
  };
}

// --- Login con Tango (regla #38): valida nick + clave, devuelve el perfil. ---
export async function verifyLogin(usuario, password) {
  const resp = await fetch(`${BASE}/api/external/auth/verify`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      usuario,
      username: usuario,
      password,
      clave: password,
    }),
  });
  if (!resp.ok) {
    return { valid: false, status: resp.status };
  }
  const data = await resp.json().catch(() => ({}));
  // Tango responde { valid, usuario: { nombre, apellido, email, nick, rol, ... } }
  return data;
}

// --- Traer ventas en un rango de fechas, con paginación. (regla #17/#30) ---
export async function fetchVentas({ desde, hasta, limit = 200 }) {
  const all = [];
  let offset = 0;
  let guard = 0;
  while (guard < 50) {
    const url = `${BASE}/api/external/ventas?desde=${desde}&hasta=${hasta}&limit=${limit}&offset=${offset}`;
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) {
      throw new Error(`Tango /ventas respondió ${resp.status}`);
    }
    const payload = await resp.json().catch(() => null);
    const rows = Array.isArray(payload)
      ? payload
      : payload?.data || payload?.ventas || [];
    all.push(...rows);

    const pg = payload?.pagination || {};
    const hasMore = Boolean(pg.hasMore);
    const next = Number(pg.offset ?? offset) + Number(pg.limit ?? limit);
    if (!hasMore || rows.length === 0 || next <= offset) break;
    offset = next;
    guard++;
  }
  return all;
}

// Normaliza una venta de Tango a los campos que guardamos en `sales`.
export function mapVenta(v) {
  const vendedor =
    typeof v?.vendedor === 'string' ? v.vendedor : v?.vendedor?.nombre || null;
  const cliente =
    typeof v?.cliente === 'string'
      ? v.cliente
      : [v?.cliente?.nombre, v?.cliente?.apellido].filter(Boolean).join(' ').trim() || null;
  return {
    tango_venta_id: v?.ventaid ?? v?.id ?? null,
    ban_number: String(v?.ban || '').trim() || null,
    phone: String(v?.numerocelularactivado || v?.telefono || '').replace(/\D/g, '') || null,
    ventatipo_nombre: v?.ventatipo?.nombre || v?.ventatipo_nombre || null,
    monthly_value: Number(v?.pagomensual ?? v?.plan?.rate ?? 0) || null,
    vendor_name: vendedor,
    cliente_nombre: cliente,
    sale_date: v?.fechaactivacion ? String(v.fechaactivacion).slice(0, 10) : null,
    raw_payload: v,
  };
}
