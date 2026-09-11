import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const route = readFileSync(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../src/services/benefitsPortalCatalog.js', import.meta.url), 'utf8');
const persistence = readFileSync(new URL('../src/services/motorComercialReglasCompuestasPersistence.js', import.meta.url), 'utf8');

test('Affinity es una familia de fuente oficial que solo acepta PDF', () => {
  const familias = route.match(/const FAMILIAS = new Set\(\[([^\]]*)\]\)/)?.[1] || '';
  assert.match(familias, /'affinity'/);
  const migration = readFileSync(new URL('../migrations/2026-09-07-fuentes-comerciales-familia-affinity.sql', import.meta.url), 'utf8');
  const constraintList = migration.match(/CHECK \(familia IN \(([\s\S]*?)\)\)/)?.[1] || '';
  const enBackend = [...familias.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  const enMigracion = [...constraintList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(enMigracion, enBackend, 'la lista FAMILIAS del backend y el CHECK de la migracion deben coincidir');
  assert.match(migration, /DROP CONSTRAINT IF EXISTS fuentes_comerciales_familia_check/);
  assert.match(route, /familia === 'affinity' && !\/\\\.pdf\$\/i\.test\(name\)/);
  assert.match(route, /formato_affinity_pdf_invalido/);
});

test('Affinity expone preview, borrador/aprobacion, historial, vigente y publicacion local con su propio dominio', () => {
  assert.match(route, /post\('\/affinity\/preview', requireAdmin/);
  assert.match(route, /post\('\/affinity\/reglas-compuestas\/persistir', requireAdmin/);
  assert.match(route, /get\('\/affinity\/historial', requireAdmin/);
  assert.match(route, /get\('\/affinity\/reglas-compuestas-publicadas\/vigente', requireAdmin/);
  assert.match(route, /get\('\/affinity\/reglas-compuestas\/:versionId', requireAdmin/);
  assert.match(route, /post\('\/affinity\/reglas-compuestas\/:versionId\/publicar-local', requireAdmin/);
  assert.match(route, /normalizeAffinityBenefitSources\(\[\{ fuente: row, text: extracted\.text \|\| '' \}\], \{ resoluciones \}\)/);
  assert.match(route, /readCurrentPublishedCompositeRules\(\{ db: pool, dominio: AFFINITY_DOMINIO \}\)/);
  assert.match(route, /normalizadorVersion: AFFINITY_NORMALIZADOR_VERSION/);
  assert.doesNotMatch(route.match(/post\('\/affinity\/preview'[\s\S]*?\n\}\);/)[0], /INSERT|UPDATE|DELETE/);
  assert.match(persistence, /export async function listCompositeRulesVersions/);
});

test('la aclaracion de una contradiccion queda a nombre del usuario que la registra', () => {
  const handler = route.match(/post\('\/affinity\/preview'[\s\S]*?\n\}\);/)[0];
  // El actor sale de la sesion, nunca del cuerpo del request.
  assert.match(handler, /actor: uname\(req\)/);
  assert.doesNotMatch(handler, /actor:\s*(?:req\.body|valor\?\.actor)/);
  assert.match(handler, /Number\.isFinite\(megas\)/);
  assert.match(appHtml, /function ofResolverAffinity\(tecnologia,megas\)/);
  assert.match(appHtml, /resoluciones:ofAffinityResoluciones/);
});

test('el portal lee Affinity desde su propia vista, no desde el catalogo de Beneficios', () => {
  assert.match(portal, /readAffinityBenefits/);
  assert.match(portal, /readPublishedVersion\(db, 'affinity_benefits'\)/);
  assert.match(portal, /export async function readAffinityPortalDetail/);
  // El catalogo de Beneficios ya no lo incluye: el vendedor lo veria duplicado.
  assert.match(portal, /Affinity no entra en este catalogo/);
  assert.doesNotMatch(portal, /affinityEntries/);
});

test('Admin Ofertas muestra Affinity como modulo propio del Centro de Cargas', () => {
  const tabs = appHtml.match(/const OF_TABS=\[([\s\S]*?)\];/)?.[1] || '';
  const familias = appHtml.match(/const FC_FAMILIAS=\[([\s\S]*?)\];/)?.[1] || '';
  assert.match(tabs, /\['affinity','Affinity'\]/);
  assert.match(familias, /\['affinity','Affinity'\]/);
  assert.match(appHtml, /if\(ofTab==='affinity'\)return ofRenderAffinity\(\);/);
  assert.match(appHtml, /function ofRenderAffinity\(\)/);
  assert.match(appHtml, /\/api\/fuentes-comerciales\/affinity\/preview/);
  assert.match(appHtml, /\/api\/fuentes-comerciales\/affinity\/reglas-compuestas\/persistir/);
  assert.match(appHtml, /\/publicar-local/);
  assert.match(appHtml, /Affinity solo acepta el PDF oficial del programa/);
});
