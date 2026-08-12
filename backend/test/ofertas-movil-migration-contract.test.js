import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('la migración móvil conserva borradores, versiones reemplazadas y una sola vigente', () => {
  const sql = fs.readFileSync(new URL('../migrations/2026-08-05-ofertas-movil-versiones.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.ofertas_movil_versiones/);
  assert.match(sql, /borrador.*vigente.*reemplazada/s);
  assert.match(sql, /UNIQUE INDEX.*estado.*vigente|WHERE estado = 'vigente'/s);
  assert.doesNotMatch(sql, /ON DELETE CASCADE/i);
});
