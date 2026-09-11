import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');
const templatePath = resolve(process.cwd(), '..', 'frontend', 'propuesta-template.html');

function comparativaBlock(html) {
  const start = html.indexOf('// ---- Comparativa de Planes');
  const end = html.indexOf('async function viewCliente', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

test('los botones de comparativa no arrastran emojis mal codificados', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.doesNotMatch(html, /ðŸ/);
  assert.doesNotMatch(html, /Ã°Å¸/);
  assert.match(html, /🌐 Comparativa HTML\/PDF/);
});

test('el modal de comparativa puede verse lado a lado y recuerda la preferencia', async () => {
  const block = comparativaBlock(await readFile(appPath, 'utf8'));

  assert.match(block, /function compVistaGuardada\(\)/);
  assert.match(block, /vp_comp_vista/);
  assert.match(block, /function compToggleVista\(\)/);
  assert.match(block, /class="compGrid( |")/);
  assert.match(block, /onclick="compToggleVista\(\)"/);
});

test('la comparativa abre la propuesta con el cliente para poder guardarla en el CRM', async () => {
  const block = comparativaBlock(await readFile(appPath, 'utf8'));

  assert.match(block, /client_id:c\.id/);
  assert.match(block, /onclick="generarPropuesta\(\)"/);
});

test('la propuesta titula con el cliente real y no con un cliente de ejemplo', async () => {
  const template = await readFile(templatePath, 'utf8');

  assert.doesNotMatch(template, /<title>[^<]*Graphic Printing[^<]*<\/title>/);
  assert.match(template, /document\.title=/);
});

test('la propuesta guarda los dos formatos y no obliga a elegir uno', async () => {
  const template = await readFile(templatePath, 'utf8');

  assert.match(template, /function guardarHTML\(\)/);
  assert.match(template, /function guardarPDF\(\)/);
  assert.match(template, /function guardarPropuesta\(\)\{[^}]*guardarHTML\(\)/);
  assert.match(template, /guardarPDF\(\)/);
  assert.match(template, /onclick="guardarPropuesta\(\)"/);
  assert.match(template, /\.html'/);
  assert.match(template, /\.pdf'/);
});

test('el HTML guardado es autocontenido y reabre con los datos editados', async () => {
  const template = await readFile(templatePath, 'utf8');

  assert.match(template, /window\.__PROPUESTA__/);
  assert.match(template, /cloneNode\(true\)/);
  assert.match(template, /new Blob\(/);
  assert.match(template, /text\/html/);
});

test('la propuesta guarda las ediciones en Comparativas del CRM', async () => {
  const template = await readFile(templatePath, 'utf8');

  assert.match(template, /function guardarEnCRM\(\)/);
  assert.match(template, /'\/api\/comparativas'/);
  assert.match(template, /vp_token/);
  assert.match(template, /client_id/);
  assert.match(template, /onclick="guardarEnCRM\(\)"/);
});

test('el Excel de la comparativa sale con diseño Claro en un xlsx nativo', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /exceljs@[0-9.]+\/dist\/exceljs\.min\.js/);

  const start = html.indexOf('function compExcel()');
  const end = html.indexOf('function compPDF()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = html.slice(start, end);

  assert.match(block, /new ExcelJS\.Workbook\(\)/);
  assert.match(block, /addWorksheet\('Comparativa'/);
  assert.match(block, /FF1F2A44/);
  assert.match(block, /FFFFB21C/);
  assert.match(block, /writeBuffer\(\)/);
  assert.match(block, /\.xlsx'/);
  assert.match(block, /\$#,##0\.00/);
});

test('el Excel conserva un respaldo plano si ExcelJS no carga y no deja codigo muerto', async () => {
  const html = await readFile(appPath, 'utf8');
  const start = html.indexOf('function compExcel()');
  const end = html.indexOf('function compPDF()', start);
  const block = html.slice(start, end);

  assert.match(block, /typeof ExcelJS==='undefined'/);
  assert.match(block, /compExcelPlano\(/);
  assert.doesNotMatch(block, /application\/vnd\.ms-excel/);
  assert.doesNotMatch(block, /compare-form/);

  const planoStart = html.indexOf('function compExcelPlano(');
  assert.notEqual(planoStart, -1);
  const plano = html.slice(planoStart, html.indexOf('function compExcel()', planoStart) + 1 || planoStart + 4000);
  assert.match(plano, /XLSX\.utils\.book_new\(\)/);
  assert.match(plano, /XLSX\.writeFile/);
});

test('la propuesta muestra plan actual y oferta lado a lado con vista alternable', async () => {
  const template = await readFile(templatePath, 'utf8');

  assert.match(template, /class="compareGrid"/);
  assert.match(template, /\.compareGrid\{[^}]*grid-template-columns:1fr 1fr/);
  assert.match(template, /function toggleVista\(\)/);
  assert.match(template, /vp_propuesta_vista/);
  assert.match(template, /onclick="toggleVista\(\)"/);
});
