import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vigenciaFromSources } from '../src/routes/motorOfertasRoutes.js';

test('el motor movil toma sus dos fuentes comerciales y expone una version temporal autorizada', () => {
  const route = fs.readFileSync(new URL('../src/routes/motorOfertasRoutes.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(route, /normalizeOfferWorkbooks/);
  assert.match(route, /vencida_pendiente_reemplazo/);
  assert.match(route, /motorOfertasRouter\.post\('\/preview'/);
  assert.match(route, /motorOfertasRouter\.post\('\/publicar'/);
  assert.match(route, /ofertas_movil_versiones/);
  assert.match(route, /fuente_ids/);
  assert.match(server, /motorOfertasRouter/);
});

test('admin y portal movil consumen la version publicada', () => {
  const app = fs.readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
  const portal = fs.readFileSync(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.match(app, /api\/motor-ofertas\/preview/);
  assert.match(app, /api\/motor-ofertas\/publicar/);
  assert.match(portal, /api\/ofertas-movil\/vigente/);
  assert.match(portal, /vencida_pendiente_reemplazo/);
  assert.match(portal, /loadMobileOffersVersion/);
  assert.match(portal, /renderPlanInformation/);
});

test('los acordeones informativos de planes conservan su estado y el buscador no los borra', () => {
  const portal = fs.readFileSync(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.match(portal, /\.plan-card-header/);
  assert.match(portal, /\.plan-accordion-body/);
  assert.match(portal, /addEventListener\('input', \(\) => \{\s*render\(\);/);
});

test('la vista publicada carga tambien la estructura oficial por plan desde el endpoint de modulos', () => {
  const portal = fs.readFileSync(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.match(portal, /api\/planes-modulos\/moviles/);
  assert.match(portal, /buildMultilineaActivationTable/);
  assert.match(portal, /buildPlanCard\(module\)/);
  assert.match(portal, /visibleModules\.forEach\(module => container\.appendChild\(buildPlanCard\(module\)\)/);
});

test('la pagina movil publica solo informacion de planes y no lista ofertas debajo', () => {
  const portal = fs.readFileSync(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.doesNotMatch(portal, /Ofertas móviles publicadas/);
  assert.doesNotMatch(portal, /published-mobile-offer/);
  assert.match(portal, /visibleModules\.forEach\(module => container\.appendChild\(buildPlanCard\(module\)\)/);
});

test('las tablas de activacion usan la paleta oscura del portal y no fondo blanco', () => {
  const portal = fs.readFileSync(new URL('../../Planes para web/movil.html', import.meta.url), 'utf8');
  assert.match(portal, /\.activation-table\{[^}]*background:#171b2f/);
  assert.match(portal, /\.activation-table \.activation-title\{[^}]*background:#12304f/);
  assert.match(portal, /\.activation-table \.activation-head\{[^}]*background:#232944/);
  assert.doesNotMatch(portal, /\.activation-table\{[^}]*background:#f7f7f7/);
});

test('la vigencia principal sale del boletin de financiamiento y diferencia fechas como advertencia', () => {
  const result = vigenciaFromSources(
    'Tabla Ofertas Financiamiento 30 de julio al 5 de agosto de 2026- PYMES.xlsx',
    'Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx',
  );
  assert.deepEqual(result.vigencia, { desde: '2026-07-30', hasta: '2026-08-05' });
  assert.equal(result.advertencias[0].codigo, 'vigencias_fuentes_distintas');
});
