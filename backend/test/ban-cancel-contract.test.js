import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const frontendPath = resolve(process.cwd(), '..', 'frontend', 'app.html');
const writeRoutesPath = resolve(process.cwd(), 'src', 'routes', 'writeRoutes.js');

test('Clientes permite cancelar un BAN desde su ficha sin usar el placeholder de editar', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /async function cliCancelBan\(banId,banNumber\)/);
  assert.match(html, /api\('\/api\/bans-real\/'\+banId,\{method:'PUT',body:\{status:'C'\}\}\)/);
  assert.match(html, /onclick="cliCancelBan\('\$\{b\.id\}'/);
  assert.match(html, /Cancelar BAN/);
  assert.doesNotMatch(html, /cliWIP\('Editar BAN'\)/);
});

test('el backend cancela BAN con status C sin borrar BANs ni suscriptores', async () => {
  const source = await readFile(writeRoutesPath, 'utf8');

  assert.match(source, /writeRouter\.put\('\/bans-real\/:id'/);
  assert.match(source, /status !== 'C'/);
  assert.match(source, /UPDATE bans\s+SET status = 'C', updated_at = now\(\)\s+WHERE id = \$1\s+RETURNING id, ban_number, status/s);
  assert.doesNotMatch(source, /DELETE FROM bans/);
  assert.doesNotMatch(source, /DELETE FROM subscribers[^;]*ban_id/s);
});
