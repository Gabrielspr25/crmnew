import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const clientsReal = readFileSync(new URL('../src/routes/clientsReal.js', import.meta.url), 'utf8');
const writeRoutes = readFileSync(new URL('../src/routes/writeRoutes.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('detalle de cliente expone el ultimo cambio por suscriptor sin contar notas manuales', () => {
  assert.match(clientsReal, /subscriber_history sh_update/);
  assert.match(clientsReal, /sh_update\.created_at AS last_update_at/);
  assert.match(clientsReal, /sh_update\.source AS last_update_source/);
  assert.match(clientsReal, /sh_update\.metadata->>'origin' AS last_update_origin/);
  assert.match(clientsReal, /COALESCE\(sh_update\.metadata->>'type',''\) <> 'manual_note'/);
});

test('alta desde imagen se marca con origin imagen sin cambiar el source permitido', () => {
  assert.match(writeRoutes, /b\.origin === 'imagen' \? \{ origin: 'imagen' \} : \{\}/);
  assert.match(app, /expected_ban_number:expectedBan,origin:'imagen'/);
});

test('fila de suscriptor muestra boton Actualizado que abre el historial', () => {
  assert.match(app, /function cliSubLastUpdateButton\(s\)/);
  assert.match(app, /onclick="cliOpenSubHistory\('\$\{s\.id\}'\)"/);
  assert.match(app, /<b>Actualizado<\/b>/);
  assert.match(app, /\$\{cliSubLastUpdateButton\(s\)\}\$\{lastNote\}/);
});

test('historial y boton distinguen Manual, Importador, Imagen y Sistema', () => {
  assert.match(app, /function cliSubHistSourceKey\(source,origin\)\{ return origin==='imagen'\?'imagen'/);
  assert.match(app, /s==='imagen'\?'Imagen'/);
  assert.match(app, /\.subhist-source\.imagen\{/);
  assert.match(app, /cliSubHistSourceKey\(x\.source,x\.metadata&&x\.metadata\.origin\)/);
});
