import { validateLineaMovil } from './motorOfertasContract.js';
import { findEligibleEquipment } from './motorOfertasEligibility.js';

const ALLOWED_EVENTS = new Set(['linea_nueva', 'portabilidad', 'renovacion']);
const MONTHS = 30;

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

export function findBusinessRedPlusEligible({ block, linea, offers = [], equiposEspeciales = [], version = { estado: 'vigente' }, today = new Date().toISOString().slice(0, 10) }) {
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
        aplicacion_automatica: !expired,
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
        contexto_ban: { posicion_en_ban: position, beneficios_usados_por_oferta: {} },
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
  for (const equipment of equiposEspeciales) {
    const categoria = String(equipment?.categoria || '').toLowerCase();
    const model = String(equipment?.modelo || '').trim();
    const regularPrice = Number(equipment?.precio_regular);
    if (!['tablet', 'modem'].includes(categoria) || !model || !Number.isFinite(regularPrice)) continue;
    const key = model.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    const plazos = (Array.isArray(equipment.mensualidades) ? equipment.mensualidades : [])
      .map((item) => ({ meses: Number(item.meses), precio_financiado: roundMoney(regularPrice), pago_mensual: roundMoney(item.monto) }))
      .filter((item) => Number.isInteger(item.meses) && item.meses > 0 && Number.isFinite(item.pago_mensual) && item.pago_mensual > 0);
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
        precio_financiado: roundMoney(regularPrice),
      },
      oferta: { id: `financiamiento-${categoria}`, nombre: `Financiamiento ${categoria === 'tablet' ? 'tabletas' : 'modems'}` },
      beneficio: { tipo: 'financiado' },
      plazos,
      aplicacion_automatica: true,
      validaciones: [],
      fuente: { hoja: 'Finan Modems- Tablets-Routers', upload_id: equipment.upload_id || null },
      vigencia: null,
      segmento: 'equipos_especiales',
    });
  }

  equipos.sort((a, b) => a.equipo.modelo_oficial.localeCompare(b.equipo.modelo_oficial));
  return {
    equipos,
    validaciones: equipos.length ? [] : [validation('sin_equipos_elegibles', 'warning')],
    esquema: 'esquema_1',
    posicion_en_ban: position,
  };
}
