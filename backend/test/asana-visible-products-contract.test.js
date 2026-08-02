import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana muestra productos en columnas separadas por cliente', () => {
  assert.match(appHtml, /<th>Cliente<\/th><th>Vendedor<\/th>\$\{ASANA_PRODS\.map\(p=>`<th class="c" style="color:var\(--\$\{p\[3\]\}\)">\$\{p\[1\]\}<\/th>`\)\.join\(''\)\}/);
  assert.match(appHtml, /\$\{ASANA_PRODS\.map\(p=>cell\(o,p\[0\],p\[2\]\)\)\.join\(''\)\}/);
  assert.doesNotMatch(appHtml, /Oportunidades actuales/);
  assert.doesNotMatch(appHtml, /const visibleProducts=asanaVisibleProducts\(o\)/);
});

test('Asana usa el estilo compacto oscuro sin inputs deshabilitados en productos', () => {
  assert.match(appHtml, /\.acell\{display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;background:transparent;border:0;border-radius:0;padding:2px 0;min-height:26px;/);
  assert.match(appHtml, /\.asana-value\{color:#54FFA5;font-size:12px;font-weight:400;/);
  assert.match(appHtml, /\.asana-table th\{padding:9px 6px;font-size:11\.5px;font-weight:400;/);
  assert.match(appHtml, /\.asana-table\{min-width:920px;table-layout:auto;/);
  assert.match(appHtml, /nth-child\(n\+3\):nth-child\(-n\+9\)\{min-width:46px;width:4\.8%;\}/);
  assert.doesNotMatch(appHtml, /\.acell\{[^}]*background:linear-gradient/);
  assert.match(appHtml, /<div class="asana-value \$\{p\?'':'empty'\}">\$\{display\}<\/div>/);
  assert.match(appHtml, /<div class="asana-client-cell" title="\$\{esc\(clientLineTitle\)\}">/);
  assert.match(appHtml, /<span class="asana-vendor">/);
  assert.match(appHtml, /\.asubs\{font-size:12px;color:#b9a06d;/);
  assert.match(appHtml, /\.asana-client-line \.linkbtn\{font-size:12px!important;font-weight:400!important;/);
  assert.match(appHtml, /\.asana-client-line\{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;/);
  assert.match(appHtml, /\.asana-client-line \.linkbtn\{[^}]*overflow:hidden;text-overflow:ellipsis;/);
  assert.match(appHtml, /\.asana-ban-inline\{font-size:12px;color:#f6c86f;min-width:0;overflow:hidden;text-overflow:ellipsis;/);
  assert.match(appHtml, /\.asana-meta-inline\{font-size:12px;color:#b9a06d;white-space:nowrap;/);
  assert.match(appHtml, /title="\$\{esc\(clientLineTitle\)\}"/);
  assert.match(appHtml, /<span class="asana-ban-inline">\$\{esc\(banText\)\}<\/span><span class="asana-meta-inline">\$\{o\.ban_count\|\|0\} BAN/);
  assert.doesNotMatch(appHtml, /<div class="asana-ban">/);
  assert.doesNotMatch(appHtml, /<div class="asana-client-meta">/);
  assert.match(appHtml, /\.asana-vendor\{[^}]*font-size:12px;font-weight:400;/);
  assert.match(appHtml, /\.asana-money\{display:block;color:#2ff0b8;font-weight:400;font-size:12px;\}/);
  assert.match(appHtml, /\.asana-notes-btn,\.asana-actions \.btn\{font-size:12px!important;/);
  assert.match(appHtml, /rowProductTotal\(o\)/);
  assert.match(appHtml, /productUnits=\(o,pk,type\)=>/);
  assert.doesNotMatch(appHtml, /<input class="cinp" style="width:84px;text-align:right" value="\$\{val\}" disabled>/);
  assert.doesNotMatch(appHtml, /<button class="astep"[^>]*>\$\{esc\(step\)\}<\/button>/);
});

test('Asana no muestra columnas reiterativas en la tabla', () => {
  assert.doesNotMatch(appHtml, /<th class="r">Total Líneas<\/th>/);
  assert.doesNotMatch(appHtml, /<td class="r"><span class="asana-total">\$\{rowProductTotal\(o\)\}<\/span><\/td>/);
  assert.doesNotMatch(appHtml, /💬 Abrir/);
  assert.doesNotMatch(appHtml, /<th class="r">Total \$<\/th><th>Notas<\/th><th>Acciones<\/th>/);
  assert.match(appHtml, /<th class="r">Total \$<\/th><th class="c">Agenda<\/th><th>Acciones<\/th>/);
  assert.match(appHtml, /colspan="12"/);
});

test('Asana deja solo Abrir Asana en la ultima columna de acciones', () => {
  assert.match(appHtml, /<div class="asana-actions"><button class="btn ghost" onclick="location\.hash='#\/opp\/\$\{o\.id\}'">Abrir Asana<\/button><\/div>/);
  assert.doesNotMatch(appHtml, /<button class="btn ghost" onclick="abrirCliente\('\$\{o\.client_id\|\|''\}'\)">Cliente<\/button>/);
  assert.doesNotMatch(appHtml, /<button class="btn" style="background:rgba\(248,113,113,\.16\);color:#ff7f93" onclick="cerrarOpp\('\$\{o\.id\}'\)">Eliminar seg\.<\/button>/);
});
