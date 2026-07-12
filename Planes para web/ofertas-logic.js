// ofertas-logic.js
// Motor de filtrado del Constructor de Ofertas 2 (Excel PYMES 9-22 jun 2026).
// Depende de OFERTAS_DATA (ofertas-data.js).

const PLAN_MULTILINEA_NUM = {
  plus: 65,
  extreme: 75,
  supreme: 95,
  sinfronteras: 100
};

const PLAN_MULTILINEA_LABEL = {
  plus: 'Plus ($65)',
  extreme: 'Extreme ($75)',
  supreme: 'Supreme ($95)',
  sinfronteras: 'Sin Fronteras ($100)'
};

const PLAN_MULTILINEA_RANK = {
  plus: 65,
  extreme: 75,
  supreme: 95,
  sinfronteras: 100
};

function getPlanNum(state) {
  if (state.tipo === 'individual') return Number(state.planInd) || 0;
  return PLAN_MULTILINEA_NUM[state.planMulti] || 65;
}

// Ofertas aplicables segun evento/tipo/plan/beneficio.
function getOfertasAplicables(state) {
  const plan = getPlanNum(state);

  return (window.OFERTAS_DATA || []).filter(oferta => {
    // 1. Filtro de beneficio
    if (state.beneficio !== 'todos' && oferta.beneficio !== state.beneficio) return false;
    if (Array.isArray(oferta.eventos) && oferta.eventos.length) {
      const evento = state.lineEvent || (Array.isArray(state.eventos) ? state.eventos[0] : null);
      if (!oferta.eventos.includes(evento)) return false;
    }

    // 2. Filtro de tipo individual vs multilinea
    if (state.tipo === 'individual') {
      if (oferta.tipo === 'multilinea') return false;
      if (Array.isArray(oferta.planesIndividuales)) return oferta.planesIndividuales.includes(plan);
    } else {
      if (oferta.tipo === 'individual') return false;
      if (Array.isArray(oferta.familiasMultilinea)) return oferta.familiasMultilinea.includes(state.planMulti);
      // verificar familia multilinea segun terminos del Excel
      if (oferta.familias.length > 0 && !oferta.familias.includes(state.planMulti)) return false;
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
  PLAN_MULTILINEA_NUM,
  PLAN_MULTILINEA_LABEL,
  PLAN_MULTILINEA_RANK,
  getPlanNum,
  getOfertasAplicables,
  getEquiposFiltrados,
  requiresTradein,
  calcularTablaComercial
};
