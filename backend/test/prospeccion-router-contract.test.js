import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

async function appHtml() {
  return readFile(path.join(root, 'frontend/app.html'), 'utf8');
}

function extractRouter(html) {
  const start = html.indexOf('async function router()');
  const end = html.indexOf("window.addEventListener('hashchange',router)", start);
  assert.ok(start > -1, 'router debe existir');
  assert.ok(end > start, 'router debe terminar antes del listener hashchange');
  return html.slice(start, end);
}

test('router no permite que una vista anterior pise Prospeccion despues de cambiar de ruta', async () => {
  const html = await appHtml();
  const router = extractRouter(html);

  assert.match(html, /let routerRunId=0/);
  assert.match(router, /const runId=\+\+routerRunId/);
  assert.match(router, /if\(runId!==routerRunId\)return;\s*\$\(\'view\'\)\.innerHTML=html/);
  assert.match(router, /if\(runId!==routerRunId\)return;\s*if\(route==='prospeccion'\)prInit\(\)/);
  assert.match(router, /else if\(route==='prospeccion'\)html=await viewProspeccion\(\)/);
  assert.match(router, /if\(route==='prospeccion'\)prInit\(\)/);
});
