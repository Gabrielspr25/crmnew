import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const frontendPath = process.env.FRONTEND_HTML_PATH
  ? resolve(process.env.FRONTEND_HTML_PATH)
  : resolve(process.cwd(), '..', 'frontend', 'app.html');

test('los formularios de edicion no se cierran al tocar el fondo', async () => {
  const html = await readFile(frontendPath, 'utf8');
  const start = html.indexOf('function openForm(title, fields, onSubmit)');
  const end = html.indexOf('async function cliEditar()', start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = html.slice(start, end);

  assert.match(block, /id="formBg"/);
  assert.doesNotMatch(block, /event\.target===this\)closeForm\(\)/);
  assert.match(block, /onclick="closeForm\(\)"/);
  assert.match(block, /await onSubmit\(vals\); closeForm\(\);/);
});
