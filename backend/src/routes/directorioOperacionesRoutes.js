import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { logAudit } from './misc.js';

export const directorioOperacionesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const FIELDS = [
  'district', 'code', 'full_name', 'employee_number', 'job_title', 'municipalities', 'mobile', 'email',
];

function text(value) {
  const result = String(value ?? '').trim();
  return result || null;
}

function normalizedHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function findColumn(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalizedHeader(header)));
}

export function parseDirectoryWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => normalizedHeader(name) === 'directorio') || workbook.SheetNames[0];
  if (!sheetName) throw new Error('El archivo no contiene hojas');

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return headers.includes('nombre') && headers.some((header) => header === 'empleado' || header === 'empleadonumero');
  });
  if (headerIndex < 0) throw new Error('No se encontro el encabezado NOMBRE y #EMPLEADO en la hoja DIRECTORIO');

  const headers = rows[headerIndex];
  const columns = {
    district: findColumn(headers, ['distrito']),
    code: findColumn(headers, ['codigo']),
    full_name: findColumn(headers, ['nombre']),
    employee_number: findColumn(headers, ['empleado', 'empleadonumero']),
    job_title: findColumn(headers, ['puesto']),
    municipalities: findColumn(headers, ['pueblosquecomprende']),
    mobile: findColumn(headers, ['celular']),
    email: findColumn(headers, ['email', 'correoelectronico']),
  };

  const contacts = [];
  const ignored = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const contact = Object.fromEntries(FIELDS.map((field) => [field, columns[field] >= 0 ? text(row[columns[field]]) : null]));
    if (!contact.full_name && !contact.employee_number) return;
    if (!contact.full_name || !contact.employee_number) {
      ignored.push({ row: headerIndex + index + 2, reason: 'Falta NOMBRE o #EMPLEADO' });
      return;
    }
    contacts.push(contact);
  });

  const duplicateNumbers = new Set();
  const seen = new Set();
  contacts.forEach((contact) => {
    if (seen.has(contact.employee_number)) duplicateNumbers.add(contact.employee_number);
    seen.add(contact.employee_number);
  });
  if (duplicateNumbers.size) throw new Error(`Hay empleados duplicados: ${[...duplicateNumbers].join(', ')}`);

  return { sheetName, contacts, ignored };
}

function tableMissing(error) {
  return error?.code === '42P01';
}

directorioOperacionesRouter.get('/directorio-operaciones', requireAuth, async (req, res) => {
  try {
    const q = text(req.query.q);
    const district = text(req.query.district);
    const params = [];
    const where = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(full_name ILIKE $${params.length} OR employee_number ILIKE $${params.length} OR email ILIKE $${params.length} OR mobile ILIKE $${params.length} OR municipalities ILIKE $${params.length})`);
    }
    if (district) {
      params.push(district);
      where.push(`district = $${params.length}`);
    }
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [contacts, districts, total] = await Promise.all([
      pool.query(`SELECT id, district, code, full_name, employee_number, job_title, municipalities, mobile, email, source_file, source_sheet, created_at, updated_at
                    FROM ventaspro_nuevo.directorio_operaciones ${filter}
                    ORDER BY district NULLS LAST, full_name`, params),
      pool.query(`SELECT district, COUNT(*)::int AS contacts
                    FROM ventaspro_nuevo.directorio_operaciones
                   WHERE district IS NOT NULL AND district <> ''
                   GROUP BY district ORDER BY district`),
      pool.query('SELECT COUNT(*)::int AS total FROM ventaspro_nuevo.directorio_operaciones'),
    ]);
    res.json({ ok: true, total: total.rows[0].total, contacts: contacts.rows, districts: districts.rows });
  } catch (error) {
    const message = tableMissing(error)
      ? 'Directorio Operaciones no esta inicializado. Falta ejecutar su migracion.'
      : error.message;
    res.status(500).json({ ok: false, error: message });
  }
});

directorioOperacionesRouter.post('/directorio-operaciones/import', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file?.buffer) return res.status(400).json({ ok: false, error: 'Selecciona un archivo Excel' });

  let parsed;
  try {
    parsed = parseDirectoryWorkbook(req.file.buffer);
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }

  const client = await pool.connect();
  const result = { inserted: 0, updated: 0, unchanged: 0, ignored: parsed.ignored };
  try {
    await client.query('BEGIN');
    for (const contact of parsed.contacts) {
      const values = FIELDS.map((field) => contact[field]);
      values.push(req.file.originalname, parsed.sheetName);
      const upsert = await client.query(
        `INSERT INTO ventaspro_nuevo.directorio_operaciones
          (district, code, full_name, employee_number, job_title, municipalities, mobile, email, source_file, source_sheet)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (employee_number) DO UPDATE SET
           district = EXCLUDED.district,
           code = EXCLUDED.code,
           full_name = EXCLUDED.full_name,
           job_title = EXCLUDED.job_title,
           municipalities = EXCLUDED.municipalities,
           mobile = EXCLUDED.mobile,
           email = EXCLUDED.email,
           source_file = EXCLUDED.source_file,
           source_sheet = EXCLUDED.source_sheet,
           updated_at = NOW()
         WHERE (directorio_operaciones.district, directorio_operaciones.code, directorio_operaciones.full_name,
                directorio_operaciones.job_title, directorio_operaciones.municipalities, directorio_operaciones.mobile,
                directorio_operaciones.email) IS DISTINCT FROM
               (EXCLUDED.district, EXCLUDED.code, EXCLUDED.full_name, EXCLUDED.job_title,
                EXCLUDED.municipalities, EXCLUDED.mobile, EXCLUDED.email)
         RETURNING (xmax = 0) AS inserted`,
        values,
      );
      if (!upsert.rowCount) result.unchanged += 1;
      else if (upsert.rows[0].inserted) result.inserted += 1;
      else result.updated += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const message = tableMissing(error)
      ? 'Directorio Operaciones no esta inicializado. Falta ejecutar su migracion.'
      : error.message;
    return res.status(500).json({ ok: false, error: message });
  } finally {
    client.release();
  }

  try {
    await logAudit({ ip: req.ip,
      user_name: req.user?.nombre || req.user?.nick,
      type: 'directorio_operaciones_import',
      detail: `Directorio actualizado desde ${req.file.originalname}`,
      entity: 'ventaspro_nuevo.directorio_operaciones',
      meta: { ...result, source_sheet: parsed.sheetName },
    });
  } catch (error) {
    console.warn('[directorio/audit]', error.message);
  }
  res.json({ ok: true, ...result, total: parsed.contacts.length, source_sheet: parsed.sheetName });
});

directorioOperacionesRouter.put('/directorio-operaciones/:id', requireAuth, requireAdmin, async (req, res) => {
  const values = [];
  const sets = [];
  FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      const value = text(req.body[field]);
      if ((field === 'full_name' || field === 'employee_number') && !value) return;
      values.push(value);
      sets.push(`${field} = $${values.length}`);
    }
  });
  if (!sets.length) return res.status(400).json({ ok: false, error: 'No hay datos para actualizar' });

  values.push(req.params.id);
  try {
    const updated = await pool.query(
      `UPDATE ventaspro_nuevo.directorio_operaciones
          SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, district, code, full_name, employee_number, job_title, municipalities, mobile, email, updated_at`,
      values,
    );
    if (!updated.rowCount) return res.status(404).json({ ok: false, error: 'Contacto no encontrado' });
    await logAudit({ ip: req.ip,
      user_name: req.user?.nombre || req.user?.nick,
      type: 'directorio_operaciones_edit',
      detail: `Contacto actualizado: ${updated.rows[0].full_name}`,
      entity: 'ventaspro_nuevo.directorio_operaciones',
      meta: { id: updated.rows[0].id, changed_fields: sets.map((set) => set.split(' ')[0]) },
    });
    res.json({ ok: true, contact: updated.rows[0] });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ ok: false, error: 'Ese numero de empleado ya existe en el directorio' });
    const message = tableMissing(error)
      ? 'Directorio Operaciones no esta inicializado. Falta ejecutar su migracion.'
      : error.message;
    res.status(500).json({ ok: false, error: message });
  }
});
