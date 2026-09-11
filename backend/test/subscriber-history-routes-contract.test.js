import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/routes/subscriberHistoryRoutes.js', import.meta.url), 'utf8');
const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const importRoutes = readFileSync(new URL('../src/routes/importRoutes.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/2026-09-09-subscriber-history.sql', import.meta.url), 'utf8');
const linesRoutes = readFileSync(new URL('../src/routes/lines.js', import.meta.url), 'utf8');
const salesRoutes = readFileSync(new URL('../src/routes/sales.js', import.meta.url), 'utf8');
const asanaRealRoutes = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const clientsRealRoutes = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');

test('servidor monta rutas de historial de suscriptor', () => {
  assert.match(server, /import \{ subscriberHistoryRouter \} from '\.\/routes\/subscriberHistoryRoutes\.js';/);
  assert.match(server, /app\.use\('\/api', subscriberHistoryRouter\)/);
});

test('migracion referencia el tipo real uuid de subscribers', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.subscriber_history/);
  assert.match(migration, /subscriber_id uuid NOT NULL REFERENCES public\.subscribers\(id\) ON DELETE CASCADE/);
});

test('rutas exponen historial paginado y comentario autenticado', () => {
  assert.match(route, /get\('\/subscribers\/:id\/history', requireAuth, listHistory\)/);
  assert.match(route, /get\('\/subscribers-real\/:id\/history', requireAuth, listHistory\)/);
  assert.match(route, /patch\('\/subscriber-history\/:historyId\/comment', requireAuth/);
  assert.match(route, /post\('\/subscribers-real\/:id\/history\/manual-note', requireAuth/);
  assert.match(route, /recordSubscriberManualNote/);
  assert.doesNotMatch(route, /req\.body\?\.source|req\.body\?\.created_at|req\.body\?\.changes|req\.body\?\.user_id/);
});

test('edicion manual de suscriptor usa servicio central dentro de transaccion', () => {
  assert.match(writeRoutes, /recordSubscriberChange/);
  assert.match(writeRoutes, /SELECT \* FROM subscribers WHERE id = \$1 FOR UPDATE/);
  assert.match(writeRoutes, /source: 'manual'/);
});

test('importador usa el mismo servicio central para updates y altas', () => {
  assert.match(importRoutes, /recordSubscriberChange/);
  assert.match(importRoutes, /source: 'importador'/);
  assert.match(importRoutes, /action: 'created'/);
  assert.match(importRoutes, /importName: 'Importador CRM'/);
});

test('otros caminos normales que mutan suscriptores registran historial', () => {
  assert.match(linesRoutes, /recordSubscriberChange/);
  assert.match(linesRoutes, /source: 'manual'/);
  assert.match(salesRoutes, /recordSubscriberChange/);
  assert.match(salesRoutes, /source: 'sistema'/);
  assert.match(asanaRealRoutes, /recordSubscriberChange/);
  assert.match(asanaRealRoutes, /source: 'manual'/);
});

test('detalle de cliente expone la ultima nota de historial por suscriptor', () => {
  assert.match(clientsRealRoutes, /subscriber_history sh_last/);
  assert.match(clientsRealRoutes, /last_history_comment_at/);
  assert.match(clientsRealRoutes, /last_history_comment/);
  assert.match(clientsRealRoutes, /NULLIF\(TRIM\(COALESCE\(sh_last\.comment,''\)\),''\) IS NOT NULL/);
});
