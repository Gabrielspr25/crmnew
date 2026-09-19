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
  assert.equal(Array.isArray(plan.operating_control?.modules), true);
  assert.equal(plan.operating_control.modules.length, 9);
  assert.equal(plan.operating_control.modules.every((module) => module.key && module.title && module.status && module.last_review && module.evidence && module.next_action), true);
});

test('Plan Maestro calcula avance y conteos sin guardar porcentaje manual', async () => {
  const plan = await loadProjectPlan(planPath);
  const summary = summarizeProjectPlan(plan);

  assert.equal(Object.hasOwn(plan, 'progress_percent'), false);
  assert.equal(summary.total, plan.items.length);
  assert.equal(summary.progress_percent > 0, true);
  assert.equal(summary.progress_percent < 100, true);
  assert.equal(summary.counts.bloqueados >= 1, true);
  // El estado de produccion se deriva de los items: desde el deploy del 2026-09-10 hay items en produccion.
  const enProduccion = plan.items.filter((item) => item.production_status === 'terminado').length;
  const esperado = enProduccion === 0 ? 'NO' : (enProduccion === plan.items.length ? 'SI' : 'PARCIAL');
  assert.equal(summary.production_status, esperado);
});

test('Plan Maestro separa local y produccion y no termina items con bloqueo propio', async () => {
  const plan = await loadProjectPlan(planPath);
  const blockedDone = plan.items.filter((item) => item.status === 'terminado' && item.blocker);
  const localOnly = plan.items.filter((item) => item.local_status === 'terminado' && item.production_status !== 'terminado');

  assert.deepEqual(blockedDone, []);
  assert.equal(localOnly.length > 0, true);
});

test('Plan Maestro retira PM-021 de tareas y bloqueos y conserva la decision y ficha original', async () => {
  const plan = await loadProjectPlan(planPath);
  const retiredItems = plan.retired_items?.filter((item) => item.id === 'PM-021');

  assert.equal(retiredItems?.length, 1, 'PM-021 debe conservar una unica ficha retirada');
  const [retired] = retiredItems;
  assert.equal(retired.active_task, false);
  assert.equal(retired.active_blocker, false);
  assert.equal(retired.decision_by, 'Gabriel');
  assert.equal(retired.retired_at, '2026-09-17');
  assert.match(retired.reason, /confusion/i);
  assert.match(retired.reason, /REDPLUS\s+\$60\b/);
  assert.match(retired.reason, /BREDP1\s+\$65\b/);
  assert.match(retired.reason, /identidades\s+separadas/i);
  assert.match(retired.reason, /no\s+relacionar\s+ni\s+fusionar/i);

  for (const item of plan.items) {
    assert.notEqual(item.id, retired.id, 'PM-021 no debe contarse como tarea activa ni terminada');
    const activeWork = JSON.stringify({
      title: item.title,
      summary: item.summary,
      blocker: item.blocker,
      remaining: item.remaining,
      next_action: item.next_action,
    });
    assert.doesNotMatch(activeWork, /\bPM-021\b|REDPLUS\s+\$60\s+vs\s+BREDP1\s+\$65/i, item.id);
  }

  // La ficha historica es inmutable: retirarla no equivale a completar su trabajo.
  assert.deepEqual(retired.original_record, {
    id: 'PM-021',
    area: 'Identidad Comercial',
    title: 'REDPLUS $60 vs BREDP1 $65',
    status: 'bloqueado_seguridad',
    local_status: 'bloqueado_seguridad',
    production_status: 'pendiente',
    summary: 'La diferencia entre REDPLUS $60 detectado en Excel y BREDP1 $65 del boletin no se fusiona por nombre parecido.',
    done: ['Ambiguedad documentada', 'No se promovio por inferencia'],
    remaining: ['Decision comercial o fuente oficial que relacione ambas identidades'],
    blocker: {
      summary: 'REDPLUS $60 vs BREDP1 $65: no existe evidencia oficial suficiente para fusionarlos.',
      severity: 'seguridad_comercial',
    },
    next_action: 'Mantener bloqueado hasta evidencia oficial o decision comercial documentada.',
    tests: { passed: 0, failed: 0, summary: 'Bloqueo de seguridad documentado.' },
    evidence: ['docs/motor-ofertas/auditoria-identidad-redplus-y-precedencia-fuentes-2026-08-31.md'],
    documents: ['docs/motor-ofertas/auditoria-identidad-redplus-y-precedencia-fuentes-2026-08-31.md'],
    files: [],
    last_change: 'Bloqueo visible agregado al Plan Maestro.',
    updated_at: '2026-09-04',
  });
});

test('Markdown del Plan Maestro se genera desde la misma fuente JSON', async () => {
  const plan = await loadProjectPlan(planPath);
  const generated = renderProjectPlanMarkdown(plan);
  const current = await readFile(mdPath, 'utf8');

  assert.equal(current, generated);
  assert.match(generated, /Fuente unica estructurada/);
  const decision = plan.operating_control.release_gate.find((rule) => /\bPM-021\b/.test(rule));
  assert.ok(decision, 'El retiro debe seguir visible en las reglas operativas');
  assert.match(decision, /Gabriel/);
  assert.match(decision, /PM-021\s+retirado/i);
  assert.match(decision, /REDPLUS\s+\$60\b/);
  assert.match(decision, /BREDP1\s+\$65\b/);
  assert.match(decision, /identidades\s+separadas/i);
  assert.match(decision, /no\s+relacionar\s+ni\s+fusionar/i);
  assert.ok(generated.includes(decision), 'El Markdown debe conservar la decision documentada');

  for (const heading of ['Items', 'Bloqueos Visibles']) {
    const section = generated.split(/^## /m).find((content) => content.startsWith(`${heading}\n`));
    assert.ok(section, `Falta la seccion ${heading}`);
    assert.doesNotMatch(section, /\bPM-021\b|REDPLUS\s+\$60\s+vs\s+BREDP1\s+\$65/i, heading);
  }
  assert.match(generated, /Produccion/);
});

// El Plan Maestro es documentacion para el programador (JSON + Markdown), no una pantalla del CRM:
// Gabriel pidio sacarlo del menu. El backend no lo expone por API.
test('El control operativo consulta el servicio operativo solo para administradores', async () => {
  const server = await readFile(path.join(rootDir, 'backend/src/server.js'), 'utf8');

  assert.match(server, /adminControlRouter/);
  assert.match(server, /\/api\/admin-control/);
  const route = await readFile(path.join(rootDir, 'backend/src/routes/adminControlRoutes.js'), 'utf8');
  assert.match(route, /get\(\s*['"]\/modules['"]\s*,\s*requireAuth\s*,\s*requireAdmin\b/);
  assert.match(route, /from\s+['"]\.\.\/services\/adminControlService\.js['"]/);
  assert.match(route, /await\s+loadAdminControlModules\s*\(/);
});

test('Ninguna regla comercial depende del Plan Maestro', async () => {
  const commercialFiles = [
    'backend/src/routes/motorOfertasRoutes.js',
    'backend/src/routes/fuentesComercialesRoutes.js',
    'backend/src/services/motorOfertasContract.js',
    'backend/src/services/motorOfertasNormalizer.js',
    'backend/src/services/businessRedPlusEligibility.js',
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
