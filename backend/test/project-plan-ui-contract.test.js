import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const appPath = path.join(rootDir, 'frontend/app.html');

// Decision de Gabriel (2026-09-10): el Plan Maestro es documentacion para el programador y no va en el CRM.
// Vive en docs/constructor/plan-maestro-constructor.json y su Markdown generado.
test('el menu del CRM no muestra Plan Maestro', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.doesNotMatch(html, /href="#\/plan-maestro"/);
  assert.doesNotMatch(html, />Plan Maestro</);
  assert.doesNotMatch(html, /route==='plan-maestro'/);
  assert.doesNotMatch(html, /async function viewPlanMaestro/);
  assert.doesNotMatch(html, /\/api\/project-plan/);
  assert.doesNotMatch(html, /\.pm-summary-card/);
});

test('el Plan Maestro sigue existiendo como documentacion', async () => {
  const json = await readFile(path.join(rootDir, 'docs/constructor/plan-maestro-constructor.json'), 'utf8');
  const md = await readFile(path.join(rootDir, 'docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md'), 'utf8');

  assert.ok(JSON.parse(json).items.length > 0);
  assert.match(md, /Plan Maestro/);
});

// Comparativa pertenece al modulo Clientes: se crea y se consulta desde el perfil de cada cliente.
test('Comparativa no esta en el menu principal: vive dentro de Clientes', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.doesNotMatch(html, /href="#\/comparativa"/);
  assert.doesNotMatch(html, /route==='comparativa'/);
  assert.doesNotMatch(html, /async function viewComparativa/);
  // En el perfil del cliente siguen el boton para crearla y su historial.
  assert.match(html, /onclick="abrirComparativa\('\$\{c\.id\}'\)"/);
  assert.match(html, /const comps=\(c\.comparativas\|\|\[\]\)/);
});
