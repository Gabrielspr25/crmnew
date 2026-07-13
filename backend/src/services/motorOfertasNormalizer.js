import XLSX from 'xlsx';
import { offerContractSchema } from './motorOfertasContract.js';

const ALLOWED_TERMS = Object.freeze([12, 20, 24, 30, 36]);
const EVENT_ORDER = Object.freeze([
  'linea_nueva',
  'portabilidad',
  'renovacion',
  'linea_adicional',
]);

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
      entries.push({
        model,
        normalizedModel,
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
  for (const entry of entries) {
    const matches = byModel.get(entry.normalizedModel) ?? [];
    matches.push(entry);
    byModel.set(entry.normalizedModel, matches);
  }

  return { entries, byModel };
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
  const families = [];
  const definitions = [
    ['business_red_plus', /\bBUSINESS RED PLUS\b/],
    ['business_red_extreme', /\bBUSINESS RED EXTREME\b/],
    ['business_red_supreme', /\bBUSINESS RED SUPREME\b/],
    ['business_red_sin_fronteras', /\bBUSINESS RED SIN FRONTERAS\b/],
  ];
  for (const [family, pattern] of definitions) {
    if (pattern.test(text)) families.push(family);
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
  for (const match of text.matchAll(/\b(12|20|24|30|36)\s+(?:PLAZOS?|MESES?)\b/g)) {
    const term = Number(match[1]);
    if (ALLOWED_TERMS.includes(term)) terms.add(term);
  }
  return [...terms].sort((left, right) => left - right);
}

function parseBanLimit(value) {
  const text = normalizeText(value);
  let quantity = null;
  const perBan = text.match(/(?:CUATRO\s*4|4)\s+LINEAS?\s+POR\s+BAN/);
  if (perBan) quantity = 4;
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
    .filter(Boolean);
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

function contradiction({ code, offerKey = null, detail, sheet, row }) {
  return {
    code,
    severity: 'error',
    blocking: true,
    offerKey,
    detail,
    source: sourceForRow(sheet, row),
  };
}

function matchEquipment(model, priceIndex, sourceId) {
  const normalized = normalizeModel(model);
  const matches = priceIndex.byModel.get(normalized) ?? [];
  if (matches.length !== 1) {
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
    };
  }

  const match = matches[0];
  return {
    snapshot: {
      equipo_key: match.sku_sif || slug(match.model),
      modelo_comercial: model,
      modelo_oficial: match.model,
      sku_sif: match.sku_sif,
      sap: match.sap,
      precio_regular: match.precio_regular,
      coincidencia: 'exacta',
      fuente_precio_id: sourceId,
      mensualidades: match.mensualidades,
      fuente_precio: match.source,
    },
    exact: true,
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

  const rows = rowsForSheet(financingWorkbook.Sheets[sheetName]);
  let header = null;

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
    const events = parseEvents(offerText, termsText);
    const families = parseFamilies(planText, termsText);
    const planTypes = parsePlanTypes(planText, termsText);
    const terms = parseTerms(`${offerText} ${termsText}`);
    const models = splitEquipment(equipmentText);
    const equipment = [];
    let exactMatches = 0;

    for (const model of models) {
      const matched = matchEquipment(
        model,
        priceIndex,
        sourceIds.lista_precios
      );
      equipment.push(matched.snapshot);
      if (matched.exact) {
        exactMatches += 1;
      } else {
        contradictions.push(contradiction({
          code: 'equipo_sin_coincidencia_exacta',
          offerKey: identity.id,
          detail: `No hay una coincidencia unica para ${model}.`,
          sheet: sheetName,
          row: excelRow,
        }));
      }
    }

    const state = exactMatches === equipment.length
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
      blockingContradictions: contradictions.filter((item) => item.blocking).length,
    },
  };
}
