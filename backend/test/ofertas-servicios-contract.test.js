import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appHtml = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const portalServicios = await readFile(new URL('../../Planes para web/servicios.html', import.meta.url), 'utf8');

test('Admin Ofertas incluye Servicios como modulo base controlado', () => {
  assert.match(appHtml, /\['servicios','Servicios'\]/);
  assert.match(appHtml, /function ofRenderServiciosBase\(\)/);
  assert.match(appHtml, /Pendiente de publicación oficial/);
});

test('Servicios no presenta datos heredados como publicación vigente', () => {
  for (const html of [appHtml, portalServicios]) {
    assert.match(html, /Pendiente de publicación/i);
    assert.doesNotMatch(html, /OF_SERVICIOS\s*=|OF_SEGUROS_EQUIPOS\s*=|OF_SERVICIOS_SOCS\s*=/);
    assert.doesNotMatch(html, /RESCATEM|RESCATEF|RESIDEM|RESRECM|ADVANTRM|ADVANTRF|LEGALF|LEGALM/);
  }
});

test('Portal Servicios explica que no usa documentos comerciales antiguos', () => {
  assert.match(portalServicios, /No existe todavía una publicación oficial de Servicios/);
  assert.match(portalServicios, /No se muestran precios, seguros, promociones ni documentos heredados/);
});
