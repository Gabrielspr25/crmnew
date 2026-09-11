import { dateOnly, parseRangoVigencia } from './vigenciaTexto.js';

const BENEFIT_DEFINITIONS = [
  {
    tipo: 'bono_streaming',
    categoria: 'Streaming',
    nombre: 'Bono Streaming',
    patterns: [/streaming/i],
  },
  {
    tipo: 'pago_balance_equipo',
    categoria: 'Pago de balance de equipo',
    nombre: 'Pago de balance de equipo',
    patterns: [/balance de equipo/i, /pago de balance/i, /\bbalance\b/i],
  },
  {
    tipo: 'meses_gratis',
    categoria: 'Meses gratis',
    nombre: 'Meses gratis',
    patterns: [/3\s*meses gratis/i, /tres\s*meses gratis/i, /meses gratis/i],
  },
  {
    tipo: 'convergencia',
    categoria: 'Convergencia',
    nombre: 'Convergencia / Claro Full',
    patterns: [/convergencia/i, /claro full/i, /convergente/i],
  },
  {
    tipo: 'beneficios_fijo',
    categoria: 'Fijo',
    nombre: 'Beneficios de Fijo',
    patterns: [/internet fijo/i, /\bfijo\b/i, /2\s*play/i, /3\s*play/i],
  },
  {
    tipo: 'beneficios_moviles',
    categoria: 'Movil',
    nombre: 'Beneficios moviles',
    patterns: [/update plus/i, /financiamiento/i, /linea nueva/i, /portabilidad/i, /renovacion/i],
  },
  {
    tipo: 'beneficios_iot',
    categoria: 'Inalambrico / IoT',
    nombre: 'Benefits IoT / Internet On The Go',
    patterns: [/internet on the go/i, /\biot\b/i, /claro oficina/i, /mifi/i],
  },
  {
    tipo: 'bono_portabilidad',
    categoria: 'Portabilidad',
    nombre: 'Bono portabilidad',
    patterns: [/bono.*portabilidad/i, /portabilidad.*\$\s*\d+/i],
  },
  {
    tipo: 'pago_penalidad',
    categoria: 'Pago de penalidad',
    nombre: 'Pago de penalidad',
    patterns: [/penalidad/i, /pago.*penal/i],
  },
  {
    tipo: 'doble_velocidad',
    categoria: 'Doble velocidad',
    nombre: 'Doble velocidad',
    patterns: [/doble velocidad/i, /proxima velocidad/i, /pr[oó]xima velocidad/i],
  },
  {
    tipo: 'doble_data',
    categoria: 'Doble data',
    nombre: 'Doble data',
    patterns: [/doble data/i, /data doble/i],
  },
  {
    tipo: 'descuento_porcentaje',
    categoria: 'Descuentos porcentuales',
    nombre: 'Descuento porcentual',
    patterns: [/50\s*%/i, /50 porciento/i, /porciento/i, /descuento.*%/i],
  },
  {
    tipo: 'descuento_accesorios',
    categoria: 'Accesorios',
    nombre: 'Descuento de accesorios',
    patterns: [/accesorios/i, /accesorio/i],
  },
  {
    tipo: 'tabletas',
    categoria: 'Tabletas',
    nombre: 'Tabletas / iPads',
    patterns: [/tablets?/i, /tabletas?/i, /ipads?/i],
  },
  {
    tipo: 'modems_mifi',
    categoria: 'Modems / MIFI',
    nombre: 'Modems / MIFI',
    patterns: [/modems?/i, /mifi/i, /hotspot/i],
  },
  {
    tipo: 'affinity',
    categoria: 'Affinity',
    nombre: 'Affinity',
    patterns: [/affinity/i],
  },
];

const PRODUCT_BY_DOMAIN = {
  accesorios: 'Accesorios',
  bono_portabilidad: 'Movil',
  business_red_plus: 'Movil multilinea',
  byop: 'Movil BYOP',
  convergencia_benefits: 'Fijo + Movil',
  fijo: 'Fijo',
  inalambrico_iot: 'Inalambrico / IoT',
  lista_precios: 'Equipos / accesorios',
  ofertas_financiamiento: 'Movil / equipos',
  tabletas_modems_mifi: 'Tabletas / Modems / MIFI',
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseValidityText(textValue) {
  return parseRangoVigencia(textValue, { requireYear: true }) || { desde: null, hasta: null, texto: null };
}

function validityForSource(source, today) {
  const inferred = parseValidityText(source?.vigencia_inferida?.texto || source?.nombre || '');
  const desde = inferred.desde || dateOnly(source?.vigencia_desde);
  const hasta = inferred.hasta || dateOnly(source?.vigencia_hasta);
  if (!desde && !hasta) return { desde, hasta, estado: 'requiere_revision', texto: inferred.texto };
  if (hasta && hasta < today) return { desde, hasta, estado: 'vencida', texto: inferred.texto };
  if (desde && desde > today) return { desde, hasta, estado: 'futura', texto: inferred.texto };
  return { desde, hasta, estado: 'vigente', texto: inferred.texto };
}

function sourceTextFor(source, textBySource = {}) {
  const candidates = [
    source?.nombre,
    source?.ruta_relativa_origen,
    source?.ruta,
  ].map(normalize).filter(Boolean);
  for (const [name, text] of Object.entries(textBySource || {})) {
    const normalizedName = normalize(name).replace(/\b(pdf|xlsx|xls|txt)\b/g, '').trim();
    if (candidates.some((candidate) => candidate.includes(normalizedName) || normalizedName.includes(candidate.replace(/\b(pdf|xlsx|xls)\b/g, '').trim()))) {
      return String(text || '');
    }
  }
  return '';
}

function amountNear(text, definition) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    if (!definition.patterns.some((pattern) => pattern.test(line))) continue;
    const match = line.match(/\$\s*([0-9][0-9,.]*)|([0-9]{1,3})\s*%/);
    if (match) return match[0].replace(/\s+/g, '');
  }
  return null;
}

function evidenceSnippet(text, definition) {
  const line = String(text || '').split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => definition.patterns.some((pattern) => pattern.test(item)));
  if (!line) return null;
  return line.slice(0, 240);
}

function publishedTypeSet(publishedRows = []) {
  const values = new Set();
  for (const row of publishedRows || []) {
    const parts = String(row.identidad_comercial || '').split('|');
    if (parts[1]) values.add(parts[1]);
  }
  return values;
}

function statusForDetection({ source, validity, hasText, published, definition }) {
  if (published) return 'publicado_local_vigente';
  if (validity.estado === 'vencida') return 'vencida_no_publicable';
  if (validity.estado === 'futura') return 'futura_no_vigente';
  if (!hasText && source?.extension === '.pdf') return 'requiere_extraccion_pdf';
  if (['beneficios_fijo', 'beneficios_moviles', 'beneficios_iot', 'convergencia'].includes(definition.tipo)) return 'requiere_normalizacion_especifica';
  return 'requiere_revision';
}

export function buildBenefitsConsolidation({
  inventory = {},
  textBySource = {},
  publishedRows = [],
  today = '2026-09-04',
} = {}) {
  const publishedTypes = publishedTypeSet(publishedRows);
  const detections = [];
  for (const source of inventory.fuentes || []) {
    const text = sourceTextFor(source, textBySource);
    const haystack = `${source.nombre || ''}\n${source.ruta_relativa_origen || ''}\n${source.dominio_inferido || ''}\n${text}`;
    const validity = validityForSource(source, today);
    for (const definition of BENEFIT_DEFINITIONS) {
      if (!definition.patterns.some((pattern) => pattern.test(haystack))) continue;
      const published = publishedTypes.has(definition.tipo)
        || (definition.tipo === 'convergencia' && publishedRows.some((row) => String(row.identidad_comercial || '').startsWith('fijo_benefits|')))
        || (definition.tipo === 'tabletas' && source.dominio_inferido === 'tabletas_modems_mifi')
        || (definition.tipo === 'modems_mifi' && source.dominio_inferido === 'tabletas_modems_mifi');
      const estado = statusForDetection({
        source,
        validity,
        hasText: Boolean(text),
        published,
        definition,
      });
      detections.push({
        id: `${definition.tipo}|${source.sha256}`,
        identidad_canonica: [
          definition.tipo,
          source.dominio_inferido || 'sin_dominio',
          PRODUCT_BY_DOMAIN[source.dominio_inferido] || 'producto_no_determinado',
        ].join('|'),
        tipo: definition.tipo,
        categoria: definition.categoria,
        nombre: definition.nombre,
        descripcion_comercial: evidenceSnippet(text, definition) || definition.nombre,
        condicion_aplicacion: evidenceSnippet(text, definition) ? 'Detectada en texto oficial; requiere normalizacion por dominio para condiciones completas.' : 'Pendiente de extraccion/normalizacion especifica.',
        plan_familia: /business red/i.test(haystack) ? 'Business RED / Business RED Plus' : null,
        modalidad: /byop/i.test(haystack) ? 'BYOP' : null,
        evento: /portabilidad/i.test(haystack) ? 'portabilidad' : (/renovaci/i.test(haystack) ? 'renovacion' : null),
        cantidad_posicion_lineas: /lineas? 1 a 10|1 a 10 lineas|multilinea/i.test(haystack) ? 'lineas 1 a 10 / multilinea' : null,
        convergencia: /convergenc|claro full/i.test(haystack) ? 'mencionada_en_fuente' : null,
        account_types: /pymes|corporativo/i.test(haystack) ? ['PYMES', 'Corporativo'].filter((item) => new RegExp(item, 'i').test(haystack)) : [],
        plazo: /24|30/.test(haystack) ? '24/30 si la regla especifica plazo' : null,
        compatibilidad: null,
        incompatibilidad: null,
        monto_o_beneficio: amountNear(text, definition),
        vigencia_desde: validity.desde,
        vigencia_hasta: validity.hasta,
        vigencia_estado: validity.estado,
        fuente: {
          nombre: source.nombre,
          ruta: source.ruta,
          sha256: source.sha256,
          dominio: source.dominio_inferido,
          origen: source.origen,
          archivado: source.estado_archivo_newcrm,
        },
        revision: source.grupo_revision || null,
        publicacion: published ? 'detectada_en_publicacion_local_o_regla_derivada' : 'no_publicada_por_inventario',
        normalizado: published || false,
        confirmado: published || false,
        publicado: published || false,
        consume_constructor: published && ['tabletas', 'modems_mifi', 'beneficios_moviles'].includes(definition.tipo),
        visible_portal: published,
        confidence: published ? 'confirmado' : 'requiere_revision',
        estado,
        faltante: published ? null : 'preview/diff/normalizacion/publicacion local por dominio antes de consumo',
      });
    }
  }

  for (const row of publishedRows || []) {
    const parts = String(row.identidad_comercial || '').split('|');
    const tipo = parts[1] || null;
    if (!tipo) continue;
    const definition = BENEFIT_DEFINITIONS.find((item) => item.tipo === tipo);
    if (!definition) continue;
    if (detections.some((item) => item.tipo === tipo && item.publicado)) continue;
    detections.push({
      id: `${tipo}|${row.fuente_sha256 || row.id || row.identidad_comercial}`,
      identidad_canonica: [tipo, 'fijo_benefits', parts[2] || 'producto_no_determinado'].join('|'),
      tipo,
      categoria: definition.categoria,
      nombre: definition.nombre,
      descripcion_comercial: definition.nombre,
      condicion_aplicacion: 'Regla compuesta publicada localmente; condiciones completas viven en Motor Comercial.',
      plan_familia: null,
      modalidad: null,
      evento: null,
      cantidad_posicion_lineas: null,
      convergencia: 'segun_regla_publicada',
      account_types: [],
      plazo: null,
      compatibilidad: null,
      incompatibilidad: null,
      monto_o_beneficio: null,
      vigencia_desde: null,
      vigencia_hasta: null,
      vigencia_estado: 'vigente',
      fuente: {
        nombre: 'Motor Comercial fijo_benefits',
        ruta: null,
        sha256: String(row.fuente_sha256 || '').toUpperCase(),
        dominio: 'fijo_benefits',
        origen: 'publicacion_local',
        archivado: 'publicado_local',
      },
      revision: null,
      publicacion: 'detectada_en_publicacion_local_o_regla_derivada',
      normalizado: true,
      confirmado: true,
      publicado: true,
      consume_constructor: false,
      visible_portal: true,
      confidence: 'confirmado',
      estado: 'publicado_local_vigente',
      faltante: null,
    });
  }

  const byIdentity = new Map();
  for (const detection of detections) {
    const existing = byIdentity.get(detection.identidad_canonica);
    if (!existing) {
      byIdentity.set(detection.identidad_canonica, {
        identidad_canonica: detection.identidad_canonica,
        tipo: detection.tipo,
        categoria: detection.categoria,
        nombre: detection.nombre,
        producto_afectado: PRODUCT_BY_DOMAIN[detection.fuente.dominio] || 'Producto no determinado',
        variantes: [detection],
        publicado: detection.publicado,
        confirmado: detection.confirmado,
        estado: detection.estado,
      });
      continue;
    }
    existing.variantes.push(detection);
    existing.publicado = existing.publicado || detection.publicado;
    existing.confirmado = existing.confirmado || detection.confirmado;
    if (existing.estado !== 'publicado_local_vigente' && detection.estado === 'publicado_local_vigente') existing.estado = detection.estado;
  }

  const beneficios = [...byIdentity.values()]
    .map((item) => ({
      ...item,
      fuentes: item.variantes.map((variant) => variant.fuente),
      vigencias: item.variantes.map((variant) => ({
        desde: variant.vigencia_desde,
        hasta: variant.vigencia_hasta,
        estado: variant.vigencia_estado,
      })),
      faltantes: [...new Set(item.variantes.map((variant) => variant.faltante).filter(Boolean))],
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));

  const counts = (key) => beneficios.reduce((acc, item) => {
    const value = item[key] || 'no_determinado';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    today,
    resumen: {
      fuentes_evaluadas: (inventory.fuentes || []).length,
      detecciones: detections.length,
      beneficios_canonicos: beneficios.length,
      publicados: beneficios.filter((item) => item.publicado).length,
      requieren_revision: beneficios.filter((item) => !item.publicado).length,
      por_categoria: counts('categoria'),
      por_estado: counts('estado'),
      autoaplica: false,
    },
    beneficios,
    detecciones: detections,
    reglas_publicadas_detectadas: (publishedRows || []).map((row) => ({
      identidad_comercial: row.identidad_comercial,
      estado_confianza: row.estado_confianza,
      estado_publicacion: row.estado_publicacion,
      autoaplica: row.autoaplica,
      fuente_sha256: row.fuente_sha256,
    })),
    riesgos: [
      'Las fuentes sin texto extraido requieren parser/preview antes de publicarse.',
      'Las detecciones por palabra clave no sustituyen normalizacion comercial por dominio.',
      'No se resuelven vigencias ni condiciones por inferencia.',
      'La publicacion durable en DB requiere flujo de Fuentes Comerciales y autorizacion cuando aplique.',
    ],
  };
}

export { BENEFIT_DEFINITIONS };
