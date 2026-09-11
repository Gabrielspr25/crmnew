export const AUDITABLE_SUBSCRIBER_FIELDS = [
  'phone',
  'phone_norm',
  'plan',
  'plan_code',
  'price_code',
  'monthly_value',
  'status',
  'cancel_reason',
  'line_kind',
  'line_type',
  'product_type',
  'activation_date',
  'contract_start_date',
  'contract_end_date',
  'equipment',
  'item_id',
  'contract_term',
  'payments_made',
  'remaining_payments',
  'tango_ventaid',
];

export const SUBSCRIBER_HISTORY_LABELS = {
  phone: 'Teléfono / suscriptor',
  phone_norm: 'Teléfono normalizado',
  plan: 'Plan',
  plan_code: 'Código plan',
  price_code: 'SOC / Código plan',
  monthly_value: 'Mensualidad',
  status: 'Estado',
  cancel_reason: 'Razón cancelación',
  line_kind: 'Tipo producto',
  line_type: 'Tipo de línea',
  product_type: 'Product type',
  activation_date: 'Fecha activación',
  contract_start_date: 'Inicio contrato',
  contract_end_date: 'Vencimiento calculado',
  equipment: 'Modelo equipo',
  item_id: 'Item equipo',
  contract_term: 'Total cuotas',
  payments_made: 'Cuotas pagadas',
  remaining_payments: 'Pagos restantes',
  tango_ventaid: 'Venta Tango',
};

const MONEY_FIELDS = new Set(['monthly_value']);
const DATE_FIELDS = new Set(['activation_date', 'contract_start_date', 'contract_end_date']);
const INTEGER_FIELDS = new Set(['contract_term', 'payments_made', 'remaining_payments']);
const PHONE_FIELDS = new Set(['phone', 'phone_norm']);
const VALID_SOURCES = new Set(['manual', 'importador', 'sistema']);
const VALID_ACTIONS = new Set(['updated', 'created']);

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : value;
}

function dateOnly(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function numberOrNull(value) {
  const clean = emptyToNull(value);
  if (clean === null) return null;
  const amount = Number(String(clean).replace(/[$,\s]/g, ''));
  return Number.isFinite(amount) ? amount : clean;
}

export function normalizeSubscriberHistoryValue(field, value) {
  const clean = emptyToNull(value);
  if (clean === null) return null;
  if (PHONE_FIELDS.has(field)) return String(clean).replace(/\D/g, '') || null;
  if (DATE_FIELDS.has(field)) return dateOnly(clean);
  if (MONEY_FIELDS.has(field)) return numberOrNull(clean);
  if (INTEGER_FIELDS.has(field)) {
    const n = Number.parseInt(String(clean), 10);
    return Number.isFinite(n) ? n : clean;
  }
  if (typeof clean === 'boolean') return clean;
  return String(clean).trim();
}

export function buildSubscriberChanges(before = {}, after = {}, fields = AUDITABLE_SUBSCRIBER_FIELDS) {
  const changes = {};
  for (const field of fields) {
    if (!(field in before) && !(field in after)) continue;
    const oldValue = normalizeSubscriberHistoryValue(field, before?.[field]);
    const newValue = normalizeSubscriberHistoryValue(field, after?.[field]);
    if (oldValue !== newValue) changes[field] = { old: oldValue, new: newValue };
  }
  if (changes.phone && changes.phone_norm && changes.phone.old === changes.phone_norm.old && changes.phone.new === changes.phone_norm.new) {
    delete changes.phone_norm;
  }
  return changes;
}

export function normalizeSubscriberHistoryUser(user = {}) {
  const id = user.id || user.user_id || user.nick || user.usuario || user.email || user.username || null;
  const name = user.nombre || user.name || user.nick || user.usuario || user.email || user.username || 'Sistema';
  return { id: id == null ? null : String(id), name: String(name) };
}

export async function recordSubscriberChange({
  db,
  subscriberId,
  before = {},
  after = {},
  user = {},
  source = 'sistema',
  action = 'updated',
  metadata = {},
  comment = null,
  importBatchId = null,
  importName = null,
  importFilename = null,
} = {}) {
  if (!db || !subscriberId) throw new Error('Falta db o subscriberId para registrar historial');
  const safeSource = VALID_SOURCES.has(source) ? source : 'sistema';
  const safeAction = VALID_ACTIONS.has(action) ? action : 'updated';
  const changes = safeAction === 'created' ? {} : buildSubscriberChanges(before, after);
  if (safeAction !== 'created' && !Object.keys(changes).length) return null;
  const historicUser = normalizeSubscriberHistoryUser(user);
  const result = await db.query(
    `INSERT INTO public.subscriber_history (
       subscriber_id, user_id, user_name_snapshot, source, action, changes, comment,
       import_batch_id, import_name, import_filename, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb)
     RETURNING *`,
    [
      subscriberId,
      historicUser.id,
      historicUser.name,
      safeSource,
      safeAction,
      JSON.stringify(changes),
      comment,
      importBatchId,
      importName,
      importFilename,
      JSON.stringify(metadata || {}),
    ],
  );
  return result.rows[0] || null;
}

export async function recordSubscriberManualNote({ db, subscriberId, comment, noteDate, user } = {}) {
  if (!db || !subscriberId) throw new Error('Falta db o subscriberId para registrar la nota');
  const cleanComment = String(comment ?? '').trim();
  if (!cleanComment) throw new Error('Escribe una nota antes de guardar');
  const cleanNoteDate = String(noteDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanNoteDate)) throw new Error('Selecciona la fecha de la nota');
  const historicUser = normalizeSubscriberHistoryUser(user);
  const result = await db.query(
    `INSERT INTO public.subscriber_history (
       subscriber_id, user_id, user_name_snapshot, source, action, changes, comment, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)
     RETURNING *`,
    [
      subscriberId,
      historicUser.id,
      historicUser.name,
      'manual',
      'updated',
      JSON.stringify({}),
      cleanComment,
      JSON.stringify({ type: 'manual_note', note_date: cleanNoteDate }),
    ],
  );
  return result.rows[0] || null;
}

export async function listSubscriberHistory({ db, subscriberId, source = 'todos', page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;
  const params = [subscriberId];
  const where = ['subscriber_id = $1'];
  if (VALID_SOURCES.has(source)) {
    params.push(source);
    where.push(`source = $${params.length}`);
  }
  params.push(safeLimit, offset);
  const sqlWhere = where.join(' AND ');
  const items = await db.query(
    `SELECT id, subscriber_id, created_at, user_id, user_name_snapshot, source, action,
            changes, comment, comment_updated_at, comment_updated_by,
            import_batch_id, import_name, import_filename, metadata
       FROM public.subscriber_history
      WHERE ${sqlWhere}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = await db.query(`SELECT COUNT(*)::int AS total FROM public.subscriber_history WHERE ${sqlWhere}`, params.slice(0, -2));
  return { items: items.rows, total: total.rows[0]?.total || 0, page: safePage, limit: safeLimit };
}

export async function updateSubscriberHistoryComment({ db, historyId, comment, user } = {}) {
  const historicUser = normalizeSubscriberHistoryUser(user);
  const result = await db.query(
    `UPDATE public.subscriber_history
        SET comment = $1,
            comment_updated_at = now(),
            comment_updated_by = $2
      WHERE id = $3
      RETURNING id, subscriber_id, created_at, user_id, user_name_snapshot, source, action,
                changes, comment, comment_updated_at, comment_updated_by,
                import_batch_id, import_name, import_filename, metadata`,
    [String(comment ?? '').trim() || null, historicUser.name, historyId],
  );
  return result.rows[0] || null;
}
