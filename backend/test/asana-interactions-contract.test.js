import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const asanaRealSource = readFileSync(new URL('../src/routes/asanaReal.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Asana real exposes SOV2 log endpoints for calls and notes', () => {
  assert.match(asanaRealSource, /opportunity_notes/);
  assert.match(asanaRealSource, /asana-real\/:id\/log/);
  assert.match(asanaRealSource, /llamada/);
  assert.match(asanaRealSource, /nota/);
});

test('Asana real completing a step writes a step log entry', () => {
  assert.match(asanaRealSource, /INSERT INTO opportunity_notes/);
  assert.match(asanaRealSource, /logPrefix\('paso'\)/);
  assert.match(asanaRealSource, /completed_at = now\(\)/);
});

test('Asana UI opens opportunities and connects steps, calls, and notes', () => {
  assert.match(appHtml, /#\/opp\/\$\{o\.id\}/);
  assert.match(appHtml, /submitAsanaGestion\('\$\{o\.id\}'\)/);
  assert.match(appHtml, /setAsanaGestionType\('llamada'\)/);
  assert.match(appHtml, /setAsanaGestionType\('nota'\)/);
  assert.match(appHtml, /const logs=o\.log\|\|\[\]/);
  assert.match(appHtml, /activeLogs\.map/);
  assert.doesNotMatch(appHtml, /Notas: pr/);
});

test('Asana opportunity detail separates calls, notes and step logs into tabs', () => {
  assert.match(appHtml, /ASANA_LOG_TABS/);
  assert.match(appHtml, /asanaLogTab/);
  assert.match(appHtml, /Llamadas/);
  assert.match(appHtml, /Notas/);
  assert.match(appHtml, /Pasos/);
  assert.match(appHtml, /setAsanaLogTab/);
});

test('Asana supports scheduled call alerts from opportunity logs', () => {
  assert.match(asanaRealSource, /LLAMADA_AGENDADA/);
  assert.match(asanaRealSource, /scheduled_call_at/);
  assert.match(asanaRealSource, /asana-real\/alerts\/calls/);
  assert.match(appHtml, /setAsanaGestionType\('agenda'\)/);
  assert.match(appHtml, /id="asanaGestionSubmit"/);
  assert.match(appHtml, /asanaCallAt/);
  assert.match(appHtml, /loadCallAlerts/);
});

test('Asana shows due scheduled calls as a global reminder on any screen', () => {
  assert.match(appHtml, /callReminderBox/);
  assert.match(appHtml, /checkDueCallReminder/);
  assert.match(appHtml, /renderDueCallReminder/);
  assert.match(appHtml, /setInterval\(checkDueCallReminder,\s*60000\)/);
  assert.match(appHtml, /Llamada pendiente/);
});

test('Asana muestra agenda diaria y boton de llamada por fila', () => {
  assert.match(appHtml, /const callAlerts=await loadCallAlerts\(\)/);
  assert.match(appHtml, /function asanaCallState\(alert\)/);
  assert.match(appHtml, /function asanaDailyCallAgenda\(alerts\)/);
  assert.match(appHtml, /function asanaCallButton\(alert\)/);
  assert.match(appHtml, /const callByOpp=asanaCallMap\(callAlerts\)/);
  assert.match(appHtml, /const callAgenda=asanaDailyCallAgenda\(callAlerts\)/);
  assert.match(appHtml, /<th class="c">Agenda<\/th>/);
  assert.match(appHtml, /\$\{asanaCallButton\(callByOpp\.get\(o\.id\)\)\}/);
  assert.match(appHtml, /class="asana-call-agenda"/);
  assert.match(appHtml, /class="callbtn \$\{state\}"/);
  assert.match(appHtml, /Llamadas de hoy/);
  assert.match(appHtml, /Vencidas/);
});

test('Asana detail uses one clear management composer instead of repeated call buttons', () => {
  assert.match(appHtml, /Gestion rapida/);
  assert.match(appHtml, /gestion-choice/);
  assert.match(appHtml, /data-gestion="llamada"/);
  assert.match(appHtml, /data-gestion="nota"/);
  assert.match(appHtml, /data-gestion="agenda"/);
  assert.match(appHtml, /function submitAsanaGestion\(oid\)/);
  assert.match(appHtml, /function setAsanaGestionType\(type\)/);
  assert.doesNotMatch(appHtml, />\+ Llamada<\/button><button class="btn green" onclick="addAsanaLog\('\$\{o\.id\}','llamada',true\)">Agendar llamada<\/button><button class="btn ghost" onclick="addAsanaLog\('\$\{o\.id\}','nota'\)">\+ Nota<\/button>/);
});

test('Asana opportunity detail has a visible back button to Asana list', () => {
  assert.match(appHtml, /Volver a Asana/);
  assert.match(appHtml, /location\.hash='#\/asana'/);
});

test('Asana opportunity detail renders compact product step cards', () => {
  assert.match(appHtml, /flowgrid/);
  assert.match(appHtml, /flowcard/);
  assert.match(appHtml, /stepchips/);
  assert.match(appHtml, /Paso actual/);
});

test('Asana real usa los pasos configurados en product_step_templates', () => {
  assert.match(asanaRealSource, /ventaspro_nuevo\.product_step_templates/);
  assert.match(asanaRealSource, /'product_step_templates'/);
  assert.match(asanaRealSource, /ensureOpportunityWorkflowSteps/);
  assert.match(asanaRealSource, /productKeyParts/);
});
