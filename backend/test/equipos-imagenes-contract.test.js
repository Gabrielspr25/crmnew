import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const routes = await readFile(new URL('../src/routes/equiposRoutes.js', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/equiposImagenesService.js', import.meta.url), 'utf8');
const appHtml = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const portalEquipos = await readFile(new URL('../../Planes para web/equipos.html', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/2026-06-30-equipos-imagenes.sql', import.meta.url), 'utf8');

test('equipos tiene endpoint para buscar y guardar foto oficial', () => {
  assert.match(routes, /\/equipos-lista\/:id\/foto\/buscar/);
  assert.match(routes, /buscarYDescargarImagenEquipo/);
  assert.match(routes, /image_url=\$1/);
  assert.match(routes, /image_status='ok'/);
});

test('busqueda de imagen limita resultados a dominios oficiales', () => {
  assert.match(service, /OFFICIAL_DOMAINS/);
  assert.match(service, /isOfficialUrl/);
  assert.match(service, /duckduckgo\.com\/html/);
  assert.match(service, /downloadImage/);
});

test('schema agrega columnas de imagen y conserva vista vigente', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS image_url TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS image_source_url TEXT/);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.v_equipos_vigentes/);
});

test('admin y portal muestran foto de equipo cuando existe', () => {
  assert.match(appHtml, /eqBuscarFoto/);
  assert.match(appHtml, /Buscar foto/);
  assert.match(appHtml, /image_url/);
  assert.match(portalEquipos, /equipoImg/);
  assert.match(portalEquipos, /class="equipo-img"/);
});

