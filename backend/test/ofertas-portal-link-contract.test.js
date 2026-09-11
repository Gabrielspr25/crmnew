import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function extraer(nombre, siguiente) {
  const inicio = html.indexOf(`function ${nombre}(`);
  const fin = html.indexOf(siguiente, inicio);
  assert.notEqual(inicio, -1, `falta ${nombre}`);
  assert.notEqual(fin, -1, `no se encontro el final de ${nombre}`);
  return html.slice(inicio, fin);
}

// El boton "Abrir constructor de ofertas" del perfil del cliente sigue la misma regla que el menu:
// sitio unico ofertas.ss-group.cloud en produccion, con la sesion en el hash para poder leer al cliente.
function abrirDesdePerfil({ hostname, origin, href, token }) {
  const abiertas = [];
  const context = vm.createContext({
    URL,
    URLSearchParams,
    PORTAL_OFERTAS_URL: 'https://ofertas.ss-group.cloud/oferta-const.html',
    token,
    location: { href },
    window: { location: { hostname, origin }, open: (url) => abiertas.push(url) },
    localStorage: { getItem: () => token },
    alert: () => abiertas.push('ALERTA'),
  });
  vm.runInContext(
    extraer('buildPortalOfertasUrl', '\nfunction abrirPortalOfertas()')
      + '\n' + extraer('abrirConstructorCliente', '\nlet reportAiRec')
      + '\nabrirConstructorCliente("cli-77");',
    context,
  );
  return abiertas;
}

test('el perfil del cliente abre el Constructor en ofertas.ss-group.cloud con cliente, regreso y sesion', () => {
  const [abierta] = abrirDesdePerfil({
    hostname: 'crmp.ss-group.cloud',
    origin: 'https://crmp.ss-group.cloud',
    href: 'https://crmp.ss-group.cloud/#/cliente/cli-77',
    token: 'jwt-prod',
  });
  const url = new URL(abierta);

  assert.equal(url.origin, 'https://ofertas.ss-group.cloud');
  assert.equal(url.pathname, '/oferta-const.html');
  assert.equal(url.searchParams.get('crm_client_id'), 'cli-77');
  assert.equal(url.searchParams.get('return'), 'https://crmp.ss-group.cloud/#/cliente/cli-77');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('crm_token'), 'jwt-prod');
  assert.equal(url.searchParams.has('crm_token'), false);
});

test('en local el perfil abre el portal que sirve el propio CRM', () => {
  const [abierta] = abrirDesdePerfil({
    hostname: 'localhost',
    origin: 'http://localhost:4000',
    href: 'http://localhost:4000/#/cliente/cli-77',
    token: 'jwt-local',
  });
  const url = new URL(abierta);
  assert.equal(url.origin, 'http://localhost:4000');
  assert.equal(url.pathname, '/constructor/oferta-const.html');
  assert.equal(url.searchParams.get('crm_client_id'), 'cli-77');
});

test('sin sesion no abre el Constructor y avisa', () => {
  assert.deepEqual(abrirDesdePerfil({
    hostname: 'crmp.ss-group.cloud',
    origin: 'https://crmp.ss-group.cloud',
    href: 'https://crmp.ss-group.cloud/',
    token: '',
  }), ['ALERTA']);
});
