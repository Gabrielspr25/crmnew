import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const defaultPlanPath = path.join(rootDir, 'docs/constructor/plan-maestro-constructor.json');

export const VALID_PLAN_STATES = Object.freeze([
  'terminado',
  'en_validacion',
  'pendiente',
  'bloqueado',
  'bloqueado_seguridad',
]);

export const STATE_WEIGHTS = Object.freeze({
  terminado: 100,
  en_validacion: 60,
  pendiente: 0,
  bloqueado: 0,
  bloqueado_seguridad: 0,
});

const STATUS_LABELS = Object.freeze({
  terminado: 'Terminado',
  en_validacion: 'En validacion',
  pendiente: 'Pendiente',
  bloqueado: 'Bloqueado',
  bloqueado_seguridad: 'Bloqueado seguridad',
});

function validChecklistDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validChecklistTimestamp(value) {
  return typeof value === 'string' && validChecklistDate(value.slice(0, 10))
    && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function validateClosureChecklist(checklist) {
  const errors = [];
  if (!checklist || typeof checklist !== 'object' || Array.isArray(checklist)) {
    return { ok: false, errors: ['closure_checklist debe ser objeto'] };
  }
  if (!validChecklistDate(checklist.updated_at)) errors.push('closure_checklist.updated_at debe ser fecha YYYY-MM-DD valida');
  if (!Array.isArray(checklist.items)) errors.push('closure_checklist.items debe ser arreglo');
  const ids = new Set();
  for (const [index, item] of (Array.isArray(checklist.items) ? checklist.items : []).entries()) {
    const prefix = `closure_checklist.items[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${prefix} debe ser objeto`);
      continue;
    }
    for (const field of ['id', 'step', 'module', 'next_action', 'closure_criterion']) {
      if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${prefix}.${field} debe ser texto no vacio`);
    }
    if (typeof item.id === 'string') {
      const id = item.id.trim();
      if (ids.has(id)) errors.push(`${prefix}.id duplicado`);
      ids.add(id);
    }
    if (!VALID_PLAN_STATES.includes(item.status)) errors.push(`${prefix}.status invalido`);
    if (!['local', 'produccion'].includes(item.environment)) errors.push(`${prefix}.environment invalido`);
    if (!Array.isArray(item.evidence) || item.evidence.some(value => typeof value !== 'string' || !value.trim())) errors.push(`${prefix}.evidence debe ser arreglo de textos no vacios`);
    if (item.blocker !== null && typeof item.blocker !== 'string') errors.push(`${prefix}.blocker debe ser texto o null`);
    if (item.checked_at !== null && !validChecklistTimestamp(item.checked_at)) errors.push(`${prefix}.checked_at debe ser fecha ISO o null`);
    if (item.status === 'terminado') {
      if (!Array.isArray(item.evidence) || !item.evidence.length) errors.push(`${prefix} terminado requiere evidencia`);
      if (!validChecklistTimestamp(item.checked_at)) errors.push(`${prefix} terminado requiere checked_at`);
      if (typeof item.blocker === 'string' && item.blocker.trim()) errors.push(`${prefix} terminado no puede tener bloqueo`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function closureChecklistLabels(item) {
  return {
    status_label: item.status === 'terminado'
      ? (item.environment === 'local' ? 'Comprobado localmente' : 'Comprobado en produccion')
      : statusLabel(item.status),
    environment_label: item.environment === 'local' ? 'Local' : 'Produccion',
  };
}

export async function loadProjectPlan(filePath = defaultPlanPath) {
  const raw = await readFile(filePath, 'utf8');
  const plan = JSON.parse(raw);
  const validation = validateProjectPlan(plan);
  if (!validation.ok) {
    const err = new Error(`Plan Maestro invalido: ${validation.errors.join('; ')}`);
    err.validation = validation;
    throw err;
  }
  return {
    ...plan,
    summary: summarizeProjectPlan(plan),
  };
}

export function validateProjectPlan(plan) {
  const errors = [];
  if (plan && Object.hasOwn(plan, 'closure_checklist')) errors.push(...validateClosureChecklist(plan.closure_checklist).errors);
  if (!plan || typeof plan !== 'object') errors.push('plan debe ser objeto');
  if (!plan?.project) errors.push('project requerido');
  if (!plan?.updated_at) errors.push('updated_at requerido');
  if (!Array.isArray(plan?.items) || plan.items.length === 0) errors.push('items debe ser arreglo no vacio');
  const modules = plan?.operating_control?.modules;
  if (!Array.isArray(modules) || modules.length !== 9) errors.push('operating_control.modules debe tener nueve modulos');
  const moduleKeys = new Set();
  for (const [index, module] of (modules || []).entries()) {
    const prefix = `operating_control.modules[${index}]`;
    for (const field of ['key', 'title', 'status', 'local_status', 'production_status', 'last_review', 'evidence', 'next_action']) {
      if (!module[field]) errors.push(`${prefix}.${field} requerido`);
    }
    if (module.key && moduleKeys.has(module.key)) errors.push(`${prefix}.key duplicado ${module.key}`);
    if (module.key) moduleKeys.add(module.key);
    for (const field of ['status', 'local_status', 'production_status']) {
      if (module[field] && !VALID_PLAN_STATES.includes(module[field])) errors.push(`${prefix}.${field} invalido ${module[field]}`);
    }
  }

  const ids = new Set();
  for (const [index, item] of (plan?.items || []).entries()) {
    const prefix = `items[${index}]`;
    if (!item.id) errors.push(`${prefix}.id requerido`);
    if (item.id && ids.has(item.id)) errors.push(`${prefix}.id duplicado ${item.id}`);
    if (item.id) ids.add(item.id);
    for (const field of ['area', 'title', 'status', 'local_status', 'production_status', 'summary', 'next_action', 'updated_at']) {
      if (!item[field]) errors.push(`${prefix}.${field} requerido`);
    }
    for (const field of ['status', 'local_status', 'production_status']) {
      if (item[field] && !VALID_PLAN_STATES.includes(item[field])) errors.push(`${prefix}.${field} invalido ${item[field]}`);
    }
    if (item.status === 'terminado' && item.blocker) errors.push(`${prefix} terminado no puede tener bloqueo propio`);
  }

  return { ok: errors.length === 0, errors };
}

export function summarizeProjectPlan(plan) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  const counts = {
    terminados: 0,
    en_validacion: 0,
    pendientes: 0,
    bloqueados: 0,
    bloqueados_seguridad: 0,
  };

  let points = 0;
  let productionDone = 0;
  for (const item of items) {
    if (item.status === 'terminado') counts.terminados += 1;
    else if (item.status === 'en_validacion') counts.en_validacion += 1;
    else if (item.status === 'pendiente') counts.pendientes += 1;
    else if (item.status === 'bloqueado') counts.bloqueados += 1;
    else if (item.status === 'bloqueado_seguridad') {
      counts.bloqueados += 1;
      counts.bloqueados_seguridad += 1;
    }
    if (item.production_status === 'terminado') productionDone += 1;
    points += STATE_WEIGHTS[item.status] || 0;
  }

  const progress = items.length ? Math.round(points / items.length) : 0;
  const productionStatus = productionDone === 0 ? 'NO' : (productionDone === items.length ? 'SI' : 'PARCIAL');
  return {
    total: items.length,
    counts,
    progress_percent: progress,
    production_status: productionStatus,
  };
}

export function renderProjectPlanMarkdown(plan) {
  const summary = plan.summary || summarizeProjectPlan(plan);
  const lines = [
    '# Plan Maestro - Constructor Comercial',
    '',
    '> Fuente unica estructurada: `docs/constructor/plan-maestro-constructor.json`.',
    '> Este documento se genera desde JSON; no mantenerlo como segunda verdad manual.',
    '',
    `- Estado general: ${plan.overall_status}`,
    `- Fase: ${plan.phase}`,
    `- Entorno: ${plan.environment}`,
    `- Ultima actualizacion: ${plan.updated_at}`,
    `- Avance visual: ${summary.progress_percent}%`,
    `- Produccion: ${summary.production_status}`,
    '',
    'El porcentaje de avance es solo una referencia visual del progreso. No representa calidad tecnica ni autorizacion para produccion.',
    '',
    '## Control Operativo Obligatorio',
    '',
    plan.operating_control?.purpose || 'Sin control operativo registrado.',
    '',
    ...(plan.operating_control?.release_gate || []).map((rule, index) => `${index + 1}. ${escapeMd(rule)}`),
    '',
    '### Modulos Administrativos',
    '',
    '| Modulo | Estado | Local | Produccion | Ultima revision | Evidencia | Impacto a verificar | Proximo paso |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...(plan.operating_control?.modules || []).map((module) => `| ${escapeMd(module.title)} | ${escapeMd(statusLabel(module.status))} | ${escapeMd(statusLabel(module.local_status))} | ${escapeMd(statusLabel(module.production_status))} | ${escapeMd(module.last_review)} | ${escapeMd(module.evidence)} | ${escapeMd((module.impacts || []).join(', '))} | ${escapeMd(module.next_action)} |`),
    '',
    ...closureChecklistMarkdown(plan),
    '## Resumen',
    '',
    `- Terminados: ${summary.counts.terminados}`,
    `- En validacion: ${summary.counts.en_validacion}`,
    `- Pendientes: ${summary.counts.pendientes}`,
    `- Bloqueados: ${summary.counts.bloqueados}`,
    `- Bloqueados seguridad: ${summary.counts.bloqueados_seguridad}`,
    '',
    '## Items',
    '',
    '| ID | Area | Estado | Local | Produccion | Pruebas | Proximo paso |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...plan.items.map((item) => `| ${escapeMd(item.id)} | ${escapeMd(item.area)} | ${escapeMd(statusLabel(item.status))} | ${escapeMd(statusLabel(item.local_status))} | ${escapeMd(statusLabel(item.production_status))} | ${escapeMd(testSummary(item.tests))} | ${escapeMd(item.next_action)} |`),
    '',
    '## Bloqueos Visibles',
    '',
    ...blockedLines(plan.items),
    '',
    '## Regla Operativa',
    '',
    'Toda tarea relacionada con Constructor, Motor Comercial, Fuentes, Servicios/Beneficios o Agente Comercial debe actualizar `docs/constructor/plan-maestro-constructor.json` y regenerar este MD antes de declararse terminada.',
    '',
  ];
  return `${lines.join('\n')}`;
}

function closureChecklistMarkdown(plan) {
  if (!Object.hasOwn(plan, 'closure_checklist')) return [];
  const checklist = plan.closure_checklist;
  const validation = validateClosureChecklist(checklist);
  if (!validation.ok) throw new Error(`Checklist invalido: ${validation.errors.join('; ')}`);
  return [
    '## Checklist de Cierre',
    '',
    `Fecha al corte: ${checklist.updated_at}`,
    '',
    '| ID | Paso | Modulo | Estado | Ambiente | Evidencia | Bloqueo | Siguiente accion | Criterio de cierre | Comprobacion |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...checklist.items.map(item => {
      const labels = closureChecklistLabels(item);
      const cells = [item.id, item.step, item.module, labels.status_label, labels.environment_label, item.evidence.join('; '), item.blocker, item.next_action, item.closure_criterion, item.checked_at];
      return `| ${cells.map(escapeChecklistMd).join(' | ')} |`;
    }),
    '',
  ];
}

function escapeChecklistMd(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]{}()|#!]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

function blockedLines(items) {
  const blocked = items.filter((item) => item.blocker || item.status === 'bloqueado' || item.status === 'bloqueado_seguridad');
  if (!blocked.length) return ['Sin bloqueos registrados.'];
  return blocked.map((item) => `- **${escapeMd(item.area)}** (${escapeMd(statusLabel(item.status))}): ${escapeMd(item.blocker?.summary || item.summary)}`);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '';
}

function testSummary(tests = {}) {
  const passed = Number(tests.passed || 0);
  const failed = Number(tests.failed || 0);
  return `${passed}/${passed + failed} ${tests.summary || ''}`.trim();
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
