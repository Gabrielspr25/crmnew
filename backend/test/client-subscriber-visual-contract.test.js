import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('las lineas del perfil separan telefono, servicio y flujo de acciones', () => {
  assert.match(appSource, /\.subscriber-phone\{/);
  assert.match(appSource, /\.subscriber-service\{/);
  assert.match(appSource, /\.subscriber-workflow\{/);
  assert.match(appSource, /class="subscriber-phone">\$\{esc\(s\.phone\|\|'\u2014'\)\}<\/span>/);
  assert.match(appSource, /class="subscriber-service(?: subscriber-badges)?">/);
  assert.match(appSource, /class="subscriber-workflow">/);
});

test('el modal usa contraste limpio sin fondos blancos en las celdas', () => {
  assert.match(appSource, /\.chead>b\{color:var\(--txt2\);font-size:13px;font-weight:600;letter-spacing:\.01em;\}/);
  assert.match(appSource, /\.subscriber-label\{display:block;font-size:9px;text-transform:uppercase;letter-spacing:\.05em;color:#7dd3fc;/);
  assert.match(appSource, /\.subscriber-plan\{color:#ffe58f;font-size:14px;font-weight:800;\}/);
  assert.match(appSource, /\.subscriber-cell\{min-width:0;background:rgba\(12,17,31,\.55\);border:1px solid rgba\(75,130,255,\.20\);/);
});

test('la fila muestra fecha fin en una sola linea y no repite inicio', () => {
  assert.match(appSource, /<span class="subscriber-label">Fecha fin<\/span><span class="subscriber-expiry">\$\{s\.contract_end_date\?fmtDate\(s\.contract_end_date\):'Sin fecha'\}<\/span>/);
  assert.doesNotMatch(appSource, /<span>Inicio<br><b>\$\{s\.contract_start_date\?fmtDate\(s\.contract_start_date\):'\u2014'\}<\/b><\/span>/);
  assert.doesNotMatch(appSource, /const meta=`<div class="subscriber-meta">/);
});

test('el modal del cliente usa una sola banda horizontal por suscriptor', () => {
  assert.match(appSource, /id="cliModal" style="max-width:1540px;width:99vw"/);
  assert.match(appSource, /\.subscriber-row\{display:grid;grid-template-columns:100px 78px 112px 90px 88px 88px 60px 50px minmax\(450px,1fr\);/);
  assert.match(appSource, /<div class="subscriber-row \$\{isCanceled\?'line-canceled':'line-active'\}">/);
  assert.match(appSource, /<div class="subscriber-workflow">\$\{workflow\}<div class="subscriber-actions">/);
});

test('las acciones quedan dentro del scroll interno y no fuera del modal', () => {
  assert.match(appSource, /\.subscriber-table\{display:flex;flex-direction:column;gap:6px;overflow-x:auto;/);
  assert.match(appSource, /@media\(max-width:1500px\)\{\.subscriber-row\{grid-template-columns:96px 76px 108px 86px 84px 84px 58px 48px minmax\(438px,1fr\);min-width:1188px;/);
  assert.doesNotMatch(appSource, /\.subscriber-actions\{grid-column:-2\/-1;/);
  assert.doesNotMatch(appSource, /\.subscriber-meta\{grid-column:1\/7;/);
});
