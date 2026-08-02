import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');

test('Asana ignora placeholders sin linea, cantidad ni monto al crear y mostrar pasos', () => {
  assert.match(asanaSource, /const MEANINGFUL_OPPORTUNITY_LINE_SQL/);
  assert.match(asanaSource, /\$\{alias\}\.subscriber_id IS NOT NULL/);
  assert.match(asanaSource, /NULLIF\(TRIM\(COALESCE\(\$\{alias\}\.phone,''\)\), ''\) IS NOT NULL/);
  assert.match(asanaSource, /COALESCE\(\$\{alias\}\.quantity_value,0\) > 0/);
  assert.match(asanaSource, /COALESCE\(\$\{alias\}\.money_value,0\) > 0/);
  assert.match(asanaSource, /COALESCE\(\$\{alias\}\.target_monthly_value,0\) > 0/);
  assert.match(asanaSource, /FROM opportunity_lines ol\n\s+WHERE ol\.opportunity_id = \$1\n\s+AND ol\.product_key IS NOT NULL\n\s+AND \$\{MEANINGFUL_OPPORTUNITY_LINE_SQL\('ol'\)\}/);
  assert.match(asanaSource, /WHERE ol\.opportunity_id = o\.id AND ol\.product_key IS NOT NULL\n\s+AND \$\{MEANINGFUL_OPPORTUNITY_LINE_SQL\('ol'\)\}/);
  assert.match(asanaSource, /FROM opportunity_lines ol\n\s+WHERE ol\.opportunity_id = \$1\n\s+AND \$\{MEANINGFUL_OPPORTUNITY_LINE_SQL\('ol'\)\}/);
});
