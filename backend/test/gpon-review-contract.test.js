import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(new URL('../migrations/2026-07-28-subscriber-gpon-reviews.sql', import.meta.url), 'utf8');
const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const clientsReal = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');

test('GPON se guarda en tabla separada por suscriptor fijo', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.subscriber_gpon_reviews/);
  assert.match(migration, /subscriber_id uuid PRIMARY KEY/);
  assert.match(migration, /gpon_applies boolean/);
  assert.match(migration, /gpon_note text/);
  assert.match(migration, /reviewed_at date/);
  assert.match(migration, /REFERENCES public\.subscribers\(id\) ON DELETE CASCADE/);
});

test('backend expone upsert de revision GPON por suscriptor', () => {
  assert.match(writeRoutes, /writeRouter\.put\('\/subscribers-real\/:id\/gpon-review'/);
  assert.match(writeRoutes, /subscriber_gpon_reviews/);
  assert.match(writeRoutes, /gpon_applies/);
  assert.match(writeRoutes, /gpon_note/);
  assert.match(writeRoutes, /reviewed_at/);
  assert.match(writeRoutes, /ON CONFLICT \(subscriber_id\) DO UPDATE/);
});

test('detalle de cliente trae los campos GPON junto a cada suscriptor', () => {
  assert.match(clientsReal, /LEFT JOIN subscriber_gpon_reviews gr ON gr\.subscriber_id = s\.id/);
  assert.match(clientsReal, /gr\.gpon_applies/);
  assert.match(clientsReal, /gpon_note/);
  assert.match(clientsReal, /gpon_reviewed_at/);
});
