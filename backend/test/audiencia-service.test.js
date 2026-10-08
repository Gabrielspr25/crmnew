import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAudienciaStore, audienceDefaults } from '../src/services/audienciaStore.js';

test('Audiencia inicia aislada con los proyectos confirmados y sin finanzas no validadas', () => {
  const data = audienceDefaults();
  assert.deepEqual(data.projects.map((project) => project.name), [
    'newcrm',
    'Notebook ejercicio',
    'Scraper',
    'Web-Accesorios-Tango-PR2',
    'Audiencia',
    'Constructor',
  ]);
  assert.equal(data.items.length, 0);
  assert.equal(data.projects.some((project) => project.name === 'Panel de finanzas'), false);
  const newcrm = data.projects.find((project) => project.name === 'newcrm');
  assert.deepEqual(newcrm.modules.map((module) => module.name), [
    'Arquitectura del Constructor',
    'Motor Comercial y elegibilidad',
    'Fuentes y Centro de Cargas',
    'Comparativas y cotización',
    'Administración y transición',
  ]);
  assert.equal(newcrm.modules.every((module) => module.status === 'en validación'), true);
  const audiencia = data.projects.find((project) => project.name === 'Audiencia');
  const katy = audiencia.modules.find((module) => module.name === 'Katy');
  assert.notEqual(katy.status, 'bloqueada');
  assert.match(katy.evidence, /coordinación posterior sin verificar/);
  assert.doesNotMatch(audiencia.modules.find((module) => module.name === 'Acceso privado').evidence, /requiere segunda contraseña|y segunda contraseña/);
});

test('Audiencia incorpora módulos documentados sin reemplazar proyectos ni fichas privadas existentes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'audiencia-modules-'));
  const store = createAudienciaStore({ directory });
  const initial = audienceDefaults();
  const newcrm = initial.projects.find((project) => project.name === 'newcrm');
  const preserved = { ...initial, projects: initial.projects.map((project) => project.id === newcrm.id ? { ...project, modules: [] } : project), items: [{ id: 'captura-1', kind: 'idea', title: 'Texto original', rawInput: 'Texto original', projectId: '', moduleId: '', state: 'pendiente', date: '', nextStep: '', notes: '', history: [] }] };
  await writeFile(path.join(directory, 'audiencia.json'), JSON.stringify(preserved), 'utf8');

  const actual = await store.read();
  const actualNewcrm = actual.projects.find((project) => project.id === newcrm.id);
  assert.ok(actualNewcrm.modules.some((module) => module.name === 'Arquitectura del Constructor'));
  assert.deepEqual(actual.items, preserved.items);
});

test('Audiencia conserva una copia anterior y rechaza una escritura con revision obsoleta', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'audiencia-store-'));
  const store = createAudienciaStore({ directory });
  const initial = await store.read();
  const saved = await store.write({
    ...initial,
    items: [{ id: 'idea-1', title: 'Idea privada', kind: 'idea', state: 'pendiente', projectId: '', notes: '', nextStep: '', history: [] }],
  }, initial.revision);

  assert.equal(saved.revision, 1);
  await assert.rejects(
    () => store.write({ ...initial, items: [] }, initial.revision),
    (error) => error.status === 409,
  );

  const previous = JSON.parse(await readFile(path.join(directory, 'audiencia.previous.json'), 'utf8'));
  assert.equal(previous.revision, 0);
  assert.equal(previous.items.length, 0);
});
