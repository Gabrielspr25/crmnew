import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifyReply, extractCrmCode, folderForClassification } from '../src/services/correosCampaigns.js';

const migrationPath = new URL('../migrations/2026-08-02-correos-agente.sql', import.meta.url);
const routePath = new URL('../src/routes/correosRoutes.js', import.meta.url);
const appPath = new URL('../../frontend/app.html', import.meta.url);
const agentPath = new URL('../../agent-outlook/CorreosAgent.ps1', import.meta.url);

test('la migración crea la persistencia de campañas y eventos de Outlook', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_campaigns/i);
  assert.match(migration, /campaign_code TEXT NOT NULL UNIQUE/i);
  assert.match(migration, /CHECK \(batch_size BETWEEN 1 AND 100\)/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_events/i);
  assert.match(migration, /outlook_entry_id text UNIQUE/i);
});

test('solo identifica respuestas con un código CRM y las clasifica de forma segura', () => {
  assert.equal(extractCrmCode('RE: Revisión de cuenta [CRM-CAMP-024]'), 'CRM-CAMP-024');
  assert.equal(extractCrmCode('Consulta general'), null);
  assert.equal(classifyReply('No deseo recibir más mensajes.'), 'no_contactar');
  assert.equal(classifyReply('Podemos reunirnos el jueves.'), 'meeting');
  assert.equal(classifyReply('Me interesa revisar la propuesta.'), 'interested');
  assert.equal(classifyReply('Gracias por la información.'), 'pending_review');
  assert.equal(folderForClassification('meeting'), 'Reunión / llamada agendada');
});

test('la API reserva una cola limitada y recibe eventos idempotentes del agente local', () => {
  const route = readFileSync(routePath, 'utf8');

  assert.match(route, /correosRouter\.post\('\/correos\/campaigns'/);
  assert.match(route, /correosRouter\.get\('\/correos\/agent\/queue'/);
  assert.match(route, /correosRouter\.post\('\/correos\/agent\/events'/);
  assert.match(route, /correosRouter\.get\('\/correos\/agent\/tracking\/:code'/);
  assert.match(route, /CORREOS_AGENT_TOKEN/);
  assert.match(route, /FOR UPDATE SKIP LOCKED/);
  assert.match(route, /ON CONFLICT \(outlook_entry_id\) DO NOTHING/);
});

test('Correos ofrece edición enriquecida para el flujo 1 a 1 y para campañas', () => {
  const html = readFileSync(appPath, 'utf8');
  assert.match(html, /Correo 1 a 1/);
  assert.match(html, /Campañas/);
  assert.match(html, /contenteditable="true"/);
  assert.match(html, /coCreateDraft/);
  assert.match(readFileSync(routePath, 'utf8'), /\/correos\/clients\/:id\/drafts/);
});

test('Campañas permite configurar contenido, fechas y ritmo de envío antes de programar', () => {
  const html = readFileSync(appPath, 'utf8');
  assert.match(html, /Nombre de campaña/);
  assert.match(html, /Inicio de campaña/);
  assert.match(html, /Fin de campaña/);
  assert.match(html, /Correos por lote/);
  assert.match(html, /Intervalo \(minutos\)/);
  assert.match(html, /coSaveCampaign/);
  assert.match(html, /coRenderCampaigns/);
});

test('el agente Outlook procesa solamente mensajes con código CRM', () => {
  const agent = readFileSync(agentPath, 'utf8');
  assert.match(agent, /Get-OutlookApplication/);
  assert.match(agent, /Email de campaña/);
  assert.match(agent, /CRM-\(\?:CAMP\|CLI\)/);
  assert.match(agent, /outlook_entry_id/);
  assert.doesNotMatch(agent, /SMTP_PASS|JWT_SECRET|password/i);
});
