import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const leer = (archivo) => readFileSync(new URL(archivo, root), 'utf8');
const portalPages = [
  'Planes para web/index.html',
  'Planes para web/claro-tv.html',
  'Planes para web/movil.html',
  'Planes para web/banda-ancha.html',
  'Planes para web/equipos.html',
  'Planes para web/servicios.html',
  'Planes para web/benefits.html',
  'Planes para web/affinity.html',
  'Planes para web/directorio-fijo.html',
];

test('el Portal no conserva accesos al Constructor ni a Ofertas heredados', () => {
  for (const archivo of portalPages) {
    const page = leer(archivo);
    assert.doesNotMatch(page, /href="oferta-const\.html"/, archivo);
    assert.doesNotMatch(page, /href="ofertas\.html"/, archivo);
    assert.doesNotMatch(page, />Constructor</, archivo);
    assert.doesNotMatch(page, />Ofertas</, archivo);
  }
});

test('el CRM concentra la administracion comercial en una unica entrada', () => {
  const crm = leer('frontend/app.html');
  assert.doesNotMatch(crm, /CONSTRUCTOR_OFERTAS_URL/);
  assert.doesNotMatch(crm, /abrirPortalOfertas/);
  assert.doesNotMatch(crm, /abrirConstructorCliente/);
  assert.match(crm, /href="#\/ofertas"[^>]*>.*Administraci[oó]n de Ofertas/);
  assert.doesNotMatch(crm, /href="#\/tareas-reglas-admin"/);
});

test('las pantallas heredadas no quedan publicadas como interfaz funcional', () => {
  assert.equal(existsSync(new URL('Planes para web/oferta-const.html', root)), false);
  assert.equal(existsSync(new URL('Planes para web/ofertas.html', root)), false);
  assert.equal(existsSync(new URL('Planes para web/constructor-publications.js', root)), false);
  assert.equal(existsSync(new URL('Planes para web/ofertas-logic.js', root)), false);
});
