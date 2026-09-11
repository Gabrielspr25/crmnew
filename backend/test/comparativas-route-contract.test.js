import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const misc = readFileSync(new URL('../src/routes/misc.js', import.meta.url), 'utf8');
const migracion = readFileSync(new URL('../migrations/2026-07-06-ventaspro-nuevo-base.sql', import.meta.url), 'utf8');

// public.comparativas no existe ni en local ni en produccion: guardar una comparativa fallaba.
test('las comparativas se leen y guardan en la tabla que crea la migracion', () => {
  assert.match(migracion, /CREATE TABLE IF NOT EXISTS ventaspro_nuevo\.comparativas/);
  assert.match(misc, /const COMPARATIVAS = 'ventaspro_nuevo\.comparativas'/);
  assert.doesNotMatch(misc, /(?:INTO|FROM)\s+public\.comparativas/);
  assert.match(misc, /INSERT INTO \$\{COMPARATIVAS\}/);
  assert.match(misc, /FROM \$\{COMPARATIVAS\}/);
});

test('un error de base responde en vez de dejar la peticion colgada', () => {
  assert.match(misc, /const conErrores = \(handler\) => async \(req, res\) =>/);
  for (const ruta of ["post('/comparativas'", "get('/comparativas'", "get('/comparativas/:id'"]) {
    const inicio = misc.indexOf(ruta);
    assert.notEqual(inicio, -1, `falta ${ruta}`);
    assert.match(misc.slice(inicio, inicio + 80), /requireAuth, conErrores\(/, `${ruta} debe capturar errores`);
  }
});

test('un id que no es uuid no llega a la base', () => {
  assert.match(misc, /if \(!UUID\.test\(req\.params\.id\)\) return res\.status\(404\)/);
  assert.match(misc, /client_id invalido/);
});
