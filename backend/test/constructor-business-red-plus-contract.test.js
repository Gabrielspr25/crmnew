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

// Decision actual: el menu del CRM abre el portal limpio; el perfil de cliente abre el Constructor real.
test('El acceso separa portal limpio y Constructor real en el mismo dominio publicado', () => {
  assert.match(crmPage, />Constructor<\/a>/);
  assert.match(crmPage, /const PORTAL_OFERTAS_URL='https:\/\/ofertas\.ss-group\.cloud\/'/);
  assert.match(crmPage, /const CONSTRUCTOR_OFERTAS_URL='https:\/\/ofertas\.ss-group\.cloud\/oferta-const\.html'/);
  assert.match(crmPage, /isConstructor\?'\/constructor\/oferta-const\.html':'\/constructor\/'/);
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
  assert.match(constructorPage, /grid-template-rows:auto auto auto 1fr/);
  assert.match(constructorPage, /grid-template-rows:auto auto auto minmax\(0,1fr\)/);
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

test('Tabletas y modems tienen filtro de marca dinamico dentro del tipo', () => {
  assert.match(constructorPage, /activeDeviceBrand/);
  assert.match(constructorPage, /availableDeviceSubBrands/);
  assert.match(constructorPage, /renderDeviceSubBrandTabs/);
  assert.match(constructorPage, /state\.activeBrand==='Tabletas'\|\|state\.activeBrand==='Módems'/);
  assert.doesNotMatch(constructorPage, /const MODEM_BRANDS=/);
  assert.doesNotMatch(constructorPage, /MODEM_BRANDS\.includes/);
  assert.doesNotMatch(constructorPage, /Apple \| Samsung/);
});

test('El boton Escoger de Matriz uno asigna la linea exacta y conserva datos del equipo', () => {
  assert.match(constructorPage, /data-motor-equipment-key/);
  assert.match(constructorPage, /handleMotorEquipmentChoose/);
  assert.match(constructorPage, /item_code:.*item\.equipo\.item_code/);
  assert.match(constructorPage, /sap_code:.*item\.equipo\.sap_code/);
  assert.match(constructorPage, /motorPagoMensual/);
  assert.match(constructorPage, /selectedMotorPlazo/);
  assert.match(constructorPage, /beneficio:benefit/);
  assert.match(constructorPage, /state\.cart\[index\]=\{\.\.\.state\.cart\[index\]/);
});

test('La fila seleccionada muestra descuento de monto fijo del Motor y no 0 por ciento', () => {
  assert.match(constructorPage, /motorBeneficio\?\.tipo==='descuento_monto'/);
  assert.match(constructorPage, /Descuento \$\{money\(row\.motorBeneficio\.monto\|\|row\.oferta\.credito\|\|0\)\}/);
  assert.match(constructorPage, /Number\(row\.motorPorcentaje\|\|0\)>0/);
});

test('La modal muestra beneficio oficial, precio resultante, fuente y vigencia para tabletas/modems', () => {
  assert.match(constructorPage, /motorBenefitLabel/);
  assert.match(constructorPage, /motorResultPrice/);
  assert.match(constructorPage, /motorSourceTrace/);
  assert.match(constructorPage, /Condicion:/);
  assert.match(constructorPage, /Vigencia:/);
});

test('El boton Aplica solo se muestra cuando el Motor no devuelve bloqueo', () => {
  assert.match(constructorPage, /hasMotorBlockingValidation/);
  assert.match(constructorPage, /const applies=!hasMotorBlockingValidation\(eq\.motor\)/);
  assert.match(constructorPage, /applies\?'Aplica':'No aplica'/);
  assert.match(constructorPage, /if\(key&&!hasMotorBlockingValidation\(eq\.motor\)\)assignMotorEquipment\(key\)/);
});

test('El motor carga tabletas y modems vigentes desde la lista oficial', () => {
  assert.match(motorRoute, /FROM public\.v_equipos_vigentes/);
  assert.match(motorRoute, /categoria IN \('tablet', 'modem'\)/);
  assert.match(motorRoute, /equiposEspeciales/);
});
