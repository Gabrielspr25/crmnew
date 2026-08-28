import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const logic = await readFile(new URL('../../Planes para web/ofertas-logic.js', import.meta.url), 'utf8');
const constructorPage = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const offersPage = await readFile(new URL('../../Planes para web/ofertas.html', import.meta.url), 'utf8');

test('motor visual recibe ofertas y planes desde publicaciones, no desde archivos heredados', () => {
  assert.match(logic, /window\.OFERTAS_DATA/);
  assert.match(logic, /CONSTRUCTOR_PLAN_AMOUNTS/);
  assert.doesNotMatch(logic, /Excel PYMES 9-22 jun 2026/);
  assert.doesNotMatch(constructorPage, /ofertas-data\.js/);
  assert.doesNotMatch(offersPage, /ofertas-data\.js/);
  assert.match(constructorPage, /constructor-publications\.js/);
  assert.match(offersPage, /constructor-publications\.js/);
});
