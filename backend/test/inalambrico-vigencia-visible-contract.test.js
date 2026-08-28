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

test('Backup cruza el plan con el equipo FIGU publicado para planes menores de 30', () => {
  assert.match(portal, /function findBackupEquipmentOffer\(plan/);
  assert.match(portal, /seccion_key === 'equipos_precios_inalambrico'/);
  assert.match(portal, /financiamiento_gu/);
  assert.match(portal, /Pendiente de publicacion/);
  assert.match(portal, /24 meses/);
  assert.match(portal, /36 meses/);
  assert.match(portal, /FIGU/);
});

test('Backup organiza plan y financiamiento en una tabla compacta', () => {
  assert.match(portal, /class="backup-table-wrap"/);
  assert.match(portal, /class="backup-table"/);
  assert.match(portal, /<th>Plan<\/th>/);
  assert.match(portal, /<th>Equipo<\/th>/);
  assert.match(portal, /<th>24 meses<\/th>/);
  assert.match(portal, /<th>36 meses<\/th>/);
  assert.match(portal, /@media\(max-width:640px\)[\s\S]*\.backup-table/);
});
