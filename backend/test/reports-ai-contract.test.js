import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const route = readFileSync(new URL('../src/routes/reportsAiRoutes.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('reportes inteligentes usan endpoint de solo lectura por intencion', () => {
  assert.match(route, /reportsAiRouter\.post\('\/reports-ai\/query'/);
  assert.match(route, /requireAuth/);
  assert.match(route, /detectReportIntent/);
  assert.match(route, /blockedSqlPattern/);
  assert.match(route, /SELECT/);
  assert.doesNotMatch(route, /DELETE FROM|UPDATE public|INSERT INTO|DROP TABLE/i);
});

test('servidor monta ruta de reportes inteligentes', () => {
  assert.match(server, /import \{ reportsAiRouter \} from '\.\/routes\/reportsAiRoutes\.js'/);
  assert.match(server, /app\.use\('\/api', reportsAiRouter\)/);
});

test('frontend abre caja inteligente de reportes', () => {
  assert.match(appHtml, /function mostrarInfoReportes\(\)/);
  assert.match(appHtml, /Reporte inteligente/);
  assert.match(appHtml, /async function ejecutarReporteInteligente\(\)/);
  assert.match(appHtml, /\/api\/reports-ai\/query/);
});

test('frontend muestra acceso visible y dictado para reporte inteligente', () => {
  assert.match(appHtml, /Abrir reporte inteligente/);
  assert.doesNotMatch(appHtml, /\(cliQ\|\|cliTab==='all'\)\?\`<div class="card"[^`]*Abrir reporte inteligente/);
  assert.match(appHtml, /Dictar reporte/);
  assert.match(appHtml, /function reportAiToggleVoice\(\)/);
  assert.match(appHtml, /SpeechRecognition\|\|window\.webkitSpeechRecognition/);
});

test('modal de reporte inteligente es amplia y responsive', () => {
  assert.match(appHtml, /id="reportAiModal" style="max-width:1480px;width:98vw"/);
  assert.match(appHtml, /\.report-ai-result\{/);
  assert.match(appHtml, /\.report-ai-table\{width:100%;table-layout:fixed;/);
  assert.match(appHtml, /\.report-ai-mobile\{display:none;/);
  assert.match(appHtml, /@media\(max-width:900px\)\{[^}]*\.report-ai-table-wrap\{display:none/);
  assert.match(appHtml, /<div class="report-ai-mobile">\$\{mobileRows\}<\/div>/);
});
