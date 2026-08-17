import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
const planesRoute = await readFile(new URL('../src/routes/planesRoutes.js', import.meta.url), 'utf8');

test('fuentes comerciales expone ciclo local de bases informativas', () => {
  assert.match(route, /post\('\/:id\/preview-base\/borradores', requireAdmin/);
  assert.match(route, /get\('\/bases-informativas\/historial', requireAdmin/);
  assert.match(route, /post\('\/bases-informativas\/:id\/validar', requireAdmin/);
  assert.match(route, /post\('\/bases-informativas\/:id\/aprobar', requireAdmin/);
  assert.match(route, /post\('\/bases-informativas\/:id\/publicar', requireAdmin/);
});

test('guardar borrador crea publicaciones independientes desde la misma fuente y hash', () => {
  assert.match(route, /Object\.values\(previewPayload\.previews \|\| \{\}\)/);
  assert.match(route, /INSERT INTO public\.bases_informativas_publicaciones/);
  assert.match(route, /item\.fuente_comercial_id/);
  assert.match(route, /item\.fuente_sha256/);
  assert.match(route, /item\.modulos_generados/);
  assert.match(route, /item\.contenido_excluido/);
  assert.match(route, /estado, version_etiqueta/);
});

test('transiciones validan el orden y no modifican datos comerciales aprobados', () => {
  assert.match(route, /estadoOrigen: 'borrador'[\s\S]+estadoDestino: 'validada'/);
  assert.match(route, /estadoOrigen: 'validada'[\s\S]+estadoDestino: 'aprobada'/);
  assert.match(route, /COALESCE\(jsonb_array_length\(validacion->'errores'\), 0\) = 0/);
  assert.match(route, /transicion_invalida/);
  assert.match(route, /publicacion_congelada/);
});

test('publicar delega en la funcion transaccional y no toca ofertas_movil_versiones', () => {
  assert.match(route, /SELECT \* FROM public\.publicar_base_informativa\(\$1,\$2\)/);
  assert.doesNotMatch(route, /ofertas_movil_versiones/);
});

test('planes-modulos publica claro_tv y devuelve metadatos de version vigente', () => {
  assert.match(planesRoute, /'claro_tv'/);
  assert.match(planesRoute, /PUBLICACION_CATEGORIA_POR_PAGINA/);
  assert.match(planesRoute, /fijos: 'fijo'/);
  assert.match(planesRoute, /claro_tv: 'claro_tv'/);
  assert.match(planesRoute, /estado='publicada'/);
  assert.match(planesRoute, /publicacion: publicacionResult\.rows\[0\] \|\| null/);
});
