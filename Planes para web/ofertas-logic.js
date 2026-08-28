// ofertas-logic.js
// Motor de filtrado. Los datos y montos se inyectan desde publicaciones vigentes.

const publishedPlanAmounts = () => window.CONSTRUCTOR_PLAN_AMOUNTS || {};
const publishedPlanLabels = () => window.CONSTRUCTOR_PLAN_LABELS || {};

function canonicalToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function canonicalEvent(value) {
  const token = canonicalToken(value);
  if (token === 'nueva' || token === 'lineanueva') return 'lineanueva';
  if (token === 'adicional' || token === 'lineaadicional') return 'lineaadicional';
  return token;
}

function canonicalFamily(value) {
  const token = canonicalToken(value);
  if (token.includes('sinfronteras')) return 'sinfronteras';
  if (token.includes('extreme')) return 'extreme';
  if (token.includes('supreme')) return 'supreme';
  if (token.includes('plus')) return 'plus';
  return token;
}

function getPlanNum(state) {
  if (state.tipo === 'individual') return Number(state.planInd) || 0;
  return Number(publishedPlanAmounts()[state.planMulti] || 0);
}

// Ofertas aplicables segun evento/tipo/plan/beneficio.
function getOfertasAplicables(state) {
  const plan = getPlanNum(state);

  return (window.OFERTAS_DATA || []).filter(oferta => {
    // 1. Filtro de beneficio
    if (state.beneficio !== 'todos' && oferta.beneficio !== state.beneficio) return false;
    if (Array.isArray(oferta.eventos) && oferta.eventos.length) {
      const evento = state.lineEvent || (Array.isArray(state.eventos) ? state.eventos[0] : null);
      if (!oferta.eventos.some(item => canonicalEvent(item) === canonicalEvent(evento))) return false;
    }

    // 2. Filtro de tipo individual vs multilinea
    if (state.tipo === 'individual') {
      if (oferta.tipo === 'multilinea') return false;
      if (Array.isArray(oferta.planesIndividuales)) return oferta.planesIndividuales.includes(plan);
    } else {
      if (oferta.tipo === 'individual') return false;
      if (Array.isArray(oferta.familiasMultilinea)) {
        return oferta.familiasMultilinea.some(item => canonicalFamily(item) === canonicalFamily(state.planMulti));
      }
      // verificar familia multilinea segun terminos del Excel
      if (Array.isArray(oferta.familias) && oferta.familias.length > 0
        && !oferta.familias.some(item => canonicalFamily(item) === canonicalFamily(state.planMulti))) return false;
    }

    // 3. Regla general: un plan mayor hereda ofertas/equipos de planes menores,
    // salvo ofertas que declaran planesIndividuales/familiasMultilinea exactos.
    if (plan < oferta.planMin) return false;
    if (oferta.planMaxEnforced && plan > oferta.planMax) return false;

    return true;
  });
}

// Equipos unicos de las ofertas aplicables (dedup por marca|modelo),
// con la lista de ofertaIds donde aparece cada equipo.
function getEquiposFiltrados(state) {
  const ofertas = getOfertasAplicables(state);
  const vistos = new Set();
  const equipos = [];

  ofertas.forEach(oferta => {
    oferta.equipos.forEach(equipo => {
      const key = equipo.marca + '|' + equipo.modelo;
      if (!vistos.has(key)) {
        vistos.add(key);
        equipos.push({ ...equipo, key, ofertaIds: [oferta.id] });
      } else {
        equipos.find(e => e.key === key).ofertaIds.push(oferta.id);
      }
    });
  });

  return equipos
    .filter(e => !state.marca || e.marca === state.marca)
    .filter(e => !state.buscar || e.modelo.toLowerCase().includes(state.buscar.toLowerCase()))
    .sort((a, b) => a.modelo.localeCompare(b.modelo));
}

// REGLA: lineas nuevas NUNCA requieren trade-in. Renovaciones segun la oferta.
function requiresTradein(oferta, evento) {
  return evento === 'renovacion' && oferta.tradeinRenov === true;
}

// Tabla comercial: gratis / 50% / credito (con mensualidad por plazo).
function calcularTablaComercial(oferta, equipoPrecio) {
  if (oferta.beneficio === 'gratis') {
    return {
      tipo: 'gratis',
      precioRegular: equipoPrecio,
      precioFinal: 0,
      nota: 'El cliente paga taxes/IVU al activar.'
    };
  }

  if (oferta.beneficio === '50pct') {
    const final = equipoPrecio * 0.5;
    return {
      tipo: '50pct',
      precioRegular: equipoPrecio,
      descuento: equipoPrecio * 0.5,
      precioFinal: final,
      mensual30: final / 30
    };
  }

  if (oferta.beneficio === 'credito' && oferta.credito) {
    const final = Math.max(0, equipoPrecio - oferta.credito);
    const resultado = {
      tipo: 'credito',
      precioRegular: equipoPrecio,
      credito: oferta.credito,
      precioFinal: final,
      plazos: {}
    };
    oferta.plazos.forEach(p => {
      resultado.plazos[p] = {
        mensual: final / p,
        creditoMensual: oferta.credito / p
      };
    });
    return resultado;
  }

  return null;
}

// Exponer global
window.OfertasLogic = {
  get PLAN_MULTILINEA_NUM(){ return publishedPlanAmounts(); },
  get PLAN_MULTILINEA_LABEL(){ return publishedPlanLabels(); },
  get PLAN_MULTILINEA_RANK(){ return publishedPlanAmounts(); },
  getPlanNum,
  getOfertasAplicables,
  getEquiposFiltrados,
  requiresTradein,
  calcularTablaComercial
};
