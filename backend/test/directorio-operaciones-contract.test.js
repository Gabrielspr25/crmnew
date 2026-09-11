import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const appHtml = readFileSync(new URL('frontend/app.html', root), 'utf8');
const server = readFileSync(new URL('backend/src/server.js', root), 'utf8');

// Decision de Gabriel (2026-09-10): Directorio Operaciones no va en el CRM.
// Se quitan la entrada del panel, la pantalla y su API. La tabla y su migracion quedan (no se borran datos).
test('el panel lateral del CRM no muestra Directorio Operaciones', () => {
  assert.doesNotMatch(appHtml, /href="#\/directorio"/);
  assert.doesNotMatch(appHtml, />Directorio Operaciones</);
  assert.doesNotMatch(appHtml, /route==='directorio'/);
  assert.doesNotMatch(appHtml, /async function viewDirectorioOperaciones/);
  assert.doesNotMatch(appHtml, /\/api\/directorio-operaciones/);
});

test('el backend ya no expone la API de Directorio Operaciones', () => {
  assert.doesNotMatch(server, /directorioOperacionesRouter/);
  assert.equal(existsSync(new URL('backend/src/routes/directorioOperacionesRoutes.js', root)), false);
});

test('la migracion de la tabla se conserva: no se borran datos', () => {
  assert.ok(existsSync(new URL('backend/migrations/2026-07-20-directorio-operaciones.sql', root)));
});

// El Directorio de Fijo (Admin Ofertas y portal) es otra cosa y sigue en pie.
test('Directorio de Fijo no se ve afectado', () => {
  assert.match(appHtml, /function ofRenderDirectorioFijo\(/);
  assert.match(appHtml, /\['directorio_fijo','Directorio de Fijo'\]/);
});
