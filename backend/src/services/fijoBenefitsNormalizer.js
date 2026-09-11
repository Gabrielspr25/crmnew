import { parseRangoVigencia } from './vigenciaTexto.js';

const ACCENTS = /[\u0300-\u036f]/g;

function text(value) {
  return String(value ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function fold(value) {
  return text(value).normalize('NFD').replace(ACCENTS, '').toLowerCase();
}

function parseMoney(value) {
  const source = String(value ?? '').replace(/,/g, '');
  const withDollar = [...source.matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (withDollar.length) return withDollar[withDollar.length - 1];
  const match = source.match(/\b(\d+(?:\.\d+)?)\b/);
  return match ? Number(match[1]) : null;
}

function parsePercent(value) {
  const match = String(value ?? '').match(/(\d{1,3})\s*%/);
  return match ? Number(match[1]) : null;
}

function sourceInfo(source = {}) {
  return {
    id: source.id || null,
    familia: source.familia || null,
    nombre_original: source.nombre_original || null,
    sha256: source.sha256 || null,
  };
}

function splitPages(rawText) {
  const source = String(rawText || '');
  if (!source.trim()) return [];
  const parts = source.split(/===== PAGE\s+(\d+)\s+=====/i);
  if (parts.length === 1) return [{ page: null, text: source }];
  const pages = [];
  for (let index = 1; index < parts.length; index += 2) {
    pages.push({ page: Number(parts[index]), text: parts[index + 1] || '' });
  }
  return pages;
}

// Solo se toma la vigencia anclada a "Válido ..." para no confundir periodos de promociones citados en el texto.
export function detectVigencia(rawText) {
  const source = fold(rawText);
  const anchored = source.match(/valido[\s\S]{0,90}/);
  if (!anchored) return { desde: null, hasta: null };
  const parsed = parseRangoVigencia(anchored[0], { defaultYear: source.match(/20\d{2}/)?.[0] || null });
  return parsed ? { desde: parsed.desde, hasta: parsed.hasta } : { desde: null, hasta: null };
}

function detectProducts(rawText) {
  const source = fold(rawText);
  const products = [];
  if (/accesorios|computadoras|tablets/.test(source)) products.push('accesorio');
  if (/fijo|telefonia|internet fijo|2play|3play/.test(source)) products.push('fijo');
  if (/movil|pospago|financiamiento|internet on[- ]?the[- ]?go/.test(source)) products.push('movil');
  if (/claro\s*tv|clarotv|tv streaming|stb/.test(source)) products.push('claro_tv');
  if (/claro oficina|fwa|inalambrico|iot/.test(source)) products.push('inalambrico_iot');
  return [...new Set(products)];
}

function detectConditions(rawText, block = {}) {
  const source = fold(rawText);
  const conditions = {
    convergencia: block.requiresConvergence || /convergente|convergencia|claro full/.test(source) ? 'requerida' : 'no_determinado',
    contrato_meses: source.match(/contrato\s+de\s+(\d{1,2})\s+meses/)?.[1] ? Number(source.match(/contrato\s+de\s+(\d{1,2})\s+meses/)[1]) : null,
    plan_minimo: null,
    eventos: [],
    nivel_aplicacion: 'no_determinado',
    compatibilidad: block.compatibilidad || block.compatibility || 'no_determinado',
    limite: block.limit || null,
  };
  const planMin = source.match(/plan(?:es)?[^.\n]{0,80}?\s+de\s+\$\s*(\d+(?:\.\d+)?)/)
    || source.match(/desde\s+\$\s*(\d+(?:\.\d+)?)/);
  if (planMin) conditions.plan_minimo = Number(planMin[1]);
  if (/cliente nuevo|clientes nuevos|activaciones nuevas/.test(source)) conditions.eventos.push('cliente_nuevo');
  if (/existente|clientes existentes/.test(source)) conditions.eventos.push('cliente_existente');
  if (/portabilidad|portar/.test(source)) conditions.eventos.push('portabilidad');
  if (/renovacion|renovaciones/.test(source)) conditions.eventos.push('renovacion');
  if (/ban/.test(source)) conditions.nivel_aplicacion = 'BAN';
  else if (/linea/.test(source)) conditions.nivel_aplicacion = 'linea';
  else if (/cliente/.test(source)) conditions.nivel_aplicacion = 'cliente';
  else if (/equipo|accesorio|tablet/.test(source)) conditions.nivel_aplicacion = 'producto';
  if (/pueden ser combinados|aplican y pueden ser combinados|acumula/.test(source)) conditions.compatibilidad = 'acumula';
  if (/escoger entre|no acumula|incompatible/.test(source)) conditions.compatibilidad = /escoger entre/.test(source) ? 'no_acumula' : 'incompatible';
  const max = source.match(/(?:maximo|hasta)\s+(?:de\s+)?(\d{1,2})\s+(lineas?|beneficios?|equipos?)/);
  if (max) conditions.limite = { cantidad: Number(max[1]), unidad: max[2] };
  if (/(?:solo|s[oó]lo)\s+aplica\s+un\s+bono(?:\s+de\s+\$?\s*\d+(?:\.\d+)?)?\s+por\s+ban/.test(source)) {
    conditions.limite = { cantidad: 1, unidad: 'BAN' };
  }
  return conditions;
}

function detectBenefit(rawText) {
  const source = fold(rawText);
  const percent = parsePercent(rawText);
  if (/3\s+meses gratis|tres\s*\(3\)\s*meses gratis|meses gratis/.test(source)) return { tipo: 'meses_gratis', meses: 3 };
  if (/1000\/1000|1000 megas/.test(source) && /6\s+meses/.test(source)) return { tipo: 'velocidad_gratis', velocidad: '1000/1000', meses: 6 };
  if (/doble\/?proxima velocidad|doble de velocidad|proxima velocidad/.test(source)) return { tipo: 'doble_velocidad' };
  if (/doble de data/.test(source)) return { tipo: 'doble_data' };
  if (/bono.*streaming|streaming/.test(source)) return { tipo: 'bono_streaming', monto: parseMoney(rawText) };
  if (/bono.*portabilidad|portabilidad/.test(source)) return { tipo: 'bono_portabilidad', monto: parseMoney(rawText) };
  if (/penalidad/.test(source)) return { tipo: 'pago_penalidad', monto: parseMoney(rawText) };
  if (/super bundle|affinity/.test(source) && percent != null) return { tipo: 'descuento_affinity', porcentaje: percent };
  if (/affinity/.test(source) && /\$\s*\d/.test(rawText)) {
    const descuento = String(rawText).replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)\s*(?:de\s+)?descuento/i);
    return { tipo: 'descuento_affinity', monto: descuento ? Number(descuento[1]) : parseMoney(rawText) };
  }
  if (/acceso exclusivo a ofertas especiales|ofertas especiales/.test(source)) return { tipo: 'acceso_ofertas_especiales' };
  if (percent != null && /accesorios|computadoras|tablets/.test(source)) return { tipo: 'descuento_accesorios', porcentaje: percent };
  if (/\$0\s+cargo de activacion|activacion gratis|activacion gratuita/.test(source)) return { tipo: 'activacion_gratis' };
  if (/gratis/.test(source)) return { tipo: 'gratis' };
  if (/descuento/.test(source) && percent != null) return { tipo: 'descuento_porcentaje', porcentaje: percent };
  return { tipo: 'no_determinado' };
}

function ruleTypeForBlock(block, source = {}) {
  const combined = fold(`${block.title}\n${block.body}`);
  const title = fold(block.title);
  const benefit = detectBenefit(`${block.title}\n${block.body}`);
  if (/nuevo precio|precio regular nuevo|cambio oficial.*precio|actualizacion de precio/.test(combined)) return 'cambio_precio_oficial';
  if (
    block.section === 'terminos_condiciones' ||
    /terminos|condiciones|restricciones|requisitos/.test(title) ||
    /^(?:\d+\.\s*)?(?:aplica|esta oferta|el bono|el beneficio|los tres|los cr[eé]ditos|si el cliente|requiere verificacion|clientes que no tengan|cargos de instalacion|puj|boosters|cliente movil|cliente fijo|cliente nuevo|para solicitar|solo aplica|s[oó]lo aplica)/.test(title) ||
    /account\s*types|cambia de ban|baja la renta|hasta 30 dias|s[oó]lo puede solicitar|solo aplica un bono|una solicitud por cada|price codes|garantia|no aplica/.test(title)
  ) return 'terminos';
  if (source.familia === 'affinity') {
    return benefit.tipo !== 'no_determinado' || /affinity|descuento|beneficio|bono/.test(combined) ? 'beneficio' : 'revision_manual';
  }
  if (source.familia === 'ofertas_fijo' && benefit.tipo !== 'no_determinado') return 'oferta_temporal';
  if (source.familia === 'ofertas_fijo' && /oferta|promocion|gratis|descuento|bono|credito|2play|3play/.test(combined)) return 'oferta_temporal';
  if (source.familia === 'beneficios' || /beneficio|claro full|convergencia|convergente/.test(combined)) return 'beneficio';
  if (/oferta|promocion|gratis|descuento|bono|credito|2play|3play/.test(combined)) return 'oferta_temporal';
  return 'revision_manual';
}

function confidenceFor({ tipoRegla, beneficio, conditions, source = {} }) {
  if (tipoRegla === 'revision_manual') return 'requiere_revision';
  if (tipoRegla === 'terminos') return 'confirmado';
  if (beneficio.tipo === 'no_determinado') return 'requiere_revision';
  // Affinity no depende de convergencia: el valor del beneficio viene explicito y los terminos gatean la compuesta.
  if (source.familia === 'affinity') return 'confirmado';
  if (conditions.convergencia === 'no_determinado' && !conditions.eventos.length) return 'requiere_revision';
  return 'confirmado';
}

function actionFor(tipoRegla) {
  if (tipoRegla === 'cambio_precio_oficial') return 'versionar_precio_base';
  if (tipoRegla === 'terminos') return 'vincular_terminos';
  if (tipoRegla === 'beneficio') return 'publicar_beneficio';
  if (tipoRegla === 'oferta_temporal') return 'publicar_oferta_temporal';
  return 'revision_manual';
}

function blockKey(title, body, index) {
  const normalized = fold(`${title} ${body}`)
    .replace(/\$?\s*\d+(?:\.\d+)?\s*(?:%|dolares?)?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || `bloque-${index + 1}`;
}

function ruleFromBlock({ block, source, index }) {
  const tipoRegla = ruleTypeForBlock(block, source);
  const fullText = `${block.contextTitle || ''}\n${block.title}\n${block.body}`;
  const beneficio = detectBenefit(fullText);
  const conditions = detectConditions(fullText, block);
  const products = detectProducts(fullText);
  const estadoConfianza = confidenceFor({ tipoRegla, beneficio, conditions, source });
  const key = blockKey(block.title, block.body, index);
  return {
    fuente_comercial_id: source.id || null,
    seccion_origen: block.section || 'texto_extraido',
    tipo_regla: tipoRegla,
    familia: source.familia || 'ofertas_fijo',
    producto: products[0] || 'no_determinado',
    codigo: key,
    nombre: block.title || key,
    llave_comercial: [
      source.familia || 'ofertas_fijo',
      tipoRegla,
      products.join(',') || 'producto_no_determinado',
      beneficio.tipo,
      conditions.convergencia,
      key,
    ].join('|'),
    valor: {
      beneficio,
      productos_afectados: products,
      texto_detectado: text(block.title),
    },
    condiciones: conditions,
    accion: actionFor(tipoRegla),
    prioridad: tipoRegla === 'beneficio' ? 30 : 25,
    vigencia_desde: block.vigencia?.desde ?? null,
    vigencia_hasta: block.vigencia?.hasta ?? null,
    estado_confianza: estadoConfianza,
    estado_publicacion: 'borrador',
    estado_comercial: block.vigencia?.hasta ? 'vigente' : 'vigente_por_reemplazo_pendiente',
    aplicacion_automatica: false,
    traza: {
      fuente: sourceInfo(source),
      pagina: block.page ?? null,
      texto_original: text(`${block.title}\n${block.body}`),
    },
  };
}

function termText(regla) {
  return fold(`${regla.nombre}\n${regla.traza?.texto_original || ''}`);
}

function termMatchesBenefit(term, benefit) {
  const source = termText(term);
  const tipo = benefit.valor.beneficio.tipo;
  if (tipo !== 'no_determinado' && term.valor?.beneficio?.tipo === tipo) return true;
  if (/definicion oficial de cliente convergente|que es un cliente convergente/.test(source)) {
    return benefit.condiciones.convergencia === 'requerida';
  }
  if (tipo === 'meses_gratis') return /3 meses gratis|tres\s*\(3\)\s*meses gratis|renta del plan.*60/.test(source);
  if (tipo === 'pago_penalidad') return /penalidad/.test(source);
  if (tipo === 'bono_portabilidad') return /portabilidad/.test(source) && !/streaming/.test(source);
  if (tipo === 'doble_velocidad') return /doble\/?proxima velocidad|doble de velocidad|proxima velocidad/.test(source);
  if (tipo === 'doble_data') return /doble de data|internet on[- ]?the[- ]?go|claro oficina/.test(source);
  if (tipo === 'bono_streaming') return /streaming/.test(source);
  if (tipo === 'descuento_affinity') return /affinity|super bundle/.test(source);
  if (tipo === 'descuento_porcentaje' && /internet on[- ]?the[- ]?go/.test(fold(benefit.nombre))) {
    return /internet on[- ]?the[- ]?go|fwa|modem|equipo/.test(source) && /descuento|credito|price code|financiamiento/.test(source);
  }
  if (tipo === 'descuento_accesorios') return /accesorios|computadoras|tablets/.test(source) && /terminos|condiciones|descuento/.test(source);
  return false;
}

function mergeConditions(benefit, terms) {
  const merged = {
    ...benefit.condiciones,
    eventos: [...benefit.condiciones.eventos],
    limite: benefit.condiciones.limite,
  };

  for (const term of terms) {
    const conditions = term.condiciones || {};
    if (conditions.convergencia === 'requerida') merged.convergencia = 'requerida';
    if (merged.contrato_meses == null && conditions.contrato_meses != null) merged.contrato_meses = conditions.contrato_meses;
    if (merged.plan_minimo == null && conditions.plan_minimo != null) merged.plan_minimo = conditions.plan_minimo;
    if (merged.nivel_aplicacion === 'no_determinado' && conditions.nivel_aplicacion !== 'no_determinado') {
      merged.nivel_aplicacion = conditions.nivel_aplicacion;
    }
    if (!merged.limite && conditions.limite) merged.limite = conditions.limite;
    for (const event of conditions.eventos || []) {
      if (!merged.eventos.includes(event)) merged.eventos.push(event);
    }
    if (conditions.compatibilidad === 'incompatible') merged.compatibilidad = 'incompatible';
    else if (conditions.compatibilidad === 'no_acumula' && merged.compatibilidad !== 'incompatible') merged.compatibilidad = 'no_acumula';
    else if (conditions.compatibilidad === 'acumula' && merged.compatibilidad === 'no_determinado') merged.compatibilidad = 'acumula';
  }

  return merged;
}

// Affinity tiene su propio modulo, su boletin oficial y su dominio (affinity_benefits). Si el boletin de
// convergencia lo menciona de paso, esa mencion no se publica como regla: duplicaria el beneficio en el
// portal con menos condiciones que la fuente dedicada.
const DOMINIO_PROPIO = new Set(['descuento_affinity']);

function composeBenefitRules(reglas) {
  const benefits = reglas
    .filter((regla) => ['beneficio', 'oferta_temporal'].includes(regla.tipo_regla))
    .filter((regla) => !DOMINIO_PROPIO.has(regla.valor?.beneficio?.tipo));
  const terms = reglas.filter((regla) => regla.tipo_regla === 'terminos');
  const relacionesAmbiguas = [];
  const compuestas = benefits.map((benefit) => {
    const linkedTerms = terms.filter((term) => termMatchesBenefit(term, benefit));
    const motivosRevision = [];
    if (!linkedTerms.length) motivosRevision.push('sin_terminos_vinculados');
    if (benefit.estado_confianza !== 'confirmado') motivosRevision.push(benefit.estado_confianza);
    const estadoConfianza = motivosRevision.length ? 'requiere_revision' : 'confirmado';
    if (motivosRevision.length) {
      relacionesAmbiguas.push({
        llave_beneficio: benefit.llave_comercial,
        beneficio: benefit.valor.beneficio,
        motivo: motivosRevision[0],
        pagina: benefit.traza?.pagina ?? null,
      });
    }

    return {
      llave_comercial: `${benefit.llave_comercial}|compuesta`,
      beneficio_regla_id: benefit.codigo,
      beneficio: benefit.valor.beneficio,
      producto: benefit.producto,
      productos_afectados: benefit.valor.productos_afectados,
      condiciones: mergeConditions(benefit, linkedTerms),
      terminos_vinculados: linkedTerms.map((term) => ({
        llave_comercial: term.llave_comercial,
        codigo: term.codigo,
        nombre: term.nombre,
        pagina: term.traza?.pagina ?? null,
        condiciones: term.condiciones,
        estado_confianza: term.estado_confianza,
      })),
      estado_confianza: estadoConfianza,
      motivos_revision: motivosRevision,
      aplicacion_automatica: false,
      traza: {
        fuente: benefit.traza?.fuente || {},
        beneficio: {
          pagina: benefit.traza?.pagina ?? null,
          texto_original: benefit.traza?.texto_original || '',
        },
        terminos: linkedTerms.map((term) => ({
          pagina: term.traza?.pagina ?? null,
          texto_original: term.traza?.texto_original || '',
        })),
      },
    };
  });

  return { compuestas, relacionesAmbiguas };
}

function offerBlocksFromPage(page, vigencia) {
  const raw = page.text || '';
  const normalized = raw.replace(/\r/g, '');
  if (/Beneficios de Claro Full PYMES para Clientes Convergentes:/i.test(normalized)) return [];
  if (/¿?Qu[eé] es un cliente convergente/i.test(normalized)) {
    return [{ page: page.page, title: 'Definicion oficial de cliente convergente', body: text(normalized), section: 'terminos_condiciones', vigencia }];
  }
  const termsPage = /t[ée]rminos\s+y\s+condiciones/i.test(normalized);
  const contextTitle = termsPage ? text(normalized.split(/t[ée]rminos\s+y\s+condiciones/i)[0].split('\n').slice(0, 8).join(' ')) : '';
  const matches = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+([A-ZÁÉÍÓÚÑ0-9][^\n]+)([\s\S]*?)(?=(?:\n\s*\d{1,2}\.\s+[A-ZÁÉÍÓÚÑ0-9])|$)/g)];
  if (matches.length) {
    return matches
      .map((match) => ({
        page: page.page,
        title: `${match[1]}. ${text(match[2])}`,
        body: text(match[3]),
        section: termsPage ? 'terminos_condiciones' : 'ofertas_y_promociones',
        contextTitle,
        vigencia,
      }))
      .filter((block) => termsPage || /promocion|oferta|beneficio|convergente|gratis|descuento|bono/i.test(`${block.title}\n${block.body}`));
  }
  if (/beneficios de claro full|beneficios de convergencia/i.test(normalized)) {
    return [{ page: page.page, title: 'Beneficios de Claro Full PYMES', body: text(normalized), section: 'beneficios_convergencia', vigencia }];
  }
  return [];
}

function benefitListBlocks(rawText, vigencia) {
  const source = String(rawText || '');
  const match = source.match(/Beneficios de Claro Full PYMES para Clientes Convergentes:([\s\S]*?)(Todos estos beneficios[\s\S]*?)(?====== PAGE|\nCON CLARO|$)/i);
  if (!match) return [];
  return [...match[1].matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+([\s\S]*?)(?=(?:\n\s*\d{1,2}\.\s+)|$)/g)]
    .map((item) => ({
      page: 3,
      title: `${item[1]}. ${text(item[2].split('\n')[0])}`,
      body: text(item[2]),
      section: 'beneficios_claro_full',
      vigencia,
      requiresConvergence: true,
      compatibility: item[1] === '8' && /escoger una/i.test(match[2]) ? 'no_acumula' : 'acumula',
    }))
    .filter((block) => block.body);
}

// Cuando una pagina no tiene bloques numerados, pageBlockFallback permite tomar la pagina completa como un bloque
// (titulo = primera linea) solo si su texto coincide; blockFilter descarta bloques ajenos al dominio antes de componer.
function fallbackPageBlocks(pages, pattern, vigencia) {
  return pages
    .filter((page) => pattern.test(page.text || ''))
    .map((page) => {
      const lines = String(page.text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
      return { page: page.page, title: lines[0] || `Pagina ${page.page || ''}`.trim(), body: text(lines.slice(1).join(' ')), section: 'texto_extraido', vigencia };
    })
    .filter((block) => block.body || block.title);
}

export function normalizeFijoOfferBenefitSources(sources = [], { pageBlockFallback = null, blockFilter = null } = {}) {
  const reglas = [];
  const advertencias = [];

  for (const entry of sources) {
    const source = entry.fuente || entry.source || {};
    const rawText = String(entry.text || entry.texto || '');
    const vigencia = {
      desde: source.vigencia_desde || detectVigencia(rawText).desde,
      hasta: source.vigencia_hasta || detectVigencia(rawText).hasta,
    };
    const pages = splitPages(rawText);
    const listBlocks = benefitListBlocks(rawText, vigencia);
    const pageBlocks = pages.flatMap((page) => offerBlocksFromPage(page, vigencia));
    let blocks = [...listBlocks, ...pageBlocks];
    if (!blocks.length && pageBlockFallback) blocks = fallbackPageBlocks(pages, pageBlockFallback, vigencia);
    if (blockFilter) blocks = blocks.filter(blockFilter);

    if (!blocks.length) {
      advertencias.push({
        codigo: 'sin_bloques_oferta_beneficio',
        fuente: sourceInfo(source),
        bloqueante: false,
      });
      continue;
    }

    reglas.push(...blocks.map((block, index) => ruleFromBlock({ block, source, index })));
  }

  const beneficios = reglas
    .filter((regla) => ['beneficio', 'oferta_temporal'].includes(regla.tipo_regla))
    .filter((regla) => !DOMINIO_PROPIO.has(regla.valor?.beneficio?.tipo));
  const derivadasAOtroDominio = reglas.filter((regla) => DOMINIO_PROPIO.has(regla.valor?.beneficio?.tipo));
  for (const regla of derivadasAOtroDominio) {
    advertencias.push({
      codigo: 'beneficio_de_dominio_propio_omitido',
      detalle: `"${regla.nombre}" menciona un beneficio Affinity: se publica desde el modulo Affinity con su boletin oficial, no desde esta fuente.`,
      llave_comercial: regla.llave_comercial,
      bloqueante: false,
    });
  }
  const reglasCompuestas = composeBenefitRules(reglas);
  return {
    reglas_normalizadas: reglas,
    reglas_compuestas: reglasCompuestas.compuestas,
    benefits: beneficios.map((regla) => ({
      llave_comercial: regla.llave_comercial,
      beneficio: regla.valor.beneficio,
      productos_afectados: regla.valor.productos_afectados,
      condiciones: regla.condiciones,
      fuente_comercial_id: regla.fuente_comercial_id,
      estado_confianza: regla.estado_confianza,
      aplicacion_automatica: regla.aplicacion_automatica,
    })),
    contradicciones: reglas
      .filter((regla) => regla.estado_confianza !== 'confirmado')
      .map((regla) => ({
        codigo: regla.estado_confianza,
        llave_comercial: regla.llave_comercial,
        estado: 'abierta',
        bloqueante: true,
      })),
    relaciones_ambiguas: reglasCompuestas.relacionesAmbiguas,
    advertencias,
    resumen_reglas: {
      total: reglas.length,
      por_tipo: reglas.reduce((acc, regla) => ({ ...acc, [regla.tipo_regla]: (acc[regla.tipo_regla] || 0) + 1 }), {}),
      por_confianza: reglas.reduce((acc, regla) => ({ ...acc, [regla.estado_confianza]: (acc[regla.estado_confianza] || 0) + 1 }), {}),
    },
    resumen_compuestas: {
      total: reglasCompuestas.compuestas.length,
      por_confianza: reglasCompuestas.compuestas.reduce((acc, regla) => ({ ...acc, [regla.estado_confianza]: (acc[regla.estado_confianza] || 0) + 1 }), {}),
      ambiguas: reglasCompuestas.relacionesAmbiguas.length,
    },
  };
}
