import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Modo oscuro usa la paleta aprobada en todo el CRM principal', () => {
  assert.match(html, /body\[data-theme="dark"\]\{[^}]*--bg:#070B18/);
  assert.match(html, /body\[data-theme="dark"\]\{[^}]*--card:#101426/);
  assert.match(html, /body\[data-theme="dark"\]\{[^}]*--line:#242A3D/);
  assert.match(html, /body\[data-theme="dark"\]\{[^}]*--txt:#F4F7FB/);
  assert.match(html, /--bg:#070B18/);
  assert.match(html, /--card:#101426/);
  assert.match(html, /--line:#242A3D/);
  assert.match(html, /--primary:#6D1FAD/);
  assert.match(html, /--violet:#AD1FA6/);
  assert.match(html, /--red:#AD261F/);
  assert.match(html, /--amber:#A6AD1F/);
  assert.match(html, /--green:#3F8F1E/);
  assert.doesNotMatch(html, /body\[data-theme="dark"\]\[data-page="clientes"\]/);
  assert.doesNotMatch(html, /--txt:#ffd07a/);
  assert.doesNotMatch(html, /--primary:#4b82ff/);
  assert.match(html, /document\.body\.setAttribute\('data-page',route==='cliente'\?'clientes':route\)/);
});

test('Clientes suaviza solo el numero principal de la tarjeta Todos', () => {
  assert.match(html, /cli-kpi-\$\{t\}/);
  assert.match(html, /body\[data-page="clientes"\] \.cli-kpi-all \.v\{font-size:22px;font-weight:600;line-height:1\.1;letter-spacing:0;\}/);
  assert.match(html, /body\[data-page="clientes"\] \.cli-kpi-all \.bk b\{font-weight:600;\}/);
});

test('Modo dia usa una paleta clara profesional alineada a la marca', () => {
  assert.match(html, /body\[data-theme="day"\]\{[^}]*--bg:#F4F6FA/);
  assert.match(html, /body\[data-theme="day"\]\{[^}]*--txt:#172033/);
  assert.match(html, /body\[data-theme="day"\]\{[^}]*--primary:#6D1FAD/);
  assert.match(html, /body\[data-theme="day"\] \.side\{background:#FFFFFF;color:#4D5A70;border-right:1px solid var\(--line\);\}/);
  assert.match(html, /body\[data-theme="day"\] \.side \.brand\{color:#172033;\}/);
  assert.match(html, /body\[data-theme="day"\] \.nav\.on\{background:var\(--primary\);color:#FFFFFF;\}/);
});

test('Modo visual es global del sistema y no por modulo', () => {
  assert.match(html, /const THEME_KEY='vp_theme'/);
  assert.match(html, /function applyTheme\(theme\)/);
  assert.match(html, /function initTheme\(\)/);
  assert.match(html, /localStorage\.setItem\(THEME_KEY,next\)/);
  assert.match(html, /initTheme\(\);/);
  assert.doesNotMatch(html, /current==='soft-dark'\?'day':current==='day'\?'dark':'soft-dark'/);
  assert.doesNotMatch(html, /Noche suave/);
});

test('Noche suave reduce contraste sin crear paletas aisladas por modulo', () => {
  assert.match(html, /body\[data-theme="soft-dark"\]\{[^}]*--bg:#202A3E/);
  assert.match(html, /body\[data-theme="soft-dark"\]\{[^}]*--txt:#D3D9E3/);
  assert.match(html, /body\[data-theme="soft-dark"\]\{[^}]*font-weight:300/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.side\{background:#263149/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.side \.nav:nth-of-type\(5n\+1\)/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.side \.nav\.on\{background:#6D1FAD/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.subhist-filter\.on[^}]*color:#E7D6F0/);
  assert.doesNotMatch(html, /body\[data-theme="soft-dark"\] \.sc-scope/);
  assert.doesNotMatch(html, /body\[data-theme="dark"\] \.sc-scope/);
  assert.doesNotMatch(html, /body\[data-theme="soft-dark"\] \.sc-clients/);
  assert.doesNotMatch(html, /body\[data-theme="dark"\] \.sc-clients/);
});

test('BANs y Suscriptores tiene una superficie nocturna propia y legible', () => {
  assert.match(html, /body\[data-theme="soft-dark"\] \.subscriber-row\{background:linear-gradient\(180deg,#1C263A,#151E31\);border-color:#3E4C68;/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.subscriber-cell\{background:#111827;border-color:#2C3955;/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.subscriber-workflow\{background:#19243A;border-color:#2C3955;/);
  assert.match(html, /body\[data-theme="soft-dark"\] \.subscriber-phone,body\[data-theme="soft-dark"\] \.subscriber-plan\{color:#F1F3F7;/);
});
