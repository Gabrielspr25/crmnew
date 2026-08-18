import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const indexPage = await readFile(new URL('../../Planes para web/index.html', import.meta.url), 'utf8');
const directoryPage = await readFile(new URL('../../Planes para web/directorio-fijo.html', import.meta.url), 'utf8');
const dataSource = await readFile(new URL('../../Planes para web/directorio-fijo-data.js', import.meta.url), 'utf8');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(dataSource, context);
const directory = context.window.DIRECTORIO_FIJO_DATA;

test('portal de fijo publica Directorio de fijo como pagina aparte', () => {
  assert.match(indexPage, /href="directorio-fijo\.html"/);
  assert.doesNotMatch(indexPage, /function buildDirectorioFijo\(q\)/);
  assert.doesNotMatch(indexPage, /directorio-fijo-data\.js/);
  assert.doesNotMatch(indexPage, /href="oferta-const\.html"/);
  assert.doesNotMatch(indexPage, /href="ofertas\.html"/);
  assert.match(directoryPage, /directorio-fijo-data\.js\?v=2026081101/);
  assert.match(directoryPage, /href="directorio-fijo\.html" class="active"/);
  assert.match(indexPage, /Directorio de fijo/);
  assert.match(directoryPage, /function render\(\)/);
  assert.match(directoryPage, /Gerente Operaciones de Campo/);
});

test('directorio de fijo agrupa por gerente de operaciones de campo', () => {
  assert.equal(directory.title, 'Directorio de fijo');
  assert.equal(directory.source_file, 'Directorio Operaciones Clientes Masivos dic. 2025.xlsx');
  assert.equal(directory.groups.length, 7);
  assert.equal(directory.admin.length, 6);
  assert.equal(directory.groups[0].manager.job, 'Gerente Operaciones de Campo');
  assert.equal(directory.groups[0].manager.name, 'José R. Delgado Cotto');
  assert.equal(directory.groups.reduce((total, group) => total + 1 + group.contacts.length, directory.admin.length), 84);
});
