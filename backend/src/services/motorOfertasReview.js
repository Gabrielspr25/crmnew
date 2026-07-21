import XLSX from 'xlsx';
import { indexPriceWorkbook, normalizeModel, normalizeText } from './motorOfertasNormalizer.js';

const MODEL_STOP_WORDS = new Set([
  'SAMSUNG', 'APPLE', 'IPHONE', 'MOTOROLA', 'MOTO', 'GALAXY', 'GXY',
  'DE', 'LA', 'EL', 'Y', 'CON', 'SIN', 'GB', '5G', 'LTE', 'ULTRA',
]);

function asRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
}

function sourceRow(contradiction) {
  const sources = contradiction?.fuentes_enfrentadas
    ?? contradiction?.sources
    ?? contradiction?.source
    ?? [];
  const source = Array.isArray(sources) ? sources[0] : sources;
  return {
    sheet: source?.sheet ?? source?.hoja ?? null,
    row: Number(source?.row ?? source?.fila) || null,
  };
}

function parseResolution(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function reviewStatus(contradiction) {
  if (contradiction?.estado === 'resuelta') return 'resuelto';
  return parseResolution(contradiction?.resolucion)?.tipo === 'sin_equivalencia'
    ? 'sin_equivalencia'
    : 'pendiente';
}

function headerIndex(rows) {
  return rows.findIndex((row) => {
    const cells = row.map(normalizeText);
    return cells.includes('OFERTA')
      && cells.some((cell) => cell.includes('PLANES QUE APLICAN'))
      && cells.some((cell) => cell.includes('EQUIPOS QUE APLICAN'));
  });
}

function columnIndex(headers, expression) {
  return headers.map(normalizeText).findIndex((cell) => expression.test(cell));
}

function splitModels(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((model) => model.replace(/^\s*(?:NUEVO|NEW)!?\s*/i, '').replace(/\*+$/g, '').trim())
    .filter(Boolean);
}

function financingRows(financingBuffer) {
  const workbook = XLSX.read(financingBuffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => {
    const nameNormalized = normalizeText(name);
    return nameNormalized.includes('OFERTAS')
      && nameNormalized.includes('EQUIPOS')
      && nameNormalized.includes('PORTAFOLIO');
  });
  if (!sheetName) throw new Error('No se encontro la hoja Ofertas Equipos en Portafolio');
  const rows = asRows(workbook.Sheets[sheetName]);
  const headerAt = headerIndex(rows);
  if (headerAt < 0) throw new Error('No se encontro el encabezado de ofertas');
  const headers = rows[headerAt];
  const offerColumn = columnIndex(headers, /^OFERTA$/);
  const planColumn = columnIndex(headers, /PLANES QUE APLICAN/);
  const equipmentColumn = columnIndex(headers, /EQUIPOS QUE APLICAN/);
  const termsColumns = headers
    .map((cell, index) => ({ cell: normalizeText(cell), index }))
    .filter(({ cell }) => cell.includes('TERMINOS Y CONDICIONES'))
    .map(({ index }) => index);
  const result = [];
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const offer = String(row[offerColumn] ?? '').trim();
    const plan = String(row[planColumn] ?? '').trim();
    const models = splitModels(row[equipmentColumn]);
    if (!offer || !plan || models.length === 0) continue;
    const terms = termsColumns
      .map((column) => String(row[column] ?? '').trim())
      .filter(Boolean)
      .join('\n');
    result.push({
      sheet: sheetName,
      row: index + 1,
      offer,
      plan,
      terms,
      models,
    });
  }
  return result;
}

function identityTokens(value) {
  return normalizeModel(value)
    .split(' ')
    .filter((token) => token.length > 1 && !MODEL_STOP_WORDS.has(token));
}

function isCandidate(model, priceEntry) {
  const wanted = identityTokens(model);
  const actual = new Set(identityTokens(priceEntry.model));
  const numeric = wanted.filter((token) => /\d/.test(token));
  if (numeric.some((token) => !actual.has(token))) return false;
  const overlap = wanted.filter((token) => actual.has(token));
  return overlap.length >= Math.min(2, wanted.length);
}

function candidateId(entry) {
  return [entry.sku_sif ?? 'sin-sku', entry.source.sheet, entry.source.row].join('|');
}

function candidateRows(model, priceEntries) {
  return priceEntries
    .filter((entry) => isCandidate(model, entry))
    .map((entry) => ({
      id: candidateId(entry),
      modelo: entry.model,
      sku_sif: entry.sku_sif,
      sap: entry.sap,
      precio_regular: entry.precio_regular,
      fuente: entry.source,
    }));
}

function modelFromDetail(detail) {
  const match = String(detail ?? '').match(/para\s+(.+?)\.?$/i);
  return match?.[1]?.trim() ?? null;
}

function findOccurrenceRow(rows, contradiction, used) {
  const source = sourceRow(contradiction);
  const model = modelFromDetail(contradiction.detalle ?? contradiction.detail);
  const keyPrefix = `${source.sheet ?? ''}:${source.row ?? ''}:`;
  const candidates = rows.filter((row) =>
    (!source.sheet || row.sheet === source.sheet)
    && (!source.row || row.row === source.row)
  );
  if (model) {
    return {
      ...(candidates[0] ?? {
        sheet: source.sheet,
        row: source.row,
        offer: null,
        plan: null,
        terms: null,
      }),
      model,
    };
  }
  for (const row of candidates) {
    for (const currentModel of row.models) {
      const key = `${keyPrefix}${normalizeModel(currentModel)}`;
      if (model && normalizeModel(currentModel) !== normalizeModel(model)) continue;
      const usedCount = used.get(key) ?? 0;
      if (usedCount < row.models.filter((item) => normalizeModel(item) === normalizeModel(currentModel)).length) {
        used.set(key, usedCount + 1);
        return { ...row, model: currentModel };
      }
    }
  }
  return {
    sheet: source.sheet,
    row: source.row,
    offer: null,
    plan: null,
    terms: null,
    model,
  };
}

function distinctCount(items) {
  return new Set(items.filter(Boolean)).size;
}

export function buildOfferReviewSnapshot({
  financingBuffer,
  priceListBuffer,
  version,
  contradictions,
  vigencia,
  comparacion = null,
}) {
  const rows = financingRows(financingBuffer);
  const priceIndex = indexPriceWorkbook(priceListBuffer);
  const open = (contradictions ?? []).filter((item) => item?.bloqueante ?? item?.blocking ?? true);
  const equipmentContradictions = open.filter((item) =>
    (item.codigo ?? item.code) === 'equipo_sin_coincidencia_exacta'
  );
  const used = new Map();
  const equipos = equipmentContradictions.map((contradiction) => {
    const occurrence = findOccurrenceRow(rows, contradiction, used);
    const resolution = parseResolution(contradiction.resolucion);
    return {
      id: contradiction.id,
      fila_origen: occurrence.row,
      hoja_origen: occurrence.sheet,
      regla_oferta: occurrence.offer,
      plan: occurrence.plan,
      modelo_generico: occurrence.model,
      terminos_originales: occurrence.terms,
      candidatos: candidateRows(occurrence.model, priceIndex.entries),
      estado_revision: reviewStatus(contradiction),
      equivalencia_propuesta: resolution?.tipo === 'equivalencia_propuesta'
        ? resolution.candidate_id
        : null,
      equivalencia_confirmada: contradiction.estado === 'resuelta',
    };
  });
  const repetitions = new Map();
  for (const item of equipos) {
    const key = item.modelo_generico;
    repetitions.set(key, (repetitions.get(key) ?? 0) + 1);
  }
  for (const item of equipos) {
    item.repeticiones_otras_filas = Math.max(0, (repetitions.get(item.modelo_generico) ?? 1) - 1);
  }

  const business_red = open
    .filter((item) => (item.codigo ?? item.code) === 'contrato_oferta_invalido')
    .filter((item) => /BUSINESS RED/i.test(String(item.detalle ?? item.detail ?? '')))
    .map((contradiction) => {
      const source = sourceRow(contradiction);
      const row = rows.find((item) => item.sheet === source.sheet && item.row === source.row) ?? {};
      const resolution = parseResolution(contradiction.resolucion);
      return {
        id: contradiction.id,
        fila_origen: source.row,
        hoja_origen: source.sheet,
        texto_original: [row.offer, row.plan, row.terms].filter(Boolean).join('\n'),
        dato_pendiente: String(contradiction.detalle ?? contradiction.detail ?? ''),
        alcance_propuesto: resolution?.tipo === 'alcance_business_red_propuesto'
          ? resolution.familias ?? []
          : [],
        estado_revision: reviewStatus(contradiction),
      };
    });

  return {
    ok: true,
    version,
    vigencia,
    resumen: {
      filas_procesadas: distinctCount([...equipos, ...business_red].map((item) => `${item.hoja_origen}:${item.fila_origen}`)),
      bloqueos_totales: equipmentContradictions.length + business_red.length,
      bloqueos_equipos: equipmentContradictions.length,
      bloqueos_business_red: business_red.length,
      modelos_genericos_unicos: distinctCount(equipos.map((item) => item.modelo_generico)),
      filas_afectadas: distinctCount([...equipos, ...business_red].map((item) => `${item.hoja_origen}:${item.fila_origen}`)),
      cambios_detectados: comparacion?.cambios_detectados ?? 0,
      ofertas_nuevas: comparacion?.ofertas_nuevas ?? 0,
      ofertas_modificadas: comparacion?.ofertas_modificadas ?? 0,
      ofertas_salieron: comparacion?.ofertas_salieron ?? 0,
      precios_nuevos_modificados: comparacion?.precios_nuevos_modificados ?? 0,
    },
    equipos,
    business_red,
    comparacion,
  };
}
