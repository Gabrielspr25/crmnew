import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const appPath = new URL('../../frontend/app.html', import.meta.url);

async function readApp() {
  return readFile(appPath, 'utf8');
}

async function loadMotorUi() {
  const html = await readApp();
  const start = html.indexOf('let moPreview=');
  const end = html.indexOf('// ----- SERVICIOS / FEATURES -----', start);
  assert.ok(start >= 0 && end > start, 'falta el bloque UI del motor de ofertas');

  const elements = new Map([
    ['moResultado', { innerHTML: '', disabled: false }],
    ['moAprobar', { innerHTML: '', disabled: true }],
    ['moEstado', { innerHTML: '', disabled: false }],
    ['moVigente', { innerHTML: '', disabled: false }],
  ]);
  const calls = { api: [] };
  const context = {
    $: (id) => elements.get(id) ?? null,
    api: async (path) => {
      calls.api.push(path);
      return path === '/api/motor-ofertas/version-vigente'
        ? { ok: true, version: null }
        : { ok: true };
    },
    esc: (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character])),
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  return { context, elements, calls };
}

test('integra el motor movil dentro de la pestana ofertas existente', async () => {
  const html = await readApp();

  assert.match(html, /async function ofRenderOfertasTienda\(\)/);
  assert.match(html, /id=["']moTablaFinanciamiento["'][^>]*accept=["']\.xlsx["']/);
  assert.match(html, /id=["']moListaPrecios["'][^>]*accept=["']\.xlsx["']/);
  assert.match(html, /id=["']moPreviewBtn["']/);
  assert.match(html, /id=["']moAprobar["'][^>]*disabled/);
  assert.doesNotMatch(html, /#\/motor-ofertas|function viewMotorOfertas|function moSetTab/);
});

test('envia ambos Exceles en FormData y no hace preview incompleto', async () => {
  const html = await readApp();

  assert.match(html, /new FormData\(\)/);
  assert.match(html, /fd\.append\(['"]tabla_financiamiento['"],\s*tabla\.files\[0\]\)/);
  assert.match(html, /fd\.append\(['"]lista_precios['"],\s*lista\.files\[0\]\)/);
  assert.match(html, /apiForm\(['"]\/api\/motor-ofertas\/preview['"],\s*fd\)/);
  assert.match(html, /archivos_faltantes|faltantes/);
  assert.match(html, /Tabla de financiamiento/);
  assert.match(html, /Lista de precios/);
});

test('renderiza el shape real del normalizador y habilita una reutilizada aprobable', async () => {
  const { context, elements, calls } = await loadMotorUi();
  const blockingPreview = {
    ok: true,
    version: { id: 'version-bloqueada', numero: 18, estado: 'pendiente_revision' },
    resumen: { ofertas: 2, equipos: 4, contradicciones_abiertas: 1, contradicciones_bloqueantes: 1 },
    vigencia: { desde: '2026-07-01', hasta: '2026-07-31', estado: 'vigente' },
    contradicciones: [{
      blocking: true,
      code: 'equipo_sin_coincidencia_exacta',
      detail: 'Modelo sin coincidencia exacta.',
      estado: 'abierta',
    }],
  };

  vm.runInContext(`moPreview=${JSON.stringify(blockingPreview)}; moRenderPreview(moPreview);`, context);

  assert.equal(elements.get('moAprobar').disabled, true);
  assert.match(elements.get('moResultado').innerHTML, /equipo_sin_coincidencia_exacta/);
  assert.match(elements.get('moResultado').innerHTML, /Modelo sin coincidencia exacta\./);
  assert.match(elements.get('moResultado').innerHTML, /Bloqueante/);
  assert.match(elements.get('moResultado').innerHTML, /abierta/);

  const reusablePreview = {
    ok: true,
    reutilizada: true,
    version: { id: 'version-reutilizada', numero: 17, estado: 'pendiente_revision' },
    resumen: { ofertas: 2, equipos: 4, contradicciones_abiertas: 0, contradicciones_bloqueantes: 0 },
    vigencia: { desde: '2026-07-01', hasta: '2026-07-31', estado: 'vigente' },
    contradicciones: [],
  };

  vm.runInContext(`moPreview=${JSON.stringify(reusablePreview)}; moRenderPreview(moPreview);`, context);

  assert.equal(elements.get('moAprobar').disabled, false);
  assert.match(elements.get('moResultado').innerHTML, /Version reutilizada/);

  const alreadyCurrent = {
    ...reusablePreview,
    version: { id: 'version-vigente', numero: 16, estado: 'vigente' },
  };
  await vm.runInContext(`moPreview=${JSON.stringify(alreadyCurrent)}; moRenderPreview(moPreview); moAprobarYActivar();`, context);

  assert.equal(elements.get('moAprobar').disabled, true);
  assert.match(elements.get('moResultado').innerHTML, /estado vigente/);
  assert.equal(calls.api.includes('/api/motor-ofertas/aprobar'), false);
});

test('recarga la version vigente antes y despues de aprobar', async () => {
  const html = await readApp();

  assert.match(html, /function moLoadVigente\(\)/);
  assert.match(html, /api\(['"]\/api\/motor-ofertas\/version-vigente['"]\)/);
  assert.match(html, /api\(['"]\/api\/motor-ofertas\/aprobar['"],\s*\{\s*method:\s*['"]POST['"]/);
  assert.match(html, /version_id\s*:/);
  assert.match(html, /activar\s*:\s*true/);
  assert.match(html, /version_vigente_esperada_id\s*:/);
  assert.ok((html.match(/moLoadVigente\(\)/g) || []).length >= 3);
});

test('no aprueba si no puede leer la version vigente actual', async () => {
  const html = await readApp();

  assert.match(html, /moVigenteLeida\s*=\s*false/);
  assert.match(html, /if\(!moVigenteLeida\)\s*\{[^}]*No se pudo confirmar la version vigente actual/s);
});
