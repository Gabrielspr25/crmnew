const LINE_TYPES = new Set(['individual', 'multilinea_business_red']);
const EVENTS = new Set(['linea_nueva', 'portabilidad', 'renovacion', 'linea_adicional']);
const BUSINESS_RED_FAMILIES = new Set([
  'business_red_plus',
  'business_red_extreme',
  'business_red_supreme',
  'business_red_sin_fronteras',
]);

function isBusinessRedPlan(plan = {}) {
  return /^BR(?:PLUS|EXT|EXTREME|SUP|SUPREME|SF|SIN)/i.test(String(plan.codigo || ''));
}

export function validateLineaMovil(linea) {
  const errors = [];
  if (!linea || typeof linea !== 'object') {
    return { ok: false, errors: [{ codigo: 'linea_requerida', campo: 'linea' }] };
  }
  if (!String(linea.id || '').trim()) errors.push({ codigo: 'linea_id_requerido', campo: 'id' });
  if (!LINE_TYPES.has(linea.tipo)) errors.push({ codigo: 'tipo_linea_invalido', campo: 'tipo' });
  if (!linea.plan || !String(linea.plan.codigo || '').trim() || !Number.isFinite(Number(linea.plan.monto))) {
    errors.push({ codigo: 'plan_requerido', campo: 'plan' });
  }
  if (!EVENTS.has(linea.evento)) errors.push({ codigo: 'evento_invalido', campo: 'evento' });
  if (!linea.trade_in || typeof linea.trade_in !== 'object') {
    errors.push({ codigo: 'trade_in_requerido', campo: 'trade_in' });
  }

  if (linea.tipo === 'multilinea_business_red') {
    if (!BUSINESS_RED_FAMILIES.has(linea.familia_business_red)) {
      errors.push({ codigo: 'familia_business_red_requerida', campo: 'familia_business_red' });
    }
    if (!isBusinessRedPlan(linea.plan)) {
      errors.push({ codigo: 'plan_business_red_invalido', campo: 'plan.codigo' });
    }
  }

  return { ok: errors.length === 0, errors };
}

export const MOTOR_OFERTAS_VERSION_STATES = Object.freeze([
  'borrador',
  'pendiente_revision',
  'aprobada',
  'vigente',
  'reemplazada',
  'archivada',
]);
