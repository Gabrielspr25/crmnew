import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { trackingDefaults, validateTracking, auditTracking } from './audienciaTracking.js';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ITEMS = 3000;
const MAX_PROJECTS = 300;
const DEFAULT_PROJECTS = [
  'newcrm',
  'Notebook ejercicio',
  'Scraper',
  'Web-Accesorios-Tango-PR2',
  'Audiencia',
  'Constructor',
];
const DEFAULT_STATES = ['pendiente', 'esperando', 'bloqueada', 'terminada', 'revisada'];
const DOCUMENTED_MODULES = {
  newcrm: [
    ['Arquitectura del Constructor', 'en validación', 'Plan Maestro PM-001 a PM-004'],
    ['Motor Comercial y elegibilidad', 'en validación', 'Plan Maestro PM-005 a PM-008 y PM-019'],
    ['Fuentes y Centro de Cargas', 'en validación', 'Plan Maestro PM-009 a PM-015 y PM-024 a PM-025'],
    ['Comparativas y cotización', 'en validación', 'Plan Maestro PM-017, PM-022 y PM-023'],
    ['Administración y transición', 'en validación', 'Plan Maestro PM-020, PM-026 a PM-028'],
  ],
  Audiencia: [
    ['Acceso privado', 'en validación', 'Sesión CRM y propietario exacto; sin segunda contraseña en el modo local'],
    ['Ideas y seguimiento', 'en validación', 'Panel privado sin datos comerciales'],
    ['Katy', 'en validación', 'Lectura completa y dos escrituras locales comprobadas; coordinación posterior sin verificar'],
  ],
};

function error(message, status = 400) {
  const result = new Error(message);
  result.status = status;
  return result;
}

function text(value, limit = 5000) {
  return typeof value === 'string' && value.trim().length <= limit;
}

function validProject(project) {
  return project
    && text(project.id, 100)
    && text(project.name, 160)
    && Array.isArray(project.modules || [])
    && (project.modules || []).length <= 100
    && (project.modules || []).every((module) => text(module.id, 100)
      && text(module.name, 160)
      && (module.status === undefined || text(module.status, 80))
      && (module.evidence === undefined || text(module.evidence, 500)));
}

function validItem(item, states, projectIds) {
  return item
    && text(item.id, 100)
    && text(item.title, 240)
    && ['idea', 'tarea'].includes(item.kind)
    && text(item.state, 80)
    && states.includes(item.state)
    && (!item.projectId || projectIds.has(item.projectId))
    && (!item.moduleId || text(item.moduleId, 100))
    && (!item.date || /^\d{4}-\d{2}-\d{2}$/.test(item.date))
    && (item.nextStep === undefined || text(item.nextStep, 3000))
    && (item.notes === undefined || text(item.notes, 10000))
    && (item.rawInput === undefined || text(item.rawInput, 10000))
    && (item.history === undefined || (Array.isArray(item.history) && item.history.length <= 200 && item.history.every((entry) => text(entry.id, 100) && text(entry.at, 40) && text(entry.note, 3000))));
}

export function audienceDefaults() {
  return {
    version: 1,
    revision: 0,
    theme: 'light',
    states: [...DEFAULT_STATES],
    projects: DEFAULT_PROJECTS.map((name) => ({
      id: `aud-project-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      modules: (DOCUMENTED_MODULES[name] || []).map(([moduleName, status, evidence]) => ({
        id: `aud-module-${name}-${moduleName}`, name: moduleName, status, evidence,
      })),
    })),
    items: [],
    tracking: trackingDefaults(),
  };
}

function reconcileDocumentedModules(value) {
  return {
    ...value,
    projects: [...value.projects, ...(!value.projects.some(p=>p.name==='Constructor') ? [{id:'aud-project-constructor',name:'Constructor',modules:[]}] : [])].map((project) => {
      const documented = DOCUMENTED_MODULES[project.name] || [];
      const knownNames = new Set((project.modules || []).map((module) => module.name));
      const missing = documented
        .filter(([moduleName]) => !knownNames.has(moduleName))
        .map(([name, status, evidence]) => ({ id: `aud-module-${project.id}-${name}`, name, status, evidence }));
      return missing.length ? { ...project, modules: [...(project.modules || []), ...missing] } : project;
    }),
  };
}

export function validateAudience(value) {
  if (!value || typeof value !== 'object') throw error('Los datos de Audiencia no son válidos.');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw error('La revisión de Audiencia no es válida.');
  if (!['light', 'dark'].includes(value.theme)) throw error('El tema de Audiencia no es válido.');
  if (!Array.isArray(value.states) || value.states.length < 1 || value.states.length > 50 || !value.states.every((state) => text(state, 80))) throw error('Los estados de Audiencia no son válidos.');
  if (!Array.isArray(value.projects) || value.projects.length > MAX_PROJECTS || !value.projects.every(validProject)) throw error('Los proyectos de Audiencia no son válidos.');
  const projectIds = new Set(value.projects.map((project) => project.id));
  if (projectIds.size !== value.projects.length) throw error('Los proyectos de Audiencia están duplicados.');
  if (!Array.isArray(value.items) || value.items.length > MAX_ITEMS || !value.items.every((item) => validItem(item, value.states, projectIds))) throw error('Las fichas de Audiencia no son válidas.');
  if (new Set(value.items.map((item) => item.id)).size !== value.items.length) throw error('Las fichas de Audiencia están duplicadas.');
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_BYTES) throw error('Audiencia supera el límite de 25 MB.', 413);
  if (value.tracking !== undefined) validateTracking(value.tracking);
  return value;
}

export function createAudienciaStore({ directory }) {
  const currentFile = path.join(directory, 'audiencia.json');
  const previousFile = path.join(directory, 'audiencia.previous.json');
  let queue = Promise.resolve();
  const defaults = audienceDefaults();

  async function read() {
    try {
      const data = reconcileDocumentedModules(validateAudience(JSON.parse(await readFile(currentFile, 'utf8'))));
      return { ...data, tracking: data.tracking || trackingDefaults() };
    } catch (caught) {
      if (caught?.code === 'ENOENT') return structuredClone(defaults);
      if (caught?.status) throw caught;
      throw error('No se pudo leer Audiencia; los datos existentes se conservaron sin cambios.', 500);
    }
  }

  async function write(value, expectedRevision, actor) {
    const work = queue.then(async () => {
      const current = await read();
      let inventoryInitial = false;
      try {
        inventoryInitial = !JSON.parse(await readFile(currentFile, 'utf8')).tracking;
      } catch (caught) {
        if (caught?.code !== 'ENOENT') throw caught;
        inventoryInitial = true;
      }
      if (expectedRevision !== current.revision) throw error('Audiencia cambió en otra sesión. Actualiza antes de guardar.', 409);
      validateAudience(value);
      // Compatibilidad con clientes versión 1: omitir tracking conserva el registro.
      const tracking = auditTracking(current, value, actor, inventoryInitial);
      const next = validateAudience({ ...value, tracking, revision: current.revision + 1 });
      await mkdir(directory, { recursive: true });
      try {
        await copyFile(currentFile, previousFile);
      } catch (caught) {
        if (caught?.code !== 'ENOENT') throw caught;
        await writeFile(previousFile, JSON.stringify(current, null, 2), 'utf8');
      }
      const temporary = `${currentFile}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
      await rename(temporary, currentFile);
      return next;
    });
    queue = work.catch(() => {});
    return work;
  }

  return { read, write };
}
