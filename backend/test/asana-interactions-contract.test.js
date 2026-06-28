import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaRealSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana real exposes SOV2 log endpoints for calls and notes', () => {
  assert.match(asanaRealSource, /opportunity_notes/);
  assert.match(asanaRealSource, /asana-real\/:id\/log/);
  assert.match(asanaRealSource, /llamada/);
  assert.match(asanaRealSource, /nota/);
});

test('Asana real completing a step writes a step log entry', () => {
  assert.match(asanaRealSource, /INSERT INTO opportunity_notes/);
  assert.match(asanaRealSource, /logPrefix\('paso'\)/);
  assert.match(asanaRealSource, /completed_at = now\(\)/);
});

test('Asana UI opens opportunities and connects steps, calls, and notes', () => {
  assert.match(appHtml, /#\/opp\/\$\{o\.id\}/);
  assert.match(appHtml, /addAsanaLog\('\$\{o\.id\}','llamada'\)/);
  assert.match(appHtml, /addAsanaLog\('\$\{o\.id\}','nota'\)/);
  assert.match(appHtml, /\(o\.log\|\|\[\]\)\.map/);
  assert.doesNotMatch(appHtml, /Notas: pr/);
});

test('Asana opportunity detail has a visible back button to Asana list', () => {
  assert.match(appHtml, /Volver a Asana/);
  assert.match(appHtml, /location\.hash='#\/asana'/);
});

test('Asana opportunity detail renders compact product step cards', () => {
  assert.match(appHtml, /flowgrid/);
  assert.match(appHtml, /flowcard/);
  assert.match(appHtml, /stepchips/);
  assert.match(appHtml, /Paso actual/);
});

test('Asana real can backfill workflow template steps prepared in crm_workflow_templates', () => {
  assert.match(asanaRealSource, /crm_workflow_templates/);
  assert.match(asanaRealSource, /crm_workflow_template_steps/);
  assert.match(asanaRealSource, /ensureOpportunityWorkflowSteps/);
  assert.match(asanaRealSource, /productKeyParts/);
});
