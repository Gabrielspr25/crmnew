import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function has(pattern) {
  assert.equal(pattern.test(appHtml), true);
}

test('tablas permiten autoajuste de contenido por celda', () => {
  has(/th,td\{[^}]*white-space:normal;[^}]*overflow-wrap:break-word;[^}]*word-break:normal;/);
  has(/\.card>table,\s*\.card>div>table,\s*\.panel table\{[^}]*width:max-content;[^}]*min-width:100%;/);
});

test('telefonos y controles no se parten al autoajustar celdas', () => {
  has(/\.subscriber-phone\{[^}]*white-space:nowrap;[^}]*word-break:keep-all;/);
  has(/\.subscriber-row\{[^}]*grid-template-columns:120px 78px 122px/);
  has(/\.subscriber-row\{grid-template-columns:120px 76px 118px/);
});
