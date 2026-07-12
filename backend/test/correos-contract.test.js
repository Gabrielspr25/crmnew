import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
test('Correos ofrece solo botones para app escritorio y Outlook Web', () => {
  assert.match(appHtml, /Abrir app escritorio \(BCC\)/);
  assert.match(appHtml, /Abrir Outlook Web \(Para\)/);
  assert.doesNotMatch(appHtml, /Enviar oculto por SMTP/);
  assert.doesNotMatch(appHtml, /onclick="coSMTP\(\)"/);
  assert.doesNotMatch(appHtml, /function coSMTP\(\)/);
  assert.doesNotMatch(appHtml, /CO_FIRMA_HTML/);
  assert.doesNotMatch(appHtml, /enviá por servidor/);
  assert.match(appHtml, /function coOutlookWeb\(\)/);
});

test('Outlook Web usa deeplink compose con Para, asunto y cuerpo', () => {
  const webFunction = appHtml.match(/function coOutlookWeb\(\)\{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(appHtml, /https:\/\/outlook\.office\.com\/mail\/deeplink\/compose/);
  assert.match(webFunction, /p\.set\('to'/);
  assert.doesNotMatch(webFunction, /p\.set\('bcc'/);
  assert.match(webFunction, /subject/);
  assert.match(webFunction, /body/);
});

test('App escritorio usa mailto con BCC separado por punto y coma para Outlook classic', () => {
  const desktopFunction = appHtml.match(/function coOutlook\(\)\{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(desktopFunction, /mailto:\?bcc=/);
  assert.match(desktopFunction, /join\(';'\)/);
});

test('Firma de correos incluye datos de Gabriel y aviso de confidencialidad', () => {
  assert.match(appHtml, /Gabriel Sanchez/);
  assert.match(appHtml, /Corporate and retail account Director/);
  assert.match(appHtml, /gabriel\.sanchez@claropr\.com/);
  assert.match(appHtml, /AVISO DE CONFIDENCIALIDAD/);
  assert.match(appHtml, /CONFIDENTIALITY NOTICE/);
});
