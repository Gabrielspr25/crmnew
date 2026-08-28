import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const portal = fs.readFileSync(fileURLToPath(new URL('../../Planes%20para%20web/banda-ancha.html', import.meta.url)), 'utf8');

test('Inalambrico muestra una fecha de vencimiento legible desde el mismo API', () => {
  assert.match(portal, /function formatVigenciaVisible/);
  assert.match(portal, /Vigente hasta/);
  assert.match(portal, /m\.vigencia_hasta/);
});

test('Inalambrico organiza sus modulos en acordeones compactos', () => {
  assert.match(portal, /let openSectionKey/);
  assert.match(portal, /function toggleInalambricoAccordion/);
  assert.match(portal, /\.section-card\.collapsed \.section-body/);
  assert.match(portal, /section-summary/);
  assert.match(portal, /card\.innerHTML = headerHTML \+ `<div class="section-body">/);
  assert.match(portal, /event\.stopPropagation\(\);openModalIdx/);
});
