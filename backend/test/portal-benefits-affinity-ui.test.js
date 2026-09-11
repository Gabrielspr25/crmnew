import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const PAGINAS = [
  'index.html', 'claro-tv.html', 'movil.html', 'banda-ancha.html', 'equipos.html',
  'servicios.html', 'benefits.html', 'affinity.html', 'directorio-fijo.html',
  'oferta-const.html', 'ofertas.html',
];

const leer = (nombre) => readFileSync(new URL(`../../Planes para web/${nombre}`, import.meta.url), 'utf8');
const benefits = leer('benefits.html');
const affinity = leer('affinity.html');
const route = readFileSync(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../src/services/benefitsPortalCatalog.js', import.meta.url), 'utf8');

test('Affinity tiene su propia pestana en todas las paginas del portal', () => {
  for (const pagina of PAGINAS) {
    assert.match(leer(pagina), /<a href="affinity\.html"[^>]*>Affinity<\/a>/, `falta la pestana Affinity en ${pagina}`);
  }
  assert.match(affinity, /<a href="affinity\.html" class="active">Affinity<\/a>/);
});

test('Beneficios se muestra como tabla operativa y no como tarjetas', () => {
  assert.match(benefits, /<thead><tr><th>Categoria<\/th><th>Beneficio<\/th><th>Producto<\/th><th>Condicion principal<\/th><th>Vigencia<\/th><th>Fuente oficial<\/th>/);
  assert.match(benefits, /function renderRow\(item, index\)/);
  assert.doesNotMatch(benefits, /benefit-card/);
  assert.doesNotMatch(benefits, /class="grid"/);
});

test('las filas se ajustan al contenido y el nombre del archivo no las estira', () => {
  // La condicion crece con su texto; el nombre del PDF se acota a dos lineas y el completo va en la modal.
  assert.match(benefits, /\.cond\{color:#cec4b7;overflow-wrap:break-word\}/);
  assert.match(benefits, /function sourceShort\(item\)/);
  assert.match(benefits, /class="src" title="\$\{escapeHtml\(sourceText\(item\)\)\}"/);
  assert.doesNotMatch(benefits, /\.cond\{[^}]*-webkit-line-clamp/, 'la condicion no debe quedar recortada');
});

test('el detalle abre en modal y se puede cerrar de tres formas', () => {
  assert.match(benefits, /<div class="overlay" id="overlay" hidden>/);
  assert.match(benefits, /role="dialog" aria-modal="true"/);
  assert.match(benefits, /function abrirDetalle\(item, boton\)/);
  assert.match(benefits, /function cerrarDetalle\(\)/);
  assert.match(benefits, /getElementById\('modalClose'\)\.addEventListener\('click', cerrarDetalle\)/);
  assert.match(benefits, /event\.key === 'Escape'/);
  assert.match(benefits, /if\(event\.target\.id === 'overlay'\) cerrarDetalle\(\)/);
  // Ya no se expande una fila oculta debajo.
  assert.doesNotMatch(benefits, /id="detalle-\$\{index\}" hidden/);
  assert.doesNotMatch(benefits, /class="detail"/);
});

test('Affinity no se lista en Beneficios porque tiene pagina propia', () => {
  assert.match(portal, /Affinity no entra en este catalogo/);
  assert.doesNotMatch(portal, /affinityEntries/);
  assert.match(portal, /export async function readAffinityPortalDetail/);
});

test('la pagina de Affinity lee la publicacion vigente y no datos estaticos', () => {
  assert.match(affinity, /const API_URL = \(window\.PORTAL_API_BASE \|\| ''\) \+ '\/api\/fuentes-comerciales\/affinity-vigente'/);
  assert.match(affinity, /Terminos y condiciones oficiales/);
  assert.match(affinity, /Todavia no hay una version de Affinity publicada/);
  assert.doesNotMatch(affinity, /\b8%\b/, 'el porcentaje debe venir de la publicacion, no del HTML');
  assert.doesNotMatch(affinity, /AFFINITY8/, 'el codigo debe venir de la publicacion, no del HTML');
});

test('el endpoint publico de Affinity es de lectura y expone condiciones y terminos', () => {
  const handler = route.match(/get\('\/affinity-vigente'[\s\S]*?\n\}\);/)[0];
  assert.doesNotMatch(handler, /INSERT|UPDATE|DELETE/);
  assert.ok(route.indexOf("get('/affinity-vigente'") < route.indexOf('fuentesComercialesRouter.use(requireAuth)'), 'el portal no tiene sesion');
  assert.match(portal, /export async function readAffinityPortalDetail/);
  assert.match(portal, /publicado: false/);
  assert.match(portal, /aclaracion:/);
});
