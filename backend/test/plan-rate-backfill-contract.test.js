import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const scriptPath = new URL('../scripts/apply-plan-rate-backfill.mjs', import.meta.url);

test('backfill de rentas exige vista previa, cantidad esperada y transaccion', () => {
  assert.equal(existsSync(scriptPath), true, 'falta el script de backfill controlado');
  const source = readFileSync(scriptPath, 'utf8');

  assert.match(source, /--apply/);
  assert.match(source, /--expect/);
  assert.match(source, /BEGIN/);
  assert.match(source, /ROLLBACK/);
  assert.match(source, /COMMIT/);
  assert.match(source, /monthly_value IS NULL OR s\.monthly_value <= 0/);
  assert.match(source, /monthly_rate > 0/);
});
