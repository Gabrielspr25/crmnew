import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana representa cada paso con un check accesible que lo completa', () => {
  assert.match(appHtml, /class="step-card-check"/);
  assert.match(appHtml, /aria-label="Completar \$\{esc\(s\.name\)\}"/);
  assert.match(appHtml, /title="Completar \$\{esc\(s\.name\)\}"/);
  assert.match(appHtml, /onclick="avanzar\('\$\{o\.id\}','\$\{s\.id\}'\)"><\/button>/);
  assert.doesNotMatch(appHtml, /onclick="avanzar\('\$\{o\.id\}','\$\{s\.id\}'\)">✓<\/button>/);
  assert.doesNotMatch(appHtml, />Completar<\/button>/);
});
