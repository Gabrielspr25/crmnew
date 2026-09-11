import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const frontend = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../migrations/2026-09-10-subscriber-phone-per-ban.sql', import.meta.url),
  'utf8'
);

test('el alta de suscriptores identifica duplicados por telefono y BAN', () => {
  assert.match(writeRoutes, /WHERE s\.phone_norm = \$1::text\s+AND s\.ban_id = \$2/);
  assert.match(writeRoutes, /WHERE s\.phone_norm = \$1::text\s+AND s\.ban_id <> \$2/);
  assert.match(writeRoutes, /El teléfono ya está activo en el BAN/);
  assert.match(writeRoutes, /ON CONFLICT \(ban_id, phone_norm\)/);
  assert.doesNotMatch(writeRoutes, /ON CONFLICT \(phone_norm\)/);
});

test('cada BAN conserva su propia pestaña activas o canceladas', () => {
  assert.match(frontend, /const cliMSubByBan=\{\}/);
  assert.match(frontend, /function cliBanSubTab\(banId\)/);
  assert.match(frontend, /function setCliBanSubTab\(banId,tab\)/);
  assert.match(frontend, /const banTab=cliBanSubTab\(b\.id\)/);
  assert.match(frontend, /onclick="setCliBanSubTab\('\$\{b\.id\}','canceladas'\)"/);
});

test('la migracion elimina solo la unicidad global y conserva telefono por BAN', () => {
  assert.match(migration, /DROP INDEX IF EXISTS public\.subscribers_phone_norm_uniq/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS subscribers_ban_phone_norm_uniq/);
  assert.match(migration, /\(ban_id, phone_norm\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS subscribers_active_phone_norm_uniq/);
  assert.match(migration, /LOWER\(TRIM\(COALESCE\(status, ''\)\)\) IN \('activo', 'activa', 'active', 'a'\)/);
});
