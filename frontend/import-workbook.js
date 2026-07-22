(function attachImportWorkbook(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.ImportWorkbook = api;
}(typeof window !== 'undefined' ? window : globalThis, function createImportWorkbook() {
  function text(value) {
    return value == null ? '' : String(value).trim();
  }

  function digits(value) {
    return text(value).replace(/\D/g, '');
  }

  function headerKey(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  }

  const COLUMN = {
    company: ['EMPRESA'],
    email: ['EMAIL', 'CORREO'],
    ban: ['BAN'],
    sub_phone: ['SUB'],
    account_type: ['ACCTYPE'],
    status: ['SUBSTATUS'],
    // Fecha en que se activó la línea; distinta al inicio del compromiso.
    activation_date: ['SUBSTATUSDATE'],
    soc: ['SOC'],
    monthly_value: ['PRECIO'],
    product_type: ['PRODUCTTYPE'],
    contract_start_date: ['COMMITSTARTDATE'],
    contract_end_date: ['COMMITENDDATE'],
    credit_class: ['CREDITCLASS'],
    installment_from: ['NOOFINSTALLFROM'],
    installment_total: ['TOTALNOOFINSTALL'],
    item_id: ['ITEMID'],
    equipment: ['ITEMLDESC', 'ITEMSDESC'],
    remaining_payments: ['PLAZOSRESTANTES'],
  };

  const REFERENCE_ONLY_HEADERS = new Set(['GRUPOBANDA', 'CANTLINEASBAN']);

  function isReferenceOnlyHeader(value) {
    return REFERENCE_ONLY_HEADERS.has(headerKey(value));
  }

  function headerIndex(headers) {
    const index = new Map();
    headers.forEach((header, position) => index.set(headerKey(header), position));
    return index;
  }

  function rowValue(row, index, aliases) {
    for (const alias of aliases) {
      const position = index.get(alias);
      if (position != null && text(row[position])) return text(row[position]);
    }
    return '';
  }

  function parseSheet(rows, lineKind) {
    if (!rows || rows.length < 2) return [];
    const index = headerIndex(rows[0]);
    return rows.slice(1)
      .filter((row) => row.some((cell) => text(cell)))
      .map((row) => {
        const parsed = {};
        Object.entries(COLUMN).forEach(([field, aliases]) => {
          parsed[field] = rowValue(row, index, aliases);
        });
        parsed.ban = digits(parsed.ban);
        parsed.sub_phone = digits(parsed.sub_phone);
        parsed.line_kind = lineKind || '';
        return parsed;
      });
  }

  function parseConvergentPairs(rows) {
    const pairs = [];
    let header = null;
    let mode = null;

    for (const row of rows || []) {
      const first = headerKey(row[0]);
      if (first === 'LINEASMOVIL') {
        mode = 'movil';
        header = null;
        continue;
      }
      if (first === 'LINEASFIJO') {
        mode = 'fijo';
        header = null;
        continue;
      }
      if (mode && !header && first === 'BAN') {
        header = headerIndex(row);
        continue;
      }
      if (mode && !header && first === 'CANTLINEASBAN') {
        header = headerIndex(row);
        continue;
      }
      if (!mode || !header || !row.some((cell) => text(cell))) continue;

      const banPosition = header.get('BAN');
      const subPosition = header.get('SUB');
      const ban = digits(row[banPosition]);
      const sub = digits(row[subPosition]);
      if (ban.length === 9 && sub.length === 10) pairs.push({ ban, sub_phone: sub, line_kind: mode });
    }
    return pairs;
  }

  function parseOperationalWorkbook(workbook, XLSX) {
    const names = new Map((workbook.SheetNames || []).map((name) => [headerKey(name), name]));
    const required = ['MOVIL', 'FIJOS', 'CANCELADOS'];
    if (!required.every((key) => names.has(key))) return { isOperationalWorkbook: false };

    const read = (key) => XLSX.utils.sheet_to_json(workbook.Sheets[names.get(key)], { header: 1, defval: '' });
    const mobile = parseSheet(read('MOVIL'), 'movil');
    const fixed = parseSheet(read('FIJOS'), 'fijo');
    const cancelled = parseSheet(read('CANCELADOS'), '');
    const convergent = names.has('CONVERGENTE') ? parseConvergentPairs(read('CONVERGENTE')) : [];
    const allRows = [...mobile, ...fixed, ...cancelled];
    const byBan = new Map();
    for (const row of allRows) {
      if (row.ban.length !== 9) continue;
      const previous = byBan.get(row.ban) || { company: '', email: '' };
      byBan.set(row.ban, {
        company: previous.company || row.company,
        email: previous.email || row.email,
      });
    }

    const errors = [];
    const uniqueSubscribers = new Set();
    const rows = [];
    for (const row of allRows) {
      if (row.ban.length !== 9 || row.sub_phone.length !== 10) {
        errors.push(`Fila sin BAN o suscriptor válido: BAN ${row.ban || 'vacío'}, SUB ${row.sub_phone || 'vacío'}.`);
        continue;
      }
      if (uniqueSubscribers.has(row.sub_phone)) {
        errors.push(`Suscriptor repetido: ${row.sub_phone}. No se enviará duplicado al importador.`);
        continue;
      }
      uniqueSubscribers.add(row.sub_phone);
      const shared = byBan.get(row.ban) || {};
      rows.push({ ...row, company: row.company || shared.company || '', email: row.email || shared.email || '' });
    }

    return {
      isOperationalWorkbook: true,
      rows,
      errors,
      summary: { movil: mobile.length, fijo: fixed.length, cancelados: cancelled.length, convergente: convergent.length },
    };
  }

  return { parseOperationalWorkbook, isReferenceOnlyHeader };
}));
