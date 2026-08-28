import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifyReply, extractCrmCode, folderForClassification } from '../src/services/correosCampaigns.js';

const migrationPath = new URL('../migrations/2026-08-02-correos-agente.sql', import.meta.url);
const optionalEndMigrationPath = new URL('../migrations/2026-08-03-correos-fin-campana-opcional.sql', import.meta.url);
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
  assert.match(route, /\(campaign_code,name,subject,body_html,subject_template,html_template,scheduled_at,starts_at/);
  assert.doesNotMatch(route, /VALUES \(\$1,\$2,\$3,\$4,\$3,\$4,\$5,\$5/,
    'las columnas heredadas y las nuevas no deben reutilizar parámetros SQL de tipos distintos');
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

test('Campanas muestra seguimiento operativo y permite pausar sin abandonar Correos', () => {
  const html = readFileSync(appPath, 'utf8');
  const route = readFileSync(routePath, 'utf8');
  assert.match(html, /Actualizar ahora/);
  assert.match(html, /Pendientes/);
  assert.match(html, /Enviando ahora/);
  assert.match(html, /Pausar campa/);
  assert.match(html, /coStartCampaignRefresh/);
  assert.match(route, /correosRouter\.post\('\/correos\/campaigns\/:id\/pause'/);
  assert.match(route, /COUNT\(r\.id\) FILTER \(WHERE r\.status='pending'\)/);
  assert.match(route, /COUNT\(r\.id\) FILTER \(WHERE r\.status='claimed'\)/);
});

test('Correo 1 a 1 carga un borrador real al seleccionar el cliente y no codifica espacios como mas', () => {
  const html = readFileSync(appPath, 'utf8');
  const route = readFileSync(routePath, 'utf8');

  assert.match(html, /async function coLoadClientDraft\(/);
  assert.match(html, /await coLoadClientDraft\(email\)/);
  assert.match(html, /encodeURIComponent\(body\)/);
  assert.match(route, /active_subscribers/);
  assert.match(route, /monthly_value/);
});

test('El borrador enriquecido ofrece una barra visual para editar párrafos y formato', () => {
  const html = readFileSync(appPath, 'utf8');

  assert.match(html, /coEditorCommand/);
  assert.match(html, /formatBlock/);
  assert.match(html, /insertUnorderedList/);
  assert.match(html, /createLink/);
});

test('Correo 1 a 1 muestra un borrador base y permite guardar el formato sin abrir Outlook', () => {
  const html = readFileSync(appPath, 'utf8');
  const route = readFileSync(routePath, 'utf8');

  assert.match(html, /Guardar borrador/);
  assert.match(html, /coSaveDraftFormat/);
  assert.match(route, /su asesor de Claro Empresas/);
  assert.match(route, /WhatsApp/);
});

test('El borrador individual no muestra Plan actual y puede ampliarse para editarlo', () => {
  const html = readFileSync(appPath, 'utf8');
  const route = readFileSync(routePath, 'utf8');

  assert.match(html, /Ampliar editor/);
  assert.match(html, /coToggleEditorSize/);
  assert.doesNotMatch(route, /Plan\(es\) actual\(es\)/);
});

test('El formato guardado se puede reutilizar como plantilla base para el próximo cliente', () => {
  const html = readFileSync(appPath, 'utf8');

  assert.match(html, /Guardar formato para próximos clientes/);
  assert.match(html, /coSaveBaseTemplate/);
  assert.match(html, /vp_correos_individual_template/);
  assert.match(html, /coApplyBaseTemplate/);
});

test('Campañas programa por inicio y ritmo, sin fecha de fin ni lista de clientes 1 a 1', () => {
  const html = readFileSync(appPath, 'utf8');
  assert.match(html, /Nombre de campaña/);
  assert.match(html, /Inicio de campaña/);
  assert.doesNotMatch(html, /Fin de campaña/);
  assert.match(html, /Correos por lote/);
  assert.match(html, /Intervalo \(minutos\)/);
  assert.match(html, /Seleccionar destinatarios/);
  assert.match(html, /coShowCampaignRecipients/);
  const campaignDraft = html.match(/const CO_CAMPAIGN_DRAFT=`([\s\S]*?)`;/)?.[1] || '';
  assert.match(campaignDraft, /En Claro Empresas queremos apoyarle con alternativas de conectividad/);
  assert.match(campaignDraft, /Corporate and retail account Director/);
  assert.match(campaignDraft, /Tel Of: 787-796-2099&nbsp;&nbsp;Cel: 787-319-0909/);
  assert.match(campaignDraft, /CLARO&nbsp;&nbsp;Agente de ventas SS/);
  assert.match(campaignDraft, /gabriel\.sanchez@claropr\.com/);
  assert.match(html, /coSelectCampaignSegment/);
  assert.match(html, /Activos \('\+active\+/);
  assert.match(html, /Cancelados \('\+cancelled\+/);
  assert.match(html, /if\(coMode==='one'\)\{await coEnsureClientes\(\);coRenderCtrl\(\);coRenderList\(\);\}else\{coRenderCampaignComposer\(\);var body=/);
  assert.match(html, /id="coClientPicker" \$\{coMode==='campaign'\?'style="display:none"':''\}/);
  assert.match(html, /coMode==='one'\?`<div id="coCount"[\s\S]*?coSaveDraftFormat\(\)/);
  assert.match(html, /coSaveCampaign/);
  assert.match(html, /coRenderCampaigns/);
});

test('Una campaña puede no tener fecha de fin y se completa al terminar destinatarios', () => {
  const route = readFileSync(routePath, 'utf8');
  const migration = readFileSync(optionalEndMigrationPath, 'utf8');
  const html = readFileSync(appPath, 'utf8');

  assert.match(migration, /ALTER COLUMN ends_at DROP NOT NULL/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS campaign_code/i);
  assert.match(route, /ends_at IS NULL OR now\(\) <= c\.ends_at/);
  assert.match(route, /status='completed'/);
  assert.match(html, /Finaliza automáticamente cuando no queden clientes pendientes/);
});

test('el agente Outlook procesa solamente mensajes con código CRM', () => {
  const agent = readFileSync(agentPath, 'utf8');
  assert.match(agent, /Get-OutlookApplication/);
  assert.match(agent, /Email de campaña/);
  assert.match(agent, /CRM-\(\?:CAMP\|CLI\)/);
  assert.match(agent, /outlook_entry_id/);
  assert.doesNotMatch(agent, /SMTP_PASS|JWT_SECRET|password/i);
});

test('el agente obtiene su token desde la credencial local del usuario', () => {
  const agent = readFileSync(agentPath, 'utf8');
  assert.match(agent, /GetEnvironmentVariable\('CORREOS_AGENT_TOKEN','User'\)/);
  assert.match(agent, /La configuración local requiere CrmUrl, AgentToken y Mailbox/);
});
test('el agente local abre Outlook si estaba cerrado y espera de forma limitada', () => {
  const agent = readFileSync(agentPath, 'utf8');
  assert.match(agent, /TimeoutSec = 30/);
  assert.match(agent, /\[int\]\$Limit = 100/);
  assert.match(agent, /agent\/queue\?limit=\$Limit/);
  assert.doesNotMatch(agent, /New-Object -ComObject Outlook\.Application/);
  assert.match(agent, /Start-Process/);
  assert.match(agent, /GetActiveObject\('Outlook\.Application'\)/);
  assert.match(agent, /AddSeconds\(60\)/);
  assert.match(agent, /Start-Sleep -Seconds 2/);
  assert.match(agent, /CorreosAgent-errors\.log/);
  assert.match(agent, /function Get-CrmSubject/);
  assert.match(agent, /\$crmSubject = Get-CrmSubject \$item\.subject_template \$item\.campaign_code/);
  assert.match(agent, /\$mail\.Subject = \$crmSubject/);
  assert.match(agent, /subject=\$crmSubject/);
  assert.match(agent, /event_type='failed'/);
  assert.match(agent, /continue/);
  assert.match(agent, /Get-OutlookAccount \$namespace \$cfg\.Mailbox/);
  assert.match(agent, /\$mail\.SendUsingAccount = \$mailAccount/);
  assert.match(agent, /function New-MailItemForAccount/);
  assert.match(agent, /\$Account\.DeliveryStore\.GetDefaultFolder\(16\)/);
  assert.match(agent, /Items\.Add\('IPM\.Note'\)/);
  assert.match(agent, /\$mailAccount\.DeliveryStore\.GetDefaultFolder\(6\)/);
  assert.doesNotMatch(agent, /\$namespace\.GetDefaultFolder\(6\)/);
  assert.match(agent, /GetDefaultFolder\(6\)/);
  assert.doesNotMatch(agent, /Folders\.Item\('Inbox'\)/);
  assert.match(agent, /Folders\.Add\(\$Name\)/);
  assert.match(agent, /Email de campana/);
  assert.doesNotMatch(agent, /Outlook debe estar abierto antes de ejecutar el agente/);
  assert.doesNotMatch(agent, /Accounts\.Add|Profiles\.|Rules/);
});
