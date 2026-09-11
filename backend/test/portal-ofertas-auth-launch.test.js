import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function loadPortalUrlBuilder({ hostname, origin, token }) {
  const start = page.indexOf('function buildPortalOfertasUrl(');
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

// Local: el propio CRM sirve el portal bajo /constructor.
test('abre el portal local con crm_origin y el JWT en el hash', () => {
  const url = new URL(loadPortalUrlBuilder({
    hostname: '127.0.0.1',
    origin: 'http://127.0.0.1:4012',
    token: 'jwt-local',
  }));

  assert.equal(url.origin, 'http://127.0.0.1:4012');
  assert.equal(url.pathname, '/constructor/oferta-const.html');
  assert.equal(url.searchParams.get('crm_origin'), 'http://127.0.0.1:4012');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('crm_token'), 'jwt-local');
  assert.equal(url.searchParams.has('crm_token'), false);
});

// Produccion: portal y Constructor son un solo sitio, ofertas.ss-group.cloud.
test('en produccion abre el Constructor en ofertas.ss-group.cloud con la sesion en el hash', () => {
  const url = new URL(loadPortalUrlBuilder({
    hostname: 'crmp.ss-group.cloud',
    origin: 'https://crmp.ss-group.cloud',
    token: 'jwt-prod',
  }));

  assert.equal(url.origin, 'https://ofertas.ss-group.cloud');
  assert.equal(url.pathname, '/oferta-const.html');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('crm_token'), 'jwt-prod');
  assert.equal(url.searchParams.has('crm_token'), false, 'el token nunca va en la query: quedaria en logs del servidor');
  assert.equal(url.searchParams.has('crm_origin'), false, 'en produccion el portal ya sabe cual es el CRM');
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
