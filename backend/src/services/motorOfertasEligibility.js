import {
  parseEligibilityRequest,
  parseOfferContract,
} from './motorOfertasContract.js';

function validation(codigo, estado = 'warning') {
  return { codigo, estado };
}

function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function parseOptionalJson(value) {
  if (!value || typeof value !== 'string') return value ?? {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isWithinDocumentRange(offer, contract, today) {
  const current = dateKey(today);
  const from = offer.vigencia_desde ?? contract.vigencia.desde;
  const until = offer.vigencia_hasta ?? contract.vigencia.hasta;
  return (!from || from <= current) && (!until || current <= until);
}

function offerValidity(offer, contract) {
  return offer.vigencia_documental ?? contract.vigencia.estado;
}

function offerSource(offer, contract) {
  const trace = parseOptionalJson(offer.trazabilidad);
  return {
    tipo: contract.fuente.tipo,
    archivo: trace.fileName ?? null,
    hoja: offer.fuente_hoja ?? contract.fuente.hoja ?? null,
    fila: offer.fuente_fila ?? contract.fuente.fila ?? null,
    referencia: contract.fuente.referencia ?? null,
  };
}

function offerValidityMetadata(offer, contract) {
  return {
    desde: offer.vigencia_desde ?? contract.vigencia.desde ?? null,
    hasta: offer.vigencia_hasta ?? contract.vigencia.hasta ?? null,
    estado: offerValidity(offer, contract),
  };
}

function matchesOffer({ offer, contract, request, today, addValidation }) {
  const { linea, contexto_ban: banContext } = request;
  const commercialState = offer.estado_comercial ?? contract.estado;
  if (commercialState !== 'confirmada' || contract.estado !== 'confirmada') {
    addValidation(validation('oferta_no_confirmada'));
    return false;
  }

  const validity = offerValidity(offer, contract);
  if (validity === 'vencida_pendiente_reemplazo') {
    addValidation(validation('oferta_vencida_pendiente_reemplazo'));
    return false;
  }
  if (validity !== 'vigente' || contract.vigencia.estado !== 'vigente') {
    addValidation(validation('oferta_no_vigente'));
    return false;
  }
  if (!isWithinDocumentRange(offer, contract, today)) {
    addValidation(validation('oferta_fuera_vigencia'));
    return false;
  }
  if (!contract.tipos_plan.includes(linea.tipo)) return false;
  if (
    linea.tipo === 'multilinea_business_red'
    && !contract.familias.includes(linea.familia_business_red)
  ) {
    return false;
  }
  if (!contract.eventos.includes(linea.evento)) return false;

  const minimum = offer.plan_monto_minimo;
  const maximum = offer.plan_monto_maximo;
  if (
    minimum === null
    || minimum === undefined
    || maximum === null
    || maximum === undefined
    || !Number.isFinite(Number(minimum))
    || !Number.isFinite(Number(maximum))
  ) {
    addValidation(validation('monto_plan_no_documentado'));
    return false;
  }
  if (linea.plan.monto < Number(minimum) || linea.plan.monto > Number(maximum)) {
    return false;
  }

  if (contract.trade_in?.requerido_eventos.includes(linea.evento) && !linea.trade_in.validado) {
    addValidation(validation('trade_in_requerido'));
    return false;
  }

  if (!contract.limite_ban.aplica) return true;
  if (!banContext) {
    addValidation(validation('limite_ban_pendiente'));
    return false;
  }

  const used = banContext.beneficios_usados_por_oferta[contract.id] ?? 0;
  if (
    banContext.posicion_en_ban > contract.limite_ban.cantidad
    || used >= contract.limite_ban.cantidad
  ) {
    addValidation(validation('limite_ban_excedido'));
    return false;
  }
  return true;
}

function makeEquipmentGroup({ offer, contract, equipment }) {
  return {
    equipo: {
      id: equipment.equipo_key,
      equipo_key: equipment.equipo_key,
      equipo_lista_id: equipment.equipo_lista_id ?? null,
      modelo_comercial: equipment.modelo_comercial,
      modelo_oficial: equipment.modelo_oficial ?? null,
      sku_sif: equipment.sku_sif ?? null,
      sap: equipment.sap ?? null,
      precio_regular: equipment.precio_regular ?? null,
    },
    oferta: {
      id: contract.id,
      nombre: contract.nombre,
    },
    plazos: [],
    beneficio: {
      tipo: equipment.beneficio_tipo ?? null,
    },
    aplicacion_automatica: true,
    validaciones: [],
    fuente: offerSource(offer, contract),
    vigencia: offerValidityMetadata(offer, contract),
  };
}

function compareGroups(left, right) {
  return [
    left.oferta.id.localeCompare(right.oferta.id),
    left.equipo.equipo_key.localeCompare(right.equipo.equipo_key),
    String(left.equipo.modelo_oficial ?? '').localeCompare(String(right.equipo.modelo_oficial ?? '')),
  ].find((result) => result !== 0) ?? 0;
}

export function evaluateEligibleOffers({ request, snapshot, today = new Date() }) {
  const parsedRequest = parseEligibilityRequest(request);
  const offers = Array.isArray(snapshot?.offers) ? snapshot.offers : [];
  const equipmentRows = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];
  const validations = [];
  const validationCodes = new Set();
  const groups = new Map();

  const addValidation = (item) => {
    if (validationCodes.has(item.codigo)) return;
    validationCodes.add(item.codigo);
    validations.push(item);
  };

  const equipmentByOffer = new Map();
  for (const equipment of equipmentRows) {
    const rows = equipmentByOffer.get(equipment.oferta_id) ?? [];
    rows.push(equipment);
    equipmentByOffer.set(equipment.oferta_id, rows);
  }

  for (const offer of offers) {
    let contract;
    try {
      contract = parseOfferContract(parseJson(offer.contrato));
    } catch {
      addValidation(validation('contrato_oferta_invalido'));
      continue;
    }
    if (!matchesOffer({ offer, contract, request: parsedRequest, today, addValidation })) {
      continue;
    }

    for (const equipment of equipmentByOffer.get(offer.id) ?? []) {
      if (!['exacta', 'equivalencia_aprobada'].includes(equipment.coincidencia)) {
        addValidation(validation('equipo_no_confirmado'));
        continue;
      }
      if (!contract.plazos.includes(equipment.plazo)) continue;
      if (!Number.isFinite(Number(equipment.pago_mensual))) continue;

      const key = `${contract.id}:${equipment.equipo_key}`;
      const group = groups.get(key) ?? makeEquipmentGroup({ offer, contract, equipment });
      group.plazos.push({
        meses: equipment.plazo,
        pago_mensual: Number(equipment.pago_mensual),
      });
      groups.set(key, group);
    }
  }

  const equipos = [...groups.values()]
    .map((group) => ({
      ...group,
      plazos: group.plazos.sort((left, right) => left.meses - right.meses),
    }))
    .sort(compareGroups);

  if (equipos.length === 0 && validations.length === 0) {
    return {
      equipos: [],
      validaciones: [validation('sin_equipos_elegibles', 'info')],
    };
  }

  return { equipos, validaciones: validations };
}
