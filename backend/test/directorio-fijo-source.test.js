import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { diffDirectorioFijo, parseDirectorioFijoWorkbook } from '../src/services/directorioFijoSource.js';

function workbookBuffer(rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'DIRECTORIO');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

const headers = {
  Distrito: 'Metro Norte',
  Código: '220',
  Nombre: 'José Delgado',
  Empleado: '32008',
  Puesto: 'Gerente Operaciones de Campo',
  'Pueblos que comprende': 'Metro Norte',
  Celular: '939-278-3755',
  Email: 'jose@example.com',
};

test('convierte el Excel oficial de Directorio a la estructura del portal', () => {
  const result = parseDirectorioFijoWorkbook(workbookBuffer([
    { ...headers, Nombre: 'David Carreras', Distrito: 'Administración', Puesto: 'Subdirector OC', Empleado: '20457' },
    headers,
    { ...headers, Nombre: 'Annelys Vega', Puesto: 'Supervisor Operaciones de Campo', Empleado: '34341' },
  ]));

  assert.equal(result.source_sheet, 'DIRECTORIO');
  assert.equal(result.admin.length, 1);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].manager.name, 'José Delgado');
  assert.equal(result.groups[0].contacts[0].name, 'Annelys Vega');
  assert.equal(result.total_contactos, 3);
});

test('bloquea un Excel de Directorio que no tiene columnas de contacto verificables', () => {
  assert.throws(
    () => parseDirectorioFijoWorkbook(workbookBuffer([{ Producto: 'No corresponde' }])),
    { code: 'directorio_columnas_incompletas' },
  );
});

test('resume altas, bajas y cambios contra el Directorio publicado', () => {
  const current = {
    admin: [],
    groups: [{ manager: { ...headers, name: 'José Delgado', employee: '32008' }, contacts: [{ ...headers, name: 'Ana', employee: '1', email: 'ana@example.com' }] }],
  };
  const next = {
    admin: [],
    groups: [{ manager: { ...headers, name: 'José Delgado', employee: '32008' }, contacts: [{ ...headers, name: 'Ana María', employee: '1', email: 'ana@example.com' }, { ...headers, name: 'Beatriz', employee: '2', email: 'bea@example.com' }] }],
  };

  assert.deepEqual(diffDirectorioFijo(current, next).resumen, { altas: 1, bajas: 0, cambios: 1, sin_cambio: 1 });
});
