import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const fuentes = fs.readFileSync(new URL('src/routes/fuentesComercialesRoutes.js', root), 'utf8');
const equipos = fs.readFileSync(new URL('src/routes/equiposRoutes.js', root), 'utf8');
const app = fs.readFileSync(new URL('../frontend/app.html', root), 'utf8');

test('una fuente comercial de equipos válida reemplaza la lista mediante el importador transaccional', () => {
  assert.match(fuentes, /importarListaEquiposDesdeFuente/);
  assert.match(fuentes, /familia === 'equipos'/);
  assert.match(fuentes, /publicacion = await importarListaEquiposDesdeFuente/);
  assert.match(equipos, /export async function importarListaEquiposDesdeFuente/);
  assert.match(equipos, /if \(!items\.length\)/);
  assert.match(equipos, /UPDATE public\.equipos_lista SET activo = FALSE/);
});

test('la importación conserva el archivo oficial y asocia el reemplazo a la fuente comercial', () => {
  assert.match(equipos, /fuente_comercial_id/);
  assert.match(equipos, /nombre_archivo/);
  assert.match(fuentes, /archiveFuenteComercialBuffer/);
});

test('Admin informa cuándo la fuente de equipos ya actualizó la lista publicada', () => {
  assert.match(app, /if\(key==='lista_precios'\)\{/);
  assert.match(app, /publicacion_modo','borrador'/);
  assert.match(app, /equipos-preview/);
  assert.match(app, /Lista de Precios en borrador/);
  assert.match(app, /function ofPublicarListaPrecios\(/);
  assert.match(app, /equipos-publicar/);
  assert.match(app, /Lista de Precios publicada/);
  assert.doesNotMatch(app, /Lista de Precios actualizada/);
});

test('Lista de Precios separa archivar, previsualizar y publicar en backend', () => {
  assert.match(fuentes, /publicacion_modo/);
  assert.match(fuentes, /modoPublicacion !== 'borrador'/);
  assert.match(fuentes, /fuentesComercialesRouter\.post\('\/:id\/equipos-preview'/);
  assert.match(fuentes, /parsearExcel/);
  assert.match(fuentes, /fuentesComercialesRouter\.post\('\/:id\/equipos-publicar'/);
  assert.match(app, /r\.publicacion/);
  assert.match(app, /if\(!\['fijo','claro_tv','moviles','inalambrico_iot','lista_precios'\]\.includes\(key\)\)/);
});

test('un UUID que contiene 403 no se informa como falta de permiso', () => {
  const source = app.match(/function fcMensajeApi\(e\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'fcMensajeApi debe existir');
  const context = {};
  vm.runInNewContext(source, context);
  const message = context.fcMensajeApi(new Error('/api/fuentes-comerciales/83f17d67-8a8f-453b-84c3-40364d028d20/preview-base -> 422'));
  assert.equal(message, 'El documento no pudo procesarse como fuente Fijo/Claro TV.');
});

test('Lista de Precios permite generar vista previa desde la fuente ya guardada', () => {
  assert.match(app, /function ofGenerarListaPreciosPreview\(/);
  assert.match(app, /onclick="ofGenerarListaPreciosPreview\(\)"/);
  assert.match(app, /Generar vista previa/);
});

test('una carga duplicada recupera la fuente por el hash calculado del archivo', () => {
  assert.match(fuentes, /const uploadSha256 = crypto\.createHash\('sha256'\)\.update\(req\.file\.buffer\)\.digest\('hex'\)/);
  assert.match(fuentes, /\[familia, uploadSha256\]/);
});
