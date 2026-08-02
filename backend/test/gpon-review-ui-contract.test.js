import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('modal del cliente renderiza controles GPON solo para lineas fijas', () => {
  assert.match(appHtml, /function cliGponReviewControls\(s,kind\)/);
  assert.match(appHtml, /if\(kind!=='fijo'\)return '';/);
  assert.match(appHtml, /Aumento/);
  assert.match(appHtml, /gpon_note/);
  assert.match(appHtml, /gpon_reviewed_at/);
  assert.match(appHtml, /cliSaveGponReview\('\$\{s\.id\}'\)/);
});

test('modal guarda revision GPON sin editar el suscriptor completo', () => {
  assert.match(appHtml, /async function cliSaveGponReview\(subscriberId\)/);
  assert.match(appHtml, /\/api\/subscribers-real\/'\+subscriberId\+'\/gpon-review/);
  assert.match(appHtml, /gpon_applies/);
  assert.match(appHtml, /await refreshCli\(\)/);
});
