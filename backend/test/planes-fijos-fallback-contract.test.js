import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const indexPage = await readFile(new URL('../../Planes para web/index.html', import.meta.url), 'utf8');
const fallbackData = await readFile(new URL('../../Planes para web/fijos-data.js', import.meta.url), 'utf8');
const claroTvPage = await readFile(new URL('../../Planes para web/claro-tv.html', import.meta.url), 'utf8');
const ofertaConstPage = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const portalPages = await Promise.all(
  ['index.html', 'movil.html', 'banda-ancha.html', 'equipos.html', 'servicios.html', 'oferta-const.html', 'ofertas.html', 'claro-tv.html']
    .map((name) => readFile(new URL(`../../Planes para web/${name}`, import.meta.url), 'utf8'))
);

test('Planes Fijos usa fallback estatico cuando el API no devuelve modulos', () => {
  assert.match(indexPage, /fijos-data\.js/);
  assert.match(indexPage, /PLANES_FIJOS_MODULOS_FALLBACK/);
  assert.match(indexPage, /useFallbackPlanes/);
  assert.match(indexPage, /sin modulos publicados/);
});

test('Claro TV vive en un tab separado, no dentro de Planes Fijos', () => {
  assert.match(indexPage, /href="claro-tv\.html"/);
  assert.doesNotMatch(fallbackData, /seccion_key:\s*'claro_tv'/);
  assert.match(claroTvPage, /Claro TV/);
  assert.match(claroTvPage, /PLANES_CLARO_TV_DATA/);
  assert.match(claroTvPage, /Clarotv\+ ULTRA ESENCIAL/);
  assert.match(claroTvPage, /IP2BASC2/);
  assert.match(claroTvPage, /Clarotv\+ BASIC/);
  assert.match(claroTvPage, /PY2SIG/);
  assert.match(claroTvPage, /IPLYB/);
  assert.match(claroTvPage, /NPVR250/);
});

test('Planes Fijos fallback conserva modulos visibles aunque no haya backend', () => {
  assert.match(fallbackData, /seccion_key:\s*['"]precios_medidos_telefonia['"]/);
  assert.match(fallbackData, /seccion_key:\s*['"]precios_ilimitado_pr['"]/);
  assert.match(fallbackData, /seccion_key:\s*['"]precios_2play_internet['"]/);
  assert.match(fallbackData, /seccion_key:\s*['"]servicios_valores_agregados['"]/);
});

test('Planes Fijos respeta separacion oficial de precios y servicios del PDF 2026', () => {
  assert.match(fallbackData, /REV\. 03\.31\.2026/);
  assert.match(fallbackData, /Planes Medidos - Telefonia/);
  assert.match(fallbackData, /Planes Ilimitado PR - Telefonia/);
  assert.match(fallbackData, /Planes Ilimitado PR\/US \+ Internet - 2Play/);
  assert.match(fallbackData, /Valores Agregados - Telefonia/);

  for (const code of [
    'A863', 'A864', 'A865', 'A867', 'A868', 'A869',
    '7203', '6991', '6992', '6644',
    'A148', 'A149', 'A150', 'A151',
    'A801', 'A802',
    'A734', 'A735', 'A736', 'A761', 'A762', 'A763',
    'A737', 'A738', 'A739', 'A798', 'A799', 'A800',
    '6996', '6999', '7033', 'A153', 'A154', 'A155',
    'A871', 'A872', 'A873', 'A874', 'A875', 'A877',
    '7107', '7108', 'A879', 'A880', 'A881', 'A882', 'A883', 'A884', 'A885',
    'C474', 'C475', 'C476', 'A170',
    '7448', '3241', '2266', '3256', '3229', '3228', '6955', '9924', '3240',
    '1186', '1187', '7336', '9063', 'A714',
    '7242', '7243', '7244', '7245', '7246', '7141', '7142', '7247', '7268',
    '2633', '2635', '7240', '7241', '3254', '3255'
  ]) {
    assert.match(fallbackData, new RegExp(`codigo:['"]${code}['"]`), `falta ${code}`);
  }

  assert.doesNotMatch(fallbackData, /codigo:['"]A887['"]/);
  assert.doesNotMatch(fallbackData, /codigo:['"]A888['"]/);
  assert.doesNotMatch(fallbackData, /codigo:['"]A889['"]/);
  assert.doesNotMatch(fallbackData, /Clarotv\+/);
  assert.doesNotMatch(fallbackData, /codigo:['"]PY2SIG['"]/);
});

test('Navegacion principal no muestra caracteres rotos', () => {
  for (const html of portalPages) {
    const nav = html.match(/<nav class="nav">[\s\S]*?<\/nav>/)?.[0] || '';
    assert.doesNotMatch(nav, /ð|Ã|Â|�/);
    assert.match(nav, /Planes Fijos/);
    assert.match(nav, /Claro TV/);
    assert.match(nav, /Planes Moviles/);
    assert.match(nav, /Inalambrico \/ IoT/);
    assert.match(nav, /Lista de Equipos/);
  }
});

test('Headers principales no muestran caracteres rotos', () => {
  for (const html of portalPages) {
    const header = html.match(/<header class="header">[\s\S]*?<\/header>/)?.[0] || '';
    assert.doesNotMatch(header, /ð|Ã|Â|�/);
  }
});
test('Oferta const permite agregar productos fijos y Claro TV a la comparativa', () => {
  assert.match(ofertaConstPage, /fijos-data\.js/);
  assert.match(ofertaConstPage, /CONST_CLARO_TV_DATA/);
  assert.match(ofertaConstPage, /stepProductos/);
  assert.match(ofertaConstPage, /Productos fijos y Claro TV/);
  assert.match(ofertaConstPage, /productosAdicionalesMonthlyTotal/);
  assert.match(ofertaConstPage, /addProductoAdicional/);
  assert.match(ofertaConstPage, /Plan \+ equipos \+ servicios \+ seguro \+ fijo\/TV/);
});

test('Oferta const organiza fijo y Claro TV con acordeones compactos', () => {
  assert.match(ofertaConstPage, /productAccordion/);
  assert.match(ofertaConstPage, /product-family-tabs/);
  assert.match(ofertaConstPage, /Fijo/);
  assert.match(ofertaConstPage, /Claro TV/);
  assert.match(ofertaConstPage, /toggleProductAccordion/);
});

test('Oferta const filtra productos fijos por tecnologia COBRE, VRAD y GPON', () => {
  assert.match(ofertaConstPage, /product-tech-tabs/);
  assert.match(ofertaConstPage, /setProductTechnology/);
  assert.match(ofertaConstPage, /COBRE/);
  assert.match(ofertaConstPage, /VRAD/);
  assert.match(ofertaConstPage, /GPON/);
  assert.match(ofertaConstPage, /matchesProductTechnology/);
});
