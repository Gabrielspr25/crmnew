import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const appPath = new URL('../../frontend/app.html', import.meta.url);

async function readApp() {
  return readFile(appPath, 'utf8');
}

async function loadAdminUi() {
  const html = await readApp();
  const start = html.indexOf('let moPreview=');
  const end = html.indexOf('// ----- SERVICIOS / FEATURES -----', start);
  assert.ok(start >= 0 && end > start, 'falta el bloque UI de Admin Ofertas');
  const elements = new Map([
    ['moResultado', { innerHTML: '', disabled: false }],
    ['moEstado', { innerHTML: '', disabled: false }],
    ['moAprobar', { innerHTML: '', disabled: true }],
    ['moVigente', { innerHTML: '', disabled: false }],
  ]);
  const calls = { tabs: [] };
  const context = {
    $: (id) => elements.get(id) ?? null,
    ofSetTab: (tab) => calls.tabs.push(tab),
    esc: (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character])),
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  return { context, elements, calls };
}

async function loadEquipmentHelpers() {
  const html = await readApp();
  const start = html.indexOf('const EQ_MONTHS=');
  const end = html.indexOf('async function ofRenderEquipos()', start);
  assert.ok(start >= 0 && end > start, 'faltan helpers de vigencia para Lista de Equipos');
  const context = {};
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  return context;
}

function previewValido() {
  return {
    ok: true,
    version: { id: '00000000-0000-4000-8000-000000000005', numero: 5, estado: 'pendiente_revision' },
    vigencia: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
    fuentes: {
      tabla_financiamiento: { desde: '2026-07-16', hasta: '2026-07-21', estado: 'vigente' },
      lista_precios: { desde: '2026-05-28', hasta: '2026-07-31', estado: 'vigente' },
    },
    resumen: {
      filas_procesadas: 11,
      equipos_procesados: 45,
      ofertas_nuevas: 3,
      ofertas_modificadas: 2,
      ofertas_salieron: 1,
      equipos_nuevos: 4,
      equipos_salieron: 1,
      precios_nuevos_modificados: 2,
      cambios_detectados: 13,
      contradicciones_bloqueantes: 0,
    },
    contradicciones: [],
  };
}

test('Admin Ofertas tiene un solo renderer simple, sin bloqueos ni decisiones manuales', async () => {
  const html = await readApp();
  const offersStart = html.indexOf('async function ofRenderOfertasTienda()');
  const offersEnd = html.indexOf('function moArchivoLabel', offersStart);
  const equipmentStart = html.indexOf('async function ofRenderEquipos()');
  const equipmentEnd = html.indexOf('async function eqPreview', equipmentStart);
  const offersRenderer = html.slice(offersStart, offersEnd);
  const equipmentRenderer = html.slice(equipmentStart, equipmentEnd);
  assert.equal((html.match(/async function ofRenderOfertasTienda\(\)/g) ?? []).length, 1);
  assert.match(offersRenderer, /id=["']moTablaFinanciamiento["']/);
  assert.match(offersRenderer, /id=["']moVigenciaDesde["']/);
  assert.match(offersRenderer, /id=["']moVigenciaHasta["']/);
  assert.doesNotMatch(offersRenderer, /id=["']moListaPrecios["']/);
  assert.doesNotMatch(equipmentRenderer, /id=["']moListaPrecios["']/);
  assert.match(equipmentRenderer, /id=["']eqVigenciaInicio["']/);
  assert.match(equipmentRenderer, /id=["']eqVigenciaFin["']/);
  assert.match(offersRenderer, /Ofertas moviles/);
  assert.match(offersRenderer, /lista vigente aceptada/);
  assert.match(offersRenderer, /id=["']moAprobar["']/);
  assert.match(html, /api\/motor-ofertas\/preview-tabla/);
  assert.doesNotMatch(html, /if\(ofTab==='ofertas'\) return ofRenderOfertasRevisionTecnica\(\)/);
});

test('renderiza el resumen comercial y habilita actualizar solo para un preview válido', async () => {
  const { context, elements } = await loadAdminUi();
  const preview = previewValido();
  vm.runInContext(`moPreview=${JSON.stringify(preview)}; moRenderPreview(moPreview);`, context);

  const rendered = elements.get('moResultado').innerHTML;
  assert.match(rendered, /Filas procesadas/);
  assert.match(rendered, />11</);
  assert.match(rendered, /Equipos procesados/);
  assert.match(rendered, />45</);
  assert.match(rendered, /Ofertas nuevas/);
  assert.match(rendered, /Precios nuevos o modificados/);
  assert.match(rendered, /2026-07-16/);
  assert.match(rendered, /Tabla de financiamiento/);
  assert.match(rendered, /Lista de precios/);
  assert.match(rendered, /Fuentes analizadas/);
  assert.match(rendered, /2026-05-28/);
  assert.doesNotMatch(rendered, /contradicci/i);
  assert.equal(elements.get('moAprobar').disabled, false);

  preview.resumen.contradicciones_bloqueantes = 1;
  vm.runInContext(`moPreview=${JSON.stringify(preview)}; moRenderPreview(moPreview);`, context);
  assert.equal(elements.get('moAprobar').disabled, true);
});

test('mantiene Ofertas y Lista de Equipos como tabs independientes', async () => {
  const { context, calls } = await loadAdminUi();
  vm.runInContext("moSetSourceFile('tabla_financiamiento',{files:[{name:'ofertas.xlsx'}]})", context);
  assert.deepEqual(calls.tabs, []);

  vm.runInContext("moSetSourceFile('lista_precios',{files:[{name:'precios.xlsx'}]})", context);
  assert.deepEqual(calls.tabs, []);
});

test('distingue un archivo seleccionado de una importacion ya analizada', async () => {
  const { context } = await loadAdminUi();
  vm.runInContext("moSetSourceFile('tabla_financiamiento',{files:[{name:'ofertas.xlsx'}]})", context);
  const status = vm.runInContext("moSourceName('tabla_financiamiento')", context);
  assert.match(status, /Tabla de financiamiento seleccionado: ofertas\.xlsx/);
  assert.match(status, /Pendiente de analizar/);
});

test('detecta la vigencia de la lista desde el nombre oficial cuando el historial no la guardó', async () => {
  const context = await loadEquipmentHelpers();
  const vigencia = vm.runInContext("eqUploadVigencia({nombre_archivo:'Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx'})", context);
  assert.deepEqual(JSON.parse(JSON.stringify(vigencia)), {
    desde: '2026-05-28',
    hasta: '2026-07-31',
    origen: 'nombre_archivo',
  });
});

test('detecta el rango dentro de un mismo mes para la tabla de ofertas', async () => {
  const context = await loadEquipmentHelpers();
  const vigencia = vm.runInContext("eqUploadVigencia({nombre_archivo:'Tabla Ofertas Financiamiento 16 al 21 de julio de 2026- PYMES.xlsx'})", context);
  assert.deepEqual(JSON.parse(JSON.stringify(vigencia)), {
    desde: '2026-07-16',
    hasta: '2026-07-21',
    origen: 'nombre_archivo',
  });
});

test('envia la vigencia visible al aceptar la lista y analizar el boletin', async () => {
  const html = await readApp();

  assert.match(html, /var vigencia=eqVigenciaIngresada\(\)\s*\|\|\s*eqUploadVigencia\(\{nombre_archivo:ofEquiposPreview\.name\}\)/);
  assert.match(html, /fd\.append\('vigencia_inicio',vigencia\.desde\)/);
  assert.match(html, /fd\.append\('vigencia_fin',vigencia\.hasta\)/);
  assert.match(html, /moVigenciaDesde/);
  assert.match(html, /moVigenciaHasta/);
});
