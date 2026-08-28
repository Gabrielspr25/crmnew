(function (global) {
  'use strict';

  const ENDPOINTS = Object.freeze({
    offers: '/api/ofertas-movil/vigente',
    mobile: '/api/planes-modulos/moviles',
    fixed: '/api/planes-modulos/fijos',
    tv: '/api/planes-modulos/claro_tv',
    equipment: '/api/equipos-lista',
  });

  async function request(endpoint) {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || payload.codigo || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = payload.codigo || null;
      throw error;
    }
    return payload;
  }

  function publishedModules(payload) {
    const publication = payload?.publicacion || payload?.ultima_publicacion;
    if (!publication || !Array.isArray(payload.modulos) || !payload.modulos.length) return [];
    return payload.modulos;
  }

  function rows(module) {
    return Array.isArray(module?.contenido?.filas) ? module.contenido.filas : [];
  }

  function familyKey(value) {
    const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized.includes('sin fronteras')) return 'sinfronteras';
    if (normalized.includes('extreme')) return 'extreme';
    if (normalized.includes('supreme')) return 'supreme';
    if (normalized.includes('plus')) return 'plus';
    return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'business_red';
  }

  function mobileCatalog(modules) {
    const individualModule = modules.find(module => module.seccion_key === 'movil_planes_individuales');
    const multilineModule = modules.find(module => module.seccion_key === 'movil_multilinea_business_red');
    const individual = rows(individualModule)
      .filter(row => Number.isFinite(Number(row.precio_regular ?? row.precio)))
      .map(row => ({
        code: String(row.codigo || ''),
        label: String(row.descripcion || row.codigo || 'Plan individual'),
        regular: Number(row.precio_regular ?? row.precio),
        autopay: Number(row.renta_autopay ?? row.precio_autopay ?? row.precio_regular ?? row.precio),
      }))
      .sort((a, b) => a.regular - b.regular);

    const grouped = new Map();
    rows(multilineModule).forEach(row => {
      const key = familyKey(row.familia);
      if (!grouped.has(key)) grouped.set(key, { key, label: String(row.familia || 'Business Red'), lineCosts: [] });
      const line = Number(row.cantidad_lineas);
      const price = Number(row.precio_regular ?? row.precio);
      if (line > 0 && Number.isFinite(price)) grouped.get(key).lineCosts[line - 1] = price;
    });
    const multiline = [...grouped.values()]
      .map(plan => ({ ...plan, lineCosts: plan.lineCosts.map(value => Number.isFinite(value) ? value : null) }))
      .filter(plan => plan.lineCosts.length >= 2);
    return { individual, multiline };
  }

  function productGroups(modules, type) {
    return modules.map(module => ({
      key: module.seccion_key,
      titulo: module.titulo,
      tipo: type,
      filas: rows(module).map(row => ({ ...row, tipo: type, grupo: module.titulo })),
    }));
  }

  function equipmentKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function equipmentTokens(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\biph\b/g, 'iphone')
      .replace(/\bgxy\b/g, 'galaxy')
      .replace(/\bmoto\b/g, 'motorola')
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .filter(token => !['apple', 'samsung', 'motorola', 'galaxy', '5g'].includes(token));
  }

  function publishedEquipment(payload) {
    if (!payload?.ok || !Array.isArray(payload.data) || !payload.data.length) return [];
    return payload.data.filter(item => item?.activo !== false && !item?.fuera_portafolio);
  }

  function reconcileOffers(offers, equipment) {
    const phones = equipment.filter(item => String(item.categoria || '').toLowerCase() === 'celular');
    return offers.map(offer => ({
      ...offer,
      equipos: (Array.isArray(offer?.equipos) ? offer.equipos : []).flatMap(item => {
        const expectedPrice = Number(item.precio);
        const expectedTokens = equipmentTokens(item.modelo);
        const matches = phones.filter(official => {
          if (Number(official.precio_regular) !== expectedPrice) return false;
          const officialTokens = equipmentTokens(official.modelo);
          return expectedTokens.length > 0 && expectedTokens.every(token => officialTokens.includes(token));
        });
        if (!matches.length) return [];
        const itemCodes = [...new Set(matches.map(match => match.item_code).filter(Boolean))];
        return [{
          ...item,
          precio: expectedPrice,
          itemCode: itemCodes.length === 1 ? itemCodes[0] : null,
          itemCodes,
          source: 'equipos-lista',
        }];
      }),
    }));
  }

  async function load() {
    const entries = await Promise.all(Object.entries(ENDPOINTS).map(async ([key, endpoint]) => {
      try { return [key, { ok: true, payload: await request(endpoint) }]; }
      catch (error) { return [key, { ok: false, error }]; }
    }));
    const result = Object.fromEntries(entries);
    const mobileModules = result.mobile.ok ? publishedModules(result.mobile.payload) : [];
    const fixedModules = result.fixed.ok ? publishedModules(result.fixed.payload) : [];
    const tvModules = result.tv.ok ? publishedModules(result.tv.payload) : [];
    const version = result.offers.ok ? result.offers.payload?.version : null;
    const equipment = result.equipment.ok ? publishedEquipment(result.equipment.payload) : [];
    const offers = reconcileOffers(Array.isArray(version?.datos) ? version.datos : [], equipment);

    return {
      status: result,
      offers,
      offersVersion: version || null,
      equipment,
      mobileCatalog: mobileCatalog(mobileModules),
      fixedGroups: productGroups(fixedModules, 'Fijo'),
      tvGroups: productGroups(tvModules, 'Claro TV'),
      ready: Boolean(version && mobileModules.length && equipment.length && offers.some(offer => offer.equipos.length)),
    };
  }

  global.ConstructorPublications = Object.freeze({ ENDPOINTS, load, mobileCatalog, productGroups, publishedEquipment, reconcileOffers, equipmentKey });
})(window);
