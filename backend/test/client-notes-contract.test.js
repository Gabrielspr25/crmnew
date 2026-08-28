import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..');
const appHtml = await readFile(resolve(root, 'frontend', 'app.html'), 'utf8');
const clientsRealSource = await readFile(resolve(process.cwd(), 'src', 'routes', 'clientsReal.js'), 'utf8');
const writeRoutesSource = await readFile(resolve(process.cwd(), 'src', 'routes', 'writeRoutes.js'), 'utf8');
const migrationSource = await readFile(resolve(process.cwd(), 'migrations', '2026-08-13-client-notes.sql'), 'utf8');

test('cliente tiene notas internas separadas de Asana y oportunidades', () => {
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.client_notes/);
  assert.match(migrationSource, /client_id UUID NOT NULL REFERENCES public\.clients\(id\) ON DELETE CASCADE/);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'nota'/);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS created_by_name TEXT NULL/);
  assert.match(migrationSource, /CHECK \(type IN \('nota','no_renueva','pendiente','riesgo','otro'\)\)/);
  assert.match(migrationSource, /idx_client_notes_client_created/);
  assert.doesNotMatch(migrationSource, /sales_opportunities|opportunity_notes/);
});

test('detalle de cliente lee client_notes sin depender de opportunity_notes', () => {
  assert.match(clientsRealSource, /to_regclass\('public\.client_notes'\)/);
  assert.match(clientsRealSource, /FROM client_notes/);
  assert.match(clientsRealSource, /COALESCE\(created_by_name, created_by::text, 'Usuario'\) AS created_by/);
  assert.match(clientsRealSource, /client_notes: clientNotes\.rows/);
});

test('endpoint guarda notas internas del cliente con validacion y usuario', () => {
  assert.match(writeRoutesSource, /post\('\/clients-real\/:id\/notes'/);
  assert.match(writeRoutesSource, /VALID_CLIENT_NOTE_TYPES/);
  assert.match(writeRoutesSource, /INSERT INTO client_notes \(client_id, type, note, created_by_name\)/);
  assert.match(writeRoutesSource, /SELECT id FROM clients WHERE id = \$1/);
  assert.doesNotMatch(writeRoutesSource, /INSERT INTO opportunity_notes[\s\S]*clients-real\/:id\/notes/);
});

test('modal del cliente muestra formulario y lista de notas internas separadas', () => {
  assert.match(appHtml, /function cliNoteTypeLabel\(type\)/);
  assert.match(appHtml, /async function guardarNotaCliente\(\)/);
  assert.match(appHtml, /api\('\/api\/clients-real\/'\+cliM\.id\+'\/notes'/);
  assert.match(appHtml, /id="cliNoteType"/);
  assert.match(appHtml, /id="cliNoteBody"/);
  assert.match(appHtml, /Notas internas del cliente/);
  assert.match(appHtml, /Historial de Asana/);
});
