import { validateLineaMovil } from './motorOfertasContract.js';
import { findEligibleEquipment } from './motorOfertasEligibility.js';
import { dateOnly } from './vigenciaTexto.js';

const ALLOWED_EVENTS = new Set(['linea_nueva', 'portabilidad', 'renovacion']);
const MONTHS = 30;
const BLOCKING_STATES = ['requiere revision', 'fuente ambigua', 'contradiccion', 'fuente incompleta', 'no determinado'];
// La vigencia_hasta real vive en la fuente archivada (fuentes_comerciales por sha256); los callers la pasan como specialDiscountVigencia.
export const SPECIAL_EQUIPMENT_DISCOUNT = {
  amount: 130,
  allowedMonths: [24, 30],
  priceCodesByModality: {
    financiamiento: { 24: 'F13024', 30: 'F13030' },
    update_plus: { 24: 'U13024', 30: 'U13030' },
  },
  source: {
    archivo: 'Boletin Oferta Descuentos Modems MIFI Tablets 23 julio 2026.pdf',
    hoja: 'Boletín Oferta Descuentos Modems, MIFI y Tablets',
    pagina: 6,
    seccion: 'Planes Multilíneas Business RED',
    vigencia_desde: '2026-07-23',
    vigencia_hasta: null,
    sha256: 'BDCD529BC1F2ABD8D71D0DCDA23F5142F67480249E00EF3451DEE1CDD61DECF5',
  },
  condicion: 'Business Red Plus, líneas 1 a 10, módems/MIFI/tablets en financiamiento; no requiere pago inicial ni trade-in.',
};

function specialDiscountVigenciaFor(override = null) {
  return {
    desde: dateOnly(override?.desde || override?.vigencia_desde) || SPECIAL_EQUIPMENT_DISCOUNT.source.vigencia_desde,
    hasta: dateOnly(override?.hasta || override?.vigencia_hasta) || SPECIAL_EQUIPMENT_DISCOUNT.source.vigencia_hasta,
  };
}

function validation(codigo, estado = 'bloqueante', detalle = null) {
  return { codigo, estado, ...(detalle ? { detalle } : {}) };
}

function roundMoney(value) {
  return Number((Number(value || 0) + Number.EPSILON).toFixed(2));
}

function benefitFor(discount) {
  if (discount === 1) return { tipo: 'gratis', porcentaje: 100 };
  if (discount > 0) return { tipo: 'descuento_porcentaje', porcentaje: roundMoney(discount * 100) };
  return { tipo: 'financiado' };
}

function isExpired(vigencia, today) {
  return Boolean(vigencia?.hasta && today && vigencia.hasta < today);
}

function equipmentKey(item) {
  return String(item?.equipo?.modelo_oficial || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function lineModality(linea) {
  return String(linea?.modalidad_linea || 'financiamiento').toLowerCase();
}

function specialDiscountCodes(modalidadLinea) {
  return SPECIAL_EQUIPMENT_DISCOUNT.priceCodesByModality[modalidadLinea]
    || SPECIAL_EQUIPMENT_DISCOUNT.priceCodesByModality.financiamiento;
}

function normalizeCandidateKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasBlockingValidation(item) {
  const validations = Array.isArray(item?.validaciones) ? item.validaciones : [];
  const sourceState = normalizeCandidateKey(item?.fuente?.estado_confianza || item?.fuente?.confidence || item?.fuente?.estado || '');
  if (BLOCKING_STATES.includes(sourceState)) return true;
  return validations.some((validationItem) => {
    const code = normalizeCandidateKey(validationItem.codigo || validationItem.estado || '');
    return validationItem.estado === 'bloqueante' || BLOCKING_STATES.includes(code);
  });
}

function firstTerm(item, preferredTerm = null) {
  const terms = Array.isArray(item?.plazos) ? item.plazos : [];
  if (preferredTerm) {
    const match = terms.find((term) => Number(term.meses) === Number(preferredTerm));
    if (match) return match;
  }
  return terms[0] || {};
}

function benefitDiscount(item, term) {
  const regular = Number(item?.equipo?.precio_regular || 0);
  const financed = Number(term?.precio_financiado ?? item?.equipo?.precio_financiado ?? regular);
  const amount = Number(item?.beneficio?.monto || 0);
  if (amount > 0) return roundMoney(amount);
  if (Number.isFinite(regular) && Number.isFinite(financed) && regular > financed) return roundMoney(regular - financed);
  const percent = Number(item?.beneficio?.porcentaje || 0);
  if (percent > 0 && regular > 0) return roundMoney(regular * percent / 100);
  return 0;
}

function candidatePriceCode(item, term, modalidadLinea) {
  if (term?.price_code) return term.price_code;
  const codes = item?.price_codes || {};
  if (codes[modalidadLinea]?.[term?.meses]) return codes[modalidadLinea][term.meses];
  if (codes.fi) return codes.fi;
  if (codes.up) return codes.up;
  return null;
}

function regularMonthly(regular, term) {
  const months = Number(term?.meses || 0);
  if (!Number.isFinite(Number(regular)) || !Number.isFinite(months) || months <= 0) return null;
  return roundMoney(Number(regular) / months);
}

function compactEquipmentKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bjex\s+stream\b/g, 'jexstream')
    .replace(/[^a-z0-9]+/g, '');
}

function displayEquipmentModel(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (/cg\s*890/i.test(text)) return 'Franklin JEXstream CG890 5G';
  if (/rg\s*2100/i.test(text)) return 'Franklin JEXstream RG2100 5G';
  const iphoneBase = text.match(/\biphone\s+17\b(?!\s*(?:pro|air|e))/i);
  const capacity = text.match(/\b(\d{3,4}\s*gb)\b/i)?.[1]?.replace(/\s+/g, '').toUpperCase();
  if (iphoneBase) return capacity ? `iPhone 17 ${capacity}` : 'iPhone 17';
  return text;
}

function equipmentCategory(item = {}) {
  const category = normalizeCandidateKey(item.categoria_producto || item.categoria || item.product_category || '');
  if (['celular', 'smartphone', 'phone', 'iphone'].includes(category)) return 'smartphone';
  if (['modem', 'mifi', 'internet on the go', 'router'].includes(category)) return 'modem';
  if (['tablet', 'tableta', 'ipad'].includes(category)) return 'tablet';
  return category;
}

function isMatchingEquipment(requested = {}, item = {}) {
  const requestedCode = String(requested.item_code || requested.itemCode || '').trim().toUpperCase();
  if (requestedCode) return String(item.item_code || '').trim().toUpperCase() === requestedCode;

  const requestedModel = String(requested.modelo || requested.equipo || requested.model || '').trim();
  const candidateModel = String(item.modelo || item.modelo_oficial || item.equipo || '').trim();
  if (!requestedModel || !candidateModel) return false;

  const requestedKey = compactEquipmentKey(requestedModel);
  const candidateKey = compactEquipmentKey(candidateModel);

  if (requestedKey === 'iphone17') {
    return /^iphone17(?!pro|air|e)/.test(candidateKey);
  }
  if (requestedKey.includes('cg890')) return candidateKey.includes('cg890');
  if (requestedKey.includes('rg2100')) return candidateKey.includes('rg2100');
  return candidateKey.includes(requestedKey);
}

function sourceApplies(source = {}, scenarioDate = null) {
  const state = normalizeCandidateKey(source.estado_publicacion || source.estado || source.vigencia_documental || 'vigente');
  if (state && !['vigente', 'publicada', 'activa', 'confirmed', 'confirmado'].includes(state)) return false;
  const date = dateOnly(scenarioDate);
  const from = dateOnly(source.vigencia_desde || source.vigencia_inicio);
  const to = dateOnly(source.vigencia_hasta || source.vigencia_fin);
  if (date && from && from > date) return false;
  if (date && to && to < date) return false;
  return true;
}

function sourcePriority(item = {}, requested = {}) {
  const sourceType = normalizeCandidateKey(item.fuente?.tipo || item.source_type || '');
  const category = equipmentCategory(requested);
  if (['modem', 'mifi', 'tablet'].includes(category) && sourceType === 'inalambrico iot') return 0;
  if (category === 'smartphone' && sourceType === 'lista precios') return 0;
  if (sourceType === 'lista precios') return 1;
  return 2;
}

function uniqueValues(items, getValue) {
  return [...new Set((items || []).map(getValue).filter(value => value != null && value !== ''))];
}

function normalizedPriceSource(item = {}) {
  return item.fuente || {
    tipo: item.source_type || 'lista_precios',
    nombre: item.source_name || item.nombre_archivo || 'Lista de equipos vigente',
    sha256: item.source_sha256 || item.sha256 || null,
    vigencia_desde: item.vigencia_desde || item.vigencia_inicio || null,
    vigencia_hasta: item.vigencia_hasta || item.vigencia_fin || null,
    estado_publicacion: item.estado_publicacion || item.vigencia_documental || 'vigente',
  };
}

function normalizeResolvedTerm(term = {}) {
  const meses = Number(term.meses || term.plazo || 0);
  const monto = Number(term.monto ?? term.pago_mensual);
  if (!Number.isFinite(meses) || meses <= 0 || !Number.isFinite(monto)) return null;
  return { meses, monto: roundMoney(monto), price_code: term.price_code || null };
}

export function resolveCurrentEquipmentPrice({ equipment = {}, catalog = [], scenarioDate = null, preferredTerm = MONTHS } = {}) {
  const matches = (Array.isArray(catalog) ? catalog : [])
    .filter((item) => isMatchingEquipment(equipment, item))
    .filter((item) => sourceApplies(normalizedPriceSource(item), scenarioDate))
    .filter((item) => Number.isFinite(Number(item.precio_regular)) && Number(item.precio_regular) > 0)
    .sort((a, b) => sourcePriority(a, equipment) - sourcePriority(b, equipment));

  if (!matches.length) {
    return {
      ok: false,
      reason: 'precio_oficial_no_publicado',
      equipment,
      requires_choice: false,
    };
  }

  const preferredPriority = sourcePriority(matches[0], equipment);
  const sourceMatches = matches.filter((item) => sourcePriority(item, equipment) === preferredPriority);
  const grouped = new Map();
  for (const item of sourceMatches) {
    const model = displayEquipmentModel(item.modelo || item.modelo_oficial);
    const price = roundMoney(item.precio_regular);
    const terms = (Array.isArray(item.mensualidades) ? item.mensualidades : [])
      .map(normalizeResolvedTerm)
      .filter(Boolean);
    const term = terms.find((candidate) => Number(candidate.meses) === Number(preferredTerm)) || terms[0] || null;
    const key = [compactEquipmentKey(model), price, term?.meses || '', term?.monto || ''].join('|');
    const current = grouped.get(key) || {
      modelo_canonico: model,
      fabricante: item.marca || item.fabricante || item.manufacturer || '',
      precio_regular: price,
      mensualidades: terms,
      item_codes: [],
      sap_codes: [],
      rows: [],
      fuente: normalizedPriceSource(item),
    };
    if (item.item_code) current.item_codes.push(String(item.item_code));
    if (item.sap_code) current.sap_codes.push(String(item.sap_code));
    current.rows.push(item);
    grouped.set(key, current);
  }

  const groups = [...grouped.values()];
  if (groups.length > 1) {
    return {
      ok: false,
      reason: 'equipo_requiere_precision',
      requires_choice: true,
      variants: groups.map((group) => ({
        modelo: group.modelo_canonico,
        precio_regular: group.precio_regular,
        item_codes: uniqueValues(group.item_codes, value => value),
      })),
    };
  }

  const resolved = groups[0];
  return {
    ok: true,
    identity: {
      modelo_canonico: resolved.modelo_canonico,
      fabricante: resolved.fabricante || null,
      categoria: equipmentCategory(equipment) || equipmentCategory(resolved.rows[0]),
    },
    item_code: resolved.item_codes.length === 1 ? resolved.item_codes[0] : null,
    item_codes: uniqueValues(resolved.item_codes, value => value),
    sap_code: resolved.sap_codes.length === 1 ? resolved.sap_codes[0] : null,
    sap_codes: uniqueValues(resolved.sap_codes, value => value),
    precio_regular: resolved.precio_regular,
    mensualidades: resolved.mensualidades,
    fuente: resolved.fuente,
    requires_choice: false,
  };
}

function regularItemFromResolvedPrice(resolved = {}) {
  if (!resolved.ok) return null;
  const terms = (Array.isArray(resolved.mensualidades) ? resolved.mensualidades : [])
    .map((term) => ({
      meses: term.meses,
      precio_financiado: resolved.precio_regular,
      pago_mensual: term.monto,
      price_code: term.price_code || null,
    }))
    .filter((term) => term.meses > 0 && term.pago_mensual != null);
  if (!terms.length) return null;
  return {
    equipo: {
      id: resolved.item_code || null,
      item_code: resolved.item_code || null,
      item_codes: resolved.item_codes || [],
      sap_code: resolved.sap_code || null,
      sap_codes: resolved.sap_codes || [],
      marca: resolved.identity?.fabricante || resolved.identity?.modelo_canonico?.split(' ')[0] || '',
      modelo_oficial: resolved.identity?.modelo_canonico || '',
      categoria: resolved.identity?.categoria || '',
      precio_regular: resolved.precio_regular,
      precio_financiado: resolved.precio_regular,
    },
    oferta: { id: 'financiamiento-regular-catalogo-vigente', nombre: 'Financiamiento regular' },
    beneficio: { tipo: 'financiado' },
    plazos: terms,
    aplicacion_automatica: false,
    autoaplica: false,
    validaciones: [],
    condiciones: ['Precio regular vigente desde fuente comercial publicada; sin descuento aplicado por inferencia.'],
    fuente: resolved.fuente,
    vigencia: {
      desde: resolved.fuente?.vigencia_desde || resolved.fuente?.vigencia_inicio || null,
      hasta: resolved.fuente?.vigencia_hasta || resolved.fuente?.vigencia_fin || null,
    },
    segmento: 'catalogo_precio_regular',
  };
}

function candidateLimit(item, context = {}) {
  const validations = Array.isArray(item?.validaciones) ? item.validaciones : [];
  if (validations.some((validationItem) => validationItem.codigo === 'limite_ban_excedido')) {
    return { scope: 'BAN', remaining: 0, reason: 'limite_ban_excedido' };
  }
  const limit = item?.limite_ban || item?.oferta?.limite_ban || null;
  if (!limit?.aplica) return null;
  const amount = Number(limit.cantidad || 0);
  const used = Number(context.beneficios_usados_por_oferta?.[item.oferta?.id] || 0);
  return {
    scope: 'BAN',
    limit: amount || null,
    used,
    remaining: amount ? Math.max(0, amount - used) : null,
    fuera_limite: limit.fuera_limite || null,
  };
}

function candidateReason(item) {
  const validations = Array.isArray(item?.validaciones) ? item.validaciones : [];
  if (validations.length) return validations.map((validationItem) => validationItem.codigo).join(', ');
  const benefit = item?.beneficio || {};
  if (benefit.tipo === 'gratis') return 'equipo_gratis_confirmado_por_motor';
  if (benefit.tipo === 'descuento_porcentaje') return `descuento_${benefit.porcentaje || 0}_porciento_confirmado_por_motor`;
  if (benefit.tipo === 'descuento_monto') return `descuento_monto_${benefit.monto || 0}_confirmado_por_motor`;
  return 'candidato_confirmado_por_motor';
}

function toCommercialCandidate({ item, linea, preferredTerm = null, version = null, context = {} }) {
  const term = firstTerm(item, preferredTerm);
  const validations = Array.isArray(item.validaciones) ? item.validaciones : [];
  const blocked = hasBlockingValidation(item);
  const modalidadLinea = lineModality(linea);
  const regular = Number(item?.equipo?.precio_regular || 0);
  const promotional = Number(term.precio_financiado ?? item?.equipo?.precio_financiado ?? regular);
  const monthly = Number.isFinite(Number(term.pago_mensual)) ? roundMoney(term.pago_mensual) : null;
  const limit = candidateLimit(item, context);
  return {
    linea: linea.id || null,
    posicion: Number(linea.posicion_en_ban || linea.indice || 0) || null,
    equipo: item.equipo?.modelo_oficial || item.equipo?.modelo || '',
    item_code: item.equipo?.item_code || null,
    item_codes: Array.isArray(item.equipo?.item_codes) ? item.equipo.item_codes : [],
    sap_code: item.equipo?.sap_code || null,
    sap_codes: Array.isArray(item.equipo?.sap_codes) ? item.equipo.sap_codes : [],
    fabricante: item.equipo?.marca || item.equipo?.manufacturer || '',
    categoria: item.equipo?.categoria || item.segmento || '',
    precio_regular: roundMoney(regular),
    precio_promocion: roundMoney(promotional),
    mensualidad_regular: regularMonthly(regular, term),
    mensualidad: monthly,
    mensualidad_neta: monthly,
    tipo_beneficio: item.beneficio?.tipo || 'financiado',
    descuento: benefitDiscount(item, term),
    plazo: term.meses ? Number(term.meses) : null,
    price_code: candidatePriceCode(item, term, modalidadLinea),
    plan_familia: linea.familia_business_red || linea.tipo || null,
    evento: linea.evento || null,
    limite_ban: limit,
    cupo_promocional_restante: limit?.remaining ?? null,
    fuente_publicacion: item.fuente || null,
    vigencia: item.vigencia || version?.vigencia || null,
    regla_aplicada: item.oferta?.id || null,
    confidence: blocked ? 'requiere_revision' : 'confirmado',
    reason: candidateReason(item),
    validaciones: validations,
    bloqueado: blocked,
    autoaplica: false,
  };
}

function matchesCandidateFilters(candidate, filters = {}) {
  const equipment = normalizeCandidateKey(filters.equipo || filters.modelo || '');
  const manufacturer = normalizeCandidateKey(filters.fabricante || filters.marca || '');
  const productCategory = normalizeCandidateKey(filters.categoria_producto || filters.categoria || '');
  const benefit = normalizeCandidateKey(candidate.tipo_beneficio);
  const monthly = Number(candidate.mensualidad || 0);
  if (equipment && !normalizeCandidateKey(candidate.equipo).includes(equipment)) return false;
  if (manufacturer && normalizeCandidateKey(candidate.fabricante) !== manufacturer) return false;
  if (productCategory && normalizeCandidateKey(candidate.categoria) !== productCategory) return false;
  if (filters.solo_gratis && benefit !== 'gratis') return false;
  if (filters.descuento_50 && !(benefit === 'descuento_porcentaje' && Number(candidate.descuento || 0) > 0)) return false;
  if (filters.plazo && Number(candidate.plazo) !== Number(filters.plazo)) return false;
  if (filters.evento && normalizeCandidateKey(candidate.evento) !== normalizeCandidateKey(filters.evento)) return false;
  if (filters.plan_familia && normalizeCandidateKey(candidate.plan_familia) !== normalizeCandidateKey(filters.plan_familia)) return false;
  if (filters.presupuesto_maximo != null && monthly > Number(filters.presupuesto_maximo)) return false;
  return true;
}

function candidateRank(candidate, filters = {}) {
  const benefit = normalizeCandidateKey(candidate.tipo_beneficio);
  const freeScore = benefit === 'gratis' ? 0 : 1;
  const monthly = Number(candidate.mensualidad ?? Number.MAX_SAFE_INTEGER);
  const discount = -Number(candidate.descuento || 0);
  const brandPenalty = filters.mantener_marca && normalizeCandidateKey(candidate.fabricante) !== normalizeCandidateKey(filters.fabricante || filters.marca) ? 1 : 0;
  return [freeScore, monthly, discount, brandPenalty, candidate.equipo || ''].join('|');
}

function specialEquipmentTerms(equipment = {}) {
  return (Array.isArray(equipment.mensualidades) ? equipment.mensualidades : [])
    .map((term) => ({
      meses: Number(term.meses || term.plazo || 0),
      precio_financiado: roundMoney(equipment.precio_regular),
      pago_mensual: Number.isFinite(Number(term.monto ?? term.pago_mensual))
        ? roundMoney(term.monto ?? term.pago_mensual)
        : null,
      price_code: term.price_code || null,
    }))
    .filter((term) => term.meses > 0 && term.pago_mensual != null);
}

function regularSpecialEquipmentItem(equipment = {}) {
  const regular = Number(equipment.precio_regular);
  const model = String(equipment.modelo || '').trim();
  const category = normalizeCandidateKey(equipment.categoria || '');
  if (!model || !Number.isFinite(regular) || !['tablet', 'modem'].includes(category)) return null;
  const terms = specialEquipmentTerms(equipment);
  if (!terms.length) return null;
  return {
    equipo: {
      id: equipment.item_code || null,
      item_code: equipment.item_code || null,
      sap_code: equipment.sap_code || null,
      marca: equipment.marca || '',
      modelo_oficial: model,
      categoria: category,
      precio_regular: roundMoney(regular),
      precio_financiado: roundMoney(regular),
    },
    oferta: { id: `financiamiento-regular-${category}`, nombre: `Financiamiento regular ${category}` },
    beneficio: { tipo: 'financiado' },
    plazos: terms,
    aplicacion_automatica: false,
    autoaplica: false,
    validaciones: [],
    condiciones: ['Precio regular vigente desde catalogo oficial de equipos; sin descuento publicado para esta familia/evento.'],
    fuente: {
      archivo: 'Lista de equipos vigente',
      upload_id: equipment.upload_id || null,
      seccion: category,
    },
    vigencia: null,
    segmento: 'equipos_especiales_regular',
  };
}

function genericBusinessRedEquipment({ linea, offers = [], equiposEspeciales = [], version = { estado: 'vigente' }, contexto_ban = {} } = {}) {
  const portafolio = findEligibleEquipment({
    offers,
    request: {
      linea,
      contexto_ban: {
        ...contexto_ban,
        posicion_en_ban: Number(linea.posicion_en_ban || 0),
        beneficios_usados_por_oferta: contexto_ban.beneficios_usados_por_oferta || {},
      },
    },
    version,
  });
  const specialItems = [];
  for (const equipment of equiposEspeciales) {
    const item = regularSpecialEquipmentItem(equipment);
    if (item) specialItems.push(item);
  }
  return {
    equipos: [...portafolio.equipos, ...specialItems],
    validaciones: portafolio.validaciones || [],
  };
}

function requestedEquipmentMissingReview(linea = {}, filters = {}) {
  const requested = filters.equipo || filters.modelo || linea.equipo_solicitado || '';
  if (!String(requested || '').trim()) return null;
  return {
    linea: linea.id || null,
    posicion: Number(linea.posicion_en_ban || linea.indice || 0) || null,
    equipo: requested,
    fabricante: filters.fabricante || filters.marca || '',
    categoria: filters.categoria_producto || linea.categoria_producto || '',
    precio_regular: null,
    precio_promocion: null,
    mensualidad_regular: null,
    mensualidad: null,
    mensualidad_neta: null,
    tipo_beneficio: 'no_determinado',
    descuento: null,
    plazo: null,
    price_code: null,
    plan_familia: linea.familia_business_red || linea.tipo || null,
    evento: linea.evento || null,
    limite_ban: null,
    cupo_promocional_restante: null,
    fuente_publicacion: null,
    vigencia: null,
    regla_aplicada: null,
    confidence: 'requiere_revision',
    reason: 'precio_oficial_no_publicado',
    validaciones: [validation('precio_oficial_no_publicado', 'bloqueante')],
    bloqueado: true,
    autoaplica: false,
  };
}

function resolvedPriceReview(linea = {}, filters = {}, resolved = {}) {
  const requested = filters.equipo || filters.modelo || linea.equipo_solicitado || '';
  if (resolved?.requires_choice) {
    return {
      ...requestedEquipmentMissingReview(linea, filters),
      reason: 'equipo_requiere_precision',
      validaciones: [validation('equipo_requiere_precision', 'bloqueante', { variantes: resolved.variants || [] })],
    };
  }
  return requestedEquipmentMissingReview(linea, filters);
}

function sameEquipmentItem(a = {}, b = {}) {
  const aCodes = [
    a.equipo?.item_code,
    ...(Array.isArray(a.equipo?.item_codes) ? a.equipo.item_codes : []),
  ].filter(Boolean).map(String);
  const bCodes = [
    b.equipo?.item_code,
    ...(Array.isArray(b.equipo?.item_codes) ? b.equipo.item_codes : []),
  ].filter(Boolean).map(String);
  if (aCodes.length && bCodes.length && aCodes.some((code) => bCodes.includes(code))) return true;
  return equipmentKey(a) && equipmentKey(a) === equipmentKey(b);
}

function candidateTotals(candidates = [], lineas = []) {
  const byPosition = new Map();
  for (const candidate of candidates) {
    const key = Number(candidate.posicion || 0) || byPosition.size + 1;
    if (!byPosition.has(key)) byPosition.set(key, candidate);
  }
  const selected = [...byPosition.values()];
  const planRegular = (Array.isArray(lineas) ? lineas : []).reduce((sum, line) => sum + Number(line.plan?.monto ?? line.plan_monto ?? 0), 0);
  const planAutoPayValues = (Array.isArray(lineas) ? lineas : []).map((line) => Number(line.plan?.monto_autopay ?? line.plan_monto_autopay));
  const hasAutoPay = planAutoPayValues.every((value) => Number.isFinite(value));
  const planAutoPay = hasAutoPay ? planAutoPayValues.reduce((sum, value) => sum + value, 0) : null;
  const equipmentRegular = selected.reduce((sum, item) => sum + Number(item.mensualidad_regular ?? 0), 0);
  const equipmentNet = selected.reduce((sum, item) => sum + Number(item.mensualidad_neta ?? item.mensualidad ?? 0), 0);
  const credits = selected.reduce((sum, item) => sum + Math.max(0, Number(item.mensualidad_regular ?? 0) - Number(item.mensualidad_neta ?? item.mensualidad ?? 0)), 0);
  return {
    total_plan_regular: roundMoney(planRegular),
    total_plan_autopay: planAutoPay == null ? null : roundMoney(planAutoPay),
    total_equipos_regular: roundMoney(equipmentRegular),
    total_descuentos_creditos: roundMoney(credits),
    total_equipos_neto: roundMoney(equipmentNet),
    total_mensual_regular: roundMoney(planRegular + equipmentNet),
    total_mensual_autopay: planAutoPay == null ? null : roundMoney(planAutoPay + equipmentNet),
  };
}

// El cupo por BAN es compartido entre las lineas de una misma solicitud: se asigna en orden de posicion.
// Las lineas que exceden el cupo siguen la misma regla de fuente que el motor (financiado si la fuente lo
// permite; si no, quedan en revision), sin decidir por el vendedor cual linea usa la promocion.
function applySharedBanLimits(candidates, review, contexto_ban = {}) {
  const used = contexto_ban.beneficios_usados_por_oferta || {};
  const linesByOffer = new Map();
  for (const candidate of candidates) {
    const offerId = candidate.regla_aplicada;
    const limit = Number(candidate.limite_ban?.limit || 0);
    if (!offerId || !limit) continue;
    if (!linesByOffer.has(offerId)) linesByOffer.set(offerId, { limit, positions: new Set() });
    linesByOffer.get(offerId).positions.add(Number(candidate.posicion || 0));
  }
  for (const [offerId, { limit, positions }] of linesByOffer) {
    const alreadyUsed = Number(used[offerId] || 0);
    const remaining = Math.max(0, limit - alreadyUsed);
    const ordered = [...positions].sort((a, b) => a - b);
    for (const candidate of candidates) {
      if (candidate.regla_aplicada !== offerId) continue;
      const turn = ordered.indexOf(Number(candidate.posicion || 0));
      const available = Math.max(0, remaining - turn);
      const fueraLimite = candidate.limite_ban?.fuera_limite || null;
      candidate.limite_ban = { scope: 'BAN', limit, used: alreadyUsed + turn, remaining: available, fuera_limite: fueraLimite, ...(available ? {} : { reason: 'limite_ban_excedido' }) };
      candidate.cupo_promocional_restante = available;
      if (available) continue;
      candidate.reason = 'limite_ban_excedido';
      if (fueraLimite === 'financiado_si_fuente_lo_permite') {
        if (!candidate.validaciones.some((item) => item.codigo === 'limite_ban_excedido')) {
          candidate.validaciones = [...candidate.validaciones, validation('limite_ban_excedido', 'informativo', { cupo_ban: limit, lineas_previas: alreadyUsed + turn })];
        }
        candidate.tipo_beneficio = 'financiado';
        candidate.descuento = 0;
        candidate.precio_promocion = candidate.precio_regular;
        candidate.mensualidad = candidate.mensualidad_regular;
        candidate.mensualidad_neta = candidate.mensualidad_regular;
        continue;
      }
      candidate.validaciones = [...candidate.validaciones, validation('limite_ban_excedido', 'bloqueante', { cupo_ban: limit, lineas_previas: alreadyUsed + turn })];
      candidate.bloqueado = true;
      candidate.confidence = 'requiere_revision';
    }
  }
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index].bloqueado) review.push(...candidates.splice(index, 1));
  }
}

function candidatesState(candidates, review) {
  if (candidates.length) return 'candidatos_disponibles';
  return review.length ? 'requiere_revision' : 'sin_candidatos';
}

export function findBusinessRedPlusCommercialCandidates({
  block,
  lineas = [],
  grupos = [],
  offers = [],
  equiposEspeciales = [],
  equipmentCatalog = [],
  version = { estado: 'vigente' },
  today = new Date().toISOString().slice(0, 10),
  filtros = {},
  contexto_ban = {},
  specialDiscountVigencia = null,
  aplicarLimitesCompartidos = true,
} = {}) {
  if (Array.isArray(grupos) && grupos.length) {
    const candidates = [];
    const review = [];
    const validations = [];
    const groupedLines = [];
    for (const group of grupos) {
      const groupLines = Array.isArray(group?.lineas) ? group.lineas : [];
      groupedLines.push(...groupLines);
      const result = findBusinessRedPlusCommercialCandidates({
        block,
        lineas: groupLines,
        offers,
        equiposEspeciales,
        version,
        today,
        filtros: { ...filtros, ...(group?.filtros || {}) },
        contexto_ban,
        equipmentCatalog,
        specialDiscountVigencia,
        aplicarLimitesCompartidos: false,
      });
      candidates.push(...result.candidatos);
      review.push(...result.requiere_revision);
      validations.push(...result.validaciones);
    }
    if (aplicarLimitesCompartidos) applySharedBanLimits(candidates, review, contexto_ban);
    candidates.sort((a, b) => candidateRank(a, filtros).localeCompare(candidateRank(b, filtros)));
    review.sort((a, b) => `${a.posicion}|${a.equipo}`.localeCompare(`${b.posicion}|${b.equipo}`));
    return {
      ok: true,
      modo: 'candidatos_alternativas_motor',
      estado: candidatesState(candidates, review),
      version,
      filtros,
      grupos_evaluados: grupos.length,
      lineas_evaluadas: groupedLines.length,
      candidatos: candidates,
      requiere_revision: review,
      validaciones: validations,
      totales: candidateTotals(candidates, groupedLines),
      autoaplica: false,
    };
  }

  const candidates = [];
  const review = [];
  const lineValidations = [];
  const targetLines = Array.isArray(lineas) ? lineas : [];

  for (const linea of targetLines) {
    const position = Number(linea.posicion_en_ban || linea.indice || 0);
    const context = {
      ...contexto_ban,
      posicion_en_ban: position || contexto_ban.posicion_en_ban,
      beneficios_usados_por_oferta: contexto_ban.beneficios_usados_por_oferta || {},
    };
    const normalizedLine = { ...linea, posicion_en_ban: position || linea.posicion_en_ban };
    const result = normalizedLine.familia_business_red === 'business_red_plus'
      ? findBusinessRedPlusEligible({
        block,
        linea: normalizedLine,
        offers,
        equiposEspeciales,
        version,
        today,
        contexto_ban: context,
        specialDiscountVigencia,
      })
      : genericBusinessRedEquipment({
        linea: normalizedLine,
        offers,
        equiposEspeciales,
        version,
        contexto_ban: context,
      });
    if (!result.equipos.length && result.validaciones.length) {
      lineValidations.push({ linea: linea.id || null, posicion: position || null, validaciones: result.validaciones });
    }
    let matchedForLine = 0;
    const requested = filtros.equipo || filtros.modelo || normalizedLine.equipo_solicitado || '';
    const resolved = requested
      ? resolveCurrentEquipmentPrice({
        equipment: {
          modelo: requested,
          item_code: normalizedLine.item_code || filtros.item_code || null,
          categoria_producto: filtros.categoria_producto || normalizedLine.categoria_producto || null,
        },
        catalog: equipmentCatalog,
        scenarioDate: today,
        preferredTerm: filtros.plazo || MONTHS,
      })
      : null;
    const resolvedItem = resolved?.ok ? regularItemFromResolvedPrice(resolved) : null;
    const lineItems = [...result.equipos];
    if (resolvedItem && !lineItems.some((item) => sameEquipmentItem(item, resolvedItem))) {
      lineItems.push(resolvedItem);
    }

    for (const item of lineItems) {
      const candidate = toCommercialCandidate({ item, linea, preferredTerm: filtros.plazo, version, context });
      if (!matchesCandidateFilters(candidate, filtros)) continue;
      matchedForLine += 1;
      if (candidate.bloqueado) review.push(candidate);
      else candidates.push(candidate);
    }
    if (!matchedForLine) {
      const missing = resolved ? resolvedPriceReview(linea, filtros, resolved) : requestedEquipmentMissingReview(linea, filtros);
      if (missing) review.push(missing);
    }
  }

  if (aplicarLimitesCompartidos) applySharedBanLimits(candidates, review, contexto_ban);
  candidates.sort((a, b) => candidateRank(a, filtros).localeCompare(candidateRank(b, filtros)));
  review.sort((a, b) => `${a.posicion}|${a.equipo}`.localeCompare(`${b.posicion}|${b.equipo}`));

  return {
    ok: true,
    modo: 'candidatos_alternativas_motor',
    estado: candidatesState(candidates, review),
    version,
    filtros,
    lineas_evaluadas: targetLines.length,
    candidatos: candidates,
    requiere_revision: review,
    validaciones: lineValidations,
    totales: candidateTotals(candidates, targetLines),
    autoaplica: false,
  };
}

export function findBusinessRedPlusEligible({
  block,
  linea,
  offers = [],
  equiposEspeciales = [],
  equipmentCatalog = [],
  version = { estado: 'vigente' },
  today = new Date().toISOString().slice(0, 10),
  contexto_ban = {},
  specialDiscountVigencia = null,
}) {
  const contract = validateLineaMovil(linea);
  if (!contract.ok) return { equipos: [], validaciones: contract.errors };
  if (linea.tipo !== 'multilinea_business_red' || linea.familia_business_red !== 'business_red_plus') {
    return { equipos: [], validaciones: [validation('esquema_no_aplica')] };
  }
  if (!ALLOWED_EVENTS.has(linea.evento)) {
    return { equipos: [], validaciones: [validation('evento_no_aplica_business_red_plus')] };
  }

  const position = Number(linea.posicion_en_ban);
  if (!Number.isInteger(position) || position < 1 || position > 10) {
    return { equipos: [], validaciones: [validation('posicion_en_ban_invalida')] };
  }
  const modalidadLinea = lineModality(linea);
  if (modalidadLinea === 'byop') {
    return {
      equipos: [],
      validaciones: [validation('byop_sin_promocion_equipo', 'informativo')],
      esquema: 'business_red_plus_byop',
      posicion_en_ban: position,
      modalidad_linea: modalidadLinea,
    };
  }
  if (!block || block.line_order_dependent !== true || !Array.isArray(block.groups) || !block.groups.length) {
    return { equipos: [], validaciones: [validation('esquema_business_red_plus_no_publicado')] };
  }

  const expired = isExpired(block.vigencia, today);
  const equipos = [];
  block.groups.forEach((group, groupIndex) => {
    const discount = Number(group.line_discounts?.[position - 1]);
    if (!Number.isFinite(discount)) return;
    for (const equipment of group.equipment || []) {
      const regularPrice = Number(equipment.regular_price);
      const financedPrice = Number(equipment.discount_prices?.[position - 1]);
      if (!equipment.model || !Number.isFinite(regularPrice) || !Number.isFinite(financedPrice)) continue;
      const rowValidations = expired ? [validation('fuente_vencida', 'warning')] : [];
      const source = { ...(block.source || {}), ...(group.source || {}), posicion_linea: position };
      equipos.push({
        equipo: {
          marca: equipment.manufacturer || '',
          modelo_oficial: equipment.model,
          precio_regular: regularPrice,
          precio_financiado: roundMoney(financedPrice),
        },
        oferta: {
          id: `business-red-plus-esquema-1-grupo-${groupIndex + 1}`,
          nombre: `Business Red Plus - linea ${position}`,
        },
        beneficio: benefitFor(discount),
        plazos: [{
          meses: MONTHS,
          precio_financiado: roundMoney(financedPrice),
          pago_mensual: roundMoney(financedPrice / MONTHS),
        }],
        aplicacion_automatica: false,
        autoaplica: false,
        validaciones: rowValidations,
        price_codes: group.price_codes || {},
        fuente: source,
        vigencia: block.vigencia || null,
        segmento: 'gama_alta',
      });
    }
  });

  if (position >= 5 && position <= 10 && offers.length) {
    const portafolio = findEligibleEquipment({
      offers,
      request: {
        linea,
        contexto_ban: {
          ...contexto_ban,
          posicion_en_ban: position,
          beneficios_usados_por_oferta: contexto_ban.beneficios_usados_por_oferta || {},
        },
      },
      version,
    });
    const seen = new Set(equipos.map(equipmentKey));
    for (const item of portafolio.equipos) {
      const key = equipmentKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      equipos.push({ ...item, segmento: 'gama_baja' });
    }
  }

  const seen = new Set(equipos.map(equipmentKey));
  const specialVigencia = specialDiscountVigenciaFor(specialDiscountVigencia);
  const specialExpired = isExpired(specialVigencia, today);
  const specialNotStarted = Boolean(specialVigencia.desde && today && today < specialVigencia.desde);
  const specialValidations = specialExpired ? [validation('fuente_vencida', 'warning', { vigencia_hasta: specialVigencia.hasta })] : [];
  for (const equipment of specialNotStarted ? [] : equiposEspeciales) {
    const categoria = String(equipment?.categoria || '').toLowerCase();
    const model = String(equipment?.modelo || '').trim();
    const regularPrice = Number(equipment?.precio_regular);
    if (!['tablet', 'modem'].includes(categoria) || !model || !Number.isFinite(regularPrice)) continue;
    const key = normalizeCandidateKey(model);
    if (!key || seen.has(key)) continue;
    const precioFinanciado = roundMoney(Math.max(0, regularPrice - SPECIAL_EQUIPMENT_DISCOUNT.amount));
    const priceCodes = specialDiscountCodes(modalidadLinea);
    const hasKnownMonthlyTerms = (Array.isArray(equipment.mensualidades) ? equipment.mensualidades : [])
      .some((item) => SPECIAL_EQUIPMENT_DISCOUNT.allowedMonths.includes(Number(item.meses)));
    if (!hasKnownMonthlyTerms) continue;
    const plazos = SPECIAL_EQUIPMENT_DISCOUNT.allowedMonths
      .map((meses) => ({
        meses,
        precio_financiado: precioFinanciado,
        pago_mensual: roundMoney(precioFinanciado / meses),
        price_code: priceCodes[meses] || null,
      }))
      .filter((item) => Number.isFinite(item.pago_mensual) && item.pago_mensual >= 0);
    if (!plazos.length) continue;
    seen.add(key);
    equipos.push({
      equipo: {
        id: equipment.item_code || null,
        item_code: equipment.item_code || null,
        sap_code: equipment.sap_code || null,
        marca: equipment.marca || '',
        modelo_oficial: model,
        categoria,
        precio_regular: roundMoney(regularPrice),
        precio_financiado: precioFinanciado,
      },
      oferta: { id: `descuento-business-red-plus-${categoria}`, nombre: `Descuento Business Red Plus ${categoria === 'tablet' ? 'tabletas' : 'modems'}` },
      beneficio: { tipo: 'descuento_monto', monto: SPECIAL_EQUIPMENT_DISCOUNT.amount, aplicacion: 'credito_mensual' },
      plazos,
      aplicacion_automatica: false,
      autoaplica: false,
      validaciones: specialValidations,
      condiciones: [SPECIAL_EQUIPMENT_DISCOUNT.condicion],
      price_codes: SPECIAL_EQUIPMENT_DISCOUNT.priceCodesByModality,
      fuente: { ...SPECIAL_EQUIPMENT_DISCOUNT.source, vigencia_desde: specialVigencia.desde, vigencia_hasta: specialVigencia.hasta, upload_id: equipment.upload_id || null },
      vigencia: specialVigencia,
      segmento: 'equipos_especiales',
    });
  }

  const requestedModel = String(linea.equipo_solicitado || '').trim();
  if (requestedModel && Array.isArray(equipmentCatalog) && equipmentCatalog.length) {
    const resolved = resolveCurrentEquipmentPrice({
      equipment: { modelo: requestedModel, item_code: linea.item_code || null, categoria_producto: linea.categoria_producto || null },
      catalog: equipmentCatalog,
      scenarioDate: today,
    });
    const catalogItem = resolved.ok ? regularItemFromResolvedPrice(resolved) : null;
    if (catalogItem && !equipos.some((item) => sameEquipmentItem(item, catalogItem))) equipos.push(catalogItem);
  }

  equipos.sort((a, b) => a.equipo.modelo_oficial.localeCompare(b.equipo.modelo_oficial));
  return {
    equipos,
    validaciones: equipos.length ? [] : [validation('sin_equipos_elegibles', 'warning')],
    esquema: 'esquema_1',
    posicion_en_ban: position,
    modalidad_linea: modalidadLinea,
  };
}
