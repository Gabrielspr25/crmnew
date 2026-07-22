import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('las lineas del perfil separan telefono, servicio y detalle comercial', () => {
  assert.match(appSource, /\.subscriber-phone\{/);
  assert.match(appSource, /\.subscriber-service\{/);
  assert.match(appSource, /\.subscriber-meta\{/);
  assert.match(appSource, /class="subscriber-phone">\$\{esc\(s\.phone\|\|'—'\)\}<\/span>/);
  assert.match(appSource, /class="subscriber-service">/);
  assert.match(appSource, /class="subscriber-meta">/);
});

test('el BAN queda secundario y los detalles de la linea son legibles', () => {
  assert.match(appSource, /\.chead>b\{color:var\(--txt2\);font-size:13px;font-weight:600;letter-spacing:\.01em;\}/);
  assert.match(appSource, /\.subscriber-plan\{color:var\(--txt2\);font-size:14px;font-weight:650;\}/);
  assert.match(appSource, /\.subscriber-meta\{color:var\(--txt3\);font-size:12px;margin-top:5px;/);
});
