import { SPECIAL_EQUIPMENT_DISCOUNT, findBusinessRedPlusEligible } from './businessRedPlusEligibility.js';
import { dateOnly } from './vigenciaTexto.js';

const CATEGORY_LABELS = {
  bono_portabilidad: 'Bono portabilidad',
  bono_streaming: 'Streaming',
  descuento_accesorios: 'Accesorios',
  descuento_affinity: 'Affinity',
  descuento_porcentaje: 'Descuentos porcentuales',
  doble_data: 'Doble data',
  doble_velocidad: 'Doble velocidad',
  meses_gratis: 'Meses gratis',
  pago_penalidad: 'Pago penalidad',
};

const BENEFIT_NAMES = {
  bono_portabilidad: 'Bono de portabilidad',
  bono_streaming: 'Bono Streaming por Convergencia',
  descuento_accesorios: 'Descuento de accesorios',
  descuento_affinity: 'Affinity',
  descuento_porcentaje: 'Descuento porcentual',
  doble_data: 'Doble data',
  doble_velocidad: 'Doble velocidad',
  meses_gratis: 'Meses gratis',
  pago_penalidad: 'Pago de penalidad',
};

const PRODUCT_LABELS = {
  accesorio: 'Accesorios',
  fijo: 'Fijo',
  inalambrico_iot: 'Inalambrico / IoT',
  movil: 'Movil',
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `$${Number.isInteger(amount) ? String(amount) : amount.toFixed(2)}`;
}

function unique(values) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function termText(term) {
  if (!term || typeof term !== 'object') return String(term || '').trim();
  return String(term.nombre || term.titulo || term.descripcion || term.texto || term.seccion || '').trim();
}

function conditionText(condition) {
  if (!condition || typeof condition !== 'object') return String(condition || '').trim();
  return String(condition.descripcion || condition.detalle || condition.nombre || condition.tipo || '').trim();
}

function limitText(limit) {
  if (!limit || typeof limit !== 'object') return null;
  const unidad = String(limit.unidad || limit.tipo || '').trim();
  const cantidad = limit.cantidad ?? limit.maximo ?? limit.valor;
  if (cantidad != null && unidad) return `${cantidad} por ${unidad}`;
  if (cantidad != null) return String(cantidad);
  return unidad || null;
}

function sourceName(ruleSource, source) {
  return ruleSource?.nombre_original || ruleSource?.nombre || source?.nombre_original || source?.titulo || null;
}

function sourcePage(ruleSource) {
  return ruleSource?.pagina || ruleSource?.page || ruleSource?.seccion || null;
}

function traceBenefitText(trace) {
  const text = String(trace?.beneficio?.texto_original || '').trim();
  if (!text) return null;
  return text.split('\n').map((line) => line.trim()).filter(Boolean)[0] || null;
}

function benefitAmount(benefit) {
  if (benefit?.monto != null) return money(benefit.monto);
  if (benefit?.porcentaje != null) return `${benefit.porcentaje}%`;
  return benefit?.descripcion || benefit?.nombre || BENEFIT_NAMES[benefit?.tipo] || benefit?.tipo || 'Beneficio publicado';
}

function productText(products) {
  const labels = unique(asArray(products).map((item) => PRODUCT_LABELS[item] || item));
  return labels.length ? labels.join(' + ') : 'Producto indicado en regla publicada';
}

function buildConvergenceEntry({ fixedVersion, fixedSource, fixedRules } = {}) {
  if (!fixedVersion || !asArray(fixedRules).length) return null;
  const terms = unique(asArray(fixedRules).flatMap((rule) => asArray(rule.terminos).map(termText)))
    .filter((term) => /convergente|convergencia|claro full/i.test(term))
    .slice(0, 5);
  return {
    id: 'fijo_benefits|convergencia|cliente',
    dominio: 'fijo_benefits',
    categoria: 'Convergencia',
    nombre: 'Claro Full PYMES',
    beneficio: 'Condicion requerida',
    producto_afectado: 'Fijo + Movil',
    condicion_principal: terms[0] || 'Cliente convergente Claro Full PYMES segun reglas publicadas',
    convergencia_evento: 'Cliente convergente',
    limite: null,
    vigencia: {
      desde: dateOnly(fixedSource?.vigencia_desde),
      hasta: dateOnly(fixedSource?.vigencia_hasta),
      documental: fixedSource?.vigencia_documental || 'vigente',
    },
    fuente: {
      id: fixedSource?.id || null,
      nombre: fixedSource?.nombre_original || fixedSource?.titulo || 'Fuente Benefits Claro Full PYMES',
      seccion: 'Beneficios Claro Full PYMES para Clientes Convergentes',
      pagina: 3,
    },
    estado_vigente: 'vigente',
    confirmado: true,
    publicado: true,
    autoaplica: false,
    version: {
      id: fixedVersion.id,
      numero: fixedVersion.numero,
      estado: fixedVersion.estado_publicacion,
    },
    compatibilidad: null,
    terminos_principales: terms,
    faltante: null,
  };
}

export function compositeBenefitToPortalEntry({ rule, version, source } = {}) {
  const contract = rule?.contrato || {};
  const trace = contract.traza || {};
  const benefit = contract.beneficio || {};
  const tipo = benefit.tipo || String(rule?.identidad_comercial || '').split('|')[1] || 'beneficio';
  const identityProduct = String(rule?.identidad_comercial || '').split('|')[2];
  const condiciones = unique(asArray(contract.condiciones).map(conditionText));
  const terms = unique(asArray(rule?.terminos).map(termText)).slice(0, 6);
  const ruleSource = contract.fuente || trace.fuente || {};
  const benefitTrace = trace.beneficio || {};
  // La vigencia puede venir como objeto ({desde,hasta}) o plana en el contrato, segun el normalizador de origen.
  const vigencia = contract.vigencia || {};
  const desde = dateOnly(vigencia.desde || contract.vigencia_desde || rule?.vigencia_desde || source?.vigencia_desde);
  const hasta = dateOnly(vigencia.hasta || contract.vigencia_hasta || rule?.vigencia_hasta || source?.vigencia_hasta);

  return {
    id: rule?.identidad_comercial || rule?.id,
    dominio: version?.dominio || 'fijo_benefits',
    categoria: CATEGORY_LABELS[tipo] || benefit.nombre || tipo,
    nombre: benefit.nombre || BENEFIT_NAMES[tipo] || tipo,
    beneficio: benefitAmount(benefit),
    producto_afectado: productText(contract.productos || contract.producto_afectado || [identityProduct]),
    condicion_principal: condiciones[0] || traceBenefitText(trace) || (contract.convergencia_requerida ? 'Cliente convergente Claro Full PYMES' : 'Segun regla publicada'),
    convergencia_evento: unique([
      contract.convergencia_requerida ? 'Convergencia requerida' : '',
      ...asArray(contract.eventos || contract.evento),
    ]).join(' · ') || null,
    limite: limitText(contract.limite) || limitText(benefit.limite) || null,
    vigencia: {
      desde,
      hasta,
      documental: source?.vigencia_documental || 'vigente',
    },
    fuente: {
      id: source?.id || contract.fuente_comercial_id || null,
      nombre: sourceName(ruleSource, source),
      seccion: ruleSource.seccion || benefitTrace.seccion || contract.seccion || null,
      pagina: sourcePage(benefitTrace) || sourcePage(ruleSource),
    },
    estado_vigente: 'vigente',
    confirmado: rule?.estado_confianza === 'confirmado',
    publicado: rule?.estado_publicacion === 'vigente',
    autoaplica: false,
    version: {
      id: version?.id || null,
      numero: version?.numero || null,
      estado: version?.estado_publicacion || null,
    },
    compatibilidad: contract.compatibilidad || null,
    terminos_principales: terms,
    faltante: terms.length ? null : 'Sin terminos principales estructurados en la publicacion',
  };
}

function aggregateByCategory(items) {
  const byCategory = new Map();
  for (const item of asArray(items)) {
    const categoria = String(item?.equipo?.categoria || '').toLowerCase();
    if (!['tablet', 'modem'].includes(categoria)) continue;
    if (!byCategory.has(categoria)) byCategory.set(categoria, []);
    byCategory.get(categoria).push(item);
  }
  return byCategory;
}

function minMoney(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) return null;
  return money(Math.min(...numeric));
}

function specialEquipmentEntry(categoria, items, mobileVersion) {
  const first = items[0] || {};
  const codigos = unique(items.flatMap((item) => asArray(item.plazos).map((plazo) => plazo.price_code)));
  const marcas = unique(items.map((item) => item.equipo?.marca)).sort((a, b) => a.localeCompare(b));
  const plazos = unique(items.flatMap((item) => asArray(item.plazos).map((plazo) => plazo.meses))).sort((a, b) => Number(a) - Number(b));
  const monto = first.beneficio?.monto ?? first.beneficio?.amount;
  const categoriaLabel = categoria === 'tablet' ? 'Tabletas' : 'Modems';

  return {
    id: `ofertas_moviles|business_red_plus|${categoria}`,
    dominio: 'ofertas_moviles',
    categoria: categoriaLabel,
    nombre: `${categoriaLabel} Business Red Plus`,
    beneficio: money(monto) || 'Descuento publicado',
    producto_afectado: categoria === 'tablet' ? 'Tabletas / iPads' : 'Modems / MiFi',
    condicion_principal: asArray(first.condiciones)[0] || 'Business Red Plus segun publicacion vigente',
    convergencia_evento: 'Business Red Plus · lineas 1 a 10',
    limite: 'Lineas 1 a 10',
    vigencia: {
      desde: dateOnly(first.vigencia?.desde || first.fuente?.vigencia_desde),
      hasta: dateOnly(first.vigencia?.hasta),
      documental: mobileVersion?.estado || 'vigente',
    },
    fuente: {
      // upload_id identifies the equipment price-list history, not the official
      // benefit bulletin. It must not be exposed as a source-document link.
      id: null,
      nombre: first.fuente?.archivo || first.fuente?.hoja || 'Boletin Oferta Descuentos Modems, MIFI y Tablets',
      seccion: first.fuente?.seccion || 'Planes Multilineas Business RED',
      pagina: first.fuente?.pagina || null,
    },
    estado_vigente: 'vigente',
    confirmado: true,
    publicado: mobileVersion?.estado === 'vigente' || !mobileVersion?.estado,
    autoaplica: false,
    version: {
      id: mobileVersion?.id || null,
      numero: mobileVersion?.numero || null,
      estado: mobileVersion?.estado || null,
    },
    compatibilidad: null,
    terminos_principales: unique([
      codigos.length ? `Codigos: ${codigos.join(', ')}` : '',
      plazos.length ? `Plazos: ${plazos.join('/')} meses` : '',
      marcas.length ? `Marcas disponibles: ${marcas.join(', ')}` : '',
      `Precio regular desde ${minMoney(items.map((item) => item.equipo?.precio_regular)) || 'publicacion vigente'}`,
      `Precio con beneficio desde ${minMoney(items.map((item) => item.equipo?.precio_financiado)) || 'publicacion vigente'}`,
    ]),
    codigos,
    cantidad_equipos: items.length,
    marcas,
    faltante: null,
  };
}

export function buildSpecialEquipmentBenefitEntries({ mobileVersion, equipmentResult } = {}) {
  const grouped = aggregateByCategory(equipmentResult?.equipos || []);
  return ['tablet', 'modem']
    .filter((categoria) => grouped.has(categoria))
    .map((categoria) => specialEquipmentEntry(categoria, grouped.get(categoria), mobileVersion));
}

function publishedRuleEntries(rules, version, source) {
  return asArray(rules)
    .filter((rule) => rule?.estado_confianza === 'confirmado' && rule?.estado_publicacion === 'vigente' && rule?.autoaplica === false)
    .map((rule) => compositeBenefitToPortalEntry({ rule, version, source }));
}

// Affinity no entra en este catalogo: tiene su propia pagina en el portal (`affinity.html`) porque sus
// condiciones y terminos no caben en una fila. Se lee con readAffinityPortalDetail.
export function buildBenefitsPortalCatalog({
  fixedVersion,
  fixedSource,
  fixedRules = [],
  specialEquipmentEntries = [],
  advertencias = [],
} = {}) {
  const fixedEntries = publishedRuleEntries(fixedRules, fixedVersion, fixedSource);
  const convergenceEntry = buildConvergenceEntry({ fixedVersion, fixedSource, fixedRules });

  const specialEntries = asArray(specialEquipmentEntries).map((entry) => ({
    ...entry,
    dominio: entry.dominio || 'ofertas_moviles',
    estado_vigente: entry.estado_vigente || 'vigente',
    autoaplica: false,
  }));

  const beneficios = [convergenceEntry, ...fixedEntries, ...specialEntries]
    .filter(Boolean)
    .filter((entry) => entry.confirmado && entry.publicado && entry.estado_vigente === 'vigente' && entry.autoaplica === false)
    .sort((a, b) => String(a.categoria).localeCompare(String(b.categoria)) || String(a.nombre).localeCompare(String(b.nombre)));

  return {
    ok: true,
    generado_en: new Date().toISOString(),
    resumen: {
      total_beneficios: beneficios.length,
      dominios: unique(beneficios.map((entry) => entry.dominio)),
      categorias: unique(beneficios.map((entry) => entry.categoria)),
      autoaplica: false,
    },
    fuentes: unique(beneficios.map((entry) => entry.fuente?.nombre)),
    advertencias: asArray(advertencias),
    beneficios,
  };
}

const CONDICION_ETIQUETAS = {
  plan_minimo: 'Renta minima del plan',
  plazos_meses: 'Plazos de contrato',
  limite: 'Limite',
  eventos: 'Aplica a',
  modalidades: 'Modalidades',
  nivel_aplicacion: 'Nivel de aplicacion',
  compatibilidad: 'Combinable',
  excluye: 'No aplica a',
  tecnologias: 'Tecnologias y velocidad minima',
  servicios: 'Servicios',
};

function textoCondicion(clave, valor) {
  if (valor == null || (Array.isArray(valor) && !valor.length)) return null;
  if (clave === 'plan_minimo') return `Desde $${valor}`;
  if (clave === 'plazos_meses') return `${valor.join(', ')} meses`;
  if (clave === 'limite') return `${valor.cantidad} ${String(valor.unidad || '').replace(/_/g, ' ')}`;
  if (clave === 'compatibilidad') return valor === 'incompatible' ? 'No combinable con otras ofertas' : String(valor).replace(/_/g, ' ');
  if (clave === 'tecnologias') return valor.map((item) => `${item.tecnologia.replace(/_/g, '/').toUpperCase()} desde ${item.velocidad_minima_megas} megas`).join(' · ');
  if (Array.isArray(valor)) return valor.map((item) => String(item).replace(/_/g, ' ')).join(', ');
  if (clave === 'nivel_aplicacion' && valor === 'no_determinado') return null;
  return String(valor).replace(/_/g, ' ');
}

// Detalle completo del programa Affinity para su pagina del portal: el vendedor necesita ver las condiciones
// y los terminos oficiales, no solo el porcentaje.
export async function readAffinityPortalDetail(db) {
  if (!db?.query) throw new Error('db_requerida');
  const { affinityVersion, affinityRules, affinitySource } = await readAffinityBenefits(db);
  if (!affinityVersion) return { ok: true, publicado: false, programas: [], version: null, fuente: null };

  const programas = asArray(affinityRules).map((rule) => {
    const contrato = rule.contrato || {};
    const condiciones = contrato.condiciones || {};
    const tecnologiaConAclaracion = asArray(condiciones.tecnologias).find((item) => item.resolucion);
    return {
      producto: contrato.producto || String(rule.identidad_comercial || '').split('|')[2] || 'no_determinado',
      beneficio: contrato.beneficio?.porcentaje != null ? `${contrato.beneficio.porcentaje}%` : money(contrato.beneficio?.monto),
      codigo: contrato.beneficio?.codigo || null,
      aplicacion: contrato.beneficio?.aplicacion === 'renta_mensual' ? 'Sobre la renta mensual del plan' : null,
      codigos_facturacion: asArray(contrato.codigos_facturacion),
      condiciones: Object.entries(CONDICION_ETIQUETAS)
        .map(([clave, etiqueta]) => ({ etiqueta, valor: textoCondicion(clave, condiciones[clave]) }))
        .filter((item) => item.valor),
      terminos: asArray(rule.terminos).map(termText).filter(Boolean),
      aclaracion: tecnologiaConAclaracion
        ? `${tecnologiaConAclaracion.tecnologia.toUpperCase()} aplica desde ${tecnologiaConAclaracion.resolucion.megas} megas (aclarado por ${tecnologiaConAclaracion.resolucion.actor} el ${tecnologiaConAclaracion.resolucion.fecha})`
        : null,
      vigencia: { desde: dateOnly(contrato.vigencia_desde), hasta: dateOnly(contrato.vigencia_hasta) },
      autoaplica: false,
    };
  }).sort((a, b) => String(a.producto).localeCompare(String(b.producto)));

  return {
    ok: true,
    publicado: true,
    generado_en: new Date().toISOString(),
    version: { numero: affinityVersion.numero, estado: affinityVersion.estado_publicacion },
    fuente: affinitySource ? { nombre: affinitySource.nombre_original, vigencia_desde: dateOnly(affinitySource.vigencia_desde), vigencia_hasta: dateOnly(affinitySource.vigencia_hasta) } : null,
    programas,
  };
}

export async function readSpecialDiscountVigencia(db) {
  const { rows } = await db.query(
    `SELECT vigencia_desde, vigencia_hasta
     FROM public.fuentes_comerciales
     WHERE lower(sha256)=lower($1)
     ORDER BY vigencia_desde DESC NULLS LAST
     LIMIT 1`,
    [SPECIAL_EQUIPMENT_DISCOUNT.source.sha256]
  );
  const row = rows[0];
  if (!row) return null;
  return { desde: dateOnly(row.vigencia_desde), hasta: dateOnly(row.vigencia_hasta) };
}

async function readPublishedVersion(db, dominio) {
  const versionResult = await db.query(
    `SELECT id, numero, dominio, estado_publicacion, resumen
     FROM public.motor_comercial_reglas_versiones
     WHERE dominio=$1 AND estado_publicacion='vigente'
     ORDER BY numero DESC
     LIMIT 1`,
    [dominio]
  );
  return versionResult.rows[0] || null;
}

async function readPublishedRulesWithTerms(db, versionId) {
  const rulesResult = await db.query(
    `SELECT id, identidad_comercial, accion_version, estado_confianza, estado_publicacion, autoaplica, contrato
     FROM public.motor_comercial_reglas_compuestas
     WHERE version_id=$1
       AND estado_confianza='confirmado'
       AND estado_publicacion='vigente'
       AND autoaplica=false
       AND accion_version <> 'vence'
     ORDER BY identidad_comercial`,
    [versionId]
  );
  const ids = rulesResult.rows.map((row) => row.id);
  let terms = [];
  if (ids.length) {
    const termResult = await db.query(
      `SELECT regla_compuesta_id, termino_snapshot
       FROM public.motor_comercial_reglas_terminos
       WHERE regla_compuesta_id = ANY($1)`,
      [ids]
    );
    terms = termResult.rows;
  }
  const termsByRule = new Map();
  for (const term of terms) {
    if (!termsByRule.has(term.regla_compuesta_id)) termsByRule.set(term.regla_compuesta_id, []);
    termsByRule.get(term.regla_compuesta_id).push(term.termino_snapshot);
  }
  return rulesResult.rows.map((rule) => ({ ...rule, terminos: termsByRule.get(rule.id) || [] }));
}

async function readAffinityBenefits(db) {
  const affinityVersion = await readPublishedVersion(db, 'affinity_benefits');
  if (!affinityVersion) return { affinityVersion: null, affinityRules: [], affinitySource: null };
  const affinityRules = await readPublishedRulesWithTerms(db, affinityVersion.id);
  const sourceResult = await db.query(
    `SELECT id, titulo, nombre_original, vigencia_desde, vigencia_hasta, vigencia_documental, estado
     FROM public.fuentes_comerciales
     WHERE familia='affinity'
       AND (
         sha256 = (
           SELECT contrato->'traza'->'fuente'->>'sha256'
           FROM public.motor_comercial_reglas_compuestas
           WHERE version_id=$1
             AND contrato->'traza'->'fuente'->>'sha256' IS NOT NULL
           LIMIT 1
         )
         OR estado='activa'
       )
     ORDER BY vigencia_desde DESC NULLS LAST, creado_en DESC
     LIMIT 1`,
    [affinityVersion.id]
  );
  return { affinityVersion, affinityRules, affinitySource: sourceResult.rows[0] || null };
}

async function readFixedBenefits(db) {
  const fixedVersion = await readPublishedVersion(db, 'fijo_benefits');
  if (!fixedVersion) return { fixedVersion: null, fixedRules: [], fixedSource: null };
  const fixedRules = await readPublishedRulesWithTerms(db, fixedVersion.id);

  const sourceResult = await db.query(
    `SELECT id, titulo, nombre_original, vigencia_desde, vigencia_hasta, vigencia_documental, estado
     FROM public.fuentes_comerciales
     WHERE familia='beneficios'
       AND estado='activa'
       AND (
         nombre_original ILIKE '%Claro Full%PYMES%'
         OR titulo ILIKE '%Claro Full%PYMES%'
         OR sha256 = (
           SELECT contrato->'traza'->'fuente'->>'sha256'
           FROM public.motor_comercial_reglas_compuestas
           WHERE version_id=$1
             AND contrato->'traza'->'fuente'->>'sha256' IS NOT NULL
           LIMIT 1
         )
       )
     ORDER BY vigencia_desde DESC NULLS LAST, creado_en DESC
     LIMIT 1`,
    [fixedVersion.id]
  );

  return { fixedVersion, fixedSource: sourceResult.rows[0] || null, fixedRules };
}

async function readSpecialEquipmentBenefits(db) {
  const mobileResult = await db.query(
    `SELECT id, numero, estado, vigencia_desde, vigencia_hasta, datos, resumen
     FROM public.ofertas_movil_versiones
     WHERE estado='vigente'
     ORDER BY numero DESC
     LIMIT 1`
  );
  const mobileVersion = mobileResult.rows[0] || null;
  const block = mobileVersion?.resumen?.business_red_plus || null;
  if (!mobileVersion || !block) {
    return { entries: [], advertencias: [{ codigo: 'version_movil_no_publicada', detalle: 'No hay esquema Business Red Plus vigente; sin beneficios de tabletas y modems.' }] };
  }

  const [equipmentResult, specialDiscountVigencia] = await Promise.all([
    db.query(
      `SELECT item_code, sap_code, modelo, marca, categoria, precio_regular, mensualidades, upload_id
       FROM public.v_equipos_vigentes
       WHERE categoria IN ('tablet', 'modem') AND COALESCE(fuera_portafolio, false)=false
       ORDER BY categoria, marca, modelo`
    ),
    readSpecialDiscountVigencia(db),
  ]);

  const eligibility = findBusinessRedPlusEligible({
    block: {
      ...block,
      vigencia: block.vigencia || { desde: mobileVersion.vigencia_desde, hasta: mobileVersion.vigencia_hasta },
    },
    linea: {
      id: 'portal-benefits-linea-1',
      tipo: 'multilinea_business_red',
      familia_business_red: 'business_red_plus',
      plan: { codigo: 'BRPLUS', nombre: 'Business Red Plus', monto: 65 },
      evento: 'linea_nueva',
      trade_in: { aplica: false, validado: false },
      posicion_en_ban: 1,
    },
    offers: mobileVersion.datos || [],
    equiposEspeciales: equipmentResult.rows,
    specialDiscountVigencia,
    version: { estado: mobileVersion.estado },
  });

  const entries = buildSpecialEquipmentBenefitEntries({ mobileVersion, equipmentResult: eligibility });
  const advertencias = [];
  if (!entries.length) {
    advertencias.push({
      codigo: 'equipos_especiales_no_disponibles',
      detalle: 'La elegibilidad Business Red Plus no devolvio tabletas ni modems para el portal.',
      validaciones: asArray(eligibility?.validaciones),
      equipos_catalogo: equipmentResult.rows.length,
    });
  }
  return { entries, advertencias };
}

export async function readBenefitsPortalCatalog({ db } = {}) {
  if (!db?.query) throw new Error('db_requerida');
  const [fixed, special] = await Promise.all([
    readFixedBenefits(db),
    readSpecialEquipmentBenefits(db),
  ]);
  return buildBenefitsPortalCatalog({
    fixedVersion: fixed.fixedVersion,
    fixedSource: fixed.fixedSource,
    fixedRules: fixed.fixedRules,
    specialEquipmentEntries: special.entries,
    advertencias: special.advertencias,
  });
}
