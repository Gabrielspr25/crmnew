import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appHtml = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Clientes actualiza el resumen sin recargar la tabla completa', () => {
  assert.match(appHtml, /function cliRenderStatsSummary\(/);
  const statsLoader = appHtml.match(/async function cliLoadStats\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(statsLoader, /cliRenderStatsSummary\(\)/);
  assert.doesNotMatch(statsLoader, /reClientes\(\)/);
});
