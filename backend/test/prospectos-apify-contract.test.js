import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const appHtml = readFileSync(new URL('frontend/app.html', root), 'utf8');
const routeSource = readFileSync(new URL('../src/routes/prospectosRoutes.js', import.meta.url), 'utf8');
const migrationPath = new URL('../migrations/2026-08-26-prospectos-apify-airtable.sql', import.meta.url);
const deployDoc = readFileSync(new URL('../../DEPLOY.md', import.meta.url), 'utf8');

test('Prospeccion publica preview y save Apify autenticados sin tocar clients', () => {
  assert.match(routeSource, /post\('\/prospectos\/apify\/preview', requireAuth/);
  assert.match(routeSource, /post\('\/prospectos\/apify\/save', requireAuth/);
  assert.match(routeSource, /fetchApifyPreview/);
  assert.match(routeSource, /saveSelectedApifyProspects/);
  assert.doesNotMatch(routeSource, /INSERT INTO\s+public\.clients/i);
  assert.doesNotMatch(routeSource, /UPDATE\s+public\.clients/i);
});

test('migracion revisable agrega estado de sincronizacion Airtable a prospectos', () => {
  assert.equal(existsSync(migrationPath), true, 'falta migracion revisable de Airtable');
  const source = readFileSync(migrationPath, 'utf8');
  assert.match(source, /ALTER TABLE public\.prospectos/);
  assert.match(source, /airtable_record_id TEXT/);
  assert.match(source, /airtable_synced_at TIMESTAMPTZ/);
  assert.match(source, /airtable_sync_error TEXT/);
});

test('frontend de Prospeccion tiene formulario Apify, preview seleccionable y guardado manual', () => {
  assert.match(appHtml, /Prospección · Apify/);
  assert.match(appHtml, /prApifyPreview/);
  assert.match(appHtml, /\/api\/prospectos\/apify\/preview/);
  assert.match(appHtml, /\/api\/prospectos\/apify\/save/);
  assert.match(appHtml, /Guardar seleccionados/);
  assert.match(appHtml, /type="checkbox"/);
});

test('DEPLOY documenta secretos backend sin valores', () => {
  for (const name of ['APIFY_API_TOKEN', 'APIFY_GOOGLE_MAPS_ACTOR_ID', 'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_NAME']) {
    assert.match(deployDoc, new RegExp(`\\| \`${name}\``));
  }
  assert.doesNotMatch(deployDoc, /Bearer\s+[A-Za-z0-9_\-]{12,}/);
});
