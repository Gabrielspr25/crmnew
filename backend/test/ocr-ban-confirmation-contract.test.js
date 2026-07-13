import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const writeRoutesSource = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');

test('OCR exige BAN detectado o escrito antes de guardar suscriptores', () => {
  assert.match(appHtml, /ocrManualBanNumber/);
  assert.match(appHtml, /No detect[eé] BAN/);
  assert.match(appHtml, /BAN de la imagen/);
  assert.match(appHtml, /if\(!expectedBan\)/);
  assert.doesNotMatch(appHtml, /expected_ban_number:ocrDetectedBanNumber\|\|ocrOpenedBanNumber\|\|null/);
  assert.match(writeRoutesSource, /expectedBan/);
  assert.match(writeRoutesSource, /targetBanNumber !== expectedBan/);
});
