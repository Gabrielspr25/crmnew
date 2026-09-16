import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const leer = (nombre) => readFileSync(new URL(`../../Planes para web/${nombre}`, import.meta.url), 'utf8');
const config = leer('portal-config.js');

// Ejecuta portal-config.js con una direccion simulada y devuelve lo que deja en window.
function cargar(href) {
  const location = new URL(href);
  const guardado = {};
  const historial = [];
  const window = {
    location: {
      hostname: location.hostname,
      origin: location.origin,
      search: location.search,
      hash: location.hash,
      pathname: location.pathname,
    },
    localStorage: { setItem: (k, v) => { guardado[k] = v; }, getItem: (k) => guardado[k] || null },
    history: { replaceState: (_s, _t, url) => historial.push(url) },
  };
  vm.runInNewContext(config, { window, URL, URLSearchParams });
  return { window, guardado, historial };
}

test('en ofertas.ss-group.cloud la API es el CRM de produccion', () => {
  const { window } = cargar('https://ofertas.ss-group.cloud/benefits.html');
  assert.equal(window.PORTAL_API_BASE, 'https://crmp.ss-group.cloud');
  assert.equal(window.portalApiUrl('/api/planes-modulos/fijos'), 'https://crmp.ss-group.cloud/api/planes-modulos/fijos');
});

test('en produccion se ignora crm_origin: un enlace armado no puede desviar el token', () => {
  const { window } = cargar('https://ofertas.ss-group.cloud/oferta-const.html?crm_origin=https://atacante.example');
  assert.equal(window.PORTAL_API_BASE, 'https://crmp.ss-group.cloud');
});

test('en local el portal servido por el CRM usa el mismo origen', () => {
  const { window } = cargar('http://localhost:4000/constructor/benefits.html');
  assert.equal(window.PORTAL_API_BASE, 'http://localhost:4000');
});

test('en local crm_origin solo se acepta si apunta a localhost', () => {
  assert.equal(cargar('http://127.0.0.1:4173/oferta-const.html?crm_origin=http://127.0.0.1:4012').window.PORTAL_API_BASE, 'http://127.0.0.1:4012');
  assert.equal(cargar('http://127.0.0.1:4173/oferta-const.html?crm_origin=https://atacante.example').window.PORTAL_API_BASE, 'http://127.0.0.1:4173');
});

test('la sesion que llega en el hash se guarda y se quita de la direccion', () => {
  const { guardado, historial } = cargar('https://ofertas.ss-group.cloud/oferta-const.html?crm_client_id=77#crm_token=jwt-abc&vista=1');
  assert.equal(guardado.vp_token, 'jwt-abc');
  assert.equal(historial.length, 1);
  assert.equal(historial[0], '/oferta-const.html?crm_client_id=77#vista=1');
  assert.doesNotMatch(historial[0], /crm_token/);
});

test('sin token en el hash no toca la sesion guardada ni la direccion', () => {
  const { guardado, historial } = cargar('https://ofertas.ss-group.cloud/affinity.html');
  assert.equal(guardado.vp_token, undefined);
  assert.equal(historial.length, 0);
});

test('portal comparte modo oscuro y modo dia con paleta SS Group del CRM', () => {
  assert.match(config, /portal_ofertas_theme/);
  assert.match(config, /portal-theme-toggle/);
  assert.match(config, /body\[data-portal-theme="dark"\]\{background:#070B18!important;color:#F4F7FB!important/);
  assert.match(config, /body\[data-portal-theme="day"\]\{background:#F4F6FA!important;color:#172033!important/);
  assert.match(config, /background:#6D1FAD!important/);
  assert.match(config, /border-color:#242A3D!important/);
});

// Toda pagina del portal que pide datos carga la configuracion primero y no usa rutas /api relativas sueltas.
test('cada pagina del portal pasa sus llamadas por la configuracion compartida', () => {
  const paginas = ['index.html', 'claro-tv.html', 'movil.html', 'banda-ancha.html', 'equipos.html', 'benefits.html', 'affinity.html', 'oferta-const.html', 'ofertas.html'];
  for (const pagina of paginas) {
    const html = leer(pagina);
    const posConfig = html.search(/<script src="portal-config\.js(?:\?v=\d+)?"><\/script>/);
    assert.ok(posConfig > 0, `${pagina} debe cargar portal-config.js`);
    const primerScript = html.search(/<script(?![^>]*portal-config\.js)[\s>]/);
    assert.ok(primerScript === -1 || posConfig < primerScript, `${pagina} debe cargar portal-config.js antes que sus otros scripts`);
    assert.doesNotMatch(html, /fetch\(\s*['"`]\/api\//, `${pagina} no debe llamar /api con ruta relativa suelta`);
    assert.doesNotMatch(html, /(?:API_URL|API|API_BASE)\s*=\s*['"](?:\/api[^'"]*)?['"]\s*;/, `${pagina} no debe fijar la API como ruta relativa`);
    assert.doesNotMatch(html, /'https:\/\/crmp\.ss-group\.cloud'/, `${pagina} no debe repetir el dominio del CRM: vive en portal-config.js`);
  }
  const constructor = leer('constructor-publications.js');
  assert.match(constructor, /global\.portalApiUrl \? global\.portalApiUrl\(endpoint\) : endpoint/);
});

// Los scripts compartidos llevan version: si no cambia, el navegador del vendedor sigue usando la copia
// vieja en cache aunque el servidor ya tenga la nueva.
test('los scripts compartidos del portal cargan con version para romper la cache', () => {
  for (const pagina of ['oferta-const.html', 'ofertas.html']) {
    assert.match(leer(pagina), /<script src="constructor-publications\.js\?v=2026091001"><\/script>/, pagina);
  }
  for (const pagina of ['index.html', 'benefits.html', 'affinity.html', 'oferta-const.html']) {
    assert.match(leer(pagina), /<script src="portal-config\.js\?v=\d{10}"><\/script>/, pagina);
    assert.match(leer(pagina), /<script src="portal-config\.js\?v=2026091602"><\/script>/, pagina);
  }
});

// Abrir el Constructor no debe pedir por GET la accion POST de alternativas (daba un 404 en cada carga).
test('la carga inicial del Constructor no pide candidatos-alternativas', () => {
  const constructor = leer('constructor-publications.js');
  assert.match(constructor, /const ACTION_ENDPOINTS = new Set\(\['commercialCandidates'\]\)/);
  assert.match(constructor, /Object\.entries\(ENDPOINTS\)\.filter\(\(\[key\]\) => !ACTION_ENDPOINTS\.has\(key\)\)/);
  assert.match(constructor, /request\(ENDPOINTS\.commercialCandidates, \{\s*method: 'POST'/);
});
