import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration = await readFile(new URL('../migrations/2026-08-27-asana-tasks.sql', import.meta.url), 'utf8').catch(() => '');
const routes = await readFile(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('migracion crea tareas Asana independientes o vinculadas', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.asana_tasks/);
  assert.match(migration, /opportunity_id UUID NULL REFERENCES public\.sales_opportunities/);
  assert.match(migration, /client_id UUID NULL REFERENCES public\.clients/);
  assert.match(migration, /step_id UUID NULL REFERENCES public\.opportunity_steps/);
  assert.match(migration, /assigned_to_username TEXT NOT NULL/);
  assert.match(migration, /CHECK \(priority IN \('baja','normal','alta'\)\)/);
  assert.match(migration, /CHECK \(status IN \('pendiente','completada','cancelada'\)\)/);
});

test('API expone agenda, alta y finalizacion con alcance por vendedor', () => {
  assert.match(routes, /asana-real\/agenda/);
  assert.match(routes, /asana-real\/tasks/);
  assert.match(routes, /asana-real\/tasks\/:taskId/);
  assert.match(routes, /assigned_to_username/);
  assert.match(routes, /sellerScope\(req\.user\)/);
  assert.match(routes, /suggested_next_step/);
  assert.match(routes, /scheduled_status = \$2/);
  assert.match(routes, /\['completada','cancelada'\]/);
  assert.match(app, /resolverLlamadaAsana/);
  assert.match(app, />Completar</);
  assert.match(app, />Cancelar</);
});

test('Asana muestra Mi dia y permite tareas sin cliente', () => {
  assert.match(app, />Mi d[ií]a</i);
  assert.match(app, /asanaDailyAgenda/);
  assert.match(app, /crearTareaAsana/);
  assert.match(app, /completarTareaAsana/);
  assert.match(app, /Tarea general/);
  assert.match(app, /Sin cliente/);
  assert.match(app, /Vencidas/);
  assert.match(app, /En gestion/);
  assert.match(app, /Tu semana/);
  assert.match(app, /asanaWeekCalendar/);
  assert.match(app, /asanaMonthCalendar/);
  assert.match(app, /function abrirModalTareaAsana\(\)/);
  assert.match(app, /function abrirModalEditarTareaAsana\(/);
  assert.match(app, /editarTareaAsana/);
  assert.match(app, /Completadas/);
  assert.match(app, /Eliminadas/);
  assert.match(app, /Eliminar de gestion/);
  assert.match(app, /function eliminarTareaGestionAsana\(/);
  assert.match(app, /confirm\('Eliminar esta tarea de gestion/);
  assert.match(app, /title="Editar tarea"/);
  assert.match(app, /id="asanaTaskDate"/);
  assert.match(app, /id="asanaTaskTime"/);
  assert.match(app, /new Date\(dateValue\+'T'\+timeValue\)\.toISOString\(\)/);
  assert.match(app, /Selecciona la fecha de la tarea/);
  assert.match(app, /Selecciona la hora de la tarea/);
  assert.match(routes, /t\.status IN \('pendiente','completada','cancelada'\)/);
  assert.match(routes, /title=COALESCE\(\$2,title\)/);
  assert.match(routes, /notes=COALESCE\(\$3,notes\)/);
  assert.match(routes, /due_at=COALESCE\(\$4,due_at\)/);
  assert.match(routes, /priority=COALESCE\(\$5,priority\)/);
});

test('Asana separa resumen y clientes en tabs visuales', () => {
  assert.match(app, /let asanaMainTab='resumen'/);
  assert.match(app, /function setAsanaMainTab\(tab\)/);
  assert.match(app, /class="sc-tab \$\{asanaMainTab==='resumen'\?'on':''\}" onclick="setAsanaMainTab\('resumen'\)">Mi d[ií]a</);
  assert.match(app, /Clientes/);
  assert.match(app, /asana-tab-panel/);
  assert.match(app, /asanaMainTab==='resumen'\?\`\$\{asanaSummary\}\s*<div class="sc-main">\$\{asanaDailyAgenda\(agenda\.items,agenda\.can_view_team\)\}\$\{asanaMonthCalendar\(agenda\.items\)\}<\/div>\s*\$\{asanaWeekCalendar\(agenda\.items\)\}`/);
  assert.match(app, /asanaMainTab==='clientes'\?\`\$\{asanaClientsTools\}\s*\$\{asanaClientsTable\}`/);
  assert.match(app, /const asanaClientsTools=/);
  assert.match(app, /const asanaClientsTable=/);
});

test('oportunidad permite agendar el paso actual como tarea', () => {
  assert.match(app, /Agendar tarea/);
  assert.match(app, /asanaTaskStepId/);
  assert.match(app, /asanaTaskOpportunityId/);
  assert.match(app, /asanaTaskPriority/);
});
