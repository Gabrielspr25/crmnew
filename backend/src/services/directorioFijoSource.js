import * as XLSX from 'xlsx';

const REQUIRED_COLUMNS = {
  district: ['distrito', 'district'],
  name: ['nombre', 'contacto', 'name'],
  employee: ['empleado', 'employee', 'id empleado'],
  job: ['puesto', 'cargo', 'job'],
};

const OPTIONAL_COLUMNS = {
  code: ['codigo', 'código', 'code'],
  municipalities: ['pueblos que comprende', 'pueblos', 'municipios', 'municipalities'],
  mobile: ['celular', 'movil', 'móvil', 'telefono', 'teléfono', 'telefono movil'],
  email: ['email', 'correo', 'e-mail'],
};

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function findColumn(headers, aliases) {
  return headers.find((header) => aliases.includes(normalizeHeader(header))) || null;
}

function personFromRow(row, columns) {
  return Object.fromEntries(Object.entries(columns).map(([key, header]) => [key, header ? normalizeValue(row[header]) : '']));
}

function isAdministration(person) {
  return normalizeHeader(person.district).includes('administracion');
}

function isManager(person) {
  return normalizeHeader(person.job).includes('gerente operaciones de campo');
}

function personKey(person) {
  const employee = normalizeHeader(person?.employee);
  if (employee) return `empleado:${employee}`;
  const email = normalizeHeader(person?.email);
  if (email) return `email:${email}`;
  return `nombre:${normalizeHeader(person?.name)}|${normalizeHeader(person?.district)}`;
}

function flattenDirectory(data) {
  const entries = [];
  for (const person of data?.admin || []) entries.push(person);
  for (const group of data?.groups || []) {
    if (group?.manager) entries.push(group.manager);
    for (const person of group?.contacts || []) entries.push(person);
  }
  return entries;
}

function comparablePerson(person) {
  return ['district', 'code', 'name', 'employee', 'job', 'municipalities', 'mobile', 'email']
    .map((key) => normalizeHeader(person?.[key]))
    .join('|');
}

export function parseDirectorioFijoWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'directorio') || workbook.SheetNames[0];
  if (!sheetName) throw Object.assign(new Error('El Excel no contiene hojas.'), { code: 'directorio_hoja_no_encontrada' });

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = {};
  for (const [key, aliases] of Object.entries({ ...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS })) columns[key] = findColumn(headers, aliases);
  const missing = Object.entries(REQUIRED_COLUMNS).filter(([key]) => !columns[key]).map(([key]) => key);
  if (missing.length) {
    throw Object.assign(new Error(`Faltan columnas requeridas: ${missing.join(', ')}.`), {
      code: 'directorio_columnas_incompletas',
      missing,
    });
  }

  const admin = [];
  const groups = [];
  let activeGroup = null;
  for (const row of rows) {
    const person = personFromRow(row, columns);
    if (!person.name) continue;
    if (isAdministration(person)) {
      admin.push(person);
      continue;
    }
    if (isManager(person)) {
      activeGroup = { manager: person, contacts: [] };
      groups.push(activeGroup);
      continue;
    }
    if (!activeGroup || normalizeHeader(activeGroup.manager.district) !== normalizeHeader(person.district)) {
      throw Object.assign(new Error(`No se puede asociar a ${person.name} con un gerente de su distrito.`), {
        code: 'directorio_contacto_sin_gerente',
      });
    }
    activeGroup.contacts.push(person);
  }

  if (!groups.length) throw Object.assign(new Error('No se encontró un Gerente Operaciones de Campo.'), { code: 'directorio_sin_gerentes' });
  const totalContactos = flattenDirectory({ admin, groups }).length;
  if (!totalContactos) throw Object.assign(new Error('El Directorio no contiene contactos publicables.'), { code: 'directorio_sin_contactos' });

  return { title: 'Directorio de fijo', source_sheet: sheetName, admin, groups, total_contactos: totalContactos };
}

export function diffDirectorioFijo(current, next) {
  const before = new Map(flattenDirectory(current).map((person) => [personKey(person), person]));
  const after = new Map(flattenDirectory(next).map((person) => [personKey(person), person]));
  let altas = 0;
  let bajas = 0;
  let cambios = 0;
  let sinCambio = 0;

  for (const [key, person] of after) {
    const previous = before.get(key);
    if (!previous) altas += 1;
    else if (comparablePerson(previous) === comparablePerson(person)) sinCambio += 1;
    else cambios += 1;
  }
  for (const key of before.keys()) if (!after.has(key)) bajas += 1;

  return { resumen: { altas, bajas, cambios, sin_cambio: sinCambio } };
}
