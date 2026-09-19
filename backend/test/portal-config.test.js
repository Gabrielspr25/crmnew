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
  const { window } = cargar('https://ofertas.ss-group.cloud/benefits.html?crm_origin=https://atacante.example');
  assert.equal(window.PORTAL_API_BASE, 'https://crmp.ss-group.cloud');
});

test('en local el portal servido por el CRM usa el mismo origen', () => {
  const { window } = cargar('http://localhost:4000/constructor/benefits.html');
  assert.equal(window.PORTAL_API_BASE, 'http://localhost:4000');
});

test('en local crm_origin solo se acepta si apunta a localhost', () => {
  assert.equal(cargar('http://127.0.0.1:4173/benefits.html?crm_origin=http://127.0.0.1:4012').window.PORTAL_API_BASE, 'http://127.0.0.1:4012');
  assert.equal(cargar('http://127.0.0.1:4173/benefits.html?crm_origin=https://atacante.example').window.PORTAL_API_BASE, 'http://127.0.0.1:4173');
});

test('la sesion que llega en el hash se guarda y se quita de la direccion', () => {
  const { guardado, historial } = cargar('https://ofertas.ss-group.cloud/benefits.html?crm_client_id=77#crm_token=jwt-abc&vista=1');
  assert.equal(guardado.vp_token, 'jwt-abc');
  assert.equal(historial.length, 1);
  assert.equal(historial[0], '/benefits.html?crm_client_id=77#vista=1');
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

test('modo dia mantiene contraste en tarjetas operativas del portal', () => {
  assert.match(config, /body\[data-portal-theme="day"\] \.section-card,[\s\S]*\.plan-card[\s\S]*background:#E9EEF8!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.entry-card\.primary,[\s\S]*background:#E4E9F7!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.entry-card\.active[\s\S]*box-shadow:0 0 0 2px rgba\(109,31,173,.24\),0 16px 34px rgba\(16,24,38,.16\)!important/);
  assert.match(config, /body\[data-portal-theme="day"\] code\{background:#E0E7FF!important;color:#4C1D95!important;border:1px solid #C4B5FD!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.code\{background:#E0E7FF!important;color:#4C1D95!important;border:1px solid #C4B5FD!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.price\{color:#166534!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.plan-item-codigo,[\s\S]*\.iot-codigo\{background:#E0E7FF!important;color:#4C1D95!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.plan-item-precio,[\s\S]*\.iot-precio\{color:#166534!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.solo-table,[\s\S]*\.convergent-table\{background:#F8FAFE!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.solo-table th,[\s\S]*\.convergent-table th\{background:#312E81!important;color:#F8FAFC!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.solo-table tbody tr:nth-child\(even\),[\s\S]*\.convergent-table tbody tr:nth-child\(even\)\{background:#EEF2FF!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.section-card,[\s\S]*\.status,[\s\S]*\.product-panel,[\s\S]*\.summary-card[\s\S]*background:#E9EEF8!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.entry-card\.primary,[\s\S]*\.prog-head,[\s\S]*\.modal-head,[\s\S]*\.accordion-head\{background:#E4E9F7!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.backup-table,[\s\S]*\.directory-table\{background:#FFFFFF!important/);
  assert.match(config, /body\[data-portal-theme="day"\] table,[\s\S]*\.ep-table\{background:#FFFFFF!important;color:#172033!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.section-name,[\s\S]*\.state-title\{color:#172033!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \[style\*="color:rgba\(255,255,255"\]\{color:#4D5A70!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.badge-blue\{background:#DBEAFE!important;color:#1E3A8A!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.pill,[\s\S]*\.btn-modal,[\s\S]*background:#FFFFFF!important;color:#172033!important/);
  assert.match(config, /body\[data-portal-theme="day"\] \.manager-row b\{color:#172033!important/);
  assert.match(config, /body\[data-portal-theme="day"\] a\{color:#075985!important/);
});

// Toda pagina del portal que pide datos carga la configuracion primero y no usa rutas /api relativas sueltas.
test('cada pagina del portal pasa sus llamadas por la configuracion compartida', () => {
  const paginas = ['index.html', 'claro-tv.html', 'movil.html', 'banda-ancha.html', 'equipos.html', 'benefits.html', 'affinity.html', 'servicios.html', 'directorio-fijo.html'];
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
});

// Los scripts compartidos llevan version: si no cambia, el navegador del vendedor sigue usando la copia
// vieja en cache aunque el servidor ya tenga la nueva.
test('los scripts compartidos del portal cargan con version para romper la cache', () => {
  const paginas = ['index.html', 'claro-tv.html', 'movil.html', 'banda-ancha.html', 'equipos.html', 'benefits.html', 'affinity.html', 'servicios.html', 'directorio-fijo.html'];
  for (const pagina of paginas) {
    assert.match(leer(pagina), /<script src="portal-config\.js\?v=\d{10}"><\/script>/, pagina);
    assert.match(leer(pagina), /<script src="portal-config\.js\?v=2026091610"><\/script>/, pagina);
  }
});
