import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const asanaRoutes = await readFile(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const writeRoutes = await readFile(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const clientsRoutes = await readFile(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/2026-09-15-notes-soft-delete.sql', import.meta.url), 'utf8').catch(() => '');

test('notas internas y de Asana se eliminan logicamente, no fisicamente', () => {
  assert.match(migration, /ALTER TABLE IF EXISTS public\.client_notes[\s\S]*ADD COLUMN IF NOT EXISTS deleted_at/);
  assert.match(migration, /ALTER TABLE IF EXISTS public\.opportunity_notes[\s\S]*ADD COLUMN IF NOT EXISTS deleted_at/);
  assert.match(writeRoutes, /delete\('\/clients-real\/:id\/notes\/:noteId'/);
  assert.match(writeRoutes, /UPDATE client_notes[\s\S]*deleted_at = now\(\)/);
  assert.doesNotMatch(writeRoutes, /DELETE FROM client_notes/);
  assert.match(asanaRoutes, /delete\('\/asana-real\/:id\/log\/:noteId'/);
  assert.match(asanaRoutes, /UPDATE opportunity_notes[\s\S]*deleted_at = now\(\)/);
  assert.doesNotMatch(asanaRoutes, /DELETE FROM opportunity_notes/);
});

test('las vistas normales ocultan notas eliminadas y conservan historial activo', () => {
  assert.match(clientsRoutes, /FROM client_notes[\s\S]*deleted_at IS NULL/);
  assert.match(clientsRoutes, /FROM opportunity_notes n[\s\S]*n\.deleted_at IS NULL/);
  assert.match(asanaRoutes, /FROM opportunity_notes[\s\S]*deleted_at IS NULL/);
});

test('la UI muestra boton eliminar con confirmacion en notas internas y notas de Asana', () => {
  assert.match(app, /eliminarNotaCliente\(/);
  assert.match(app, /eliminarNotaAsana\(/);
  assert.match(app, /confirm\('Eliminar esta nota/);
  assert.match(app, /confirm\('Eliminar este registro de Asana/);
  assert.match(app, /title="Eliminar nota"/);
});
