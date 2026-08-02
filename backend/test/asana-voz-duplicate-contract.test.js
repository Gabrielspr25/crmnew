import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Cliente Voz no crea cliente nuevo si ya existe en CRM', () => {
  assert.match(asanaSource, /SELECT c\.id, c\.name, c\.business_name/);
  assert.match(asanaSource, /LOWER\(TRIM\(COALESCE\(c\.name,''\)\)\) = LOWER\(TRIM\(\$1\)\)/);
  assert.match(asanaSource, /return res\.status\(409\)\.json/);
  assert.match(asanaSource, /Cliente ya existe/);
  assert.match(appHtml, /if\(r&&r\.error\)/);
  assert.match(appHtml, /r\.client_id/);
  assert.match(appHtml, /abrirCliente\(r\.client_id\)/);
});

test('Cliente Voz exige BAN y suscriptor antes de crear oportunidad', () => {
  assert.match(appHtml, /id="vz_ban"/);
  assert.match(appHtml, /id="vz_sub"/);
  assert.match(appHtml, /ban_number:\$\(\'vz_ban\'\)\.value\.trim\(\)/);
  assert.match(appHtml, /subscriber:\$\(\'vz_sub\'\)\.value\.trim\(\)/);
  assert.match(appHtml, /Falta el BAN/);
  assert.match(appHtml, /Falta el suscriptor/);
  assert.match(asanaSource, /const \{ empresa, telefono, ban_number, subscriber, product_key, qty, monto, nota \} = req\.body \|\| \{\};/);
  assert.match(asanaSource, /El BAN debe tener 9 digitos/);
  assert.match(asanaSource, /El suscriptor debe tener 10 digitos/);
  assert.match(asanaSource, /INSERT INTO bans \(client_id, ban_number, status, source\)/);
  assert.match(asanaSource, /INSERT INTO subscribers \(ban_id, phone, phone_norm, status, line_kind, line_type\)/);
  assert.match(asanaSource, /manual_con_ban_suscriptor/);
  assert.doesNotMatch(asanaSource, /nueva_sin_numero/);
});
