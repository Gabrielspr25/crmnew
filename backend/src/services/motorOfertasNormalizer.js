import XLSX from 'xlsx';

const ACCENTS = /[\u0300-\u036f]/g;
const WORD_NUMBERS = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

function text(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function fold(value) { return text(value).normalize('NFD').replace(ACCENTS, '').toLowerCase(); }
function cellText(value) { return String(value ?? '').replace(/\r/g, '').trim(); }

export function parseMoney(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

export function normalizeModel(value) {
  return fold(value)
    .replace(/\b(motorola)\b/g, 'moto')
    .replace(/\b(samsung|gxy)\b/g, 'galaxy')
    .replace(/\b(iphone|iph)\b/g, 'iphone')
    .replace(/\b(?:sku|sap|sif)\s*[:#-]?\s*\w+\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeCommercialModel(value) {
  return normalizeModel(value)
    .replace(/\b(flip|fold)(\d+)\b/g, '$1 $2')
    .replace(/\b(moto moto|galaxy galaxy)\b/g, (_, repeated) => repeated.split(' ')[0])
    .replace(/\b\d+\s*(?:gb|tb)\b/g, '')
    .replace(/\b5g\b/g, '')
    .replace(/\b(?:xt\d+(?:\s+\d+)?|[asf]\d{3,}[a-z]?|sm\s*\w+)\b/g, '')
    .replace(/\b(?:black|white|blue|green|gray|grey|silver|gold|pink|purple|red|yellow|orange|titanium|cobalt|violet|sky|cloud|light|darkest|spruce|juniper|grisaille|deep|forest|gibraltar|sea|space|jet|shadow|coral)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePlanScope(value) {
  const raw = text(value);
  const money = raw.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (!money) return { min: null, max: null };
  const amount = Number(money[1]);
  return /\b(desde|en adelante)\b/i.test(raw) ? { min: amount, max: null } : { min: amount, max: amount };
}

export function parseEvents(offerText, termsText) {
  const source = fold(`${offerText}\n${termsText}`);
  const events = [];
  if (/cliente nuevo|lineas? nuevas?/.test(source)) events.push('linea_nueva');
  if (/portabilidad/.test(source)) events.push('portabilidad');
  if (/renovacion/.test(source)) events.push('renovacion');
  if (/linea adicional/.test(source)) events.push('linea_adicional');
  return events;
}

function numberFromWord(value) {
  const normalized = fold(value);
  const numeric = normalized.match(/\b(\d{1,2})\b/);
  if (numeric) return Number(numeric[1]);
  return Object.entries(WORD_NUMBERS).find(([word]) => normalized.includes(word))?.[1] ?? null;
}

export function parseTerms(termsText) {
  const raw = text(termsText);
  const source = fold(raw);
  const plazos = [...source.matchAll(/\b(\d{1,2})\s*plazos?\b/g)].map((match) => Number(match[1]));
  const uniqueTerms = [...new Set(plazos)].sort((a, b) => a - b);
  const banText = source.match(/(?:maximo de |hasta |a )?([a-z]+\s*\(?\d*\)?|\d+)\s+lineas?\s+por\s+ban/);
  const cantidadBan = banText ? numberFromWord(banText[1]) : null;
  return {
    plazos: uniqueTerms,
    limite_ban: cantidadBan ? { aplica: true, cantidad: cantidadBan, fuera_limite: null } : { aplica: false },
    raw,
  };
}

function findHeaderRow(rows, requiredHeaders) {
  return rows.findIndex((row) => {
    const columns = requiredHeaders.map((header) => row.findIndex((cell) => fold(cell).startsWith(header)));
    return columns.every((column) => column >= 0) && new Set(columns).size === columns.length;
  });
}

function columnIndex(row, key) {
  return row.findIndex((cell) => fold(cell).includes(key));
}

function monthlyPayment(row, header, term) {
  const index = header.findIndex((cell) => fold(cell) === String(term));
  return index >= 0 ? parseMoney(row[index]) : null;
}

export function indexPriceWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const equipment = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerRow = findHeaderRow(rows, ['modelo']);
    if (headerRow < 0) continue;
    const header = rows[headerRow];
    const modelIndex = columnIndex(header, 'modelo');
    const skuIndex = ['sku', 'item', 'sif'].map((key) => columnIndex(header, key)).find((index) => index >= 0);
    const sapIndex = columnIndex(header, 'sap');
    const priceIndex = ['precio regular', 'precio'].map((key) => columnIndex(header, key)).find((index) => index >= 0);
    for (let index = headerRow + 1; index < rows.length; index += 1) {
      const row = rows[index];
      const model = cellText(row[modelIndex]);
      if (!model) continue;
      equipment.push({
        modelo_oficial: model,
        modelo_normalizado: normalizeCommercialModel(model),
        sku_sif: skuIndex >= 0 ? text(row[skuIndex]) || null : null,
        sap: sapIndex >= 0 ? text(row[sapIndex]) || null : null,
        precio_regular: priceIndex >= 0 ? parseMoney(row[priceIndex]) : null,
        plazos: [20, 24, 30, 36].map((meses) => ({ meses, pago_mensual: monthlyPayment(row, header, meses) })).filter((term) => term.pago_mensual != null),
        fuente: { hoja: sheetName, fila: index + 1 },
      });
    }
  }
  const byModel = new Map();
  for (const item of equipment) {
    const entries = byModel.get(item.modelo_normalizado) || [];
    entries.push(item);
    byModel.set(item.modelo_normalizado, entries);
  }
  return { equipment, byModel, sheetNames: workbook.SheetNames };
}

function splitModels(value) {
  return cellText(value)
    .split(/\n|;|\s{2,}/)
    .map((model) => model.replace(/\bNUEVO!?\b|\*/gi, '').trim())
    .filter((model) => {
      const normalized = fold(model);
      return Boolean(model) && !/^(oferta para planes|dos equipos gratis|credito\s*\$[\d,.]+:?|nuevo precio regular)/.test(normalized);
    });
}

function findPortafolioSheet(workbook) {
  return workbook.SheetNames.find((name) => fold(name).includes('ofertas equipos en portafolio'));
}

function benefitFrom(offerText) {
  const source = fold(offerText);
  if (/credito/.test(source)) return { tipo: 'credito', monto: parseMoney(offerText) };
  if (/50\s*%/.test(source)) return { tipo: 'descuento_porcentaje', porcentaje: 50 };
  if (/gratis/.test(source)) return { tipo: 'gratis' };
  return { tipo: 'financiado' };
}

function familiesFrom(termsText) {
  const source = fold(termsText);
  if (/\bboth\b/.test(source)) return { families: [], ambiguity: true };
  const families = [];
  if (/business red plus|br plus/.test(source)) families.push('business_red_plus');
  if (/business red extreme|br extreme/.test(source)) families.push('business_red_extreme');
  if (/business red supreme|br supreme/.test(source)) families.push('business_red_supreme');
  if (/sin fronteras/.test(source)) families.push('business_red_sin_fronteras');
  return { families, ambiguity: false };
}

function discountMarker(row) {
  const values = row.map((value) => {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
  }).filter((value) => value != null);
  return values[0] === 1 && values.length >= 4 ? values : null;
}

function extractPriceCodes(value) {
  const source = text(value);
  const up = source.match(/update\s*plus\s*[-:]?\s*(UP[A-Z0-9%]+)/i)?.[1] || null;
  const fi = source.match(/financiamiento\s*[-:]?\s*(FI[A-Z0-9%]+)/i)?.[1] || null;
  return { up, fi };
}

function discountRanges(lineDiscounts) {
  const ranges = [];
  let start = 1;
  let current = lineDiscounts[0] ?? 0;
  for (let index = 1; index <= lineDiscounts.length; index += 1) {
    const next = lineDiscounts[index];
    if (next !== current) {
      ranges.push({ desde: start, hasta: index, descuento: current });
      start = index + 1;
      current = next;
    }
  }
  return ranges;
}

function businessModelRows(rows, headerRow, nextMarkerRow) {
  const header = rows[headerRow] || [];
  const modelIndex = columnIndex(header, 'modelo');
  const priceIndex = columnIndex(header, 'precio regular');
  if (modelIndex < 0 || priceIndex < 0) return [];
  const result = [];
  for (let index = headerRow + 1; index < (nextMarkerRow ?? rows.length); index += 1) {
    const row = rows[index] || [];
    const model = cellText(row[modelIndex]).replace(/\*/g, '').trim();
    if (!model || fold(model) === 'modelo') continue;
    const regular = parseMoney(row[priceIndex]);
    if (regular == null) continue;
    result.push({
      manufacturer: text(row[0]),
      model,
      regular_price: regular,
      source_row: index + 1,
    });
  }
  return result;
}

export function parseBusinessRedPlusWorkbook({ buffer, fileName = null, sourceId = null }) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find((name) => fold(name) === 'ofertas business red plus');
  if (!sheetName) throw new Error('Hoja obligatoria ausente: Ofertas Business Red Plus');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  const markers = rows.map(discountMarker).map((value, index) => (value ? index : -1)).filter((index) => index >= 0);
  const warnings = [];
  const groups = markers.map((markerRow, markerIndex) => {
    const lineDiscounts = discountMarker(rows[markerRow]);
    const nextMarkerRow = markers[markerIndex + 1];
    const headerRow = rows.slice(markerRow + 1, nextMarkerRow ?? rows.length).findIndex((row) => columnIndex(row, 'modelo') >= 0 && columnIndex(row, 'precio regular') >= 0);
    const actualHeaderRow = headerRow < 0 ? -1 : markerRow + 1 + headerRow;
    const termsCells = rows.slice(markerRow + 1, actualHeaderRow < 0 ? (nextMarkerRow ?? rows.length) : actualHeaderRow)
      .flat()
      .filter((value) => text(value));
    const terms = termsCells.map(text).join('\n');
    const codes = extractPriceCodes(terms);
    if (!codes.up || !codes.fi) warnings.push({ codigo: 'price_codes_no_encontrados', hoja: sheetName, fila: markerRow + 1 });
    if (actualHeaderRow < 0) {
      warnings.push({ codigo: 'encabezado_business_red_plus_no_encontrado', hoja: sheetName, fila: markerRow + 1 });
      return null;
    }
    const equipment = businessModelRows(rows, actualHeaderRow, nextMarkerRow).map((item) => ({
      ...item,
      discount_prices: lineDiscounts.map((discount) => discount === 1 ? 0 : discount === 0 ? item.regular_price : Number((item.regular_price * (1 - discount)).toFixed(2))),
    }));
    const maxDiscountedLines = lineDiscounts.reduce((last, discount, index) => discount > 0 ? index + 1 : last, 0);
    return {
      line_discounts: lineDiscounts,
      discount_ranges: discountRanges(lineDiscounts),
      max_discounted_lines: maxDiscountedLines,
      price_codes: codes,
      terms,
      equipment,
      source: { archivo: fileName, fuente_id: sourceId, hoja: sheetName, row: markerRow + 1 },
    };
  }).filter(Boolean);
  if (groups.length !== 4) warnings.push({ codigo: 'matrices_business_red_plus_incompletas', esperado: 4, encontrado: groups.length, hoja: sheetName });
  return {
    plan: { nombre: 'Business Red Plus', monto: 65 },
    line_order_dependent: true,
    groups,
    warnings,
    source: { archivo: fileName, fuente_id: sourceId, hoja: sheetName },
  };
}

function indexPriceOverrides(rows, sheetName, fileName, sourceId) {
  const byModel = new Map();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((cell) => fold(cell).includes('precio regular nuevo'))) continue;
    const source = { hoja: sheetName, fila: index + 1, archivo: fileName || null, fuente_id: sourceId || null };
    for (const cell of row) {
      for (const line of cellText(cell).split('\n')) {
        const match = line.match(/^\s*(.+?)\s*-\s*\$\s*([\d,.]+)\s*$/);
        if (!match) continue;
        const modelo = text(match[1]);
        const precio = parseMoney(match[2]);
        if (precio == null) continue;
        byModel.set(normalizeCommercialModel(modelo), {
          modelo_oficial: modelo,
          modelo_normalizado: normalizeCommercialModel(modelo),
          sku_sif: null,
          sap: null,
          precio_regular: precio,
          plazos: [],
          fuente: source,
        });
      }
    }
  }
  return byModel;
}

export function normalizeOfferWorkbooks({ financingBuffer, priceListBuffer, sourceIds = {}, fileNames = {} }) {
  const priceIndex = indexPriceWorkbook(priceListBuffer);
  const workbook = XLSX.read(financingBuffer, { type: 'buffer' });
  const sheetName = findPortafolioSheet(workbook);
  if (!sheetName) throw new Error('Hoja obligatoria ausente: Ofertas Equipos en Portafolio');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  const headerRow = findHeaderRow(rows, ['oferta', 'plan', 'equipos']);
  if (headerRow < 0) throw new Error('Encabezados obligatorios ausentes en Ofertas Equipos en Portafolio');
  const header = rows[headerRow];
  const ofertaColumn = columnIndex(header, 'oferta');
  const planColumn = columnIndex(header, 'plan');
  const equipmentColumn = columnIndex(header, 'equipos');
  const termsColumn = ['terminos', 'condiciones'].map((key) => columnIndex(header, key)).find((index) => index >= 0);
  const priceOverrides = indexPriceOverrides(rows, sheetName, fileNames.tabla_financiamiento, sourceIds.tabla_financiamiento);
  const offers = [];
  const contradictions = [];
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const offerText = cellText(row[ofertaColumn]);
    const planText = cellText(row[planColumn]);
    const equipmentText = cellText(row[equipmentColumn]);
    if (!offerText || !planText || !equipmentText) continue;
    const termsText = termsColumn >= 0 ? cellText(row[termsColumn]) : '';
    const plan = parsePlanScope(planText);
    if (plan.min == null) continue;
    const parsedTerms = parseTerms(termsText);
    const family = familiesFrom(termsText);
    const source = { archivo: fileNames.tabla_financiamiento || null, hoja: sheetName, fila: index + 1, fuente_id: sourceIds.tabla_financiamiento || null };
    const normalizedEquipment = splitModels(equipmentText).map((model) => {
      const override = priceOverrides.get(normalizeCommercialModel(model));
      const candidates = override ? [override] : (priceIndex.byModel.get(normalizeCommercialModel(model)) || []);
      const exact = candidates[0] || null;
      if (!exact) contradictions.push({ codigo: 'equipo_sin_coincidencia_exacta', bloqueante: true, estado: 'abierta', modelo: model, fuente: source });
      const terms = exact?.plazos.filter((term) => !parsedTerms.plazos.length || parsedTerms.plazos.includes(term.meses)) || [];
      const regularPrices = [...new Set(candidates.map((candidate) => candidate.precio_regular).filter((price) => price != null))];
      return {
        id: normalizeCommercialModel(model).replace(/\s+/g, '-'),
        modelo_oficial: exact?.modelo_oficial || model,
        modelo_comercial: model,
        sku_sif: exact?.sku_sif || null,
        sap: exact?.sap || null,
        precio_regular: regularPrices.length === 1 ? regularPrices[0] : null,
        precios_regulares: regularPrices,
        plazos: terms,
        coincidencia: exact ? 'exacta' : 'pendiente',
        variantes: candidates.map((candidate) => ({ sku_sif: candidate.sku_sif, sap: candidate.sap, modelo_oficial: candidate.modelo_oficial, precio_regular: candidate.precio_regular })),
        fuente_precio: exact ? { ...exact.fuente, archivo: fileNames.lista_precios || null, fuente_id: sourceIds.lista_precios || null } : null,
      };
    });
    if (family.ambiguity) contradictions.push({ codigo: 'alcance_ambiguous_both', bloqueante: true, estado: 'abierta', fuente: source });
    offers.push({
      id: `oferta-${index + 1}`,
      nombre: text(offerText.split('\n')[0]),
      estado_comercial: family.ambiguity ? 'contradiccion' : 'confirmada',
      vigencia_documental: 'pendiente_confirmacion',
      tipo_linea: family.families.length ? 'multilinea_business_red' : 'individual',
      familias: family.families,
      plan,
      eventos: parseEvents(offerText, termsText),
      trade_in: { renovacion_requerido: /requiere trade\s*-?\s*in/i.test(offerText) && !/no requiere trade\s*-?\s*in/i.test(offerText) },
      limite_ban: parsedTerms.limite_ban,
      beneficio: benefitFrom(offerText),
      equipos: normalizedEquipment,
      fuente: source,
      texto_original: { oferta: offerText, plan: planText, terminos: termsText },
    });
  }
  return {
    offers,
    contradictions,
    inventory: { financingSheets: workbook.SheetNames, priceSheets: priceIndex.sheetNames },
    summary: { offers: offers.length, equipment: offers.reduce((total, offer) => total + offer.equipos.length, 0), blockingContradictions: contradictions.filter((item) => item.bloqueante).length },
  };
}
