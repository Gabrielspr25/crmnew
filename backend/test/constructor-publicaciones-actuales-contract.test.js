import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const constructorPage = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const publicationLoader = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');
const offersPage = await readFile(new URL('../../Planes para web/ofertas.html', import.meta.url), 'utf8');
const fixedPage = await readFile(new URL('../../Planes para web/index.html', import.meta.url), 'utf8');

test('Constructor nuevo consume exclusivamente publicaciones actuales', () => {
  for (const endpoint of [
    '/api/ofertas-movil/vigente',
    '/api/planes-modulos/moviles',
    '/api/planes-modulos/fijos',
    '/api/planes-modulos/claro_tv',
    '/api/equipos-lista',
  ]) assert.match(publicationLoader, new RegExp(endpoint.replaceAll('/', '\\/')));

  assert.match(constructorPage, /pendiente de publicaci[oó]n/i);
  assert.doesNotMatch(constructorPage, /fijos-data\.js/);
  assert.doesNotMatch(constructorPage, /ofertas-data\.js/);
  assert.doesNotMatch(constructorPage, /PLANES_FIJOS_MODULOS_FALLBACK/);
  assert.doesNotMatch(constructorPage, /CONST_CLARO_TV_DATA/);
  assert.doesNotMatch(constructorPage, /PLAN_MULTILINEA_TOTALS/);
  assert.doesNotMatch(constructorPage, /PLAN_MULTILINEA_LINE_COSTS/);
  assert.doesNotMatch(constructorPage, /PLAN_INDIVIDUAL_TOTALS/);
});

test('Constructor no ofrece servicios, seguros ni beneficios sin publicacion oficial', () => {
  assert.match(constructorPage, /Servicios pendientes de publicaci[oó]n/);
  assert.match(constructorPage, /Seguros pendientes de publicaci[oó]n/);
  assert.match(constructorPage, /Benefits pendientes de publicaci[oó]n/);
  assert.doesNotMatch(constructorPage, /const SERVICIOS\s*=\s*\[/);
  assert.doesNotMatch(constructorPage, /const SEGUROS\s*=\s*\[/);
  assert.doesNotMatch(constructorPage, /Bono Portabilidad \$150/);
  assert.doesNotMatch(constructorPage, /Pago balance hasta \$800/);
});

test('Portal de ofertas usa la version publicada sin fallback local', () => {
  assert.match(publicationLoader, /api\/ofertas-movil\/vigente/);
  assert.match(offersPage, /publicaciones_incompletas|pendiente de publicaci[oó]n/i);
  assert.doesNotMatch(offersPage, /ofertas-data\.js/);
  assert.doesNotMatch(offersPage, /insuranceRows|Seguro de equipos a escoger|Cargo Impuesto IVU 11\.5%/);
  assert.doesNotMatch(offersPage, /Creditos comienzan en la 2da factura|PROMOCION VALIDA/);
});

test('Portal fijo ya no carga el archivo estatico heredado', () => {
  assert.doesNotMatch(fixedPage, /fijos-data\.js/);
});
