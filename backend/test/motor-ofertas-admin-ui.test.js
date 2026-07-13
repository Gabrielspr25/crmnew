import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appPath = new URL('../../frontend/app.html', import.meta.url);

async function readApp() {
  return readFile(appPath, 'utf8');
}

test('integra el motor móvil dentro de la pestaña ofertas existente', async () => {
  const html = await readApp();

  assert.match(html, /async function ofRenderOfertasTienda\(\)/);
  assert.match(html, /id=["']moTablaFinanciamiento["'][^>]*accept=["']\.xlsx["']/);
  assert.match(html, /id=["']moListaPrecios["'][^>]*accept=["']\.xlsx["']/);
  assert.match(html, /id=["']moPreviewBtn["']/);
  assert.match(html, /id=["']moAprobar["'][^>]*disabled/);
  assert.doesNotMatch(html, /#\/motor-ofertas|function viewMotorOfertas|function moSetTab/);
});

test('envía ambos Exceles en FormData y no hace preview incompleto', async () => {
  const html = await readApp();

  assert.match(html, /new FormData\(\)/);
  assert.match(html, /fd\.append\(['"]tabla_financiamiento['"],\s*tabla\.files\[0\]\)/);
  assert.match(html, /fd\.append\(['"]lista_precios['"],\s*lista\.files\[0\]\)/);
  assert.match(html, /apiForm\(['"]\/api\/motor-ofertas\/preview['"],\s*fd\)/);
  assert.match(html, /archivos_faltantes|faltantes/);
  assert.match(html, /Tabla de financiamiento/);
  assert.match(html, /Lista de precios/);
});

test('muestra el resultado del preview y bloquea la activación no aprobable', async () => {
  const html = await readApp();

  assert.match(html, /function moRenderPreview\(r\)/);
  assert.match(html, /r\.resumen/);
  assert.match(html, /r\.vigencia/);
  assert.match(html, /r\.contradicciones/);
  assert.match(html, /contradicciones_bloqueantes/);
  assert.match(html, /vigencia\.estado\s*===\s*['"]vigente['"]/);
  assert.match(html, /moAprobar[^\n]*disabled|\.disabled\s*=/);
  assert.match(html, /esc\(/);
});

test('recarga la versión vigente antes y después de aprobar', async () => {
  const html = await readApp();

  assert.match(html, /function moLoadVigente\(\)/);
  assert.match(html, /api\(['"]\/api\/motor-ofertas\/version-vigente['"]\)/);
  assert.match(html, /api\(['"]\/api\/motor-ofertas\/aprobar['"],\s*\{\s*method:\s*['"]POST['"]/);
  assert.match(html, /version_id\s*:/);
  assert.match(html, /activar\s*:\s*true/);
  assert.match(html, /version_vigente_esperada_id\s*:/);
  assert.ok((html.match(/moLoadVigente\(\)/g) || []).length >= 3);
});

test('no aprueba si no puede leer la versión vigente actual', async () => {
  const html = await readApp();

  assert.match(html, /moVigenteLeida\s*=\s*false/);
  assert.match(html, /if\(!moVigenteLeida\)\s*\{[^}]*No se pudo confirmar la version vigente actual/s);
});
