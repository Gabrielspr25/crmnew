(function (global) {
  'use strict';

  const ENDPOINTS = Object.freeze({
    offers: '/api/ofertas-movil/vigente',
    mobile: '/api/planes-modulos/moviles',
    fixed: '/api/planes-modulos/fijos',
    tv: '/api/planes-modulos/claro_tv',
    equipment: '/api/equipos-lista',
    commercialRules: '/api/fuentes-comerciales/planes-fijos/reglas-compuestas-publicadas/vigente',
    commercialCandidates: '/api/motor-ofertas/candidatos-alternativas',
  });

  async function request(endpoint, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    try {
      const token = global.localStorage?.getItem('vp_token') || '';
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (_error) {}
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(global.portalApiUrl ? global.portalApiUrl(endpoint) : endpoint, { ...options, headers });
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
    const multilineRows = rows(multilineModule);
    const autoPayDiscount = Number(multilineModule?.contenido?.autopay_descuento ?? multilineRows[0]?.autopay_descuento ?? 10);
    multilineRows.forEach(row => {
      const key = familyKey(row.familia);
      if (!grouped.has(key)) grouped.set(key, {
        key,
        label: String(row.familia || 'Business Red'),
        lineCosts: [],
        autoPayLineCosts: [],
        lineCodes: [],
        autoPayDiscount: Number.isFinite(autoPayDiscount) ? autoPayDiscount : 0,
      });
      const line = Number(row.cantidad_lineas);
      const price = Number(row.precio_regular ?? row.precio);
      const autoPayPrice = Number(row.renta_autopay ?? row.precio_autopay ?? row.precio_con_autopay ?? (Number.isFinite(price) ? Math.max(0, price - (Number.isFinite(autoPayDiscount) ? autoPayDiscount : 0)) : NaN));
      if (line > 0 && Number.isFinite(price)) {
        const plan = grouped.get(key);
        plan.lineCosts[line - 1] = price;
        plan.autoPayLineCosts[line - 1] = Number.isFinite(autoPayPrice) ? autoPayPrice : null;
        plan.lineCodes[line - 1] = String(row.codigo || row.codigo_plan || '');
      }
    });
    const multiline = [...grouped.values()]
      .map(plan => {
        const lineCosts = plan.lineCosts.map(value => Number.isFinite(value) ? value : null);
        const autoPayLineCosts = plan.autoPayLineCosts.map(value => Number.isFinite(value) ? value : null);
        let regularTotal = 0;
        let autoPayTotal = 0;
        return {
          ...plan,
          lineCosts,
          autoPayLineCosts,
          lineTotals: lineCosts.map(value => {
            regularTotal += Number(value || 0);
            return regularTotal;
          }),
          autoPayTotals: autoPayLineCosts.map((value, index) => {
            autoPayTotal += Number(value ?? lineCosts[index] ?? 0);
            return autoPayTotal;
          }),
        };
      })
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

  function commercialRulesFromPayload(payload) {
    if (!payload?.ok) return { version: null, rules: [] };
    return {
      version: payload.version || payload.version_vigente || payload.publicacion || null,
      rules: Array.isArray(payload.reglas) ? payload.reglas : [],
    };
  }

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function normalizeProductCategory(value) {
    const key = normalizeKey(value);
    if (!key) return '';
    if (['smartphone', 'phone', 'telefono', 'celular', 'movil', 'gama_alta', 'gama_baja', 'iphone'].includes(key)) return 'smartphone';
    if (['tablet', 'tableta', 'ipad'].includes(key)) return 'tablet';
    if (['modem', 'mifi', 'hotspot', 'internet_on_the_go'].includes(key)) return 'modem';
    return key;
  }

  function ruleContract(rule) {
    return rule?.contrato || rule || {};
  }

  function isPublishedCommercialRule(rule) {
    return rule?.estado_confianza === 'confirmado'
      && rule?.estado_publicacion === 'vigente'
      && rule?.autoaplica === false;
  }

  function commercialRulePublicationReasons(rule) {
    const reasons = [];
    if (rule?.estado_confianza !== 'confirmado') reasons.push('estado_no_confirmado');
    if (rule?.estado_publicacion !== 'vigente') reasons.push('estado_no_vigente');
    if (rule?.autoaplica !== false) reasons.push('autoaplica_no_permitido');
    return reasons;
  }

  function affectedProducts(contract) {
    const values = contract.productos_afectados || contract.productos || contract.alcance_productos || [];
    return Array.isArray(values) ? values.map(normalizeKey).filter(Boolean) : [];
  }

  function requiredEvents(conditions) {
    const values = conditions.eventos || conditions.evento || [];
    return (Array.isArray(values) ? values : [values])
      .map(normalizeKey)
      .map(value => value === 'nueva' ? 'linea_nueva' : value)
      .filter(Boolean);
  }

  function contextEvents(context) {
    return (Array.isArray(context?.lineas) ? context.lineas : [])
      .map(line => normalizeKey(line.evento))
      .map(value => value === 'nueva' ? 'linea_nueva' : value)
      .filter(Boolean);
  }

  function ruleContextReasons(rule, context) {
    const contract = ruleContract(rule);
    const conditions = contract.condiciones || {};
    const reasons = [];
    const productSet = new Set((context?.productos || []).map(normalizeKey));
    const products = affectedProducts(contract);
    const events = requiredEvents(conditions);
    const selectedEvents = new Set(contextEvents(context));
    const minPlan = Number(conditions.plan_minimo || conditions.plan_monto_minimo || 0);
    const lines = Array.isArray(context?.lineas) ? context.lineas : [];

    if (normalizeKey(conditions.convergencia) === 'requerida' && !context?.cliente?.convergente) {
      reasons.push('requiere_convergencia_confirmada');
    }
    if (events.length && !events.some(event => selectedEvents.has(event))) {
      reasons.push('evento_no_aplica');
    }
    if (minPlan > 0 && !lines.some(line => Number(line.plan_monto || 0) >= minPlan)) {
      reasons.push('plan_minimo_no_cumplido');
    }
    if (products.length && !products.some(product => productSet.has(product))) {
      reasons.push('producto_no_presente');
    }
    return reasons;
  }

  function hasUndeterminedData(rule) {
    const contract = ruleContract(rule);
    const conditions = contract.condiciones || {};
    const values = [
      contract.beneficio?.tipo,
      conditions.compatibilidad,
      conditions.convergencia,
      conditions.plan_minimo,
      conditions.limite?.cantidad,
      conditions.limite?.unidad,
    ];
    return values.some(value => normalizeKey(value) === 'no_determinado');
  }

  function buildRuleCombinations(rule, context) {
    const contract = ruleContract(rule);
    const conditions = contract.condiciones || {};
    const products = affectedProducts(contract);
    const events = requiredEvents(conditions);
    const minPlan = Number(conditions.plan_minimo || conditions.plan_monto_minimo || 0);
    const lines = Array.isArray(context?.lineas) ? context.lineas : [];
    return lines.filter(line => {
      const event = normalizeKey(line.evento) === 'nueva' ? 'linea_nueva' : normalizeKey(line.evento);
      const product = normalizeKey(line.producto);
      if (events.length && !events.includes(event)) return false;
      if (products.length && !products.includes(product)) return false;
      if (minPlan > 0 && Number(line.plan_monto || 0) < minPlan) return false;
      return true;
    }).map(line => ({
      regla_id: rule.id || rule.identidad_comercial,
      identidad_comercial: rule.identidad_comercial,
      linea: line.linea || null,
      evento: line.evento || null,
      producto: line.producto || null,
      beneficio: contract.beneficio || rule.beneficio || null,
      accion: 'evaluar',
      autoaplica: false,
    }));
  }

  function evaluateCommercialRulesSimulation({ version = null, rules = [], context = {} } = {}) {
    const elegibles = [];
    const descartadas = [];
    const combinaciones = [];
    const received = Array.isArray(rules) ? rules : [];

    received.forEach(rule => {
      const publicationReasons = commercialRulePublicationReasons(rule);
      if (publicationReasons.length) {
        descartadas.push({ ...rule, motivos: publicationReasons });
        return;
      }
      if (!isPublishedCommercialRule(rule)) return;
      if (hasUndeterminedData(rule)) {
        descartadas.push({ ...rule, motivos: ['dato_no_determinado'] });
        return;
      }
      const contextReasons = ruleContextReasons(rule, context);
      if (contextReasons.length) {
        descartadas.push({ ...rule, motivos: contextReasons });
        return;
      }
      const simulatedRule = { ...rule, autoaplica: false };
      elegibles.push(simulatedRule);
      combinaciones.push(...buildRuleCombinations(simulatedRule, context));
    });

    return {
      modo: 'simulacion',
      version,
      recibidas: received.length,
      elegibles,
      descartadas,
      combinaciones,
      recomendacion: {
        modo: 'simulacion',
        texto: elegibles.length
          ? `Evaluar ${elegibles.length} regla(s) publicada(s) contra el caso antes de decidir.`
          : 'No hay reglas publicadas aplicables al contexto actual.',
        autoaplica: false,
      },
    };
  }

  function numericBenefit(rule) {
    const benefit = ruleContract(rule).beneficio || {};
    const amount = Number(benefit.monto ?? benefit.valor ?? benefit.descuento_mensual ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const application = normalizeKey(benefit.aplicacion || benefit.tipo_calculo || 'no_determinado');
    if (!['mensual', 'descuento_mensual', 'factura_mensual'].includes(application)) return 0;
    return amount;
  }

  function compatibility(rule) {
    return normalizeKey(ruleContract(rule).condiciones?.compatibilidad || 'no_determinado');
  }

  function rankRule(rule) {
    const benefit = ruleContract(rule).beneficio || {};
    const priority = Number(benefit.prioridad ?? numericBenefit(rule));
    return Number.isFinite(priority) ? priority : 0;
  }

  function applyCompatibility(elegibles) {
    const acumulables = elegibles.filter(rule => compatibility(rule) === 'acumula');
    const exclusive = elegibles.filter(rule => compatibility(rule) === 'no_acumula')
      .sort((a, b) => rankRule(b) - rankRule(a));
    const selectedExclusive = exclusive.slice(0, 1);
    const discarded = exclusive.slice(1).map(rule => ({ ...rule, motivos: ['beneficio_incompatible'] }));
    return { aplicadas: [...selectedExclusive, ...acumulables], descartadas: discarded };
  }

  function proposalBaseTotal(baseProposal) {
    return Number(baseProposal?.precio_base_mensual || 0) + Number(baseProposal?.equipo_mensual || 0);
  }

  function buildAlternatives({ baseProposal, elegibles, applied }) {
    const baseTotal = proposalBaseTotal(baseProposal);
    const alternatives = [
      {
        tipo: 'sin_benefits',
        descripcion: 'Plan base + equipo sin beneficios',
        total_estimado_mensual: baseTotal,
        descuento_mensual_estimado: 0,
        reglas: [],
      },
    ];
    for (const rule of elegibles) {
      const discount = numericBenefit(rule);
      alternatives.push({
        tipo: 'beneficio_individual',
        descripcion: rule.identidad_comercial || rule.id || 'beneficio',
        total_estimado_mensual: Math.max(0, baseTotal - discount),
        descuento_mensual_estimado: discount,
        reglas: [rule.identidad_comercial || rule.id],
      });
    }
    if (applied.length) {
      const discount = applied.reduce((sum, rule) => sum + numericBenefit(rule), 0);
      alternatives.push({
        tipo: 'recomendada',
        descripcion: 'Combinacion valida recomendada para revision',
        total_estimado_mensual: Math.max(0, baseTotal - discount),
        descuento_mensual_estimado: discount,
        reglas: applied.map(rule => rule.identidad_comercial || rule.id),
      });
    }
    return alternatives;
  }

  function evaluateCommercialProposal({ version = null, rules = [], baseProposal = {} } = {}) {
    const simulation = evaluateCommercialRulesSimulation({
      version,
      rules,
      context: {
        cliente: baseProposal.cliente || {},
        lineas: baseProposal.lineas || [],
        productos: baseProposal.productos || [],
      },
    });
    const compatibilityResult = applyCompatibility(simulation.elegibles);
    const applied = compatibilityResult.aplicadas.map(rule => ({ ...rule, autoaplica: false }));
    const discarded = [...simulation.descartadas, ...compatibilityResult.descartadas];
    const baseTotal = proposalBaseTotal(baseProposal);
    const discount = applied.reduce((sum, rule) => sum + numericBenefit(rule), 0);
    const proposal = {
      total_base_mensual: baseTotal,
      descuento_mensual_estimado: discount,
      total_estimado_mensual: Math.max(0, baseTotal - discount),
      bloqueada: Boolean(discarded.some(rule => (rule.motivos || []).includes('dato_no_determinado'))) || applied.length === 0,
      autoaplica: false,
    };

    return {
      modo: 'local',
      version,
      propuesta: proposal,
      reglas_aplicadas: applied,
      reglas_descartadas: discarded,
      combinaciones: simulation.combinaciones.filter(combo => applied.some(rule => (rule.id || rule.identidad_comercial) === combo.regla_id)),
      recomendacion: {
        modo: 'simulacion',
        autoaplica: false,
        texto: applied.length
          ? `Revisar propuesta con ${applied.length} regla(s) elegible(s), sin autoaplicacion.`
          : 'No hay reglas aplicables para recomendar beneficios en este contexto.',
      },
      alternativas: buildAlternatives({ baseProposal, elegibles: simulation.elegibles, applied }),
    };
  }

  function compareValue(label, actual, motor, type = 'valor') {
    const actualNumber = Number(actual || 0);
    const motorNumber = Number(motor || 0);
    return {
      tipo: type,
      campo: label,
      actual: Number.isFinite(actualNumber) ? actualNumber : actual,
      motor: Number.isFinite(motorNumber) ? motorNumber : motor,
      diferencia: Number.isFinite(actualNumber) && Number.isFinite(motorNumber)
        ? Number((motorNumber - actualNumber).toFixed(2))
        : null,
      cambia: actualNumber !== motorNumber,
    };
  }

  function compareList(label, actualItems = [], motorItems = []) {
    const actual = [...new Set((actualItems || []).map(item => normalizeKey(item)).filter(Boolean))];
    const motor = [...new Set((motorItems || []).map(item => normalizeKey(item)).filter(Boolean))];
    const added = motor.filter(item => !actual.includes(item));
    const removed = actual.filter(item => !motor.includes(item));
    return {
      tipo: 'lista',
      campo: label,
      actual,
      motor,
      agregadas_motor: added,
      removidas_motor: removed,
      cambia: Boolean(added.length || removed.length),
    };
  }

  function buildManualCommercialDecision({
    version = null,
    source = 'flujo_anterior_fallback',
    line = {},
    plan = {},
    equipment = {},
    offer = {},
    benefit = {},
    terms = [],
    validity = {},
    trace = {},
    totals = {},
    selected = false,
  } = {}) {
    return {
      source,
      autoaplica: false,
      selected: Boolean(selected),
      version,
      line: {
        linea: line.linea || null,
        evento: line.evento || null,
        plan_monto: Number(line.plan_monto || 0),
      },
      plan: {
        codigo: plan.codigo || plan.code || null,
        nombre: plan.nombre || plan.label || null,
        monto: Number(plan.monto ?? plan.regular ?? line.plan_monto ?? 0),
      },
      equipment: {
        item_code: equipment.item_code || equipment.itemCode || null,
        sap_code: equipment.sap_code || equipment.sapCode || null,
        modelo: equipment.modelo || equipment.modelo_oficial || null,
        precio_regular: Number(equipment.precio_regular ?? equipment.precio ?? 0),
      },
      offer: {
        id: offer.id || null,
        nombre: offer.nombre || offer.titulo || null,
      },
      benefit: {
        tipo: benefit.tipo || null,
        monto: Number(benefit.monto || 0),
        porcentaje: Number(benefit.porcentaje || 0),
      },
      terms: Array.isArray(terms) ? terms.filter(Boolean) : [],
      validity: {
        desde: validity.desde || validity.vigencia_desde || null,
        hasta: validity.hasta || validity.vigencia_hasta || null,
      },
      trace: {
        fuente: trace.fuente || trace.nombre_original || null,
        seccion: trace.seccion || null,
        pagina: trace.pagina || null,
        regla_id: trace.regla_id || null,
      },
      totals: {
        equipo_mensual: Number(totals.equipo_mensual || 0),
        equipo_regular: Number(totals.equipo_regular ?? equipment.precio_regular ?? equipment.precio ?? 0),
        precio_resultante: Number(totals.precio_resultante || 0),
        plan_mensual: Number(totals.plan_mensual ?? plan.monto ?? line.plan_monto ?? 0),
      },
    };
  }

  function buildCommercialScenario({
    source_mode = 'manual',
    client = {},
    ban = {},
    account_type = '',
    full_ban_lines = [],
    selected_lines = [],
    event = null,
    plan = {},
    equipment_preferences = {},
    selected_equipment = [],
    fixed_services = [],
    productos = [],
    financing = {},
    term = null,
    budget = null,
    convergence = {},
    seller_preferences = {},
    original_query = '',
  } = {}) {
    const fullLines = Array.isArray(full_ban_lines) ? full_ban_lines : [];
    const selectedLines = Array.isArray(selected_lines) ? selected_lines : [];
    return {
      source_mode,
      autoaplica: false,
      client: {
        id: client.id || client.client_id || null,
        name: client.name || client.nombre || client.business_name || client.company || '',
      },
      ban: {
        number: ban.number || ban.ban_number || ban.ban || '',
        status: ban.status || ban.estado || '',
      },
      account_type: account_type || ban.account_type || '',
      full_ban_lines: fullLines,
      selected_lines: selectedLines,
      selected_lines_count: selectedLines.length,
      event,
      plan,
      equipment_preferences,
      selected_equipment,
      fixed_services: Array.isArray(fixed_services) ? fixed_services : [],
      productos: Array.isArray(productos) ? productos : [],
      financing,
      term,
      budget,
      convergence,
      seller_preferences,
      original_query,
      commercial_truth: 'motor_comercial_publicado',
    };
  }

  function scenarioConvergenceState(scenario) {
    const state = normalizeKey(scenario?.convergence?.estado || scenario?.client?.convergence_status || '');
    if (state === 'convergente') return { convergente: true, estado: 'convergente' };
    if (['no_determinada', 'no_determinado', 'requiere_revision', 'pendiente'].includes(state)) {
      return { convergente: false, estado: 'requiere_revision' };
    }
    return { convergente: false, estado: state || 'no_confirmada' };
  }

  function buildBaseProposalFromCommercialScenario(scenario = {}) {
    const convergence = scenarioConvergenceState(scenario);
    const selectedLines = Array.isArray(scenario.selected_lines) ? scenario.selected_lines : [];
    const fixedServices = Array.isArray(scenario.fixed_services)
      ? scenario.fixed_services
      : (Array.isArray(scenario.productos_fijos) ? scenario.productos_fijos : []);
    const selectedEquipment = Array.isArray(scenario.selected_equipment) ? scenario.selected_equipment : [];
    const mobileProduct = selectedLines.length || selectedEquipment.length ? ['movil'] : [];
    const fixedProducts = fixedServices.length ? ['fijo'] : [];
    const products = [...new Set([...(scenario.productos || []), ...mobileProduct, ...fixedProducts].map(normalizeKey).filter(Boolean))];

    return {
      source_mode: scenario.source_mode || 'manual',
      cliente: {
        id: scenario.client?.id || null,
        nombre: scenario.client?.name || '',
        ban: scenario.ban?.number || '',
        convergente: convergence.convergente,
        convergencia_estado: convergence.estado,
      },
      lineas: selectedLines.map((line, index) => ({
        linea: line.linea || line.position || index + 1,
        ban: line.ban || line.ban_number || scenario.ban?.number || '',
        evento: line.evento || scenario.event || 'linea_nueva',
        producto: normalizeKey(line.producto || line.service_type || 'movil'),
        plan_monto: Number(line.plan_monto ?? line.current_rent ?? scenario.plan?.individual_monto ?? 0),
      })),
      productos: products,
      servicios_fijos: fixedServices,
      precio_base_mensual: Number(scenario.plan?.precio_base_mensual || scenario.plan?.total_mensual || 0),
      // `??` y no `||`: una mensualidad de $0 (equipo cubierto por la oferta) es un valor real.
      equipo_mensual: selectedEquipment.reduce((sum, item) => sum + Number(item.mensualidad ?? item.equipo_mensual ?? 0), 0),
      commercial_truth: scenario.commercial_truth || 'motor_comercial_publicado',
      autoaplica: false,
    };
  }

  function detectRequestedEquipment(cleanText, originalText) {
    const catalog = consultationEquipmentPatterns(cleanText);
    const match = catalog.find(item => item.pattern.test(cleanText));
    if (!match) return { brand: null, model: null, product_category: null, raw: originalText || '' };
    return { brand: match.brand, model: match.model, product_category: match.product_category || null, raw: originalText || '' };
  }

  function consultationEquipmentPatterns(cleanText = '') {
    return [
      { pattern: /\bs26\b/, brand: 'samsung', model: 'Samsung Galaxy S26', product_category: 'smartphone' },
      { pattern: /\ba37\b/, brand: 'samsung', model: 'Samsung Galaxy A37', product_category: 'smartphone' },
      { pattern: /\biphone\s*17\b/, brand: 'apple', model: 'iPhone 17', product_category: 'smartphone' },
      { pattern: /\biphone\s*pro\b/, brand: 'apple', model: 'iPhone Pro', product_category: 'smartphone', ambiguous: true },
      { pattern: /\bcg\s*890\b|\bcg890\b|\bmodem\s*890\b|\b890\b/, brand: 'franklin', model: 'Franklin JEXstream CG890 5G', product_category: 'modem', catalog_alias: 'catalogo_canonico_equipos' },
      { pattern: /\brg\s*2100\b|\brg2100\b/, brand: 'franklin', model: 'Franklin JEXstream RG2100 5G', product_category: 'modem', catalog_alias: 'catalogo_canonico_equipos' },
      { pattern: /\btablet\b|\btableta\b|\bipad\b/, brand: cleanText.includes('samsung') ? 'samsung' : (cleanText.includes('apple') || cleanText.includes('ipad') ? 'apple' : null), model: cleanText.includes('ipad') ? 'iPad' : null, product_category: 'tablet' },
      { pattern: /\bmifi\b|\bmodem\b/, brand: cleanText.includes('franklin') ? 'franklin' : null, model: null, product_category: 'modem' },
      { pattern: /\bsamsung\b/, brand: 'samsung', model: null, product_category: 'smartphone' },
      { pattern: /\biphone\b|\bapple\b/, brand: 'apple', model: null, product_category: 'smartphone' },
      { pattern: /\bmotorola\b|\bmoto\b/, brand: 'motorola', model: null, product_category: 'smartphone' },
      { pattern: /\bfranklin\b/, brand: 'franklin', model: null, product_category: null },
    ];
  }

  function countScenarioLines(scenario = {}) {
    const selected = Array.isArray(scenario.selected_lines) ? scenario.selected_lines : [];
    const full = Array.isArray(scenario.full_ban_lines) ? scenario.full_ban_lines : [];
    return selected.length || Number(scenario.selected_lines_count || 0) || full.length || Number(scenario.plan?.lineas || 0) || 1;
  }

  function detectRequestedLines(cleanText, scenario = {}, inferredEquipmentTotal = null) {
    const lineMatch = cleanText.match(/(\d+)\s*(lineas|linea|renovaciones|equipos)/);
    const remainingMatch = cleanText.match(/(?:las\s*)?(\d+)\s*restantes/);
    const allLines = /\btodas\b|\btodos\b|\besas lineas\b|\beste ban\b|\beste cliente\b/.test(cleanText);
    if (remainingMatch) return { count: Number(remainingMatch[1]), allLines: false, remaining: true };
    if (lineMatch) return { count: Number(lineMatch[1]), allLines: false, remaining: false };
    if (allLines) return { count: countScenarioLines(scenario), allLines: true, remaining: false };
    if (Number(inferredEquipmentTotal || 0) > 0) {
      return { count: Number(inferredEquipmentTotal), allLines: false, remaining: false, inferred_from_equipment: true };
    }
    return { count: null, allLines: false, remaining: false };
  }

  function detectConsultationEvent(cleanText, scenario = {}) {
    if (/\bbyop\b|tra(e|er|igo)\s*(mi\s*)?equipo|sin equipo|mantener mis equipos/.test(cleanText)) return 'byop';
    if (cleanText.includes('renov')) return 'renovacion';
    if (cleanText.includes('port')) return 'portabilidad';
    if (cleanText.includes('adicional')) return 'adicional';
    if (cleanText.includes('nueva')) return 'nueva';
    return scenario.event || null;
  }

  function detectConsultationConvergence(cleanText, scenario = {}) {
    if (/\b(no|sin)\s+converg/.test(cleanText)) return { estado: 'no_confirmada' };
    if (/\bconvergente\b|\bconvergencia\b|\bclaro\s*full\b/.test(cleanText)) return { estado: 'convergente' };
    return scenario.convergence || {};
  }

  function detectConsultationObjective(cleanText, budgetMatch) {
    if (cleanText.includes('compar')) return 'comparar_opciones';
    if (cleanText.includes('gratis')) return 'buscar_equipos_gratis';
    if (/50\s*%|mitad|cincuenta/.test(cleanText)) return 'buscar_equipos_50';
    if (cleanText.includes('ahorro')) return 'maximo_ahorro';
    if (budgetMatch) return 'optimizar_costo';
    if (cleanText.includes('mant')) return 'mantener_seleccion';
    if (/\blo mejor\b|mejor opcion|mejor oferta/.test(cleanText)) return 'requiere_aclaracion';
    return 'preparar_opciones';
  }

  function detectConsultationPlanFamily(cleanText, scenario = {}) {
    const currentFamily = scenario.plan?.multilinea_familia || scenario.plan?.familia_business_red || null;
    if (/\bbusiness\s*red\s*plus\b|\bred\s*plus\b|\bmultilinea\s*plus\b|\bbredp1\b/.test(cleanText)) return 'business_red_plus';
    if (/\bbusiness\s*red\s*extreme\b|\bmultilinea\s*extreme\b|\bextreme\b/.test(cleanText)) return 'business_red_extreme';
    if (/\bbusiness\s*red\s*supreme\b|\bmultilinea\s*supreme\b|\bsupreme\b/.test(cleanText)) return 'business_red_supreme';
    if (/\bsin\s*fronteras\b|\bbusiness\s*red\s*sin\s*fronteras\b/.test(cleanText)) return 'business_red_sin_fronteras';
    const isMultilineScenario = scenario.plan?.tipo === 'multilinea' || String(scenario.tipo || '').includes('multilinea');
    if (isMultilineScenario && currentFamily === 'plus') return 'business_red_plus';
    if (isMultilineScenario && currentFamily) return currentFamily;
    return null;
  }

  function consultationPlanFamilyLabel(planFamily) {
    const labels = {
      business_red_plus: 'Business RED Plus',
      business_red_extreme: 'Business RED Extreme',
      business_red_supreme: 'Business RED Supreme',
      business_red_sin_fronteras: 'Business RED Sin Fronteras',
    };
    return labels[planFamily] || null;
  }

  function consultationPlanFamilyInitialCode(planFamily, scenario = {}) {
    if (planFamily === 'business_red_plus') return 'BREDP1';
    return scenario.plan?.codigo || null;
  }

  function consultationEquipmentFromPhrase(phrase, cleanText = '') {
    const text = String(phrase || '').replace(/_/g, ' ').trim();
    const match = consultationEquipmentPatterns(cleanText || text).find(item => item.pattern.test(text));
    if (!match) return null;
    return {
      equipo: match.model,
      marca: match.brand || null,
      categoria: normalizeProductCategory(match.product_category || ''),
      confidence: match.ambiguous ? 'requiere_precision' : 'confirmado',
      ambiguous: Boolean(match.ambiguous),
      catalog_alias: match.catalog_alias || null,
      raw: text,
    };
  }

  function detectConsultationEquipmentSelections(cleanText, originalText = '') {
    const normalized = String(cleanText || '').replace(/[×✕✖]/g, ' x ').replace(/\biphone\s+(\d+)\s*(?:eq|equipos?)\s*(17)\b/g, '$1 iphone $2');
    const requests = [];
    const patterns = [
      /(\d+)\s*(?:x\s*)?(?:equipos?\s*)?(iphone\s*17|iphone\s*pro|s26|a37|samsung|tablets?|tabletas?|ipads?|mifis?|modems?\s*\d*|franklin\s+jexstream\s+cg\s*890(?:\s*5g)?|franklin\s+jexstream\s+rg\s*2100(?:\s*5g)?|cg\s*890|cg890|rg\s*2100|rg2100)/g,
      /(iphone\s*17|iphone\s*pro|s26|a37|samsung|tablets?|tabletas?|ipads?|mifis?|modems?\s*\d*|franklin\s+jexstream\s+cg\s*890(?:\s*5g)?|franklin\s+jexstream\s+rg\s*2100(?:\s*5g)?|cg\s*890|cg890|rg\s*2100|rg2100)\s*x\s*(\d+)/g,
    ];
    patterns.forEach((regex, patternIndex) => {
      let match;
      while ((match = regex.exec(normalized))) {
        const quantity = Number(patternIndex === 0 ? match[1] : match[2]);
        const phrase = patternIndex === 0 ? match[2] : match[1];
        const equipment = consultationEquipmentFromPhrase(phrase, normalized);
        if (!equipment || !quantity) continue;
        const key = normalizeKey(equipment.equipo || equipment.marca || equipment.categoria);
        const found = requests.find(item => normalizeKey(item.equipo || item.marca || item.categoria) === key);
        if (found) found.cantidad += quantity;
        else requests.push({ cantidad: quantity, ...equipment });
      }
    });
    if (!requests.length) {
      const single = consultationEquipmentFromPhrase(normalized, normalized);
      if (single?.equipo || single?.marca || single?.categoria) requests.push({ cantidad: null, ...single });
    }
    return requests.map(item => ({
      cantidad: item.cantidad,
      equipo: item.equipo || null,
      marca: item.marca || null,
      categoria: item.categoria || null,
      confidence: item.confidence || 'confirmado',
      ambiguous: Boolean(item.ambiguous),
      catalog_alias: item.catalog_alias || null,
      raw: item.raw || originalText || '',
    }));
  }

  function equipmentSelectionsTotal(selections = []) {
    return selections.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  }

  function hasExplicitEquipmentSelection(selections = []) {
    return (Array.isArray(selections) ? selections : []).some(item => {
      if (Number(item.cantidad || 0) > 0) return true;
      if (item.equipo) return true;
      const category = normalizeProductCategory(item.categoria || '');
      return Boolean(category && !item.marca);
    });
  }

  function queryAddsEquipment(cleanText = '') {
    return /(^|\b)(agrega|agregar|agregame|sumar|anade|añade|ademas|adicional)(\b|$)/.test(cleanText);
  }

  function queryKeepsPreviousEquipment(cleanText = '') {
    return /mant(e|e)n|conserva|deja igual/.test(cleanText);
  }

  function consultationClarifications({ cleanText, intent }) {
    const questions = [];
    if (intent.objective === 'requiere_aclaracion') {
      questions.push({
        campo: 'objetivo',
        pregunta: 'Define que significa mejor opcion para esta consulta.',
        opciones: ['menor costo', 'mayor cantidad de equipos gratis', 'mantener marca', 'mejor equipo disponible'],
      });
    }
    if (!intent.event && /\b(linea|lineas|equipo|equipos)\b/.test(cleanText)) {
      questions.push({
        campo: 'evento',
        pregunta: 'Confirma el evento comercial.',
        opciones: ['renovacion', 'portabilidad', 'linea nueva', 'linea adicional', 'BYOP'],
      });
    }
    if (intent.equipment_quantity_mismatch) {
      questions.push({
        campo: 'cantidades_equipos',
        pregunta: 'Confirma las cantidades de equipos: no cuadran con la cantidad de lineas solicitadas.',
        opciones: ['dejar lineas restantes pendientes', 'ajustar cantidad de equipos', 'cambiar cantidad de lineas'],
      });
    }
    const ambiguous = (intent.equipment_selections || []).filter(item => item.ambiguous || item.confidence === 'requiere_precision');
    ambiguous.forEach(item => {
      questions.push({
        campo: 'equipo',
        pregunta: `Confirma el modelo exacto para ${item.equipo || item.raw}.`,
        opciones: ['modelo y capacidad exacta', 'dejar pendiente de seleccion vendedor'],
      });
    });
    return questions;
  }

  function consultationTargetLines({ scenario = {}, requestedLines = null, event = null } = {}) {
    const selectedLines = Array.isArray(scenario.selected_lines) ? scenario.selected_lines : [];
    const fullLines = Array.isArray(scenario.full_ban_lines) ? scenario.full_ban_lines : [];
    const linesFromContext = selectedLines.length ? selectedLines : fullLines;
    const count = Number(requestedLines || linesFromContext.length || scenario.plan?.lineas || 1);
    if (!count) return [];
    const sample = linesFromContext[0] || {};
    return Array.from({ length: count }, (_, index) => ({
      ...sample,
      linea: index + 1,
      position: index + 1,
      ban: sample.ban || sample.ban_number || scenario.ban?.number || '',
      evento: event || sample.evento || scenario.event || null,
      producto: sample.producto || sample.service_type || 'movil',
      plan_monto: Number(sample.plan_monto ?? sample.current_rent ?? scenario.plan?.individual_monto ?? 0),
      virtual_consultation_line: !linesFromContext[index],
    }));
  }

  function interpretCommercialConsultation({ query = '', scenario = {} } = {}) {
    const original = String(query || '').trim();
    const clean = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[×✕✖]/g, ' x ');
    const budgetMatch = clean.match(/(?:\$|menos de|debajo de|pasar de|maximo|max)\s*([0-9]+(?:\.[0-9]+)?)/);
    const requestedEquipment = detectRequestedEquipment(clean, original);
    const equipmentSelections = detectConsultationEquipmentSelections(clean, original);
    const selectedTotal = equipmentSelectionsTotal(equipmentSelections);
    const quantity = detectRequestedLines(clean, scenario, selectedTotal);
    const evento = detectConsultationEvent(clean, scenario);
    const convergence = detectConsultationConvergence(clean, scenario);
    const objective = detectConsultationObjective(clean, budgetMatch);
    const planFamily = detectConsultationPlanFamily(clean, scenario);
    const requestedLines = quantity.count;
    const primarySelection = equipmentSelections.find(item => item.equipo || item.marca || item.categoria) || null;
    const brandPreference = primarySelection?.marca || requestedEquipment.brand || null;
    const equipmentGoal = clean.includes('cualquier equipo')
      ? 'cualquier_equipo'
      : (clean.includes('mantener mis equipos') ? 'mantener_equipos_actuales' : (clean.includes('gratis') ? 'gratis' : (/50\s*%|mitad|cincuenta/.test(clean) ? '50_por_ciento' : null)));
    const explicitEquipmentSelection = hasExplicitEquipmentSelection(equipmentSelections);
    const replacesEquipmentStrategy = Boolean((brandPreference || budgetMatch || ['maximo_ahorro', 'buscar_equipos_gratis', 'buscar_equipos_50', 'optimizar_costo'].includes(objective)) && !queryAddsEquipment(clean) && !queryKeepsPreviousEquipment(clean));
    const selectedEquipmentPatch = explicitEquipmentSelection
      ? equipmentSelections.map(item => ({
        modelo: item.equipo || null,
        marca: item.marca || null,
        categoria_producto: item.categoria || null,
        cantidad: Number(item.cantidad || 1),
        confidence: item.confidence || 'confirmado',
        origen: 'consulta_inteligente_local',
        catalog_alias: item.catalog_alias || null,
      }))
      : (replacesEquipmentStrategy ? [] : (Array.isArray(scenario.selected_equipment) ? scenario.selected_equipment : []));
    const equipmentPreferences = {
      ...(!replacesEquipmentStrategy ? (scenario.equipment_preferences || {}) : {}),
      marca: brandPreference || (!replacesEquipmentStrategy ? scenario.equipment_preferences?.marca : null) || null,
      modelo: primarySelection?.equipo || requestedEquipment.model || (replacesEquipmentStrategy ? null : (scenario.equipment_preferences?.modelo || null)),
      categoria_producto: primarySelection?.categoria || requestedEquipment.product_category || (!replacesEquipmentStrategy ? scenario.equipment_preferences?.categoria_producto : null) || null,
      selecciones: equipmentSelections,
      cualquier_equipo: clean.includes('cualquier equipo'),
      mantener_equipos_actuales: clean.includes('mantener mis equipos'),
      beneficio_objetivo: equipmentGoal,
    };
    const selectedLines = Array.isArray(scenario.selected_lines) ? scenario.selected_lines : [];
    const targetLines = consultationTargetLines({ scenario, requestedLines, event: evento });

    const intent = {
      requested_lines: requestedLines,
      use_all_context_lines: quantity.allLines,
      requested_remaining_lines: quantity.remaining,
      event: evento,
      primary_equipment: primarySelection?.equipo || requestedEquipment.model,
      equipment_selections: equipmentSelections,
      equipment_total_requested: selectedTotal || null,
      equipment_quantity_mismatch: Boolean(requestedLines && selectedTotal && selectedTotal !== requestedLines && !quantity.remaining),
      brand_preference: brandPreference,
      max_monthly_budget: budgetMatch ? Number(budgetMatch[1]) : null,
      budget_scope: clean.includes('equipos') && budgetMatch ? 'equipos' : (budgetMatch ? 'plan_y_equipos' : null),
      plan_family: planFamily,
      convergence: convergence?.estado || null,
      objective,
      clarification_required: objective === 'requiere_aclaracion',
      explicit_equipment_selection: explicitEquipmentSelection,
      replaces_equipment_strategy: replacesEquipmentStrategy,
    };
    const clarificationQuestions = consultationClarifications({ cleanText: clean, intent });

    return {
      adapter: 'CommercialConsultationInterpreter',
      interpreter_type: 'local_rule_based',
      external_provider: false,
      generated_without_motor: false,
      original_query: original,
      intent,
      scenario_patch: {
        source_mode: 'consultation',
        selected_lines: targetLines,
        selected_lines_count: targetLines.length || requestedLines || selectedLines.length,
        event: evento,
        equipment_preferences: equipmentPreferences,
        budget: budgetMatch ? { maximo_mensual: Number(budgetMatch[1]) } : (scenario.budget || null),
        convergence,
        plan: planFamily ? {
          ...(scenario.plan || {}),
          tipo: 'multilinea',
          multilinea_familia: planFamily,
          codigo: consultationPlanFamilyInitialCode(planFamily, scenario),
          nombre: consultationPlanFamilyLabel(planFamily) || scenario.plan?.nombre,
        } : scenario.plan,
        selected_equipment: selectedEquipmentPatch,
        seller_preferences: {
          ...(scenario.seller_preferences || {}),
          objetivo: objective,
          respetar_marca: clean.includes('solo ') && Boolean(brandPreference),
          requiere_aclaracion: clarificationQuestions.length > 0,
        },
        original_query: original,
      },
      clarification_required: clarificationQuestions.length > 0,
      clarification_questions: clarificationQuestions,
      bloqueos: ['consulta_no_decide_promociones', 'motor_comercial_define_elegibilidad'],
    };
  }

  function applyConsultationIntentToScenario({ scenario = {}, interpretation = {} } = {}) {
    const patch = interpretation.scenario_patch || {};
    return {
      ...scenario,
      ...patch,
      source_mode: 'consultation',
      autoaplica: false,
      client: scenario.client || {},
      ban: scenario.ban || {},
      full_ban_lines: Array.isArray(scenario.full_ban_lines) ? scenario.full_ban_lines : [],
      selected_lines: Array.isArray(patch.selected_lines) ? patch.selected_lines : (Array.isArray(scenario.selected_lines) ? scenario.selected_lines : []),
      equipment_preferences: patch.equipment_preferences || scenario.equipment_preferences || {},
      seller_preferences: patch.seller_preferences || scenario.seller_preferences || {},
      consultation: {
        original_query: interpretation.original_query || scenario.original_query || '',
        interpretation: interpretation.intent || {},
        adapter: interpretation.adapter || 'CommercialConsultationInterpreter',
        interpreter_type: interpretation.interpreter_type || 'local_rule_based',
      },
      commercial_truth: 'motor_comercial_publicado',
    };
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function agentModelFromText(textValue) {
    const clean = normalizeKey(textValue);
    if (/(^|_)s26($|_)/.test(clean)) return { modelo: 'Samsung Galaxy S26', marca: 'samsung', categoria_producto: 'smartphone' };
    if (/(^|_)a37($|_)/.test(clean)) return { modelo: 'Samsung Galaxy A37', marca: 'samsung', categoria_producto: 'smartphone' };
    if (/iphone_*pro/.test(clean)) return { modelo: 'iPhone Pro', marca: 'apple', categoria_producto: 'smartphone' };
    if (/iphone_*17/.test(clean)) return { modelo: 'iPhone 17', marca: 'apple', categoria_producto: 'smartphone' };
    if (/cg_*890|modem_*890|(^|_)890($|_)/.test(clean)) return { modelo: 'Franklin JEXstream CG890 5G', marca: 'franklin', categoria_producto: 'modem' };
    if (/rg_*2100|modem_*2100/.test(clean)) return { modelo: 'Franklin JEXstream RG2100 5G', marca: 'franklin', categoria_producto: 'modem' };
    if (/tablet|ipad/.test(clean)) return { modelo: clean.includes('ipad') ? 'iPad' : 'Tablet', marca: clean.includes('samsung') ? 'samsung' : (clean.includes('ipad') || clean.includes('apple') ? 'apple' : null), categoria_producto: 'tablet' };
    if (/mifi|modem/.test(clean)) return { modelo: clean.includes('franklin') ? 'Franklin modem' : 'Modem/MIFI', marca: clean.includes('franklin') ? 'franklin' : null, categoria_producto: 'modem' };
    return null;
  }

  function detectAgentEquipmentRequests(query) {
    const clean = normalizeKey(String(query || '').replace(/\biphone\s+(\d+)\s*(?:eq|equipos?)\s*(17)\b/ig, '$1 iphone $2'));
    const requests = [];
    const patterns = [
      { regex: /(\d+)_+iphone_*pro/g, text: 'iphone pro' },
      { regex: /(\d+)_+iphone_*17/g, text: 'iphone 17' },
      { regex: /(\d+)_+s26/g, text: 's26' },
      { regex: /(\d+)_+a37/g, text: 'a37' },
      { regex: /(\d+)_+(?:tablets?|ipads?)/g, text: 'tablet' },
      { regex: /(\d+)_+(?:modems?|mifis?)_*890/g, text: 'modem 890' },
      { regex: /(\d+)_+(?:modems?|mifis?)_*2100/g, text: 'modem 2100' },
      { regex: /(\d+)_+(?:modems?|mifis?)/g, text: 'modem' },
    ];
    for (const item of patterns) {
      let match;
      while ((match = item.regex.exec(clean))) {
        const model = agentModelFromText(item.text);
        if (model) requests.push({ ...model, cantidad: Number(match[1]) });
      }
    }
    const singleModel = !requests.length ? agentModelFromText(clean) : null;
    if (singleModel) requests.push({ ...singleModel, cantidad: null });
    return requests;
  }

  function mergeEquipmentRequests(existing = [], requests = [], { replace = false, replaceSource = null } = {}) {
    let result = Array.isArray(existing) ? existing.map(clonePlain) : [];
    if (replace && replaceSource) {
      const source = normalizeKey(replaceSource.modelo || replaceSource);
      result = result.filter(item => normalizeKey(item.modelo) !== source);
    }
    for (const request of requests) {
      const key = normalizeKey(request.modelo || request.categoria_producto);
      const found = result.find(item => normalizeKey(item.modelo || item.categoria_producto) === key);
      if (found) {
        found.cantidad = Number(request.cantidad || found.cantidad || 1);
        found.marca = request.marca || found.marca || null;
        found.categoria_producto = request.categoria_producto || found.categoria_producto || null;
      } else {
        result.push({
          modelo: request.modelo || null,
          marca: request.marca || null,
          categoria_producto: request.categoria_producto || null,
          cantidad: Number(request.cantidad || 1),
          origen: 'agente_comercial_local',
          autoaplica: false,
        });
      }
    }
    return result;
  }

  function detectAgentObjective(query, interpretation) {
    const clean = normalizeKey(query);
    if (/benefits?|beneficios?/.test(clean)) return 'consultar_benefits';
    if (/mas barata|menor costo|barat/.test(clean)) return 'buscar_menor_costo';
    if (/agrega|agregar|agregame|sumar|anade|añade/.test(clean)) return 'agregar';
    if (/quita|quitar|remueve|elimina/.test(clean)) return 'quitar';
    if (/reemplaza|cambia/.test(clean)) return 'reemplazar';
    return interpretation?.intent?.objective || 'preparar_opciones';
  }

  function sourceModelForReplace(query) {
    const clean = normalizeKey(query);
    const match = clean.match(/(?:reemplaza|cambia)_+(?:los_+)?(?:\d+_+)?(.+?)_+por_+/);
    return match ? agentModelFromText(match[1]) : null;
  }

  function sourceQuantityForReplace(query) {
    const clean = normalizeKey(query);
    const match = clean.match(/(?:reemplaza|cambia)_+(?:los_+)?(\d+)_+/);
    return match ? Number(match[1]) : null;
  }

  function requestedPartAfterReplace(query) {
    const clean = normalizeKey(query);
    const match = clean.match(/(?:^|_)por_+(.+)$/);
    return match ? match[1] : query;
  }

  function targetLineCountFromTurn({ query = '', interpretation = {}, scenario = {} } = {}) {
    const requested = Number(interpretation.intent?.requested_lines || 0);
    if (requested > 0) return requested;
    const clean = normalizeKey(query);
    const qty = clean.match(/(\d+)\s+(?:renovaciones?|lineas?|portabilidades?|adicionales?)/);
    if (qty) return Number(qty[1]);
    return countScenarioLines(scenario);
  }

  function scenarioWithAgentTurn({ scenario = {}, query = '', interpretation = {} } = {}) {
    const base = applyConsultationIntentToScenario({ scenario, interpretation });
    const clean = normalizeKey(query);
    const objective = detectAgentObjective(query, interpretation);
    const replace = objective === 'reemplazar';
    const replaceSource = replace ? sourceModelForReplace(query) : null;
    const equipmentQuery = replace ? requestedPartAfterReplace(query) : query;
    const equipmentRequests = detectAgentEquipmentRequests(equipmentQuery);
    const replaceQuantity = replace ? sourceQuantityForReplace(query) : null;
    if (replaceQuantity && equipmentRequests.length === 1 && !equipmentRequests[0].cantidad) {
      equipmentRequests[0].cantidad = replaceQuantity;
    }
    const count = targetLineCountFromTurn({ query, interpretation, scenario: base });
    const event = interpretation.intent?.event || base.event || (clean.includes('renov') ? 'renovacion' : null);
    const selectedLines = consultationTargetLines({ scenario: base, requestedLines: count, event });
    const addsEquipment = objective === 'agregar' || queryAddsEquipment(clean);
    const shouldReplaceEquipment = Boolean(interpretation.intent?.replaces_equipment_strategy) || (equipmentRequests.length > 0 && !addsEquipment && !replace);
    const existingEquipment = replace
      ? (Array.isArray(scenario.selected_equipment) ? scenario.selected_equipment : [])
      : (shouldReplaceEquipment ? [] : (Array.isArray(scenario.selected_equipment) ? scenario.selected_equipment : base.selected_equipment));
    return {
      ...base,
      selected_lines: selectedLines,
      selected_lines_count: selectedLines.length,
      event,
      selected_equipment: mergeEquipmentRequests(
        existingEquipment,
        equipmentRequests,
        { replace, replaceSource }
      ),
      productos: [...new Set([...(base.productos || []), ...equipmentRequests.map(item => item.categoria_producto).filter(Boolean)].map(normalizeKey))],
      seller_preferences: {
        ...(base.seller_preferences || {}),
        objetivo: objective,
      },
      agent_state: {
        active: true,
        last_objective: objective,
        last_query: query,
        turns: Number(scenario.agent_state?.turns || 0) + 1,
      },
      autoaplica: false,
      commercial_truth: 'motor_comercial_publicado',
    };
  }

  function createCommercialAgentSession({ scenario = {}, session_id = null } = {}) {
    return {
      id: session_id || `agent-${Date.now().toString(36)}`,
      scenario: {
        ...buildCommercialScenario({ ...scenario, source_mode: 'consultation' }),
        ...scenario,
        source_mode: 'consultation',
        autoaplica: false,
        commercial_truth: 'motor_comercial_publicado',
      },
      turns: [],
      last_turn: null,
      last_result: null,
      external_provider: false,
      interpreter_type: 'local_rule_based',
      autoaplica: false,
    };
  }

  function applyCommercialAgentTurn({ session = null, query = '', version = null, rules = null, motorDecision = null, motorEquipmentResults = null, motorAlternatives = [], motorCandidates = null } = {}) {
    const current = session || createCommercialAgentSession();
    const interpretation = interpretCommercialConsultation({ query, scenario: current.scenario });
    const nextScenario = scenarioWithAgentTurn({ scenario: current.scenario, query, interpretation });
    const objective = detectAgentObjective(query, interpretation);
    const hasMotorInput = Boolean(motorDecision) || Array.isArray(rules) || Array.isArray(motorEquipmentResults) || motorCandidates;
    const result = hasMotorInput
      ? evaluateCommercialConsultation({
        query,
        scenario: nextScenario,
        version,
        rules: Array.isArray(rules) ? rules : [],
        motorDecision,
        motorEquipmentResults: Array.isArray(motorEquipmentResults) ? motorEquipmentResults : [],
        motorAlternatives,
        motorCandidates,
      })
      : {
        ok: false,
        blocked: true,
        blocked_reason: 'motor_result_required',
        interpretation,
        scenario: nextScenario,
        commercial_response: null,
        generated_without_motor: false,
        autoaplica: false,
        message: 'Falta respuesta del Motor Comercial. El agente conserva contexto, pero no decide promociones.',
      };
    const turn = {
      index: current.turns.length + 1,
      query: String(query || ''),
      intent: { ...(interpretation.intent || {}), objective },
      scenario_patch: interpretation.scenario_patch || {},
      result_status: result.blocked_reason || 'evaluado',
      external_provider: false,
      autoaplica: false,
    };
    const nextSession = {
      ...current,
      scenario: nextScenario,
      turns: [...current.turns, turn],
      last_turn: turn,
      last_result: result,
      external_provider: false,
      interpreter_type: 'local_rule_based',
      autoaplica: false,
    };
    return { session: nextSession, result, turn };
  }

  function isBlockedMotorResult(item = {}) {
    const value = normalizeKey(item.estado || item.status || item.resultado || item.classification || item.clasificacion || '');
    const reasons = Array.isArray(item.motivos) ? item.motivos : (Array.isArray(item.reasons) ? item.reasons : []);
    return ['requiere_revision', 'fuente_ambigua', 'contradiccion', 'fuente_incompleta', 'no_determinado', 'bloqueada'].includes(value)
      || reasons.some(reason => ['requiere_revision', 'fuente_ambigua', 'contradiccion', 'fuente_incompleta', 'no_determinado'].includes(normalizeKey(reason)));
  }

  function summarizeMotorEquipmentResults(results = []) {
    const rows = Array.isArray(results) ? results : [];
    const summary = rows.reduce((acc, item) => {
      const key = isBlockedMotorResult(item) ? 'requiere_revision' : normalizeKey(item.resultado || item.beneficio || item.tipo_beneficio || 'regular');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const covered = rows.filter(item => !isBlockedMotorResult(item) && !['regular', 'sin_promocion'].includes(normalizeKey(item.resultado || item.beneficio || 'regular'))).length;
    const regular = rows.filter(item => !isBlockedMotorResult(item) && ['regular', 'sin_promocion'].includes(normalizeKey(item.resultado || item.beneficio || 'regular'))).length;
    const blocked = rows.filter(isBlockedMotorResult).length;
    return { total: rows.length, covered, regular, blocked, by_result: summary };
  }

  async function requestCommercialCandidates(payload = {}) {
    return request(ENDPOINTS.commercialCandidates, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  function findCommercialAlternatives({ context = {}, remainingLines = 0, preferences = {}, motorAlternatives = [], motorCandidates = null } = {}) {
    const requested = Math.max(0, Number(remainingLines || 0));
    const brand = normalizeKey(preferences.brand || preferences.marca || '');
    const productCategory = normalizeProductCategory(preferences.productCategory || preferences.categoria_producto || '');
    const objective = normalizeKey(preferences.objective || preferences.objetivo || '');
    const maxBudget = Number(preferences.maxMonthlyBudget ?? preferences.maximo_mensual ?? 0);
    const alreadyUsed = new Set((preferences.promotionsAlreadyUsed || preferences.promociones_usadas || []).map(normalizeKey));
    const sourceRows = Array.isArray(motorCandidates?.candidatos) ? motorCandidates.candidatos : motorAlternatives;

    const filtered = (Array.isArray(sourceRows) ? sourceRows : []).filter(item => {
      if (isBlockedMotorResult(item)) return false;
      if (brand && normalizeKey(item.brand || item.marca || item.fabricante) !== brand) return false;
      const itemCategory = normalizeProductCategory(item.product_category || item.categoria_producto || item.categoria || item.tipo_producto || '');
      if (productCategory && itemCategory && itemCategory !== productCategory) return false;
      if (productCategory === 'smartphone' && ['tablet', 'modem', 'mifi'].includes(itemCategory)) return false;
      if (objective.includes('gratis') && normalizeKey(item.tipo_beneficio || item.beneficio || item.resultado) !== 'gratis') return false;
      if (maxBudget > 0 && Number(item.total_monthly ?? item.total_mensual ?? item.monthly ?? item.mensualidad ?? 0) > maxBudget) return false;
      const promoId = normalizeKey(item.promotion_id || item.promo_id || item.regla_id || '');
      if (promoId && alreadyUsed.has(promoId) && item.reevaluate_required !== false) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const benefitRank = item => {
        const benefit = normalizeKey(item.tipo_beneficio || item.beneficio || item.resultado);
        if (benefit === 'gratis') return 0;
        if (benefit === 'descuento_porcentaje') return 1;
        if (benefit === 'descuento_monto') return 2;
        return 3;
      };
      const monthly = item => Number(item.monthly ?? item.mensualidad ?? item.costo_mensual ?? 999999);
      const discount = item => Number(item.descuento ?? item.discount ?? 0);
      return benefitRank(a) - benefitRank(b) || monthly(a) - monthly(b) || discount(b) - discount(a);
    });
    const grouped = new Map();
    filtered.forEach(item => {
      const normalized = {
        equipment: item.equipment || item.equipo || item.modelo || item.model || '',
        brand: item.brand || item.marca || item.fabricante || '',
        monthly: Number(item.monthly ?? item.mensualidad ?? item.costo_mensual ?? 0),
        benefit: item.benefit || item.beneficio || item.resultado || item.tipo_beneficio || '',
        source: item.source || item.fuente || item.fuente_publicacion || null,
        validity: item.validity || item.vigencia || null,
        trace: item.trace || item.traza || null,
        motor_decision_id: item.motor_decision_id || item.regla_id || item.regla_aplicada || item.id || null,
        autoaplica: false,
      };
      const sourceId = typeof normalized.source === 'string' ? normalized.source : (normalized.source?.archivo || normalized.source?.nombre_original || normalized.source?.hoja || '');
      const key = [normalizeKey(normalized.equipment), normalizeKey(normalized.benefit), normalized.monthly, sourceId, normalized.motor_decision_id].join('|');
      const current = grouped.get(key);
      if (current) {
        current.available_lines += 1;
        current.lineas.push(item.linea || item.posicion || current.lineas.length + 1);
      } else {
        grouped.set(key, { ...normalized, available_lines: 1, lineas: [item.linea || item.posicion || 1] });
      }
    });
    const alternatives = Array.from(grouped.values()).slice(0, requested || undefined).map((item, index) => ({
      linea_objetivo: index + 1,
      ...item,
    }));
    const availableLines = alternatives.reduce((sum, item) => sum + Number(item.available_lines || 0), 0);

    return {
      modo: 'consulta_motor_alternativas',
      context_version: context.version?.id || context.version?.numero || null,
      requested_lines: requested,
      found: alternatives.length,
      complete: requested === 0 || availableLines >= requested,
      alternatives,
      requiere_revision: Array.isArray(motorCandidates?.requiere_revision) ? motorCandidates.requiere_revision : [],
      blocked: requested > 0 && alternatives.length === 0,
      blocked_reason: requested > 0 && alternatives.length === 0 ? 'sin_alternativas_vigentes_motor' : null,
      autoaplica: false,
    };
  }

  function commercialMoney(value) {
    const amount = Number(value || 0);
    return `$${amount.toFixed(2)}`;
  }

  function scenarioEventLabel(value) {
    const key = normalizeKey(value);
    if (key === 'renovacion') return 'renovaciones';
    if (key === 'portabilidad') return 'portabilidades';
    if (key === 'adicional') return 'lineas adicionales';
    if (key === 'byop') return 'BYOP';
    return key || 'lineas';
  }

  function commercialBenefitName(rule = {}) {
    const raw = rule.nombre || rule.titulo || rule.beneficio || rule.identidad_comercial || rule.id || 'Benefit confirmado';
    const text = String(raw || '');
    if (!text.includes('|')) return text;
    const parts = text.split('|').filter(Boolean);
    const type = parts[1] || parts[0] || text;
    const product = parts[2] || '';
    const labels = {
      descuento_porcentaje: 'Descuento porcentual',
      doble_data: 'Doble data',
      doble_velocidad: 'Doble velocidad',
      meses_gratis: 'Meses gratis',
      bono_portabilidad: 'Bono portabilidad',
      streaming: 'Streaming',
      pago_penalidad: 'Pago de penalidad',
      descuento_accesorios: 'Descuento de accesorios',
    };
    const label = labels[type] || type.replace(/_/g, ' ');
    return product ? `${label} ${product}` : label;
  }

  function groupConsultationEquipment(scenario = {}, equipmentResults = []) {
    const requested = Array.isArray(scenario.selected_equipment) ? scenario.selected_equipment : [];
    if (requested.length) {
      return requested.map(item => ({
        modelo: item.modelo || item.equipo || item.model || item.marca || 'Equipo por confirmar',
        marca: item.marca || item.fabricante || item.brand || null,
        categoria_producto: item.categoria_producto || item.categoria || item.product_category || null,
        cantidad: Number(item.cantidad || 1),
      }));
    }
    const grouped = new Map();
    (Array.isArray(equipmentResults) ? equipmentResults : []).forEach(item => {
      const model = item.equipment || item.equipo || item.modelo || 'Equipo por confirmar';
      const key = normalizeKey(model);
      const current = grouped.get(key) || {
        modelo: model,
        marca: item.marca || item.fabricante || item.brand || null,
        categoria_producto: item.categoria_producto || item.categoria || item.product_category || null,
        cantidad: 0,
      };
      current.cantidad += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()];
  }

  function buildSimpleCommercialResponse({ scenario = {}, proposalDecision = {}, equipmentResults = [], equipmentSummary = {}, requestedLines = 0 } = {}) {
    const plan = scenario.plan || {};
    const planName = plan.nombre || plan.label || plan.codigo || 'Plan por confirmar';
    const eventText = scenarioEventLabel(scenario.event);
    const equipmentGroups = groupConsultationEquipment(scenario, equipmentResults);
    const hasSpecificEquipment = (Array.isArray(scenario.selected_equipment) ? scenario.selected_equipment : [])
      .some(item => item.modelo || item.equipo || item.categoria_producto || Number(item.cantidad || 0) > 0);
    const brandPreference = scenario.equipment_preferences?.marca || null;
    const planRegular = Number(plan.total_mensual || proposalDecision.propuesta?.total_base_mensual || 0);
    const planAutoPay = Number(plan.total_mensual_autopay || 0);
    const equipmentKnown = equipmentResults.length > 0 && equipmentResults.every(item => item.monthly != null && Number.isFinite(Number(item.monthly)));
    const equipmentNet = equipmentKnown ? equipmentResults.reduce((sum, item) => sum + Number(item.monthly || 0), 0) : null;
    const lineCount = Number(requestedLines || equipmentGroups.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) || scenario.selected_lines_count || 0);
    const equipmentText = hasSpecificEquipment && equipmentGroups.length
      ? equipmentGroups.map(item => `${Number(item.cantidad || 1)} x ${item.modelo}`).join(', ')
      : '';
    const appliedBenefits = (Array.isArray(proposalDecision.reglas_aplicadas) ? proposalDecision.reglas_aplicadas : [])
      .filter(rule => !isBlockedMotorResult(rule))
      .filter(rule => !rule.estado_confianza || rule.estado_confianza === 'confirmado')
      .map(commercialBenefitName);
    const benefitsText = appliedBenefits.length
      ? `Beneficios por convergencia: ${appliedBenefits.join(', ')}.`
      : (scenario.convergence?.estado === 'convergente'
        ? 'Beneficios por convergencia: pendientes de respuesta confirmada del Motor.'
        : 'Beneficios por convergencia: no aplican o no estan confirmados para este escenario.');
    const equipmentPromotionText = `Resumen de equipos: ${Number(equipmentSummary.covered || 0)} con beneficio, ${Number(equipmentSummary.regular || 0)} regular, ${Number(equipmentSummary.blocked || 0)} en revision.`;
    const parts = [
      `Para las ${lineCount || 'lineas'} ${eventText} en ${planName}${equipmentText ? `, con ${equipmentText}` : ''}, esto te queda asi:`,
      brandPreference && !hasSpecificEquipment
        ? `Equipos: preferencia ${brandPreference}; el Motor debe proponer equipos vigentes.`
        : equipmentGroups.length
        ? `Equipos: ${equipmentGroups.map(item => `${Number(item.cantidad || 1)} x ${item.modelo}`).join(', ')}.`
        : 'Equipos: pendiente de seleccion.',
      planAutoPay && planAutoPay !== planRegular
        ? `Mensualidad: Plan sin AutoPay: ${commercialMoney(planRegular)}. Plan con AutoPay: ${commercialMoney(planAutoPay)}.`
        : `Mensualidad: Plan: ${planRegular ? commercialMoney(planRegular) : 'pendiente de completar'}.`,
      `Equipos netos: ${equipmentNet == null ? 'pendiente de completar' : commercialMoney(equipmentNet)}.`,
      equipmentPromotionText,
      benefitsText,
    ];
    return {
      title: 'Cotizacion',
      summary_text: parts.join('\n'),
      plan: {
        nombre: planName,
        regular: planRegular || null,
        autopay: planAutoPay || null,
        autopay_assumed: false,
      },
      equipos: equipmentGroups,
      equipment_net_monthly: equipmentNet,
      recommendation: proposalDecision.recomendacion?.texto || 'Revisar resultado del Motor Comercial en modo simulacion.',
      autoaplica: false,
    };
  }

  function confirmedAppliedBenefitsFromConsultation(result = {}) {
    const appliedRules = Array.isArray(result.motor?.proposal?.reglas_aplicadas) ? result.motor.proposal.reglas_aplicadas : [];
    return appliedRules
      .filter(rule => !isBlockedMotorResult(rule))
      .filter(rule => !rule.estado_confianza || rule.estado_confianza === 'confirmado')
      .map(rule => ({
        id: rule.identidad_comercial || rule.id || rule.regla_id || null,
        nombre: rule.nombre || rule.titulo || rule.beneficio || rule.identidad_comercial || rule.id || 'Benefit confirmado',
        fuente: rule.fuente || rule.fuente_publicacion || rule.trace || null,
        vigencia: rule.vigencia || rule.vigencia_documental || null,
        confidence: rule.estado_confianza || 'confirmado',
      }));
  }

  function buildConsultationComparisonPayload({ result = null, clientId = null, currentRows = [], status = 'borrador', expectedFingerprint = null, currentFingerprint = null } = {}) {
    if (!result || result.blocked || !result.scenario || !result.motor) {
      throw new Error('consulta_comparativa_bloqueada');
    }
    if (expectedFingerprint && currentFingerprint && expectedFingerprint !== currentFingerprint) {
      throw new Error('consulta_comparativa_mismatch');
    }
    const scenario = result.scenario;
    const commercial = result.commercial_response || buildSimpleCommercialResponse({
      scenario,
      proposalDecision: result.motor?.proposal || {},
      equipmentResults: result.motor?.equipment_results || [],
      equipmentSummary: result.motor?.equipment_summary || {},
      requestedLines: result.selection?.requested_lines || countScenarioLines(scenario),
    });
    const equipmentRows = groupConsultationEquipment(scenario, result.motor?.equipment_results || []);
    const planTotal = Number(commercial.plan?.regular || scenario.plan?.total_mensual || result.baseProposal?.precio_base_mensual || 0);
    const equipmentTotal = commercial.equipment_net_monthly == null
      ? Number(result.baseProposal?.equipo_mensual || 0)
      : Number(commercial.equipment_net_monthly || 0);
    const offerTotal = Number(result.motor?.proposal?.propuesta?.total_estimado_mensual ?? (planTotal + equipmentTotal));
    const currentTotal = (Array.isArray(currentRows) ? currentRows : []).reduce((sum, row) => sum + Number(row.costo || row.current_rent || row.total || 0), 0);
    return {
      client_id: clientId || scenario.client?.id || null,
      name: `${status === 'cerrada' ? 'Comparativa cerrada' : 'Borrador comparativa'} - ${scenario.client?.name || 'Cliente'} - Consulta Comercial`,
      current_total: currentTotal,
      offer_total: offerTotal,
      lines: Array.isArray(currentRows) ? currentRows : [],
      notes: `Estado: ${status}. Origen: Consulta Comercial. Motor en modo sombra; autoaplica=false.`,
      source: 'constructor_agente_comercial',
      payload: {
        status,
        comparison_source: 'comparativas_existente',
        recalculate_in_comparativa: false,
        scenario,
        commercial_response: commercial,
        commercial_decision: result.motor?.proposal || null,
        propuesta: {
          plan: commercial.plan,
          equipos: equipmentRows,
          total_mensual_estimado: offerTotal,
          diferencia_mensual: Number.isFinite(currentTotal) && currentTotal > 0 ? offerTotal - currentTotal : null,
        },
        beneficios_aplicados: confirmedAppliedBenefitsFromConsultation(result),
        beneficios_revision: [
          ...((Array.isArray(result.alternatives?.requiere_revision) ? result.alternatives.requiere_revision : [])),
          ...((Array.isArray(result.motor?.equipment_results) ? result.motor.equipment_results : []).filter(isBlockedMotorResult)),
        ],
        motor: result.motor,
        alternatives: result.alternatives || null,
        autoaplica: false,
      },
    };
  }

  function evaluateCommercialConsultation(options = {}) {
    const {
    query = '',
    scenario = {},
    version = null,
    rules = [],
    motorDecision = null,
    motorEquipmentResults = null,
    motorAlternatives = [],
    motorCandidates = null,
    } = options;
    const interpretation = interpretCommercialConsultation({ query, scenario });
    const consultationScenario = applyConsultationIntentToScenario({ scenario, interpretation });
    if (interpretation.clarification_required) {
      return {
        ok: false,
        blocked: true,
        blocked_reason: 'clarificacion_requerida',
        clarification_questions: interpretation.clarification_questions,
        interpretation,
        scenario: consultationScenario,
        commercial_response: null,
        generated_without_motor: false,
        autoaplica: false,
      };
    }
    const hasMotorDecision = Boolean(motorDecision) || Object.prototype.hasOwnProperty.call(options, 'rules');
    const hasEquipmentDecision = Array.isArray(motorEquipmentResults);
    if (!hasMotorDecision && !hasEquipmentDecision) {
      return {
        ok: false,
        blocked: true,
        blocked_reason: 'motor_result_required',
        interpretation,
        scenario: consultationScenario,
        commercial_response: null,
        generated_without_motor: false,
        autoaplica: false,
      };
    }

    const baseProposal = buildBaseProposalFromCommercialScenario(consultationScenario);
    const proposalDecision = motorDecision || evaluateCommercialProposal({ version, rules, baseProposal });
    const equipmentResults = Array.isArray(motorEquipmentResults) ? motorEquipmentResults : [];
    const equipmentSummary = summarizeMotorEquipmentResults(equipmentResults);
    const requestedLines = interpretation.intent.requested_lines || countScenarioLines(consultationScenario);
    const remainingLines = Math.max(0, requestedLines - equipmentSummary.covered);
    const alternatives = findCommercialAlternatives({
      context: { scenario: consultationScenario, version },
      remainingLines,
      preferences: {
        brand: interpretation.intent.brand_preference,
        objective: interpretation.intent.objective,
        maxMonthlyBudget: interpretation.intent.max_monthly_budget,
        productCategory: interpretation.scenario_patch.equipment_preferences?.categoria_producto,
      },
      motorAlternatives,
      motorCandidates,
    });
    const blockedItems = equipmentResults.filter(isBlockedMotorResult);
    const ambiguousRules = [
      ...(proposalDecision.reglas_descartadas || []).filter(item => (item.motivos || []).some(reason => ['dato_no_determinado', 'fuente_ambigua', 'requiere_revision'].includes(normalizeKey(reason)))),
      ...blockedItems,
    ];
    const commercialResponse = buildSimpleCommercialResponse({
      scenario: consultationScenario,
      proposalDecision,
      equipmentResults,
      equipmentSummary,
      requestedLines,
    });

    return {
      ok: true,
      blocked: Boolean(ambiguousRules.length),
      blocked_reason: ambiguousRules.length ? 'requiere_revision_comercial' : null,
      interpretation,
      scenario: consultationScenario,
      baseProposal,
      motor: {
        version,
        proposal: proposalDecision,
        equipment_results: equipmentResults,
        equipment_summary: equipmentSummary,
      },
      selection: {
        requested_lines: requestedLines,
        equipment: interpretation.intent.primary_equipment || interpretation.intent.brand_preference || 'no_determinado',
        remaining_lines: remainingLines,
      },
      alternatives,
      actions: ['Modificar propuesta', 'Ver alternativas', 'Enviar a Comparativa', 'Cargar al Constructor', 'Ver detalles'],
      explanations: equipmentResults.map(item => ({
        line: item.linea || item.line || null,
        text: item.explanation || item.explicacion || item.motivo || 'Decision recibida del Motor Comercial.',
        source: item.source || item.fuente || null,
        validity: item.validity || item.vigencia || null,
        trace: item.trace || item.traza || null,
        blocked: isBlockedMotorResult(item),
      })),
      commercial_response: commercialResponse,
      generated_without_motor: false,
      autoaplica: false,
    };
  }

  function compareCommercialDecisionTransition({ currentDecision = null, motorDecision = null } = {}) {
    const current = currentDecision || buildManualCommercialDecision();
    const motor = motorDecision || buildManualCommercialDecision({ source: 'motor_comercial' });
    const differences = [
      compareValue('plan_mensual', current.totals?.plan_mensual, motor.totals?.plan_mensual, 'plan'),
      compareValue('equipo_mensual', current.totals?.equipo_mensual, motor.totals?.equipo_mensual, 'equipo'),
      compareValue('equipo_regular', current.totals?.equipo_regular, motor.totals?.equipo_regular, 'equipo'),
      compareList('benefit', [current.benefit?.tipo], [motor.benefit?.tipo]),
    ].filter(item => item.cambia);
    return {
      modo: 'transicion_fuente_principal',
      autoaplica: false,
      ready_for_definitive_source: differences.length === 0 && motor.source === 'motor_comercial',
      current,
      motor,
      diferencias: differences,
      fallback: {
        available: current.source === 'flujo_anterior_fallback',
        source: current.source,
      },
    };
  }

  function evaluateCommercialShadowProposal({ version = null, rules = [], currentProposal = {}, baseProposal = {} } = {}) {
    const motor = evaluateCommercialProposal({ version, rules, baseProposal });
    const actualTotal = Number(currentProposal.totalOferta ?? currentProposal.total_flujo_actual ?? 0);
    const actualDiscount = Number(currentProposal.descuento_mensual_estimado || 0);
    const motorTotal = Number(motor.propuesta.total_estimado_mensual || 0);
    const appliedRuleIds = motor.reglas_aplicadas.map(rule => rule.identidad_comercial || rule.id).filter(Boolean);
    const currentBenefitIds = currentProposal.beneficios || currentProposal.reglas_aplicadas || [];
    const differences = [
      compareValue('plan', currentProposal.planCosto ?? currentProposal.plan_total, baseProposal.precio_base_mensual, 'plan'),
      compareValue('equipo', currentProposal.equipoCosto ?? currentProposal.equipo_total, baseProposal.equipo_mensual, 'equipo'),
      compareValue('descuentos', actualDiscount, motor.propuesta.descuento_mensual_estimado, 'descuento'),
      compareValue('total', actualTotal, motorTotal, 'total'),
      compareList('benefits', currentBenefitIds, appliedRuleIds),
    ];

    return {
      modo: 'sombra',
      autoaplica: false,
      version,
      actual: {
        total_actual_cliente: Number(currentProposal.totalActual ?? currentProposal.total_actual_cliente ?? 0),
        total_flujo_actual: actualTotal,
        plan_total: Number(currentProposal.planCosto ?? currentProposal.plan_total ?? 0),
        equipo_total: Number(currentProposal.equipoCosto ?? currentProposal.equipo_total ?? 0),
        productos_total: Number(currentProposal.productosCosto ?? currentProposal.productos_total ?? 0),
        descuento_mensual_estimado: actualDiscount,
        beneficios: currentBenefitIds,
      },
      motor: {
        total_base_mensual: motor.propuesta.total_base_mensual,
        descuento_mensual_estimado: motor.propuesta.descuento_mensual_estimado,
        total_estimado_mensual: motorTotal,
        bloqueada: motor.propuesta.bloqueada,
        reglas_aplicadas: motor.reglas_aplicadas,
        reglas_descartadas: motor.reglas_descartadas,
        combinaciones: motor.combinaciones,
        recomendacion: motor.recomendacion,
        alternativas: motor.alternativas,
      },
      diferencias: differences.filter(item => item.cambia),
      todas_las_comparaciones: differences,
    };
  }

  // candidatos-alternativas es una accion (POST) que se pide al buscar alternativas, no una publicacion:
  // no se carga al abrir el Constructor.
  const ACTION_ENDPOINTS = new Set(['commercialCandidates']);

  async function load() {
    const publicaciones = Object.entries(ENDPOINTS).filter(([key]) => !ACTION_ENDPOINTS.has(key));
    const entries = await Promise.all(publicaciones.map(async ([key, endpoint]) => {
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
    const commercialRules = result.commercialRules.ok
      ? commercialRulesFromPayload(result.commercialRules.payload)
      : { version: null, rules: [] };

    return {
      status: result,
      offers,
      offersVersion: version || null,
      equipment,
      mobileCatalog: mobileCatalog(mobileModules),
      fixedGroups: productGroups(fixedModules, 'Fijo'),
      tvGroups: productGroups(tvModules, 'Claro TV'),
      motorRulesVersion: commercialRules.version,
      motorRules: commercialRules.rules,
      ready: Boolean(version && mobileModules.length && equipment.length && offers.some(offer => offer.equipos.length)),
    };
  }

  global.ConstructorPublications = Object.freeze({
    ENDPOINTS,
    load,
    mobileCatalog,
    productGroups,
    publishedEquipment,
    reconcileOffers,
    equipmentKey,
    commercialRulesFromPayload,
    buildCommercialScenario,
    buildBaseProposalFromCommercialScenario,
    interpretCommercialConsultation,
    applyConsultationIntentToScenario,
    createCommercialAgentSession,
    applyCommercialAgentTurn,
    summarizeMotorEquipmentResults,
    findCommercialAlternatives,
    requestCommercialCandidates,
    buildConsultationComparisonPayload,
    evaluateCommercialConsultation,
    buildManualCommercialDecision,
    compareCommercialDecisionTransition,
    evaluateCommercialRulesSimulation,
    evaluateCommercialProposal,
    evaluateCommercialShadowProposal,
  });
})(window);
