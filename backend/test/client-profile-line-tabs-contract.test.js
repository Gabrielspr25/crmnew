import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), '..', 'frontend', 'app.html');

test('el perfil del cliente ofrece filtros de lineas por movil, fijo y convergente', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /function cliLineKind\(subscriber, banTypes=\{\}\)/);
  assert.match(html, /function cliServiceProfile\(subscribers,bans=\[\]\)/);
  assert.match(html, /\['movil','Movil',profile\.movil\.length\]/);
  assert.match(html, /\['fijo','Fijo',profile\.fijo\.length\]/);
  assert.match(html, /\['convergente','Convergente',profile\.convergente/);
  assert.match(html, /data-client-line-tab="\$\{value\}"/);
  assert.match(html, /Movil/);
  assert.match(html, /Convergente/);
});

test('el perfil calcula convergente solo cuando existen lineas moviles y fijas', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /movil\.length\s*&&\s*fijo\.length/);
  assert.match(html, /subscriber\.line_kind/);
  assert.match(html, /function cliLineMonthly\(value\)/);
});

test('el perfil usa el tipo existente del BAN cuando line_kind no viene en el suscriptor', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /function cliLineKind\(subscriber, banTypes=\{\}\)/);
  assert.match(html, /banTypes\[subscriber&&subscriber\.ban_number\]/);
  assert.match(html, /function cliServiceProfile\(subscribers,bans=\[\]\)/);
  assert.match(html, /const serviceProfile=cliServiceProfile\(c\.subscribers\|\|\[\],c\.bans\|\|\[\]\)/);
});

test('Clientes permite filtrar el listado por movil, fijo y convergente sin cambiar la fuente', async () => {
  const html = await readFile(appPath, 'utf8');

  assert.match(html, /cliServiceFilter='todas'/);
  assert.match(html, /function cliClientServiceType\(client\)/);
  assert.match(html, /data-client-service-tab="\$\{value\}"/);
  assert.match(html, /\['convergente','Convergente'\]/);
  assert.match(html, /client\.all_service_types/);
});
