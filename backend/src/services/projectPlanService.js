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
  if (!plan || typeof plan !== 'object') errors.push('plan debe ser objeto');
  if (!plan?.project) errors.push('project requerido');
  if (!plan?.updated_at) errors.push('updated_at requerido');
  if (!Array.isArray(plan?.items) || plan.items.length === 0) errors.push('items debe ser arreglo no vacio');

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
