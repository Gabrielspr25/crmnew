import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const movilPage = await readFile(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
const planesRoute = await readFile(new URL('../src/routes/planesRoutes.js', import.meta.url), 'utf8');

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

test('Portal Movil oculta modulos Business Red legacy de lineas retro', () => {
  assert.match(movilPage, /function isLegacyBusinessRedModule/);
  assert.match(movilPage, /business_red_plus/);
  assert.match(movilPage, /sin_fronteras/);
  assert.match(movilPage, /allModulos\.filter\(\s*m\s*=>\s*!isLegacyBusinessRedModule\(m\)\s*\)/);
});

test('Portal Movil separa Business RED en acordeones por familia', () => {
  assert.match(movilPage, /function buildMobileDisplayModules/);
  assert.match(movilPage, /function mobileBusinessRedFamilyOrder/);
  assert.match(movilPage, /function moveIndividualPlansLast/);
  assert.match(movilPage, /movil_multilinea_business_red_plus/);
  assert.match(movilPage, /movil_multilinea_business_red_extreme/);
  assert.match(movilPage, /movil_multilinea_business_red_supreme/);
  assert.match(movilPage, /movil_multilinea_business_red_sin_fronteras/);
  assert.match(movilPage, /Business Red PLUS/);
  assert.match(movilPage, /Business Red EXTREME/);
  assert.match(movilPage, /Business Red SUPREME/);
  assert.match(movilPage, /Business Red Sin Fronteras/);
  assert.match(movilPage, /visible = buildMobileDisplayModules\(visible\)/);
  assert.match(movilPage, /visible = moveIndividualPlansLast\(visible\)/);
});

test('Portal Movil deja Planes individuales al final y sin texto blanco fuerte', () => {
  assert.match(movilPage, /movil_planes_individuales/);
  assert.match(movilPage, /function buildIndividualPlansTable/);
  assert.match(movilPage, /function openIndividualPlanDetails/);
  assert.match(movilPage, /individual-plan-table/);
  assert.match(movilPage, /individual-plan-name/);
  assert.match(movilPage, /individual-plan-code/);
  assert.match(movilPage, /individual-details-button/);
  assert.match(movilPage, /Ver caracteristicas/);
  assert.match(movilPage, /<th>Plan \/ codigo<\/th><th>Precio<\/th><th>Lineas<\/th><th>Requisitos<\/th><th>Detalle<\/th>/);
  assert.doesNotMatch(movilPage, /<strong>\$\{escapeHTML\(row\.descripcion\)\}<\/strong><div class="regular-price">\$\{escapeHTML\(row\.codigo\)\}<\/div>/);
});

test('Portal Movil muestra Business RED con tabla oficial de activacion por familia', () => {
  assert.match(movilPage, /function businessRedActivationRowsFromText/);
  assert.match(movilPage, /function buildBusinessRedBaseActivationTable/);
  assert.match(movilPage, /codigo_vendedor/);
  assert.match(movilPage, /codigo_sistema/);
  assert.match(movilPage, /promedio_regular/);
  assert.match(movilPage, /total_autopay/);
  assert.match(movilPage, /PROCESO DE ACTIVACION/);
  assert.match(movilPage, /businessRedActivationRowsFromText\(module\)/);
  assert.match(movilPage, /rowRegex/);
  assert.match(movilPage, /precio_factura_linea/);
  assert.match(movilPage, /buildActivationTable\(\{\s*formato:\s*'business_red_base'/);
});

test('API de modulos moviles no entrega Business Red legacy como modulo vivo', () => {
  assert.match(planesRoute, /LEGACY_MOBILE_MODULE_KEYS/);
  assert.match(planesRoute, /business_red_plus/);
  assert.match(planesRoute, /business_red_extreme/);
  assert.match(planesRoute, /business_red_supreme/);
  assert.match(planesRoute, /business_red_sin_fronteras/);
  assert.match(planesRoute, /seccion_key <> ALL/);
});
