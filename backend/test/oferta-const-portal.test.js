import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const page = await readFile(new URL('../../Planes para web/oferta-const.html', import.meta.url), 'utf8');
const navPages = await Promise.all(
  ['index.html', 'movil.html', 'banda-ancha.html', 'equipos.html', 'servicios.html', 'ofertas.html']
    .map((name) => readFile(new URL(`../../Planes para web/${name}`, import.meta.url), 'utf8'))
);

test('portal tiene tab nuevo Oferta const enlazado desde las paginas principales', () => {
  assert.match(page, /Oferta const\./);
  assert.match(page, /href="oferta-const\.html" class="active"/);
  for (const html of navPages) assert.match(html, /href="oferta-const\.html"/);
});

test('Oferta const muestra version visible en el header', () => {
  assert.match(page, /version-badge/);
  assert.match(page, /v2026\.07\.03\.11/);
  assert.match(page, /Constructor de Ofertas - PYMES \(9-22 jun 2026\)/);
});

test('Oferta const permite volver al portal sin perder el contexto CRM', () => {
  assert.match(page, /id="returnToOffersPortal"/);
  assert.match(page, /Volver al portal/);
  assert.match(page, /function returnToOffersPortal\(\)/);
  assert.match(page, /new URL\('index\.html',location\.href\)/);
  assert.match(page, /\['crm_client_id','return','crm_origin'\]/);
  assert.match(page, /target\.hash=location\.hash/);
});

test('Oferta const implementa flujo progresivo de plan a propuesta', () => {
  assert.match(page, /1\. Escoger plan/);
  assert.match(page, /2\. Escoger equipo y oferta/);
  assert.match(page, /Terminos y condiciones de la oferta seleccionada/);
  assert.match(page, /3\. Servicios y seguro/);
  assert.match(page, /4\. Productos fijos y Claro TV/);
  assert.match(page, /5\. Comparativa/);
});

test('Oferta const protege reglas de cierre individual y multilinea', () => {
  assert.match(page, /individual requiere 1 linea/);
  assert.match(page, /multilinea requiere minimo 2 lineas/);
  assert.match(page, /Cerrar comparativa/);
});

test('Oferta const mantiene la asignacion de evento por linea', () => {
  assert.match(page, /line-event-select/);
  assert.match(page, /setLineEvent/);
  assert.match(page, /toggleEvento/);
  assert.match(page, /eventos:\['nueva'\]/);
  assert.match(page, /Tipo de linea para este equipo/);
});

test('Oferta const muestra solo Linea nueva y Portabilidad en el formulario principal', () => {
  const planStart = page.indexOf('<section class="step" id="stepPlan">');
  const planEnd = page.indexOf('<section class="step locked" id="stepEquipo">', planStart);
  const planSection = page.slice(planStart, planEnd);

  assert.match(planSection, /data-evento="nueva"/);
  assert.match(planSection, /data-evento="portabilidad"/);
  assert.doesNotMatch(planSection, /data-evento="renovacion"/);
  assert.doesNotMatch(planSection, /data-evento="adicional"/);
  assert.match(planSection, /id="lineas" type="number" min="1"/);
  assert.doesNotMatch(planSection, /id="lineas"[^>]*max=/);
});

test('Oferta const no muestra resumen repetido arriba del formulario', () => {
  assert.doesNotMatch(page, /id="topSummary"/);
});

test('Oferta const sincroniza resumen al cambiar plan y aplica minimo multilinea', () => {
  assert.match(page, /onchange="syncPlan\(\);renderSummary\(\)"/);
  assert.match(page, /oninput="syncPlan\(\);renderSummary\(\)"/);
  assert.match(page, /state\.tipo==='multilinea'\?2:1/);
  assert.match(page, /\$\('lineas'\)\.min=String\(min\)/);
  assert.match(page, /syncPlan\(\);renderSummary\(\);/);
});

test('Oferta const inicia multilinea en Business Red Plus', () => {
  assert.match(page, /<option value="plus" selected>Business Red Plus<\/option>/);
  assert.match(page, /planMulti:'plus'/);
  assert.doesNotMatch(page, /<option value="supreme" selected>Business Red Supreme<\/option>/);
});

test('Oferta const prepara seleccion de equipos sin obligar a buscar', () => {
  assert.match(page, /beneficio:'todos'/);
  assert.match(page, /Lineas de la propuesta/);
  assert.match(page, /Filtrar modal/);
  assert.match(page, /Escoger equipo/);
  assert.doesNotMatch(page, /class="phone"/);
  assert.doesNotMatch(page, /No hay equipos para este plan\./);
});

test('Oferta const rotula ofertas heredadas como Business RED en multilinea', () => {
  assert.match(page, /offerDisplayTitle/);
  assert.match(page, /Equipo gratis - Aplica Business RED/);
  assert.match(page, /50% descuento - Aplica Business RED/);
  assert.match(page, /Business RED \/ lineas 1-/);
  assert.match(page, /como referencia del boletin/);
});

test('Oferta const crea filas por linea y abre modal de equipos por marca', () => {
  assert.match(page, /lineasTable/);
  assert.match(page, /renderLineRows/);
  assert.match(page, /openEquipmentModal/);
  assert.match(page, /equipmentModal/);
  assert.match(page, /brandTabs/);
  assert.match(page, /modalDeviceList/);
  assert.match(page, /modalOfferPanel/);
  assert.match(page, /activeLineIndex/);
  assert.match(page, /assignOfferToLine/);
  assert.match(page, /data-brand="\$\{esc\(brand\)\}"/);
  assert.match(page, /'Todos'/);
  assert.match(page, /function availableBrands/);
  assert.match(page, /function deviceTab/);
  assert.match(page, /setActiveBrand/);
});

test('Oferta const agrupa modems y tablets en tabs visuales', () => {
  assert.match(page, /MODEM_BRANDS=\['Dlink','Franklin','Netgear','PCD','SenseConnect'\]/);
  assert.match(page, /return 'Modem'/);
  assert.match(page, /return 'Tablets'/);
  assert.match(page, /device-tablet/);
  assert.match(page, /device-modem/);
  assert.match(page, /device-kind/);
});

test('Oferta const mantiene filas limpias con modelo y chips de beneficio', () => {
  assert.match(page, /offerActionPills/);
  assert.match(page, /Gratis/);
  assert.match(page, /50%/);
  assert.match(page, /Trade-in/);
  assert.match(page, /Beneficio/);
  assert.doesNotMatch(page, /Costo \/ regla/);
  assert.doesNotMatch(page, /Regular '\+money\(row\.equipo\.precio\)/);
});

test('Oferta const usa modal compacta con lista de equipos y panel de ofertas', () => {
  assert.match(page, /modalPicker/);
  assert.match(page, /modalDeviceList/);
  assert.match(page, /modalOfferPanel/);
  assert.match(page, /selectModalDevice/);
  assert.match(page, /renderModalOfferPanel/);
  assert.match(page, /selectedModalKey/);
  assert.doesNotMatch(page, /id="modalDeviceGrid"/);
});

test('Oferta const recomienda ofertas segun evento de la linea', () => {
  assert.match(page, /recommendOffer/);
  assert.match(page, /sortRecommendedOffers/);
  assert.match(page, /Recomendado/);
  assert.match(page, /Nueva\/Portabilidad/);
  assert.match(page, /Renovacion/);
  assert.match(page, /requiere trade-in/);
  assert.match(page, /linea>oferta\.lineaLimit/);
});

test('Oferta const muestra pago mensual por unidad en la propuesta', () => {
  assert.match(page, /function paymentPerUnit/);
  assert.match(page, /function groupProposalEquipment/);
  assert.match(page, /Pago por unidad/);
  assert.match(page, /Precio regular/);
  assert.match(page, /Credito \$\{money\(row\.oferta\.credito\)\} \/ \$\{selectedPlazo\(row\)\} meses/);
  assert.match(page, /El IVU se calcula basado en el precio regular/);
});

test('Oferta const muestra meses pago y precio regular en cada linea', () => {
  assert.match(page, /function lineMonthsText/);
  assert.match(page, /function lineMonthsControl/);
  assert.match(page, /function linePaymentText/);
  assert.match(page, /function lineRegularText/);
  assert.match(page, /function setRowPlazo/);
  assert.match(page, /<th>Meses<\/th><th>Pago equipo<\/th><th>Regular<\/th>/);
  assert.match(page, /onchange="setRowPlazo\(\$\{index\},this\.value\)"/);
  assert.match(page, /Credito \$\{money\(row\.oferta\.credito\)\}/);
});

test('Oferta const hace escroleable la tabla de escoger equipo', () => {
  assert.match(page, /class="lines-scroll"/);
  assert.match(page, /\.lines-scroll\{max-height:430px;overflow:auto/);
  assert.match(page, /position:sticky;top:0/);
});

test('Oferta const permite volver atras entre pasos', () => {
  assert.match(page, /function backToPlan/);
  assert.match(page, /function backToEquipo/);
  assert.match(page, /function backToServicios/);
  assert.match(page, /onclick="backToPlan\(\)">Volver atras/);
  assert.match(page, /onclick="backToEquipo\(\)">Volver atras/);
  assert.match(page, /onclick="backToServicios\(\)">Volver atras/);
});

test('Oferta const muestra notas condicionales de streaming y portabilidad antes de servicios', () => {
  assert.match(page, /id="offerExtrasPanel"/);
  assert.match(page, /function renderOfferExtrasPanel/);
  assert.match(page, /Bono Streaming/);
  assert.match(page, /Portabilidad/);
  assert.match(page, /conditional-panel show/);
  assert.match(page, /i\.evento==='portabilidad'/);
  assert.match(page, /oferta\.bonoStreaming/);
});

test('Oferta const activa bonos por convergente y portabilidad sin mezclarlos con servicios', () => {
  assert.match(page, /id="convergenteBtn"/);
  assert.match(page, /function toggleConvergente/);
  assert.match(page, /convergente:false/);
  assert.match(page, /applicableBonuses/);
  assert.match(page, /Bono Portabilidad \$150/);
  assert.match(page, /Bono Portabilidad hasta \$\$\{amount\}/);
  assert.match(page, /Pago balance hasta \$800/);
  assert.match(page, /Bonos aplicables/);
  assert.match(page, /dividido en 24 cuotas mensuales/);
  assert.match(page, /state\.convergente&&plan>=35/);
  assert.match(page, /portabilidadCreditos\.length&&plan>=45/);
  assert.match(page, /portabilidadCreditos\.length&&plan>=50/);
});

test('Oferta const muestra controles de plan compactos y consistentes', () => {
  assert.match(page, /class="plan-controls"/);
  assert.match(page, /class="plan-card"/);
  assert.match(page, /class="segmented" data-group="tipo"/);
  assert.match(page, /class="segment-btn active" data-val="individual"/);
  assert.match(page, /class="plan-select" id="planInd"/);
  assert.match(page, /class="context-toggle" id="convergenteBtn"/);
  assert.match(page, /No convergente<span>Toca para activar bono streaming<\/span>/);
  assert.match(page, /Cliente convergente<span>Bono streaming habilitado si aplica<\/span>/);
});

test('Oferta const muestra creditos de convergente y portabilidad por linea', () => {
  assert.match(page, /Creditos\/bonos/);
  assert.match(page, /Deuda port\./);
  assert.match(page, /function lineBonusCredits/);
  assert.match(page, /function lineBonusPills/);
  assert.match(page, /function setLineDebt/);
  assert.match(page, /selectedPortabilidadCreditRows/);
  assert.match(page, /Streaming \$10\/BAN/);
  assert.match(page, /Portabilidad \$\$\{amount\}/);
  assert.match(page, /BR porta \$\$\{amount\}/);
  assert.match(page, /Balance hasta \$800/);
  assert.match(page, /row\.evento==='portabilidad'&&row\.oferta\.beneficio!=='gratis'/);
  assert.match(page, /excepto equipos gratis/);
  assert.match(page, /selectedPortabilidadCreditRows/);
  assert.match(page, /Creditos\/bonos adicionales/);
  assert.match(page, /lineBonusCredits\(row\)/);
});

test('Oferta const arma comparativa editable antes del documento final', () => {
  assert.match(page, /Propuesta Comercial/);
  assert.match(page, /commercial-proposal/);
  assert.match(page, /cpCommercialMarkup/);
  assert.match(page, /Plan actual/);
  assert.match(page, /Oferta nueva calculada/);
  assert.match(page, /cp-cards/);
  assert.match(page, /function comparisonData/);
  assert.match(page, /function downloadComparisonHtml/);
  assert.match(page, /function printComparison/);
  assert.match(page, /Descargar HTML/);
  assert.match(page, /Descargar Excel/);
  assert.match(page, /Imprimir \/ guardar PDF/);
  assert.match(page, /Plan regular sin debito/);
  assert.match(page, /Plan con AutoPay/);
  assert.match(page, /Total mensual propuesta/);
  assert.match(page, /Plan \+ equipos \+ servicios \+ seguro \+ fijo\/TV/);
  assert.doesNotMatch(page, /<span>Diferencia<\/span>/);
});

test('Comparativa usa precios automaticos y descuento de debito automatico', () => {
  assert.match(page, /function planMonthlyCost/);
  assert.match(page, /function planRegularTotal/);
  assert.match(page, /function planAutopayTotal/);
  assert.match(page, /function debitDiscountTotal/);
  assert.match(page, /Descuento debito automatico/);
  assert.match(page, /plus:\{regular:\[65,110,130,160,175,210,245,280,315,350\],autopay:\[55,90,100,120,125,150,175,200,225,250\]\}/);
  assert.match(page, /PLAN_INDIVIDUAL_TOTALS/);
  assert.match(page, /planAutopayTotal\(\)-planRegularTotal\(\)/);
  assert.match(page, /Plan regular sin debito/);
  assert.match(page, /Total mensual propuesta/);
  assert.match(page, /Plan \+ equipos \+ servicios \+ seguro \+ fijo\/TV/);
  assert.doesNotMatch(page, /<span>Diferencia<\/span>/);
});

test('Comparativa muestra pago de equipo y notas comerciales aplicables', () => {
  assert.match(page, /Paga equipo/);
  assert.doesNotMatch(page, /<h2>Creditos aparte<\/h2>/);
  assert.doesNotMatch(page, /Aclaraciones comerciales/);
  assert.doesNotMatch(page, /function cpCommercialClarifications/);
  assert.match(page, /Bonos y condiciones/);
  assert.match(page, /function cpBonusConditions/);
  assert.match(page, /function groupedCreditsByKind/);
  assert.match(page, /Bono Streaming:.*\$10\.00 por BAN por 12 meses/);
  assert.match(page, /dividido en 24 creditos/);
  assert.match(page, /Monto indicado para esta linea/);
  assert.match(page, /function tradeInAcceptedSummary/);
  assert.match(page, /Equipos que se reciben/);
  assert.match(page, /Agente de ventas SS Solution/);
  assert.match(page, /@page\{size:letter;margin:\.32in\}/);
  assert.match(page, /function cpMonthlyCreditSummary/);
  assert.match(page, /Total final estimado/);
  assert.match(page, /Credito portabilidad/);
  assert.match(page, /50% del equipo - paga/);
  assert.doesNotMatch(page, /<b>Notas comerciales<\/b>/);
  assert.match(page, /function commercialNotes/);
  assert.match(page, /Convergencia/);
  assert.match(page, /Portabilidad/);
  assert.doesNotMatch(page, /<h2>Opciones de equipo<\/h2>/);
});

test('Comparativa permite seguro por linea y resume lo que paga cada equipo', () => {
  assert.match(page, /function linePaySummary/);
  assert.match(page, /function insuranceForPrice/);
  assert.match(page, /function toggleLineInsurance/);
  assert.match(page, /function selectedLineInsurance/);
  assert.match(page, /Seguro/);
  assert.match(page, /Paga equipo/);
  assert.match(page, /Prima seguro/);
  assert.match(page, /Deducible/);
  assert.match(page, /row\.seguro/);
  assert.match(page, /seguroCosto:selectedLineInsurance/);
});

test('Paso de equipos permite marcar seguro por linea antes de servicios', () => {
  assert.match(page, /Seguro/);
  assert.match(page, /function lineInsuranceCell/);
  assert.match(page, /onchange="toggleLineInsurance\(\$\{i\},this\.checked\)"/);
  assert.match(page, /Prima seguro/);
  assert.match(page, /Deducible/);
  assert.match(page, /Siguiente: servicios y seguro/);
});

test('Servicios muestra solo seguros seleccionados al escoger equipo', () => {
  assert.match(page, /function renderSelectedLineInsuranceSummary/);
  assert.match(page, /Seguros seleccionados por equipo/);
  assert.match(page, /selectedLineInsurance\(\)\.map/);
  assert.doesNotMatch(page, /data-seg=/);
  assert.doesNotMatch(page, /data-seg-qty/);
});

test('Servicios trae precios publicados y suma solo variantes con precio', () => {
  assert.match(page, /SERVICE_PRICE_OPTIONS/);
  assert.match(page, /residencia:\[\{label:'Claro Residencia',precio:4\.50/);
  assert.match(page, /rescate:\[\{label:'Claro Rescate',precio:5\.99/);
  assert.match(page, /'residencia-rescate':\[\{label:'Claro Residencia y Rescate',precio:7\.99/);
  assert.match(page, /advantage:\[\{label:'Claro Advantage',precio:5\.99/);
  assert.match(page, /'advantage-residencia':\[\{label:'Claro Advantage y Residencia',precio:8\.99/);
  assert.match(page, /'advantage-residencia-rescate':\[\{label:'Claro Advantage, Residencia y Rescate',precio:11\.99/);
  assert.match(page, /legal:\[\{label:'Claro Asistencia Legal',precio:9\.99/);
  assert.match(page, /function serviceAppliedOption/);
  assert.match(page, /function selectedServicePrice/);
});

test('Servicios seleccionados se sincronizan antes de calcular la propuesta', () => {
  assert.match(page, /function collectSelectedServices/);
  assert.match(page, /collectSelectedServices\(\);renderProposal\(\)/);
  assert.match(page, /onchange="collectSelectedServices\(\);renderProposal\(\)"/);
  assert.match(page, /serviciosMonthlyTotal\(\){\s*collectSelectedServices\(\);/);
  assert.match(page, /isServiceSelected\(s\.id\)\?'checked':''/);
});

test('Servicios muestra precio y bundle sin selector largo', () => {
  assert.match(page, /function serviceAppliedOption/);
  assert.match(page, /function serviceMetaText/);
  assert.match(page, /class="service-price-line"/);
  assert.match(page, /Precio: \$\{money\(applied\.precio\)\}/);
  assert.match(page, /SOC/);
  assert.match(page, /Bundle/);
  assert.match(page, /RESCATEM/);
  assert.match(page, /LEGALF \/ A851/);
  assert.doesNotMatch(page, /class="service-price-select"/);
  assert.doesNotMatch(page, /data-serv-option/);
  assert.doesNotMatch(page, /Internet 100 Megas \+ Telefonia \+ Claro Residencia/);
});

test('Comparativa permite alternar total mensual con o sin AutoPay', () => {
  assert.match(page, /usarAutopay:true/);
  assert.match(page, /function setAutopayMode/);
  assert.match(page, /id="autopayMode"/);
  assert.match(page, /Calcular con AutoPay/);
  assert.match(page, /state\.usarAutopay\?planAutopayTotal\(\):planRegularTotal\(\)/);
  assert.match(page, /Total mensual propuesta \$\{state\.usarAutopay\?'con AutoPay':'sin AutoPay'\}/);
});

test('Comparativa exporta HTML PDF y Excel sin navegar fuera del constructor', () => {
  assert.match(page, /Ver comparativa/);
  assert.match(page, /Descargar HTML/);
  assert.match(page, /Descargar Excel/);
  assert.match(page, /function downloadComparisonHtml/);
  assert.match(page, /function downloadComparisonExcel/);
  assert.match(page, /function previewComparison/);
  assert.match(page, /application\/vnd\.ms-excel/);
  assert.match(page, /excel-proposal/);
  assert.match(page, /brand-row/);
  assert.match(page, /class="card"/);
  assert.match(page, /function excelSection/);
  assert.match(page, /function excelDataRows/);
  assert.match(page, /document\.createElement\('iframe'\)/);
  assert.doesNotMatch(page, /window\.open/);
});

test('Plan actual editable rellena costo regular por linea sin descuento AutoPay', () => {
  assert.match(page, /PLAN_MULTILINEA_LINE_COSTS/);
  assert.match(page, /function planLineCosts/);
  assert.match(page, /function syncCurrentRowCosts/);
  assert.match(page, /autoCosto/);
  assert.match(page, /plus:\[65,45,20,30,15,35,35,35,35,35\]/);
  assert.match(page, /if\(state\.tipo==='individual'\)return \[planRegularTotal\(\)\]/);
  assert.match(page, /return base/);
  assert.doesNotMatch(page, /base\.map\(v=>Math\.max\(0,Number\(v\|\|0\)-10\)\)/);
  assert.match(page, /state\.currentRows\[i\]\.autoCosto=false/);
});
