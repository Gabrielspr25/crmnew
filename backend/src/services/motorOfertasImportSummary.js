function asObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])])
  );
}

function signature(value) {
  return JSON.stringify(canonical(value));
}

function offerSignature(contract, derived = {}) {
  const value = asObject(contract);
  return signature({
    nombre: value.nombre ?? null,
    estado: value.estado ?? null,
    tipos_plan: value.tipos_plan ?? [],
    familias: value.familias ?? [],
    eventos: value.eventos ?? [],
    plazos: value.plazos ?? [],
    limite_ban: value.limite_ban ?? null,
    trade_in: value.trade_in ?? null,
    terminos: value.terminos ?? null,
    plan_monto_minimo: derived.planMontoMinimo ?? value.plan_monto_minimo ?? null,
    plan_monto_maximo: derived.planMontoMaximo ?? value.plan_monto_maximo ?? null,
  });
}

function equipmentKey(item) {
  return item.equipo_key
    || item.modelo_oficial
    || item.modelo_comercial
    || item.modelo
    || null;
}

function finitePrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function previewOffers(normalized) {
  return (normalized.offers ?? []).map((offer) => ({
    key: offer.contract?.id,
    signature: offerSignature(offer.contract, offer.derived),
    equipment: (offer.equipment ?? offer.contract?.equipos ?? []).map((item) => ({
      key: equipmentKey(item),
      price: finitePrice(item.precio_regular),
    })),
  })).filter((offer) => offer.key);
}

function currentOffers(snapshot) {
  const offers = new Map();
  for (const offer of snapshot?.offers ?? []) {
    const contract = asObject(offer.contrato ?? offer.contract);
    const key = offer.oferta_key ?? contract.id;
    if (!key) continue;
    offers.set(key, {
      id: offer.id,
      signature: offerSignature(contract, offer),
      equipment: [],
    });
  }
  const byId = new Map([...offers.entries()].map(([key, value]) => [value.id, key]));
  for (const item of snapshot?.equipment ?? []) {
    const offerKey = item.oferta_key ?? byId.get(item.oferta_id);
    const offer = offers.get(offerKey);
    const key = equipmentKey(item);
    if (!offer || !key || offer.equipment.some((current) => current.key === key)) continue;
    offer.equipment.push({ key, price: finitePrice(item.precio_regular) });
  }
  return offers;
}

export function buildMotorOfertasImportSummary({ normalized, currentSnapshot = null }) {
  const preview = previewOffers(normalized);
  const current = currentOffers(currentSnapshot);
  const next = new Map(preview.map((offer) => [offer.key, offer]));

  let ofertas_nuevas = 0;
  let ofertas_modificadas = 0;
  let ofertas_salieron = 0;
  let equipos_nuevos = 0;
  let equipos_salieron = 0;
  let precios_nuevos_modificados = 0;

  for (const [key, offer] of next) {
    const previous = current.get(key);
    if (!previous) {
      ofertas_nuevas += 1;
      equipos_nuevos += offer.equipment.length;
      precios_nuevos_modificados += offer.equipment.filter((item) => item.price !== null).length;
      continue;
    }
    if (offer.signature !== previous.signature) ofertas_modificadas += 1;
    const previousEquipment = new Map(previous.equipment.map((item) => [item.key, item]));
    const nextEquipment = new Map(offer.equipment.map((item) => [item.key, item]));
    for (const [equipmentKeyValue, equipment] of nextEquipment) {
      const before = previousEquipment.get(equipmentKeyValue);
      if (!before) {
        equipos_nuevos += 1;
        if (equipment.price !== null) precios_nuevos_modificados += 1;
      } else if (equipment.price !== null && before.price !== equipment.price) {
        precios_nuevos_modificados += 1;
      }
    }
    for (const equipmentKeyValue of previousEquipment.keys()) {
      if (!nextEquipment.has(equipmentKeyValue)) equipos_salieron += 1;
    }
  }

  for (const [key, offer] of current) {
    if (next.has(key)) continue;
    ofertas_salieron += 1;
    equipos_salieron += offer.equipment.length;
  }

  return {
    filas_procesadas: normalized.summary?.filas_procesadas ?? preview.length,
    ofertas_nuevas,
    ofertas_modificadas,
    ofertas_salieron,
    equipos_nuevos,
    equipos_salieron,
    precios_nuevos_modificados,
    cambios_detectados: ofertas_nuevas
      + ofertas_modificadas
      + ofertas_salieron
      + equipos_nuevos
      + equipos_salieron
      + precios_nuevos_modificados,
  };
}
