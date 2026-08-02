import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const clientsRealSource = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');
const asanaRealSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');

test('Clientes Seguimiento usa sales_opportunities activas como fuente visual', () => {
  const activeFollowUpDefinition = clientsRealSource.match(/const ACTIVE_FOLLOW_UP_EXISTS_SQL = `([\s\S]*?)`;/)?.[1] || '';
  const followingDefinition = clientsRealSource.match(/const FOLLOWING_CLIENT_SQL = `([\s\S]*?)`;/)?.[1] || '';

  assert.match(activeFollowUpDefinition, /sales_opportunities so/);
  assert.match(activeFollowUpDefinition, /so\.archived_at IS NULL/);
  assert.match(activeFollowUpDefinition, /COALESCE\(LOWER\(so\.status\),'activa'\) = 'activa'/);
  assert.match(followingDefinition, /ACTIVE_FOLLOW_UP_EXISTS_SQL/);
  assert.doesNotMatch(activeFollowUpDefinition, /follow_up_prospects/);
});

test('Asana Seg usa sales_opportunities activas como fuente SOV2', () => {
  assert.match(asanaRealSource, /FROM sales_opportunities so/);
  assert.match(asanaRealSource, /so\.archived_at IS NULL/);
});

test('Asana Seg devuelve una sola oportunidad activa por cliente', () => {
  assert.match(asanaRealSource, /DISTINCT ON \(so\.client_id\)/);
});
