import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana client phone button opens the linked opportunity safely', () => {
  assert.match(appHtml, /function abrirLlamadaAsana\(opportunityId,noteId\)/);
  assert.match(appHtml, /event\.stopPropagation\(\);abrirLlamadaAsana\('\$\{alert\.opportunity_id\}'/);
  assert.match(appHtml, /localStorage\.setItem\('asana_call_focus',String\(noteId\)\)/);
  assert.match(appHtml, /<button class="callbtn off"[^>]*disabled>☎<\/button>/);
  assert.doesNotMatch(appHtml, /onclick="\$\{action\}">☎<\/button>/);
});
