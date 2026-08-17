import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const movilPage = await readFile(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');

test('Portal Movil consume la base informativa dinamica y muestra metadatos de publicacion', () => {
  assert.match(movilPage, /api\/planes-modulos\/moviles/);
  assert.match(movilPage, /basePublicationMeta/);
  assert.match(movilPage, /fecha_actualizacion_base/);
  assert.match(movilPage, /movil_planes_individuales/);
  assert.match(movilPage, /movil_multilinea_business_red/);
  assert.match(movilPage, /movil_multilinea_byop_ban/);
});

test('Portal Movil presenta BYOP-BAN como precio por BAN y no como precio por linea', () => {
  assert.match(movilPage, /precio_regular_descripcion/);
  assert.match(movilPage, /por BAN/);
  assert.match(movilPage, /modelo_cobro/);
  assert.doesNotMatch(movilPage, /\$15\s*por\s*l[ií]nea/i);
});

test('Portal Movil filtra Government RED y codigos de una linea operativa', () => {
  assert.match(movilPage, /isPublicMobileRow/);
  assert.match(movilPage, /segmento_no_incluido/);
  assert.match(movilPage, /BREDP1/);
  assert.match(movilPage, /BREDSF1/);
});
