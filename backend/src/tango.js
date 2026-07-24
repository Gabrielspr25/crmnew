// Cliente del API Tango V2 Externa.
// Solo usamos 2 endpoints (regla #30): /auth/verify (login) y /ventas.

const BASE = (process.env.TANGO_API_BASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.TANGO_API_KEY || '';
const planRateCache = new Map();
const PLAN_RATE_CACHE_MS = 5 * 60 * 1000;

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${KEY}`,
    'x-api-key': KEY,
    Accept: 'application/json',
    ...extra,
  };
}

function positiveRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function normalizePlanCode(value) {
  return String(value || '').trim().toUpperCase();
}

function tangoPlanCode(row) {
  const raw = row?.codigovoz ?? row?.codigo ?? row?.code ?? row?.pricecode ?? '';
  return normalizePlanCode(raw).split(/\s+/)[0] || null;
}

function tangoPlanRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.planes)) return payload.planes;
  if (Array.isArray(payload?.plans)) return payload.plans;
  return [];
}

export function resolvePlanRateFromTangoRows(planCode, rows = []) {
  const target = normalizePlanCode(planCode);
  if (!target) return { value: null, source: null, ambiguous: false };

  const rates = new Set(
    rows
      .filter((row) => tangoPlanCode(row) === target && row?.activo !== false)
      .map((row) => positiveRate(row?.rate ?? row?.monthly_value ?? row?.monthlyValue ?? row?.price ?? row?.precio))
      .filter((rate) => rate != null)
  );

  if (rates.size !== 1) {
    return { value: null, source: null, ambiguous: rates.size > 1 };
  }

  return { value: [...rates][0], source: 'tango-api-v2', ambiguous: false };
}

// Resuelve la renta del plan desde Tango V2. El sufijo 1/2 ya se quitó antes
// mediante applyPlanCodeDefaults; aquí solo se consulta el código base.
export async function resolvePlanMonthlyValueFromTango(planCode) {
  const code = normalizePlanCode(planCode);
  if (!code || !BASE || !KEY) return { value: null, source: null, ambiguous: false };

  const cached = planRateCache.get(code);
  if (cached && Date.now() - cached.at < PLAN_RATE_CACHE_MS) return cached.result;

  try {
    const resp = await fetch(`${BASE}/api/external/planes`, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return { value: null, source: null, ambiguous: false };
    const result = resolvePlanRateFromTangoRows(code, tangoPlanRows(await resp.json()));
    planRateCache.set(code, { at: Date.now(), result });
    return result;
  } catch {
    return { value: null, source: null, ambiguous: false };
  }
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

// Trae las comisiones de Tango V2 en el mismo rango que las ventas. La
// paginacion replica el contrato de /ventas para no perder resultados.
export async function fetchComisiones({ desde, hasta, limit = 200 }) {
  if (!BASE || !KEY) throw new Error('Tango V2 no esta configurado en el servidor');
  const all = [];
  let offset = 0;
  let guard = 0;
  while (guard < 50) {
    const url = `${BASE}/api/external/comisiones?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&limit=${limit}&offset=${offset}`;
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error(`Tango /comisiones respondio ${resp.status}`);
    const payload = await resp.json().catch(() => null);
    const rows = Array.isArray(payload) ? payload : payload?.data || payload?.comisiones || [];
    all.push(...rows);
    const pg = payload?.pagination || {};
    const next = Number(pg.offset ?? offset) + Number(pg.limit ?? limit);
    if (!pg.hasMore || rows.length === 0 || next <= offset) break;
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
