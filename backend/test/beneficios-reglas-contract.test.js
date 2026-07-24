import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const url = (p) => new URL(p, import.meta.url);
const read = (p) => readFile(url(p), 'utf8');

const route = await read('../src/routes/beneficiosReglasRoutes.js');
const server = await read('../src/server.js');
const constructor = await read('../../Planes para web/oferta-const.html');

test('el endpoint de beneficios-reglas expone GET y PUT sobre un archivo editable', () => {
  assert.match(route, /beneficiosReglasRouter/);
  assert.match(route, /\.get\(/);
  assert.match(route, /\.put\(/);
  assert.match(route, /requireAuth/);              // escritura protegida
  assert.match(route, /beneficios-reglas\.json/);  // almacen en archivo, sin BD
  // sin datos del boletin escritos en el backend
  assert.doesNotMatch(route, /\$\s*\d/);
  assert.doesNotMatch(route, /portabilidad|streaming|penalidad/i);
});

test('el router se monta en server.js', () => {
  assert.match(server, /beneficiosReglasRouter/);
  assert.match(server, /\/api\/beneficios-reglas/);
});

test('el constructor carga las reglas del endpoint y no lleva los montos en el codigo', () => {
  // debe consultar el endpoint y guardar la config en estado
  assert.match(constructor, /\/api\/beneficios-reglas/);
  assert.match(constructor, /REGLAS_BONOS/);
  // ningun monto de bono escrito a mano en el codigo del constructor
  assert.doesNotMatch(constructor, /return\s+150\b/);          // portabilidad 150 inline
  assert.doesNotMatch(constructor, /\$10\.00 por BAN/);        // streaming inline
  assert.doesNotMatch(constructor, /hasta \$800/);             // balance inline
  assert.doesNotMatch(constructor, /Bono Portabilidad \$150/); // texto con monto inline
});
