import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Administracion de Ofertas es la unica entrada lateral y expone Operacion y Control', () => {
  assert.match(html, /href="#\/ofertas"[^>]*>.*Administraci[oó]n de Ofertas/);
  assert.doesNotMatch(html, /href="#\/tareas-reglas-admin"/);
  assert.match(html, /function ofRenderAdminNavigation\(\)/);
  assert.match(html, />Operaci[oó]n</);
  assert.match(html, />Control de reglas</);
});

test('la ruta historica de Tareas y reglas redirige al control sin alterar rutas de modulos', () => {
  assert.match(html, /route==='tareas-reglas-admin'\)\{\s*location\.hash='#\/ofertas\/control';\s*return;\s*\}/);
  assert.match(html, /route==='ofertas'\)\{[^}]*arg==='control'/);
  assert.match(html, /OF_TABS\.some\(tab=>tab\[0\]===arg\)/);
});
