const ACCENTS = /[\u0300-\u036f]/g;

const ACCOUNT_TYPES = [
  'Business Wireline Small',
  'Business Regular',
  'Business Corporate',
  'Business Credit Limit',
  'Business BYOP Corporate',
  'Business BYOP DBA',
];

const PLAN_DEFINITIONS = [
  {
    key: 'PLUS',
    marker: 'BUSINESS RED PLUS',
    seccion_key: 'business_red_plus',
    titulo: 'Business Red PLUS',
    orden: 15,
    codigo_individual: 'BREDPLUS',
    precio_individual: 65,
    hotspot: 'Hotspot 60GB',
  },
  {
    key: 'EXTREME',
    marker: 'BUSINESS RED EXTREME',
    seccion_key: 'business_red_extreme',
    titulo: 'Business Red EXTREME',
    orden: 20,
    codigo_individual: 'BREDEXT',
    precio_individual: 75,
    hotspot: 'Hotspot 100GB',
  },
  {
    key: 'SUPREME',
    marker: 'BUSINESS RED SUPREME',
    seccion_key: 'business_red_supreme',
    titulo: 'Business Red SUPREME',
    orden: 30,
    codigo_individual: 'BREDSUP',
    precio_individual: 95,
    hotspot: 'Hotspot ilimitado',
  },
  {
    key: 'SIN FRONTERAS',
    marker: 'BUSINESS RED SIN FRONTERAS',
    seccion_key: 'business_red_sin_fronteras',
    titulo: 'Business Red SIN FRONTERAS',
    orden: 40,
    codigo_individual: 'BREDSF',
    precio_individual: 100,
    hotspot: 'Hotspot ilimitado',
  },
];

function fold(value) {
  return String(value || '').normalize('NFD').replace(ACCENTS, '').toUpperCase();
}

function money(value) {
  const num = Number(String(value || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function moneyText(value) {
  const num = money(value);
  return num == null ? '' : `$${String(num).replace(/\.00$/, '')}`;
}

function subtitleFor(rows) {
  const last = rows[rows.length - 1];
  return `${rows[0]?.codigo_vendedor || ''} · 10 lineas x ${last?.total_regular || ''} / ${last?.total_autopay || ''} AutoPay`;
}

function parseRows(block) {
  const normalized = block.replace(/\r/g, ' ').replace(/\s+/g, ' ');
  const rowPattern = /(\d{1,2})\s+l[ií]neas?\s+([A-Z]{4,8}1)\s+\$(\d+(?:\.\d+)?)\s+([A-Z]{4,8}\d{1,2})\s+\$(\d+(?:\.\d+)?)\s+\$(\d+(?:\.\d+)?)\/\$(\d+(?:\.\d+)?)\s+\$(\d+(?:\.\d+)?)\/\$(\d+(?:\.\d+)?)/gi;
  const rows = [];
  for (const match of normalized.matchAll(rowPattern)) {
    rows.push({
      linea: Number(match[1]),
      lineas: `${Number(match[1])} linea${Number(match[1]) === 1 ? '' : 's'}`,
      codigo_vendedor: match[2],
      precio_vendedor: moneyText(match[3]),
      codigo_sistema: match[4],
      precio_factura_linea: moneyText(match[5]),
      promedio_regular: moneyText(match[6]),
      promedio_autopay: moneyText(match[7]),
      total_regular: moneyText(match[8]),
      total_autopay: moneyText(match[9]),
    });
  }
  let totalRegular = 0;
  let totalAutopay = 0;
  return rows.sort((a, b) => a.linea - b.linea).map((row) => {
    const price = money(row.precio_factura_linea) || 0;
    totalRegular += price;
    totalAutopay += Math.max(0, price - 10);
    return {
      ...row,
      promedio_regular: moneyText(Number((totalRegular / row.linea).toFixed(2))),
      promedio_autopay: moneyText(Number((totalAutopay / row.linea).toFixed(2))),
      total_regular: moneyText(totalRegular),
      total_autopay: moneyText(totalAutopay),
    };
  });
}

function planBlock(text, definition) {
  const source = fold(text);
  const marker = `PROCESO DE ACTIVACION PLAN VOLTE ${definition.marker}`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const nextStarts = PLAN_DEFINITIONS
    .filter((item) => item.key !== definition.key)
    .map((item) => source.indexOf(`PROCESO DE ACTIVACION PLAN VOLTE ${item.marker}`, start + marker.length))
    .filter((index) => index > start);
  const end = nextStarts.length ? Math.min(...nextStarts) : source.length;
  return text.slice(start, end);
}

function buildModule(definition, rows, source) {
  return {
    pagina: 'moviles',
    seccion_key: definition.seccion_key,
    titulo: definition.titulo,
    subtitulo: subtitleFor(rows),
    descripcion: 'Plan multilinea Business Red por suscriptor publicado desde boletin oficial.',
    orden: definition.orden,
    activo: true,
    tipo: 'multilinea',
    contenido: {
      nota: 'El vendedor activa todas las lineas con el codigo base. El sistema ajusta el plan por cantidad de lineas activadas.',
      lineas: rows.map((row) => ({
        linea: row.linea,
        codigo: row.codigo_sistema,
        precio: money(row.precio_factura_linea),
      })),
      filas: rows.map((row) => ({
        linea: row.linea,
        codigo: row.codigo_sistema,
        precio: money(row.precio_factura_linea),
      })),
      precios_linea: rows.map((row) => money(row.precio_factura_linea)),
      hotspot: definition.hotspot,
      activacion: {
        filas: rows.map((row) => {
          const { linea, ...visibleRow } = row;
          return visibleRow;
        }),
        formato: 'multilinea_suscriptor',
        columnas: [
          'Account Types Disponibles',
          'Codigo para que el vendedor pueda activar al cliente',
          'Precio regular por linea que pone el vendedor',
          'El sistema luego cambia el plan de acuerdo a cantidad de lineas activadas',
          'Precio regular que vera el cliente en factura por linea',
          'Precio promedio por linea regular/con Autopay',
          'Precio Total que vera el cliente en su factura regular/con Auto Pay',
        ],
        account_types: ACCOUNT_TYPES,
        titulo_proceso: `PROCESO DE ACTIVACION PLAN VOLTE ${definition.marker}`,
        codigo_individual: definition.codigo_individual,
        precio_individual: moneyText(definition.precio_individual),
        source,
      },
      disponible: ['Smartphones', 'Tablets', 'Modems Banda Ancha'],
      max_lineas: 10,
      dispositivos: ['Smartphones', 'Tablets', 'Modems Banda Ancha'],
      autopay_descuento: 10,
    },
  };
}

export function parseBusinessRedMultilineaText(text, { fileName = null, sourceId = null } = {}) {
  const warnings = [];
  const source = { archivo: fileName, fuente_id: sourceId };
  const modulos = [];
  for (const definition of PLAN_DEFINITIONS) {
    const block = planBlock(text, definition);
    if (!block) {
      warnings.push({ codigo: 'tabla_no_encontrada', plan: definition.titulo });
      continue;
    }
    const rows = parseRows(block);
    if (rows.length !== 10) {
      warnings.push({ codigo: 'filas_incompletas', plan: definition.titulo, esperado: 10, encontrado: rows.length });
      continue;
    }
    modulos.push(buildModule(definition, rows, source));
  }
  return {
    modulos,
    advertencias: warnings,
    resumen: {
      modulos: modulos.length,
      filas: modulos.reduce((total, modulo) => total + (modulo.contenido.activacion?.filas?.length || 0), 0),
    },
    source,
  };
}

export function diffBusinessRedMultilinea(previousModules, currentModules) {
  const before = new Map((previousModules || []).map((item) => [item.seccion_key, item]));
  const nuevos = currentModules.filter((item) => !before.has(item.seccion_key)).length;
  const modificados = currentModules.filter((item) => {
    const prior = before.get(item.seccion_key);
    return prior && JSON.stringify(prior.contenido || {}) !== JSON.stringify(item.contenido || {});
  }).length;
  return {
    modulos_anteriores: before.size,
    modulos_actuales: currentModules.length,
    nuevos,
    modificados,
  };
}
