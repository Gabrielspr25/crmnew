import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('la migracion versionada separa estado, vigencia y contradicciones', () => {
  const sql = readFileSync(new URL('../migrations/2026-07-12-motor-ofertas-versionado.sql', import.meta.url), 'utf8');
  for (const state of ['borrador', 'pendiente_revision', 'aprobada', 'vigente', 'reemplazada', 'archivada']) assert.match(sql, new RegExp(`'${state}'`));
  assert.doesNotMatch(sql, /estado[^\n]*'contradiccion'/i);
  assert.doesNotMatch(sql, /estado[^\n]*'vencida'/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.motor_ofertas_contradicciones/i);
  assert.match(sql, /vigencia_documental/i);
});
