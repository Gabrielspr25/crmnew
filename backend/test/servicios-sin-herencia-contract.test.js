import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const page = await readFile(new URL('../../Planes para web/servicios.html', import.meta.url), 'utf8');
const admin = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Servicios no publica tablas heredadas cuando falta una fuente oficial', () => {
  assert.match(page, /Pendiente de publicación/);
  assert.match(page, /No se muestran precios, seguros, promociones ni documentos heredados/);
  assert.doesNotMatch(page, /const SERVICIOS|SEGUROS_EQUIPOS|SERVICIOS_SOCS/);
  assert.doesNotMatch(page, /RESCATEM|LEGALM|Advantage|Claro Residencia/);
});

test('Admin no ofrece tablas manuales heredadas de Servicios', () => {
  assert.match(admin, /Servicios pendiente de publicación oficial/);
  assert.doesNotMatch(admin, /OF_SERVICIOS\s*=|OF_SEGUROS_EQUIPOS\s*=|OF_SERVICIOS_SOCS\s*=/);
  assert.doesNotMatch(admin, /RESCATEM|LEGALM|ADVANTRM/);
});
