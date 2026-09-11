import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUDITABLE_SUBSCRIBER_FIELDS,
  buildSubscriberChanges,
  normalizeSubscriberHistoryUser,
  recordSubscriberChange,
  recordSubscriberManualNote,
} from '../src/services/subscriberHistoryService.js';

function createDb() {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ id: 10, ...params }] };
    },
  };
}

test('compara campos auditables y agrupa varios cambios en un solo objeto', () => {
  const changes = buildSubscriberChanges(
    { status: 'activo', cancel_reason: null, monthly_value: '60.00', plan: 'COVO150V' },
    { status: 'cancelado', cancel_reason: 'Portabilidad', monthly_value: 55, plan: 'COVO150V' },
  );

  assert.deepEqual(changes, {
    status: { old: 'activo', new: 'cancelado' },
    cancel_reason: { old: null, new: 'Portabilidad' },
    monthly_value: { old: 60, new: 55 },
  });
});

test('no genera cambios por equivalencias semanticas', () => {
  const changes = buildSubscriberChanges(
    { monthly_value: '60.00', activation_date: '2026-09-09T00:00:00.000Z', phone: '787-388-3031' },
    { monthly_value: 60, activation_date: '2026-09-09', phone: '7873883031' },
  );

  assert.deepEqual(changes, {});
});

test('recordSubscriberChange no inserta evento cuando no hay cambios update', async () => {
  const db = createDb();
  const event = await recordSubscriberChange({
    db,
    subscriberId: 1,
    before: { plan: 'A' },
    after: { plan: 'A' },
    user: { nick: 'gabriel', nombre: 'Gabriel' },
    source: 'manual',
  });

  assert.equal(event, null);
  assert.equal(db.calls.length, 0);
});

test('recordSubscriberChange inserta un solo evento con cambios estructurados', async () => {
  const db = createDb();
  await recordSubscriberChange({
    db,
    subscriberId: 1,
    before: { plan: 'A', status: 'activo' },
    after: { plan: 'B', status: 'cancelado' },
    user: { nick: 'gabriel', nombre: 'Gabriel' },
    source: 'manual',
    metadata: { importer: 'no debe duplicar' },
  });

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO public\.subscriber_history/);
  assert.deepEqual(JSON.parse(db.calls[0].params[5]), {
    plan: { old: 'A', new: 'B' },
    status: { old: 'activo', new: 'cancelado' },
  });
});

test('recordSubscriberManualNote crea un evento manual sin cambios ficticios', async () => {
  const db = createDb();
  await recordSubscriberManualNote({
    db,
    subscriberId: 1,
    comment: 'Cliente solicita llamada mañana.',
    noteDate: '2026-09-10',
    user: { nick: 'gabriel', nombre: 'Gabriel' },
  });

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO public\.subscriber_history/);
  assert.equal(db.calls[0].params[3], 'manual');
  assert.equal(db.calls[0].params[4], 'updated');
  assert.deepEqual(JSON.parse(db.calls[0].params[5]), {});
  assert.equal(db.calls[0].params[6], 'Cliente solicita llamada mañana.');
  assert.deepEqual(JSON.parse(db.calls[0].params[7]), { type: 'manual_note', note_date: '2026-09-10' });
});

test('usuario historico se deriva del JWT y no del frontend', () => {
  assert.deepEqual(normalizeSubscriberHistoryUser({ nick: 'gsanchez', nombre: 'Gabriel Sanchez' }), {
    id: 'gsanchez',
    name: 'Gabriel Sanchez',
  });
});

test('lista central de campos auditables incluye datos comerciales del suscriptor', () => {
  for (const field of ['phone', 'plan', 'price_code', 'monthly_value', 'status', 'cancel_reason', 'line_kind', 'line_type', 'product_type', 'activation_date', 'contract_start_date', 'contract_end_date', 'equipment', 'contract_term', 'payments_made', 'remaining_payments']) {
    assert.ok(AUDITABLE_SUBSCRIBER_FIELDS.includes(field), field);
  }
});
