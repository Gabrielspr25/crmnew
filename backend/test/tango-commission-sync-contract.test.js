import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salesRoute = fs.readFileSync(path.join(root, 'src/routes/sales.js'), 'utf8');
const tangoClient = fs.readFileSync(path.join(root, 'src/tango.js'), 'utf8');
const frontend = fs.readFileSync(path.join(root, '../frontend/app.html'), 'utf8');

test('la sincronizacion consulta ventas y comisiones de Tango V2', () => {
  assert.match(tangoClient, /export async function fetchComisiones/);
  assert.match(salesRoute, /fetchVentas\(\{ desde, hasta \}\)/);
  assert.match(salesRoute, /fetchComisiones\(\{ desde, hasta \}\)/);
});

test('la sincronizacion escribe CRM canonico y reportes sin limpieza destructiva', () => {
  assert.match(salesRoute, /public\.clients/);
  assert.match(salesRoute, /public\.bans/);
  assert.match(salesRoute, /public\.subscribers/);
  assert.match(salesRoute, /public\.subscriber_reports/);
  assert.match(salesRoute, /BEGIN/);
  assert.match(salesRoute, /ROLLBACK/);
  assert.doesNotMatch(salesRoute, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(salesRoute, /\bTRUNCATE\b/i);
});

test('Comisiones ofrece sincronizar Tango solo para admin o supervisor', () => {
  assert.match(frontend, /Sincronizar Tango/);
  assert.match(frontend, /syncTangoComisiones/);
  assert.match(frontend, /\['admin','supervisor'\]/);
});
