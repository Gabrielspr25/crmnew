import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProjectPlan, renderProjectPlanMarkdown, loadProjectPlan, VALID_PLAN_STATES } from '../src/services/projectPlanService.js';

const rawPlan = JSON.parse(await readFile(new URL('../../docs/constructor/plan-maestro-constructor.json', import.meta.url), 'utf8'));
function item(overrides = {}) {
  return { id: 'TEST-1', step: 'Revisar original', module: 'Modulo de prueba', status: 'pendiente', environment: 'local', evidence: [], blocker: null, next_action: 'Revisar', closure_criterion: 'Criterio verificable', checked_at: null, ...overrides };
}
function plan(items = [item()]) {
  return { ...structuredClone(rawPlan), closure_checklist: { updated_at: '2026-09-17', items } };
}

test('checklist usa los mismos estados del Plan y no necesita filas inventadas', () => {
  for (const status of VALID_PLAN_STATES) {
    const current = plan([item({ status, evidence: ['Prueba registrada'], checked_at: '2026-09-17T12:00:00Z' })]);
    const result = validateProjectPlan(current);
    assert.equal(result.ok, true, result.errors.join('\n'));
  }
  assert.equal(validateProjectPlan(plan([])).ok, true);
  const absent = plan();
  delete absent.closure_checklist;
  assert.equal(validateProjectPlan(absent).ok, true, 'Planes anteriores pueden carecer de checklist');
});

for (const [name, overrides] of [
  ['sin evidencia', { evidence: [] }], ['evidencia vacia', { evidence: [' '] }],
  ['sin fecha', { checked_at: null }], ['con bloqueo', { blocker: 'Falta verificar' }],
]) {
  test(`terminado ${name} se rechaza`, () => {
    const result = validateProjectPlan(plan([item({ status: 'terminado', evidence: ['Prueba'], checked_at: '2026-09-17T12:00:00Z', ...overrides })]));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.startsWith('closure_checklist.')));
  });
}

for (const [name, change] of [
  ['estado desconocido', p => { p.closure_checklist.items[0].status = 'aprobada'; }],
  ['ambiente desconocido', p => { p.closure_checklist.items[0].environment = 'staging'; }],
  ['duplicado', p => { p.closure_checklist.items.push(item()); }],
  ['fecha imposible', p => { p.closure_checklist.updated_at = '2026-02-30'; }],
  ['fecha de comprobacion invalida', p => { p.closure_checklist.items[0].checked_at = 'ayer'; }],
  ['comprobacion de fecha imposible', p => { p.closure_checklist.items[0].checked_at = '2026-02-30T12:00:00Z'; }],
  ['evidencia no arreglo', p => { p.closure_checklist.items[0].evidence = 'Prueba'; }],
  ['elemento nulo', p => { p.closure_checklist.items = [null]; }],
  ['items no arreglo', p => { p.closure_checklist.items = {}; }],
  ['checklist nulo', p => { p.closure_checklist = null; }],
  ['paso vacio', p => { p.closure_checklist.items[0].step = ''; }],
  ['bloqueo ausente', p => { delete p.closure_checklist.items[0].blocker; }],
  ['criterio de cierre ausente', p => { delete p.closure_checklist.items[0].closure_criterion; }],
  ['checked_at ausente', p => { delete p.closure_checklist.items[0].checked_at; }],
  ['ID no texto', p => { p.closure_checklist.items[0].id = 1; }],
  ['duplicado con espacios', p => { p.closure_checklist.items.push(item({ id: ' TEST-1 ' })); }],
  ['hora imposible', p => { p.closure_checklist.items[0].checked_at = '2026-09-17T24:01:00Z'; }],
]) {
  test(`checklist invalido: ${name}`, () => {
    const current = plan(); change(current);
    const result = validateProjectPlan(current);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.startsWith('closure_checklist')));
  });
}

test('Markdown proyecta datos, ambiente y evidencia del JSON sin mutarlo', () => {
  const current = plan([
    item({ status: 'terminado', evidence: ['Prueba local'], checked_at: '2026-09-17T12:00:00Z' }),
    item({ id: 'TEST-2', environment: 'produccion', status: 'terminado', evidence: ['Prueba productiva'], checked_at: '2026-09-17T13:00:00Z' }),
  ]);
  const before = structuredClone(current);
  const md = renderProjectPlanMarkdown(current);
  for (const value of ['Checklist de Cierre', '2026-09-17', 'TEST-1', 'TEST-2', 'Revisar original', 'Modulo de prueba', 'Prueba local', 'Prueba productiva', 'Criterio verificable', '2026-09-17T12:00:00Z', 'Comprobado localmente', 'Comprobado en produccion']) assert.ok(md.includes(value), value);
  assert.deepEqual(current, before);
  assert.throws(() => renderProjectPlanMarkdown(plan([item({ status: 'terminado' })])), /checklist/i);
});

test('Markdown escapa texto del checklist y no crea enlaces ni HTML ejecutable', () => {
  const current = plan([item({ step: '<img src=x onerror=alert(1)> | fila\nnueva', evidence: ['[abrir](javascript:alert(1))'], next_action: '`codigo`' })]);
  const md = renderProjectPlanMarkdown(current);
  assert.match(md, /&lt;img/);
  assert.ok(md.includes('\\| fila nueva'));
  assert.ok(md.includes('\\[abrir\\]'));
  assert.doesNotMatch(md, /<img|\[abrir\]\(javascript:/);
});

test('carga conserva el checklist exacto del archivo JSON unico', async () => {
  const loaded = await loadProjectPlan();
  const raw = JSON.parse(await readFile(new URL('../../docs/constructor/plan-maestro-constructor.json', import.meta.url), 'utf8'));
  assert.deepEqual(loaded.closure_checklist, raw.closure_checklist);
});
