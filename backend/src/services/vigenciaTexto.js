const ACCENTS = /[̀-ͯ]/g;

export const MESES = {
  enero: '01', ene: '01',
  febrero: '02', feb: '02',
  marzo: '03', mar: '03',
  abril: '04', abr: '04',
  mayo: '05', may: '05',
  junio: '06', jun: '06',
  julio: '07', jul: '07',
  agosto: '08', ago: '08',
  septiembre: '09', setiembre: '09', sept: '09', sep: '09', set: '09',
  octubre: '10', oct: '10',
  noviembre: '11', nov: '11',
  diciembre: '12', dic: '12',
};

function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(ACCENTS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fullYear(value) {
  const digits = String(value || '');
  if (!digits) return null;
  return digits.length === 2 ? `20${digits}` : digits;
}

function isoDate(year, month, day) {
  return `${year}-${MESES[month]}-${String(day).padStart(2, '0')}`;
}

export function dateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const embedded = text.match(/\d{4}-\d{2}-\d{2}/);
  if (embedded) return embedded[0];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const RANGE_PATTERNS = [
  // 27 de agosto al 16 de septiembre (de 2026)
  { regex: /(\d{1,2}) (?:de )?([a-z]+) (?:al|hasta) (?:el )?(\d{1,2}) (?:de )?([a-z]+)(?: (?:de )?(\d{2,4}))?/, map: (m) => ({ fromDay: m[1], fromMonth: m[2], toDay: m[3], toMonth: m[4], year: m[5] }) },
  // 1 al 30 de septiembre (de 2026)
  { regex: /(\d{1,2}) (?:al|hasta) (?:el )?(\d{1,2}) (?:de )?([a-z]+)(?: (?:de )?(\d{2,4}))?/, map: (m) => ({ fromDay: m[1], fromMonth: m[3], toDay: m[2], toMonth: m[3], year: m[4] }) },
  // 1al30sept2026
  { regex: /(\d{1,2})al(\d{1,2})([a-z]+)(\d{2,4})/, map: (m) => ({ fromDay: m[1], fromMonth: m[3], toDay: m[2], toMonth: m[3], year: m[4] }) },
  // 27ago 16sept 26  /  1 jun 31 jul 26
  { regex: /(\d{1,2}) ?([a-z]+) (\d{1,2}) ?([a-z]+) ?(\d{2,4})/, map: (m) => ({ fromDay: m[1], fromMonth: m[2], toDay: m[3], toMonth: m[4], year: m[5] }) },
];

const OPEN_PATTERNS = [
  // 23 de julio de 2026 en adelante
  { regex: /(\d{1,2}) (?:del? )?([a-z]+) (?:del? )?(\d{4}) en adelante/, map: (m) => ({ fromDay: m[1], fromMonth: m[2], year: m[3] }) },
  // valido desde el 23 de julio de 2026 / desde el 5 de noviembre del 2025
  { regex: /desde (?:el )?(\d{1,2}) (?:del? )?([a-z]+) (?:del? )?(\d{4})/, map: (m) => ({ fromDay: m[1], fromMonth: m[2], year: m[3] }) },
];

// Interpreta rangos de vigencia escritos en espanol (nombres de archivo, celdas de Excel o texto de PDF).
// Sin anio explicito usa defaultYear y, salvo requireYear, el primer anio 20xx que aparezca en el texto.
export function parseRangoVigencia(value, { defaultYear = null, requireYear = false } = {}) {
  const source = fold(value);
  if (!source) return null;
  const textYear = source.match(/\b(20\d{2})\b/)?.[1] || null;
  const resolveYear = (matched) => fullYear(matched) || defaultYear || (requireYear ? null : textYear);

  for (const { regex, map } of RANGE_PATTERNS) {
    const match = source.match(regex);
    if (!match) continue;
    const parts = map(match);
    if (!MESES[parts.fromMonth] || !MESES[parts.toMonth]) continue;
    const year = resolveYear(parts.year);
    if (!year) continue;
    return {
      desde: isoDate(year, parts.fromMonth, parts.fromDay),
      hasta: isoDate(year, parts.toMonth, parts.toDay),
      texto: match[0],
    };
  }

  for (const { regex, map } of OPEN_PATTERNS) {
    const match = source.match(regex);
    if (!match) continue;
    const parts = map(match);
    if (!MESES[parts.fromMonth]) continue;
    return { desde: isoDate(parts.year, parts.fromMonth, parts.fromDay), hasta: null, texto: match[0] };
  }

  return null;
}
