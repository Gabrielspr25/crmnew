import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import XLSX from 'xlsx';

const root = new URL('../../', import.meta.url);
const appHtml = readFileSync(new URL('frontend/app.html', root), 'utf8');
const routePath = new URL('../src/routes/directorioOperacionesRoutes.js', import.meta.url);
const migrationPath = new URL('../migrations/2026-07-20-directorio-operaciones.sql', import.meta.url);

test('Directorio Operaciones tiene una ruta propia, sin reutilizar Clientes', () => {
  assert.equal(existsSync(routePath), true, 'falta la ruta propia del directorio');
  const source = readFileSync(routePath, 'utf8');
  assert.match(source, /directorioOperacionesRouter\.get\('\/directorio-operaciones'/);
  assert.match(source, /directorioOperacionesRouter\.post\('\/directorio-operaciones\/import'/);
  assert.match(source, /directorioOperacionesRouter\.put\('\/directorio-operaciones\/:id'/);
  assert.match(source, /requireAdmin/);
});

test('Directorio Operaciones se persiste en una tabla independiente y editable', () => {
  assert.equal(existsSync(migrationPath), true, 'falta la migracion del directorio');
  const source = readFileSync(migrationPath, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS ventaspro_nuevo\.directorio_operaciones/);
  assert.match(source, /employee_number TEXT NOT NULL UNIQUE/);
  assert.match(source, /full_name TEXT NOT NULL/);
  assert.match(source, /updated_at/);
});

test('el frontend ofrece el modulo y su tabla compacta', () => {
  assert.match(appHtml, /href="#\/directorio"/);
  assert.match(appHtml, /Directorio Operaciones/);
  assert.match(appHtml, /async function viewDirectorioOperaciones\(\)/);
  assert.match(appHtml, /Actualizar desde Excel/);
  assert.match(appHtml, /Editar contacto/);
});

test('lector del directorio usa empleado como llave e ignora filas de seccion', async () => {
  const { parseDirectoryWorkbook } = await import('../src/routes/directorioOperacionesRoutes.js');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Directorio de operaciones'],
    ['DISTRITO', 'CODIGO', 'NOMBRE', '#EMPLEADO', 'PUESTO', 'PUEBLOS QUE COMPRENDE', 'CELULAR', 'EMAIL'],
    ['Metro', '128', 'Ana Perez', '1001', 'Supervisor', 'San Juan', '787-555-0101', 'ana@claro.test'],
    ['APROVISIONAMIENTO'],
  ]), 'DIRECTORIO');
  const parsed = parseDirectoryWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  assert.equal(parsed.sheetName, 'DIRECTORIO');
  assert.equal(parsed.contacts.length, 1);
  assert.equal(parsed.contacts[0].employee_number, '1001');
  assert.equal(parsed.contacts[0].full_name, 'Ana Perez');
  assert.equal(parsed.ignored.length, 0);
});
