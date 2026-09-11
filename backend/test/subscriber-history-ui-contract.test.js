import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('modal editar suscriptor tiene tabs de datos e historial', () => {
  assert.match(appHtml, /cliSubEditState/);
  assert.match(appHtml, /Datos del suscriptor/);
  assert.match(appHtml, /Historial \(\$\{cliSubHistoryCountLabel\(\)\}\)/);
  assert.match(appHtml, /api\('\/api\/subscribers-real\/'\+cliSubEditState\.id\+'\/history/);
});

test('historial de suscriptor tiene filtros paginacion comentarios y estados', () => {
  assert.match(appHtml, /Todos los eventos/);
  assert.match(appHtml, /Manual/);
  assert.match(appHtml, /Importador/);
  assert.match(appHtml, /Sistema/);
  assert.match(appHtml, /Cargar anteriores/);
  assert.match(appHtml, /Agregar comentario|Editar comentario/);
  assert.match(appHtml, /Todavía no hay cambios registrados para este suscriptor/);
  assert.match(appHtml, /PATCH',body:\{comment/);
});

test('historial permite crear una nota manual independiente', () => {
  assert.match(appHtml, /id="subhist_manual_note"/);
  assert.match(appHtml, /id="subhist_manual_date"/);
  assert.match(appHtml, /Agregar nota/);
  assert.match(appHtml, /\/api\/subscribers-real\/'\+cliSubEditState\.id\+'\/history\/manual-note/);
});

test('guardar datos del suscriptor cierra la modal luego de refrescar', () => {
  assert.match(appHtml, /renderCli\(\);\s*closeSubscriberForm\(\);/);
});

test('fila de suscriptor muestra ultima nota y abre historial de ese numero', () => {
  assert.match(appHtml, /function cliOpenSubNotes\(id\)/);
  assert.match(appHtml, /last_history_comment_at/);
  assert.match(appHtml, /Ver todas las notas/);
  assert.match(appHtml, /onclick="cliOpenSubNotes\('\$\{s\.id\}'\)"/);
});
