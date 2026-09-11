import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const page = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const loader = await readFile(new URL('../../Planes para web/constructor-publications.js', import.meta.url), 'utf8');
const logic = await readFile(new URL('../../Planes para web/ofertas-logic.js', import.meta.url), 'utf8');
const offersPage = await readFile(new URL('../../Planes para web/ofertas.html', import.meta.url), 'utf8');

test('pagina de ofertas enlaza el constructor nuevo', () => {
  assert.match(page, /href="oferta-const\.html" class="active"/);
  assert.match(offersPage, /href="oferta-const\.html"/);
});

test('constructor mantiene el flujo vendedor y el regreso al CRM', () => {
  assert.match(page, /Constructor Comercial/);
  assert.match(page, /Traer cliente del CRM/);
  assert.match(page, /Construir manualmente/);
  assert.match(page, /Consultar al asistente/);
  assert.match(page, /1\. Escoger plan/);
  assert.match(page, /2\. Escoger equipo y oferta/);
  assert.match(page, /Productos fijos y Claro TV/);
  assert.match(page, /Comparativa/);
  assert.match(page, /id="returnToOffersPortal"/);
  assert.match(page, /function returnToOffersPortal\(\)/);
});

test('constructor normaliza tres modos hacia un mismo escenario comercial', () => {
  assert.match(loader, /function buildCommercialScenario/);
  assert.match(loader, /commercial_truth:\s*'motor_comercial_publicado'/);
  assert.match(page, /sourceMode:'manual'/);
  assert.match(page, /source_mode:sourceMode/);
  assert.match(page, /updateCommercialScenario\('crm'\)/);
  assert.match(page, /updateCommercialScenario\('manual'\)/);
  assert.match(page, /updateCommercialScenario\('consultation'\)/);
  assert.match(page, /full_ban_lines:state\.crmFullBanLines/);
  assert.match(page, /selected_lines:sourceMode==='crm'\?selectedCrm:context\.lineas/);
  assert.match(page, /original_query:state\.consultationQuery/);
});

test('consulta inteligente prepara intencion local sin proveedor externo ni reglas comerciales propias', () => {
  assert.match(page, /function parseConsultationIntent/);
  assert.match(page, /interprete_local/);
  assert.match(page, /consulta_no_decide_promociones/);
  assert.match(page, /motor_comercial_define_elegibilidad/);
  assert.match(page, /Preparando cotizacion comercial/);
  assert.doesNotMatch(page, /api\.openai|anthropic|gemini|azure openai|chat\/completions|responses|COMMERCIAL_CONSULTATION_LLM_API_KEY/);
});

test('consulta reconstruye escenario desde contexto estable y bloquea desincronizacion visible', () => {
  assert.match(page, /function buildStableConsultationScenario/);
  assert.match(page, /function buildConsultationScenarioFromVisibleIntent/);
  assert.match(page, /function validateConsultationScenarioSync/);
  assert.match(page, /consulta_estado_desincronizado/);
  assert.match(page, /La consulta visible no coincide con el escenario preparado/);
  assert.match(page, /visibleIntentScenario=buildConsultationScenarioFromVisibleIntent\(state\.consultationIntent,stableScenario\)/);
  assert.match(page, /state\.commercialScenario=consultationScenarioForEvaluation\(state\.consultationIntent,visibleIntentScenario\)/);
  assert.match(page, /if\(state\.sourceMode!=='consultation'\)updateCommercialScenario\(state\.sourceMode\)/);
  assert.doesNotMatch(page, /state\.commercialScenario=consultationScenarioForEvaluation\(state\.consultationIntent,state\.commercialScenario\)/);
});

test('constructor recibe las cuatro publicaciones comerciales actuales', () => {
  assert.match(page, /constructor-publications\.js/);
  assert.match(page, /loadCurrentPublications/);
  for (const endpoint of [
    '/api/ofertas-movil/vigente',
    '/api/planes-modulos/moviles',
    '/api/planes-modulos/fijos',
    '/api/planes-modulos/claro_tv',
    '/api/equipos-lista',
  ]) assert.match(loader, new RegExp(endpoint.replaceAll('/', '\\/')));
});

test('constructor no carga archivos comerciales estaticos', () => {
  assert.doesNotMatch(page, /fijos-data\.js|ofertas-data\.js/);
  assert.doesNotMatch(page, /CONST_CLARO_TV_DATA|PLAN_MULTILINEA_TOTALS|PLAN_MULTILINEA_LINE_COSTS|PLAN_INDIVIDUAL_TOTALS/);
});

test('planes y productos se construyen desde los modulos publicados', () => {
  assert.match(page, /fillPlanSelectors/);
  assert.match(page, /mobilePlanCatalog\.individual\.map/);
  assert.match(page, /mobilePlanCatalog\.multiline\.map/);
  assert.match(page, /fixedProductGroups/);
  assert.match(page, /claroTvProductGroups/);
  assert.match(page, /renderProductosAdicionales/);
});

test('sin publicacion el constructor bloquea el avance', () => {
  assert.match(page, /Pendiente de publicacion/);
  assert.match(page, /disabled=!constructorPublications\.ready/);
  assert.match(loader, /ready:\s*Boolean\(version && mobileModules\.length && equipment\.length/);
});

test('servicios seguros y benefits no usan reglas heredadas', () => {
  assert.match(page, /Servicios pendientes de publicacion/);
  assert.match(page, /Seguros pendientes de publicacion/);
  assert.match(page, /(?:Benefits|Beneficios) pendientes de publicaci[oó]n/);
  assert.doesNotMatch(page, /const SERVICIOS\s*=|const SEGUROS\s*=|SERVICE_PRICE_OPTIONS/);
  assert.doesNotMatch(page, /Bono Portabilidad \$150|Pago balance hasta \$800|Bono Streaming:.*\$10/);
});

test('ofertas respetan evento familia plan y trade-in publicados', () => {
  assert.match(logic, /canonicalEvent/);
  assert.match(logic, /canonicalFamily/);
  assert.match(logic, /oferta\.eventos\.some/);
  assert.match(logic, /oferta\.familias\.some/);
  assert.match(logic, /requiresTradein/);
});

test('constructor conserva asignacion por linea y seleccion por equipo', () => {
  assert.match(page, /lineasTable/);
  assert.match(page, /setLineEvent/);
  assert.match(page, /openEquipmentModal/);
  assert.match(page, /assignOfferToLine/);
  assert.match(page, /selectedPlazo/);
});

test('constructor conserva comparativa y exportaciones', () => {
  assert.match(page, /function comparisonData/);
  assert.match(page, /function downloadComparisonHtml/);
  assert.match(page, /function downloadComparisonExcel/);
  assert.match(page, /function printComparison/);
  assert.match(page, /function saveComparisonToCrm/);
});
