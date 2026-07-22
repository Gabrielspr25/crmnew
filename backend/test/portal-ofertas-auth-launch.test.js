import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function loadPortalUrlBuilder({ hostname, origin, token }) {
  const start = page.indexOf('function buildPortalOfertasUrl(){');
  const end = page.indexOf('\nfunction abrirPortalOfertas()', start);
  assert.notEqual(start, -1, 'El CRM debe construir una URL autenticada para el portal');
  assert.notEqual(end, -1, 'El CRM debe tener la accion que abre el portal autenticado');

  const context = {
    URL,
    URLSearchParams,
    PORTAL_OFERTAS_URL: 'https://ofertas.ss-group.cloud/oferta-const.html',
    token,
    window: { location: { hostname, origin } },
    localStorage: { getItem: () => token },
  };
  vm.runInNewContext(page.slice(start, end), context);
  return context.buildPortalOfertasUrl();
}

test('abre el portal local con crm_origin y el JWT en el hash', () => {
  const url = new URL(loadPortalUrlBuilder({
    hostname: '127.0.0.1',
    origin: 'http://127.0.0.1:4012',
    token: 'jwt-local',
  }));

  assert.equal(url.origin, 'http://127.0.0.1:4173');
  assert.equal(url.pathname, '/oferta-const.html');
  assert.equal(url.searchParams.get('crm_origin'), 'http://127.0.0.1:4012');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('crm_token'), 'jwt-local');
  assert.equal(url.searchParams.has('crm_token'), false);
});

test('no abre un portal sin token CRM', () => {
  assert.equal(loadPortalUrlBuilder({
    hostname: '127.0.0.1',
    origin: 'http://127.0.0.1:4012',
    token: '',
  }), null);
});

test('la sesion CRM abre directamente el constructor que consume el motor', () => {
  assert.match(page, /const PORTAL_OFERTAS_URL='https:\/\/ofertas\.ss-group\.cloud\/oferta-const\.html'/,
    'el portal autenticado debe abrir el constructor y no una pagina intermedia');
});
