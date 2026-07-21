import XLSX from 'xlsx';
import { offerContractSchema } from './motorOfertasContract.js';

const ALLOWED_TERMS = Object.freeze([12, 20, 24, 30, 36]);
const EVENT_ORDER = Object.freeze([
  'linea_nueva',
  'portabilidad',
  'renovacion',
  'linea_adicional',
]);

const SPANISH_MONTHS = Object.freeze({
  ENERO: 0,
  FEBRERO: 1,
  MARZO: 2,
  ABRIL: 3,
  MAYO: 4,
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
  OCTUBRE: 9,
  NOVIEMBRE: 10,
  DICIEMBRE: 11,
});

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9$%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeModel(value) {
  return normalizeText(value)
    .replace(/\b(?:NUEVO|NEW)\b!?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeOfferEquipmentIdentity(value) {
  let normalized = normalizeModel(value)
    .replace(/\bGXY\b/g, 'GALAXY')
    .replace(/\b[A-Z]{1,4}\d{3,}[A-Z0-9]*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const capacity = normalized.match(/\b\d{2,4}\s*GB\b/);
  if (capacity) {
    normalized = normalized.slice(0, capacity.index + capacity[0].length);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

export function normalizeCommercialModel(value) {
  return normalizeModel(value)
    .replace(/(\d{4})[A-Z]{1,4}\d{3,}[A-Z0-9]*(?:\s+\d+)?\b.*$/, '$1')
    .replace(/\b[A-Z]{1,4}\d{3,}[A-Z0-9]*(?:\s+\d+)?\b.*$/, ' ')
    .replace(/\b\d{2,4}\s*GB\b.*$/, ' ')
    .replace(/\b(?:SAMSUNG|GALAXY|GXY|MOTOROLA|MOTO|IPHONE|IPH|5G)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capacityFromEquipmentIdentity(identity) {
  return identity.match(/\b\d{2,4}\s*GB\b/)?.[0].replace(/\s+/g, '') ?? null;
}

function modelWithoutEquipmentCapacity(identity) {
  const capacity = identity.match(/\b\d{2,4}\s*GB\b/);
  return capacity ? identity.slice(0, capacity.index).trim() : identity;
}

export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? '')
    .replace(/[$,\s]/g, '')
    .replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[$%]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function rowsForSheet(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
}

function readWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('El normalizador requiere buffers Excel');
  }
  return XLSX.read(buffer, { type: 'buffer', cellDates: false });
}

function isoDate(year, monthName, day) {
  const month = SPANISH_MONTHS[monthName];
  const numericDay = Number(day);
  const numericYear = Number(year);
  if (month === undefined || !Number.isInteger(numericDay) || !Number.isInteger(numericYear)) {
    return null;
  }
  const value = new Date(Date.UTC(numericYear, month, numericDay));
  if (
    value.getUTCFullYear() !== numericYear
    || value.getUTCMonth() !== month
    || value.getUTCDate() !== numericDay
  ) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function explicitRangeFromHeader(text) {
  const normalized = normalizeText(text);
  const sameMonth = normalized.match(
    /\b(?:DEL\s+)?(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(20\d{2})\b/
  );
  if (sameMonth) {
    const desde = isoDate(sameMonth[4], sameMonth[3], sameMonth[1]);
    const hasta = isoDate(sameMonth[4], sameMonth[3], sameMonth[2]);
    return desde && hasta && desde <= hasta ? { desde, hasta } : null;
  }

  const twoMonths = normalized.match(
    /\b(?:DEL\s+)?(\d{1,2})\s+DE\s+([A-Z]+)\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(20\d{2})\b/
  );
  if (!twoMonths) return null;
  const desde = isoDate(twoMonths[5], twoMonths[2], twoMonths[1]);
  const hasta = isoDate(twoMonths[5], twoMonths[4], twoMonths[3]);
  return desde && hasta && desde <= hasta ? { desde, hasta } : null;
}

function headerRange(buffer) {
  const workbook = readWorkbook(buffer);
  const ranges = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = rowsForSheet(workbook.Sheets[sheetName]).slice(0, 10);
    for (const row of rows) {
      const range = explicitRangeFromHeader(row.map((cell) => String(cell ?? '')).join(' '));
      if (range) ranges.push(range);
    }
  }
  return ranges.sort((left, right) =>
    right.hasta.localeCompare(left.hasta) || right.desde.localeCompare(left.desde)
  )[0] ?? null;
}

function validityForRange(range, now) {
  if (!range) {
    return { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  }
  const current = new Date(now).toISOString().slice(0, 10);
  return {
    ...range,
    estado: current < range.desde ? 'futura' : current > range.hasta ? 'vencida' : 'vigente',
  };
}

export function inferSourceValidity({ financingBuffer, priceListBuffer, now = new Date() }) {
  const tabla_financiamiento = validityForRange(headerRange(financingBuffer), now);
  const lista_precios = validityForRange(headerRange(priceListBuffer), now);
  let preview;
  if (
    tabla_financiamiento.estado === 'pendiente_confirmacion'
    || lista_precios.estado === 'pendiente_confirmacion'
  ) {
    preview = { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  } else {
    const desde = [tabla_financiamiento.desde, lista_precios.desde].sort().at(-1);
    const hasta = [tabla_financiamiento.hasta, lista_precios.hasta].sort()[0];
    preview = desde <= hasta
      ? validityForRange({ desde, hasta }, now)
      : { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  }
  return { tabla_financiamiento, lista_precios, preview };
}

function findHeaderIndex(rows, requiredPatterns) {
  return rows.findIndex((row) => {
    const cells = row.map(normalizeText);
    return requiredPatterns.every((pattern) =>
      cells.some((cell) => pattern.test(cell))
    );
  });
}

function findColumn(headers, predicate) {
  return headers.findIndex((header) => predicate(normalizeText(header)));
}

function monthlyColumns(headers) {
  const columns = [];
  headers.forEach((header, index) => {
    const normalized = normalizeText(header);
    const match = normalized.match(/MENSUALIDAD\s+(12|20|24|30|36)\s+MESES/);
    if (match) columns.push({ index, months: Number(match[1]) });
  });
  return columns;
}

export function indexPriceWorkbook(buffer) {
  const workbook = readWorkbook(buffer);
  const entries = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = rowsForSheet(workbook.Sheets[sheetName]);
    const headerIndex = findHeaderIndex(rows, [
      /MODELO/,
      /(?:ITEM CODE SIF|CODIGO SIF|SIF)/,
      /PRECIO/,
    ]);
    if (headerIndex < 0) continue;

    const headers = rows[headerIndex];
    const modelColumn = findColumn(headers, (cell) => cell === 'MODELO');
    const skuColumn = findColumn(headers, (cell) =>
      /(?:ITEM CODE SIF|CODIGO SIF|SIF)/.test(cell)
    );
    const sapColumn = findColumn(headers, (cell) =>
      /(?:MATERIAL SAP|CODIGO SAP|^SAP$)/.test(cell)
    );
    const priceColumn = findColumn(headers, (cell) =>
      cell === 'PRECIO' || cell === 'PRECIO REGULAR'
    );
    const paymentColumns = monthlyColumns(headers);

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index];
      const model = String(row[modelColumn] ?? '').trim();
      if (!model) continue;
      const normalizedModel = normalizeModel(model);
      if (!normalizedModel) continue;
      const offerIdentity = normalizeOfferEquipmentIdentity(model);
      entries.push({
        model,
        normalizedModel,
        offerIdentity,
        sku_sif: String(row[skuColumn] ?? '').trim() || null,
        sap: sapColumn >= 0 ? String(row[sapColumn] ?? '').trim() || null : null,
        precio_regular: parseMoney(row[priceColumn]),
        mensualidades: paymentColumns
          .map(({ index: column, months }) => ({
            meses: months,
            monto: parseMoney(row[column]),
          }))
          .filter((payment) => payment.monto !== null),
        source: {
          sheet: sheetName,
          row: index + 1,
        },
      });
    }
  }

  const byModel = new Map();
  const byOfferIdentity = new Map();
  const byModelWithoutCapacity = new Map();
  const byCommercialModel = new Map();
  for (const entry of entries) {
    const matches = byModel.get(entry.normalizedModel) ?? [];
    matches.push(entry);
    byModel.set(entry.normalizedModel, matches);
    const variants = byOfferIdentity.get(entry.offerIdentity) ?? [];
    variants.push(entry);
    byOfferIdentity.set(entry.offerIdentity, variants);

    const commercialModel = normalizeCommercialModel(entry.model);
    if (commercialModel) {
      const commercialVariants = byCommercialModel.get(commercialModel) ?? [];
      commercialVariants.push(entry);
      byCommercialModel.set(commercialModel, commercialVariants);
    }

    const capacity = capacityFromEquipmentIdentity(entry.offerIdentity);
    if (!capacity) continue;
    const modelWithoutCapacity = modelWithoutEquipmentCapacity(entry.offerIdentity);
    const capacityVariants = byModelWithoutCapacity.get(modelWithoutCapacity) ?? [];
    capacityVariants.push(entry);
    byModelWithoutCapacity.set(modelWithoutCapacity, capacityVariants);
  }

  return {
    entries,
    byModel,
    byOfferIdentity,
    byModelWithoutCapacity,
    byCommercialModel,
  };
}

function normalizeNewRegularPriceIdentity(value) {
  return normalizeOfferEquipmentIdentity(value)
    .replace(/^MOTOROLA MOTO\s+/, 'MOTOROLA ')
    .replace(/^MOTO\s+/, 'MOTOROLA ')
    .replace(/\s+/g, ' ')
    .trim();
}

function indexNewRegularPrices(workbook, sheetName, sourceId) {
  const byIdentity = new Map();
  const rows = rowsForSheet(workbook.Sheets[sheetName]);

  rows.forEach((row, index) => {
    if (!row.some((cell) => /PRECIO REGULAR NUEVO/.test(normalizeText(cell)))) return;
    row.forEach((cell) => {
      String(cell ?? '').split(/\r?\n/).forEach((line) => {
        const match = line.trim().match(/^(.+?)\s*[-–—]\s*\$?\s*([\d,.]+)\s*$/);
        if (!match) return;
        const model = match[1].trim();
        const precio_regular = parseMoney(match[2]);
        if (!model || precio_regular === null) return;
        const identity = normalizeNewRegularPriceIdentity(model);
        const entries = byIdentity.get(identity) ?? [];
        entries.push({
          model,
          identity,
          precio_regular,
          sourceId,
          source: { sheet: sheetName, row: index + 1 },
        });
        byIdentity.set(identity, entries);
      });
    });
  });

  return { byIdentity };
}

export function parsePlanScope(value) {
  const raw = String(value ?? '');
  const normalized = normalizeText(raw);
  const amounts = [...raw.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const minimum = amounts[0] ?? null;
  const openEnded = /\b(?:DESDE|EN ADELANTE)\b/.test(normalized);
  return {
    minimum,
    maximum: minimum === null || openEnded ? null : minimum,
  };
}

export function parseEvents(...values) {
  const text = normalizeText(values.join(' '));
  const events = new Set();
  if (/\b(?:LINEA|LINEAS) NUEVA(?:S)?\b|\bCLIENTE(?:S)? NUEVO(?:S)?\b/.test(text)) {
    events.add('linea_nueva');
  }
  if (/\bPORTABILIDAD(?:ES)?\b/.test(text)) events.add('portabilidad');
  if (/\bRENOVACION(?:ES)?\b/.test(text)) events.add('renovacion');
  if (
    /\bLINEA(?:S)? ADICIONAL(?:ES)?\b|\bANADAN? LINEA(?:S)?\b/.test(text)
  ) {
    events.add('linea_adicional');
  }
  return EVENT_ORDER.filter((event) => events.has(event));
}

function parseFamilies(...values) {
  const text = normalizeText(values.join(' '));
  if (!/\bBUSINESS RED\b/.test(text)) return [];
  const families = [];
  const definitions = [
    ['business_red_plus', /\bBUSINESS RED PLUS\b/],
    ['business_red_extreme', /\b(?:BUSINESS )?RED EXTREME\b/],
    ['business_red_supreme', /\b(?:BUSINESS )?RED SUPREME\b/],
    ['business_red_sin_fronteras', /\b(?:BUSINESS RED )?SIN FRONTERAS\b/],
  ];
  for (const [family, pattern] of definitions) {
    if (pattern.test(text)) families.push(family);
  }
  // La tabla usa "planes Business RED" para abarcar la familia completa.
  // Solo se expande a todas las familias cuando la fila menciona Business RED
  // de forma generica y no nombra ninguna familia especifica.
  if (families.length === 0 && /\bBUSINESS RED\b/.test(text)) {
    return definitions.map(([family]) => family);
  }
  return families;
}

function parsePlanTypes(planText, termsText) {
  const text = normalizeText(`${planText} ${termsText}`);
  const types = [];
  if (/\$\s*\d+/.test(String(planText ?? '')) || !/BUSINESS RED/.test(text)) {
    types.push('individual');
  }
  if (/\bBUSINESS RED\b/.test(text)) types.push('multilinea_business_red');
  return [...new Set(types)];
}

function parseTerms(value) {
  const text = normalizeText(value);
  const terms = new Set();
  for (const match of text.matchAll(
    /\b(12|20|24|30|36)(?:\s+Y\s+(12|20|24|30|36))?\s+(?:PLAZOS?|MESES?)\b/g
  )) {
    for (const value of match.slice(1)) {
      const term = Number(value);
      if (ALLOWED_TERMS.includes(term)) terms.add(term);
    }
  }
  return [...terms].sort((left, right) => left - right);
}

function parseBanLimit(value) {
  const text = normalizeText(value);
  let quantity = null;
  const perBan = text.match(/(?:[A-Z]+\s+)?(\d{1,2})\s+LINEAS?\s+POR\s+BAN/);
  if (perBan) quantity = Number(perBan[1]);
  if (quantity === null) {
    const range = text.match(/(?:DESDE LA 1 HASTA|HASTA)\s+(\d{1,2})/);
    if (range) quantity = Number(range[1]);
  }
  return {
    aplica: quantity !== null,
    cantidad: quantity,
    fuera_limite: quantity === null ? 'no_aplica' : 'pendiente_fuente',
  };
}

function parseTradeIn(offerText, termsText, events) {
  const text = normalizeText(`${offerText} ${termsText}`);
  const withoutNegative = text.replace(/NO REQUIERE TRADE IN/g, '');
  const required = /\bREQUIERE TRADE IN\b/.test(withoutNegative);
  const requiredEvents = required && events.includes('renovacion')
    ? ['renovacion']
    : [];
  return {
    requerido_eventos: requiredEvents,
    no_requerido_eventos: events.filter((event) => !requiredEvents.includes(event)),
    texto: String(offerText ?? '').trim(),
  };
}

function splitEquipment(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*(?:NUEVO|NEW)!?\s*/i, '').replace(/\*+$/g, '').trim())
    .filter((item) => item && !isEquipmentLabel(item));
}

function isEquipmentLabel(value) {
  const normalized = normalizeText(value);
  return normalized === 'OFERTA PARA PLANES MULTILINEAS'
    || normalized === 'DOS EQUIPOS GRATIS'
    || /^CREDITO\s+\$?\d/.test(normalized);
}

function offerIdentity(offerText, planMinimum, row) {
  const normalized = normalizeText(offerText);
  let name = String(offerText ?? '').trim().replace(/\s+/g, ' ');
  let prefix = slug(name) || 'oferta';
  if (/\bGRATIS\b/.test(normalized)) {
    name = 'Equipo gratis';
    prefix = 'equipo-gratis';
  } else if (/50\s*%/.test(normalized)) {
    name = '50% de descuento';
    prefix = '50-descuento';
  }
  return {
    id: `${prefix}-plan-${planMinimum ?? 'sin-monto'}-fila-${row}`,
    name,
  };
}

function documentedBenefitType(offerText) {
  const normalized = normalizeText(offerText);
  if (/\bGRATIS\b/.test(normalized)) return 'gratis';
  if (/\b50\s*%/.test(normalized)) return 'descuento_porcentaje';
  if (/\bCREDITO\b/.test(normalized)) return 'credito';
  return null;
}

function findOfferSheet(workbook) {
  return workbook.SheetNames.find((name) =>
    normalizeText(name).includes('OFERTAS EQUIPOS EN PORTAFOLIO')
  );
}

function offerHeader(row) {
  const normalized = row.map(normalizeText);
  const offer = normalized.findIndex((cell) => cell === 'OFERTA');
  const plan = normalized.findIndex((cell) => cell.includes('PLANES QUE APLICAN'));
  const equipment = normalized.findIndex((cell) => cell.includes('EQUIPOS QUE APLICAN'));
  if (offer < 0 || plan < 0 || equipment < 0) return null;
  return {
    offer,
    plan,
    equipment,
    bonus: normalized.findIndex((cell) => cell.includes('BONOS QUE APLICAN')),
    terms: normalized
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.includes('TERMINOS Y CONDICIONES'))
      .map(({ index }) => index),
  };
}

function sourceForRow(sheet, row) {
  return { sheet, row };
}

function contradiction({
  code,
  offerKey = null,
  detail,
  sheet,
  row,
  sources = [],
}) {
  return {
    code,
    severity: 'error',
    blocking: true,
    offerKey,
    detail,
    source: sourceForRow(sheet, row),
    sources,
  };
}

function matchEquipment(model, priceIndex, newRegularPrices, sourceId) {
  const identity = normalizeOfferEquipmentIdentity(model);
  const overrideCandidates = newRegularPrices.byIdentity.get(
    normalizeNewRegularPriceIdentity(model)
  ) ?? [];
  const override = overrideCandidates.length === 1 ? overrideCandidates[0] : null;
  let matchedIdentity = identity;
  let coincidencia = 'exacta';
  let matches = priceIndex.byOfferIdentity.get(identity) ?? [];
  if (matches.length === 0 && !capacityFromEquipmentIdentity(identity)) {
    const candidates = priceIndex.byModelWithoutCapacity.get(identity) ?? [];
    const capacities = new Set(
      candidates.map((candidate) => capacityFromEquipmentIdentity(candidate.offerIdentity))
    );
    if (capacities.size === 1) {
      matches = candidates;
      matchedIdentity = candidates[0].offerIdentity;
    }
  }
  if (matches.length === 0) {
    const commercialCandidates = priceIndex.byCommercialModel.get(
      normalizeCommercialModel(model)
    ) ?? [];
    if (commercialCandidates.length > 0) {
      matches = commercialCandidates;
      matchedIdentity = commercialCandidates[0].offerIdentity;
      coincidencia = 'equivalencia_aprobada';
    }
  }
  if (matches.length === 0) {
    if (override) {
      return {
        snapshot: {
          equipo_key: slug(override.identity),
          modelo_comercial: model,
          modelo_oficial: override.model,
          sku_sif: null,
          sap: null,
          precio_regular: override.precio_regular,
          coincidencia: 'exacta',
          fuente_precio_id: override.sourceId,
          mensualidades: [],
          variantes: [],
        },
        exact: true,
        sources: [{
          sourceId: override.sourceId,
          sheet: override.source.sheet,
          row: override.source.row,
          modelo: override.model,
          sku_sif: null,
        }],
      };
    }
    return {
      snapshot: {
        equipo_key: slug(model),
        modelo_comercial: model,
        modelo_oficial: null,
        sku_sif: null,
        sap: null,
        precio_regular: null,
        coincidencia: 'pendiente',
        fuente_precio_id: sourceId,
        mensualidades: [],
      },
      exact: false,
      sources: matches.map((match) => ({
        sourceId,
        sheet: match.source.sheet,
        row: match.source.row,
        modelo: match.model,
        sku_sif: match.sku_sif,
      })),
    };
  }

  const match = matches[0];
  const singleVariant = matches.length === 1;
  const variants = matches.map((item) => ({
    modelo: item.model,
    sku_sif: item.sku_sif,
    sap: item.sap,
    precio_regular: override?.precio_regular ?? item.precio_regular,
    mensualidades: item.mensualidades,
    fuente_precio: item.source,
  }));
  return {
    snapshot: {
      equipo_key: slug(matchedIdentity),
      modelo_comercial: model,
      modelo_oficial: matchedIdentity,
      sku_sif: singleVariant ? match.sku_sif : null,
      sap: singleVariant ? match.sap : null,
      precio_regular: override?.precio_regular ?? match.precio_regular,
      coincidencia,
      fuente_precio_id: override?.sourceId ?? sourceId,
      mensualidades: match.mensualidades,
      variantes: variants,
    },
    exact: true,
    sources: [
      ...matches.map((item) => ({
      sourceId,
      sheet: item.source.sheet,
      row: item.source.row,
      modelo: item.model,
      sku_sif: item.sku_sif,
      })),
      ...(override ? [{
        sourceId: override.sourceId,
        sheet: override.source.sheet,
        row: override.source.row,
        modelo: override.model,
        sku_sif: null,
      }] : []),
    ],
  };
}

export function normalizeOfferWorkbooks({
  financingBuffer,
  priceListBuffer,
  sourceIds,
  fileNames,
  vigencia,
}) {
  const financingWorkbook = readWorkbook(financingBuffer);
  const priceWorkbook = readWorkbook(priceListBuffer);
  const priceIndex = indexPriceWorkbook(priceListBuffer);
  const offers = [];
  const contradictions = [];
  const sheetName = findOfferSheet(financingWorkbook);

  if (!sheetName) {
    throw new Error('No se encontro la hoja Ofertas Equipos en Portafolio');
  }

  const newRegularPrices = indexNewRegularPrices(
    financingWorkbook,
    sheetName,
    sourceIds.tabla_financiamiento
  );

  const rows = rowsForSheet(financingWorkbook.Sheets[sheetName]);
  let header = null;
  let processedRows = 0;
  let processedEquipment = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const detectedHeader = offerHeader(row);
    if (detectedHeader) {
      header = detectedHeader;
      continue;
    }
    if (!header) continue;

    const offerText = String(row[header.offer] ?? '').trim();
    const planText = String(row[header.plan] ?? '').trim();
    const equipmentText = String(row[header.equipment] ?? '').trim();
    if (!offerText || !planText || !equipmentText) continue;
    const models = splitEquipment(equipmentText);
    processedRows += 1;
    processedEquipment += models.length;

    const excelRow = index + 1;
    const termsText = header.terms
      .map((column) => String(row[column] ?? '').trim())
      .filter(Boolean)
      .join('\n');
    const bonusText = header.bonus >= 0
      ? String(row[header.bonus] ?? '').trim()
      : '';
    const combined = `${offerText} ${planText} ${termsText}`;

    if (/\bBOTH\b/.test(normalizeText(combined))) {
      contradictions.push(contradiction({
        code: 'alcance_ambiguo_both',
        detail: 'La fuente contiene el alcance ambiguo both.',
        sheet: sheetName,
        row: excelRow,
      }));
      continue;
    }

    const planScope = parsePlanScope(planText);
    const identity = offerIdentity(offerText, planScope.minimum, excelRow);
    const beneficioTipo = documentedBenefitType(offerText);
    const events = parseEvents(offerText, termsText);
    const families = parseFamilies(planText, termsText);
    const planTypes = parsePlanTypes(planText, termsText);
    const terms = parseTerms(`${offerText} ${termsText}`);
    const equipment = [];
    let exactMatches = 0;
    let missingTerms = 0;

    for (const model of models) {
      const matched = matchEquipment(
        model,
        priceIndex,
        newRegularPrices,
        sourceIds.lista_precios
      );
      equipment.push({
        ...matched.snapshot,
        beneficio_tipo: beneficioTipo,
      });
      if (matched.exact) {
        exactMatches += 1;
        if (beneficioTipo === 'gratis') {
          equipment.at(-1).mensualidades = terms.map((meses) => ({ meses, monto: 0 }));
        }
        const availableTerms = new Set(
          equipment.at(-1).mensualidades.map((item) => item.meses)
        );
        for (const term of terms) {
          if (availableTerms.has(term)) continue;
          missingTerms += 1;
          contradictions.push(contradiction({
            code: 'plazo_sin_mensualidad_confirmada',
            offerKey: identity.id,
            detail: `${model} no tiene mensualidad confirmada para ${term} meses.`,
            sheet: sheetName,
            row: excelRow,
            sources: matched.sources,
          }));
        }
      } else {
        contradictions.push(contradiction({
          code: 'equipo_sin_coincidencia_exacta',
          offerKey: identity.id,
          detail: `No hay una coincidencia unica para ${model}.`,
          sheet: sheetName,
          row: excelRow,
          sources: matched.sources,
        }));
      }
    }

    const state = exactMatches === equipment.length && missingTerms === 0
      ? 'confirmada'
      : exactMatches > 0
        ? 'confirmada_parcial'
        : 'pendiente_fuente';

    const candidate = {
      id: identity.id,
      nombre: identity.name,
      estado: state,
      vigencia,
      tipos_plan: planTypes,
      familias: families,
      eventos: events,
      plazos: terms,
      limite_ban: parseBanLimit(termsText),
      equipos: equipment,
      trade_in: parseTradeIn(offerText, termsText, events),
      terminos: {
        texto: termsText,
        bonos_texto: bonusText,
      },
      fuente: {
        tipo: 'tabla_financiamiento',
        hoja: sheetName,
        fila: excelRow,
      },
    };
    const parsed = offerContractSchema.safeParse(candidate);
    if (!parsed.success) {
      contradictions.push(contradiction({
        code: 'contrato_oferta_invalido',
        offerKey: identity.id,
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
        sheet: sheetName,
        row: excelRow,
      }));
      continue;
    }

    offers.push({
      contract: parsed.data,
      derived: {
        planMontoMinimo: planScope.minimum,
        planMontoMaximo: planScope.maximum,
      },
      equipment: parsed.data.equipos,
      trace: {
        sourceId: sourceIds.tabla_financiamiento,
        fileName: fileNames.tabla_financiamiento,
        sheet: sheetName,
        row: excelRow,
        cells: {
          offer: offerText,
          plan: planText,
          equipment: equipmentText,
          bonus: bonusText,
          terms: termsText,
        },
      },
    });
  }

  return {
    offers,
    contradictions,
    inventory: {
      financingSheets: [...financingWorkbook.SheetNames],
      priceSheets: [...priceWorkbook.SheetNames],
    },
    summary: {
      offers: offers.length,
      equipment: offers.reduce((total, offer) => total + offer.equipment.length, 0),
      filas_procesadas: processedRows,
      equipos_procesados: processedEquipment,
      blockingContradictions: contradictions.filter((item) => item.blocking).length,
    },
  };
}
