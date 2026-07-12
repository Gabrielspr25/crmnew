import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appHtml = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const portalServicios = await readFile(new URL('../../Planes para web/servicios.html', import.meta.url), 'utf8');

test('Admin Ofertas incluye tab de servicios con alertas y modal descargable', () => {
  assert.match(appHtml, /\['servicios','[^']*Servicios'\]/);
  assert.match(appHtml, /ofRenderServicios/);
  assert.match(appHtml, /Alertas de vigencia/);
  assert.match(appHtml, /openServicioModal/);
  assert.match(appHtml, /downloadServicioImage/);
});

test('Servicios iniciales documentan fechas importantes y estados de vigencia', () => {
  assert.match(appHtml, /6 meses gratis Claro Rescate \/ Claro Residencia/);
  assert.match(appHtml, /Desde el 5 de noviembre de 2025/);
  assert.match(appHtml, /Sin fecha final indicada/);
  assert.match(appHtml, /Vencida/);
});

test('Servicios incluye seguro de equipos con check y cantidad editable desde cero', () => {
  assert.match(appHtml, /Seguro de equipos a escoger/);
  assert.match(appHtml, /OF_SEGUROS_EQUIPOS/);
  assert.match(appHtml, /\$1,400\.01 en adelante/);
  assert.match(appHtml, /type="checkbox"/);
  assert.match(appHtml, /type="number" min="0" step="1" value="0"/);
});

test('Servicios publica SOCS y precios oficiales individuales y combinados', () => {
  for (const html of [appHtml, portalServicios]) {
    assert.match(html, /SOCS Y CODIGOS DE EMISION/);
    assert.match(html, /RESCATEM/);
    assert.match(html, /RESCATEF \/ A821/);
    assert.match(html, /renta:5\.99/);
    assert.match(html, /RESIDEM/);
    assert.match(html, /renta:4\.50/);
    assert.match(html, /RESRECM/);
    assert.match(html, /renta:7\.99/);
    assert.match(html, /ADVANTRM/);
    assert.match(html, /ADVANTRF \/ A846/);
    assert.match(html, /renta:11\.99/);
    assert.match(html, /LEGALF \/ A851/);
    assert.match(html, /renta:9\.99/);
    assert.match(html, /No usar aqui precios de paquetes de Internet \+ Telefonia/);
  }
});

test('Imagenes descargables de hojas de servicios existen', () => {
  const required = [
    '../../frontend/img/servicios/features-p09.png',
    '../../frontend/img/servicios/features-p10.png',
    '../../frontend/img/servicios/features-p11.png',
    '../../frontend/img/servicios/features-p12.png',
    '../../frontend/img/servicios/features-p13.png',
    '../../frontend/img/servicios/features-oferta-p09.png',
  ];
  for (const rel of required) {
    assert.equal(existsSync(new URL(rel, import.meta.url)), true, `${rel} debe existir`);
  }
});
