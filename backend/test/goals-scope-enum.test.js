import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const goalsSource = readFileSync(new URL('../src/routes/goals.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');

test('cumplimiento compara scope como texto y no rompe contra el enum goal_scope', () => {
  // goals.scope es del tipo enum goal_scope: comparar contra un CASE de texto
  // provoca "operator does not exist: goal_scope = text" y tumbaba el proceso.
  assert.match(goalsSource, /g\.scope::text = CASE WHEN \$2::text IS NULL THEN 'negocio' ELSE 'vendedor' END/);
  assert.doesNotMatch(goalsSource, /g\.scope = CASE WHEN/);
});

test('un error no capturado en una ruta no puede tumbar el backend entero', () => {
  assert.match(serverSource, /process\.on\('unhandledRejection'/);
  assert.match(serverSource, /console\.error/);
});
