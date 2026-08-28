import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = process.env.FRONTEND_HTML_PATH || new URL('../../frontend/app.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');

test('modal de suscriptor ordena datos sin clasificar cuotas como fijo', () => {
  assert.match(html, /function cliLineKindFromProductType\(productType\)/);
  assert.match(html, /function cliSubscriberFinanceVisible\(values\)/);
  assert.match(html, /class="form-block/);
  assert.match(html, /class="form-grid/);
  assert.match(html, /max-width:980px/);
  assert.match(html, /type:'section',label:'Datos de la linea'/);
  assert.match(html, /type:'section',label:'Clasificacion'/);
  assert.match(html, /type:'section',label:'Fechas de contrato'/);
  assert.match(html, /type:'section',label:'Equipo \/ financiamiento'/);
  assert.doesNotMatch(html, /label:'Contrato fijo'/);
  assert.doesNotMatch(html, /label:'Movil \/ equipo'/);
});

test('tipo producto es comun y PRODUCT_TYPE respalda el tipo visible', () => {
  const fieldsStart = html.indexOf('function cliSubscriberFields(s)');
  const fieldsEnd = html.indexOf('function cliNormalizeSubscriberPayload', fieldsStart);
  const fieldsBlock = html.slice(fieldsStart, fieldsEnd);

  assert.match(fieldsBlock, /value:s\.line_kind\|\|cliLineKindFromProductType\(s\.product_type\)/);
  assert.match(fieldsBlock, /key:'line_kind',label:'Tipo producto'/);
  assert.match(fieldsBlock, /key:'line_type',label:'Tipo de linea'/);
  assert.match(fieldsBlock, /key:'product_type',label:'PRODUCT_TYPE'/);
});

test('equipo y cuotas se ocultan para fijo sin datos, pero se conservan al guardar', () => {
  assert.match(html, /data-finance-field="1"/);
  assert.match(html, /section\.style\.display=show\?'':'none'/);
  assert.match(html, /fields\.forEach\(function\(f,i\)\{ if\(f\.type==='section'\)return;/);
  assert.match(html, /vals\[f\.key\]=el\?el\.value:'';/);
});
