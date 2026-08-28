import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const constructorPage = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const crmPage = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const motorRoute = await readFile(new URL('../src/routes/motorOfertasRoutes.js', import.meta.url), 'utf8');

test('Constructor consulta Esquema 1 por posicion para Business Red Plus', () => {
  assert.match(constructorPage, /\/api\/motor-ofertas\/elegibles/);
  assert.match(constructorPage, /method\s*:\s*['"]POST['"]/);
  assert.match(constructorPage, /posicion_en_ban\s*:\s*index\s*\+\s*1/);
  assert.match(constructorPage, /familia_business_red\s*:\s*['"]business_red_plus['"]/);
  assert.match(constructorPage, /motorPagoMensual/);
  assert.match(constructorPage, /Pago equipo en linea/);
});

test('El acceso Constructor abre la pagina del mismo CRM', () => {
  assert.match(crmPage, />Constructor<\/a>/);
  assert.match(crmPage, /new URL\(['"]\/constructor\/oferta-const\.html['"],\s*window\.location\.origin\)/);
  assert.doesNotMatch(crmPage, /PORTAL_OFERTAS_URL='https:\/\/ofertas\.ss-group\.cloud\/oferta-const\.html'/);
});

test('El evento se escoge por linea y ofrece las cuatro opciones', () => {
  assert.doesNotMatch(constructorPage, /Eventos de esta propuesta/);
  assert.match(constructorPage, /EVENTOS\.map\(ev=>`<option/);
  for (const event of ['Linea nueva', 'Portabilidad', 'Renovacion', 'Linea adicional']) {
    assert.match(constructorPage, new RegExp(event));
  }
});

test('El filtro de marcas unifica diferencias de mayusculas', () => {
  assert.match(constructorPage, /function normalizedBrand\(brand\)/);
  assert.match(constructorPage, /deviceTab\(eq\).*normalizedBrand\(eq\.marca\)/);
});

test('La modal de equipos usa el alto visible y desplaza su contenido', () => {
  assert.match(constructorPage, /\.equipment-modal\{[^}]*height:min\(90vh,820px\)/);
  assert.match(constructorPage, /\.modal-body\{[^}]*min-height:0/);
  assert.match(constructorPage, /\.modal-picker\{[^}]*height:100%[^}]*min-height:0/);
  assert.match(constructorPage, /\.modal-device-list\{[^}]*overflow:auto/);
});

test('El beneficio conserva el porcentaje de la Matriz uno', () => {
  assert.match(constructorPage, /motorPorcentaje/);
  assert.match(constructorPage, /% descuento/);
});

test('El constructor filtra equipos por gama y tipo y unifica Apple con iPhone', () => {
  assert.match(constructorPage, /\['Todos','Gama alta','Gama baja','Tabletas','Módems'\]/);
  assert.match(constructorPage, /segmento\s*===\s*'gama_alta'/);
  assert.match(constructorPage, /segmento\s*===\s*'gama_baja'/);
  assert.match(constructorPage, /apple\|iphone/);
});

test('El motor carga tabletas y modems vigentes desde la lista oficial', () => {
  assert.match(motorRoute, /FROM public\.v_equipos_vigentes/);
  assert.match(motorRoute, /categoria IN \('tablet', 'modem'\)/);
  assert.match(motorRoute, /equiposEspeciales/);
});
