import { validateLineaMovil } from './motorOfertasContract.js';

function validation(codigo, estado = 'warning', detalle = null) {
  return { codigo, estado, ...(detalle ? { detalle } : {}) };
}

function matchesPlan(offer, linea) {
  const scope = offer.plan || {};
  const monto = Number(linea.plan?.monto);
  if (!Number.isFinite(monto)) return false;
  if (scope.codigos?.length && !scope.codigos.includes(linea.plan?.codigo)) return false;
  if (scope.min != null && monto < Number(scope.min)) return false;
  if (scope.max != null && monto > Number(scope.max)) return false;
  return true;
}

function matchesLine(offer, linea) {
  if (offer.tipo_linea !== linea.tipo) return false;
  if (linea.tipo === 'multilinea_business_red' && offer.familias?.length && !offer.familias.includes(linea.familia_business_red)) return false;
  return matchesPlan(offer, linea);
}

function matchesEventAndTradeIn(offer, linea) {
  if (!offer.eventos?.includes(linea.evento)) return { matches: false };
  if (linea.evento === 'renovacion' && offer.trade_in?.renovacion_requerido && !linea.trade_in?.validado) {
    return { matches: false, validation: validation('trade_in_requerido', 'bloqueante') };
  }
  return { matches: true };
}

function resolveBenefit(offer, request) {
  const base = { ...(offer.beneficio || { tipo: 'financiado' }) };
  const validations = [];
  const limit = offer.limite_ban || {};
  if (!limit.aplica) return { benefit: base, validations };

  const context = request.contexto_ban;
  if (!context) {
    return {
      benefit: base,
      validations: [validation('limite_ban_pendiente', 'bloqueante')],
      automatic: false,
    };
  }
  const used = Number(context.beneficios_usados_por_oferta?.[offer.id] || 0);
  const position = Number(context.posicion_en_ban || 0);
  const exceeded = (Number.isFinite(position) && position > Number(limit.cantidad)) || used >= Number(limit.cantidad);
  if (!exceeded) return { benefit: base, validations };
  if (limit.fuera_limite === 'financiado_si_fuente_lo_permite') {
    return {
      benefit: { tipo: 'financiado', motivo: 'limite_ban_excedido' },
      validations: [validation('limite_ban_excedido')],
    };
  }
  return { benefit: base, validations: [validation('limite_ban_excedido', 'bloqueante')], automatic: false };
}

export function findEligibleEquipment({ offers = [], request = {}, version = {} }) {
  const contract = validateLineaMovil(request.linea);
  if (!contract.ok) return { equipos: [], validaciones: contract.errors };
  if (version.estado !== 'vigente') {
    return { equipos: [], validaciones: [validation('version_vigente_no_disponible', 'bloqueante')] };
  }

  const equipos = [];
  const validaciones = [];
  for (const offer of offers) {
    if (offer.estado_comercial !== 'confirmada') continue;
    if (!matchesLine(offer, request.linea)) continue;
    const event = matchesEventAndTradeIn(offer, request.linea);
    if (!event.matches) {
      if (event.validation) validaciones.push(event.validation);
      continue;
    }
    const benefit = resolveBenefit(offer, request);
    for (const equipment of offer.equipos || []) {
      if (!['exacta', 'equivalencia_aprobada'].includes(equipment.coincidencia)) continue;
      const rowValidations = [...benefit.validations];
      let automatic = benefit.automatic !== false;
      if (offer.vigencia_documental === 'vencida_pendiente_reemplazo' || offer.vigencia_documental === 'vencida') {
        rowValidations.push(validation('fuente_vencida'));
        automatic = false;
      }
      equipos.push({
        equipo: { ...equipment },
        oferta: { id: offer.id, nombre: offer.nombre || offer.id },
        plazos: [...(equipment.plazos || [])],
        beneficio: benefit.benefit,
        aplicacion_automatica: automatic,
        validaciones: rowValidations,
        fuente: offer.fuente,
        vigencia: offer.vigencia,
      });
    }
  }
  equipos.sort((a, b) => `${a.oferta.id}|${a.equipo.modelo_oficial}|${a.plazos[0]?.meses || 0}`.localeCompare(`${b.oferta.id}|${b.equipo.modelo_oficial}|${b.plazos[0]?.meses || 0}`));
  if (!equipos.length && !validaciones.length) validaciones.push(validation('sin_equipos_elegibles'));
  return { equipos, validaciones };
}
