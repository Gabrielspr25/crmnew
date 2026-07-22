import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const migrationPath = new URL('../migrations/2026-07-22-subscribers-line-kind-cloud.sql', import.meta.url);

test('la migracion permite Cloud sin alterar movil ni fijo', () => {
  assert.equal(existsSync(migrationPath), true);
  const sql = readFileSync(migrationPath, 'utf8');
  assert.match(sql, /DROP CONSTRAINT IF EXISTS subscribers_line_kind_check/);
  assert.match(sql, /'movil'/);
  assert.match(sql, /'fijo'/);
  assert.match(sql, /'cloud'/);
  assert.match(sql, /OR line_kind IS NULL/);
});
