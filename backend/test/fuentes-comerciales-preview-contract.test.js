import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const route = fs.readFileSync(new URL('src/routes/fuentesComercialesRoutes.js', root), 'utf8');
const app = fs.readFileSync(new URL('../frontend/app.html', root), 'utf8');

test('fuentes comerciales expone preview y publicación conjunta para planes fijos', () => {
  assert.match(route, /fuentesComercialesRouter\.post\('\/planes-fijos\/preview'/);
  assert.match(route, /fuentesComercialesRouter\.post\('\/planes-fijos\/publicar'/);
  assert.match(route, /fuente_ids/);
  assert.match(route, /planes_fijos_publicaciones/);
});

test('la interfaz permite seleccionar ambos boletines y revisar antes de publicar', () => {
  assert.match(app, /fcSeleccionadas/);
  assert.match(app, /fcPreviewPlanesFijos/);
  assert.match(app, /Vista previa/);
  assert.match(app, /Publicar versión/);
  assert.match(app, /No se publica automáticamente/);
});
