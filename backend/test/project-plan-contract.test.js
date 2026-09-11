import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALID_PLAN_STATES,
  loadProjectPlan,
  renderProjectPlanMarkdown,
  summarizeProjectPlan,
  validateProjectPlan,
} from '../src/services/projectPlanService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const planPath = path.join(rootDir, 'docs/constructor/plan-maestro-constructor.json');
const mdPath = path.join(rootDir, 'docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md');

test('Plan Maestro carga una fuente JSON valida con IDs unicos y estados oficiales', async () => {
  const plan = await loadProjectPlan(planPath);
  const validation = validateProjectPlan(plan);

  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(plan.project, 'Constructor Comercial');
  assert.equal(Array.isArray(plan.items), true);
  assert.equal(plan.items.length >= 20, true);

  const ids = plan.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(plan.items.every((item) => VALID_PLAN_STATES.includes(item.status)), true);
});

test('Plan Maestro calcula avance y conteos sin guardar porcentaje manual', async () => {
  const plan = await loadProjectPlan(planPath);
  const summary = summarizeProjectPlan(plan);

  assert.equal(Object.hasOwn(plan, 'progress_percent'), false);
  assert.equal(summary.total, plan.items.length);
  assert.equal(summary.progress_percent > 0, true);
  assert.equal(summary.progress_percent < 100, true);
  assert.equal(summary.counts.bloqueados >= 1, true);
  assert.equal(summary.production_status, 'NO');
});

test('Plan Maestro separa local y produccion y no termina items con bloqueo propio', async () => {
  const plan = await loadProjectPlan(planPath);
  const blockedDone = plan.items.filter((item) => item.status === 'terminado' && item.blocker);
  const localOnly = plan.items.filter((item) => item.local_status === 'terminado' && item.production_status !== 'terminado');

  assert.deepEqual(blockedDone, []);
  assert.equal(localOnly.length > 0, true);
});

test('Plan Maestro mantiene visible el bloqueo REDPLUS vs BREDP1', async () => {
  const plan = await loadProjectPlan(planPath);
  const blocker = plan.items.find((item) => /REDPLUS \$60 vs BREDP1 \$65/i.test(`${item.title} ${item.blocker?.summary || ''}`));

  assert.ok(blocker);
  assert.equal(blocker.status, 'bloqueado_seguridad');
  assert.match(blocker.blocker.summary, /evidencia oficial suficiente/i);
});

test('Markdown del Plan Maestro se genera desde la misma fuente JSON', async () => {
  const plan = await loadProjectPlan(planPath);
  const generated = renderProjectPlanMarkdown(plan);
  const current = await readFile(mdPath, 'utf8');

  assert.equal(current, generated);
  assert.match(generated, /Fuente unica estructurada/);
  assert.match(generated, /REDPLUS \$60 vs BREDP1 \$65/);
  assert.match(generated, /Produccion/);
});

// El Plan Maestro es documentacion para el programador (JSON + Markdown), no una pantalla del CRM:
// Gabriel pidio sacarlo del menu. El backend no lo expone por API.
test('El Plan Maestro no se expone por API en el CRM', async () => {
  const server = await readFile(path.join(rootDir, 'backend/src/server.js'), 'utf8');

  assert.doesNotMatch(server, /projectPlanRouter/);
  assert.doesNotMatch(server, /project-plan/);
});

test('Ninguna regla comercial depende del Plan Maestro', async () => {
  const commercialFiles = [
    'backend/src/routes/motorOfertasRoutes.js',
    'backend/src/routes/fuentesComercialesRoutes.js',
    'backend/src/services/motorOfertasContract.js',
    'backend/src/services/motorOfertasNormalizer.js',
    'backend/src/services/businessRedPlusEligibility.js',
    'Planes para web/constructor-publications.js',
  ];

  for (const relativePath of commercialFiles) {
    const content = await readFile(path.join(rootDir, relativePath), 'utf8');
    assert.doesNotMatch(content, /projectPlan|plan-maestro|Plan Maestro/i, relativePath);
  }
});

test('Las instrucciones internas exigen actualizar Plan Maestro antes de cerrar tareas del Constructor', async () => {
  const claude = await readFile(path.join(rootDir, 'CLAUDE.md'), 'utf8');
  const agents = await readFile(path.join(rootDir, 'AGENTS.md'), 'utf8');

  assert.match(claude, /plan-maestro-constructor\.json/);
  assert.match(claude, /antes de declararse terminada/i);
  assert.match(agents, /Plan Maestro/);
});
