import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const fixedPage = await readFile(new URL('../../Planes para web/index.html', import.meta.url), 'utf8');
const tvPage = await readFile(new URL('../../Planes para web/claro-tv.html', import.meta.url), 'utf8');
const constructorPage = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const loader = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');

test('Planes Fijos usa publicacion dinamica y no fallback silencioso', () => {
  assert.match(fixedPage, /api\/planes-modulos\/fijos/);
  assert.match(fixedPage, /No existe una publicaci[oó]n vigente de Fijo/i);
  assert.doesNotMatch(fixedPage, /fijos-data\.js/);
  assert.doesNotMatch(fixedPage, /PLANES_FIJOS_MODULOS_FALLBACK/);
});

test('Claro TV usa su publicacion independiente', () => {
  assert.match(tvPage, /api\/planes-modulos\/claro_tv/);
  assert.match(tvPage, /No existe una publicaci[oó]n vigente de Claro TV/i);
});

test('Constructor recibe Fijo y Claro TV desde el cargador publicado', () => {
  assert.match(constructorPage, /constructor-publications\.js/);
  assert.match(loader, /api\/planes-modulos\/fijos/);
  assert.match(loader, /api\/planes-modulos\/claro_tv/);
  assert.doesNotMatch(constructorPage, /CONST_CLARO_TV_DATA/);
});
