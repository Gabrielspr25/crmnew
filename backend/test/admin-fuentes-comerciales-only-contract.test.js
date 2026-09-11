import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const frontendPath = process.env.FRONTEND_HTML_PATH
  ? resolve(process.env.FRONTEND_HTML_PATH)
  : resolve(process.cwd(), '..', 'frontend', 'app.html');
const fuentesRoutePath = resolve(process.cwd(), 'src', 'routes', 'fuentesComercialesRoutes.js');

test('Admin Ofertas muestra los modulos base del portal sin Fuentes comerciales visible', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /const OF_TABS=\[/);
  for (const label of ['Fijo', 'Claro TV', 'Planes Moviles', 'Inalambrico / IoT', 'Lista de Precios', 'Servicios', 'Directorio de Fijo', 'Ofertas Vigentes']) {
    assert.match(html, new RegExp(`\\['[^']+','${label}'\\]`));
  }
  assert.doesNotMatch(html, /\['fuentes','Fuentes comerciales'\]/);
  assert.doesNotMatch(html, /<h3 style="margin:0">Fuentes comerciales<\/h3>/);
});

test('Admin Ofertas renderiza por modulo y conserva fuente interna', async () => {
  const html = await readFile(frontendPath, 'utf8');
  assert.match(html, /Admin Ofertas — Centro de Cargas/);
  assert.match(html, /Sube, revisa cambios y publica\. Solo ves lo que requiere tu atención\./);
  assert.match(html, /function ofRenderProcessSteps\(/);
  assert.match(html, /function ofRenderCenterQueue\(/);
  assert.match(html, /function ofBuildCenterRows\(/);
  assert.match(html, /\.of-center-page/);
  assert.match(html, /\.of-stepper\{height:82px/);
  assert.match(html, /\.of-center-layout\{display:grid;grid-template-columns:280px minmax\(0,1fr\);gap:16px/);
  assert.match(html, /function ofRenderCenterMain\(/);
  assert.match(html, /function ofAbrirVersionPublicada\(/);
  assert.match(html, /function ofAbrirDetallePublicacion\(/);
  assert.match(html, /function ofRenderVersionModal\(/);
  assert.match(html, /Ver documento/);
  assert.match(html, /id="ofVersionDocumentoFrame"/);
  assert.match(html, /of-document-viewer/);
  assert.match(html, /var fuenteId=fuente\.id\|\|p\.fuente_comercial_id\|\|''/);
  assert.match(html, /var documentoUrl=fuenteId\?ofDocumentoUrl\(fuenteId,true\):ofDocumentoPublicacionUrl\(publicacionId,true\)/);
  assert.match(html, /async function ofCargarDocumentoOriginal\(documentoUrl\)/);
  assert.match(html, /headers:\{Authorization:'Bearer '\+token\}/);
  assert.match(html, /URL\.createObjectURL\(blob\)/);
  assert.match(html, /inline=1/);
  assert.match(html, /No se pudo cargar el documento original/);
  assert.doesNotMatch(html, /id="ofVersionDatos"/);
  assert.match(html, /Ver borrador/);
  assert.match(html, /#f4f8ff/);
  assert.match(html, /\.of-center-page \.btn\{background:#5FAD1F/);
  assert.match(html, /\.of-center-page \.btn\.of-document-btn\{background:#6D1FAD/);
  assert.match(html, /class="btn of-document-btn"[^>]*>Abrir documentos<\/button>/);
  assert.match(html, /class="of-center-page"/);
  assert.match(html, /Requiere atención/);
  assert.match(html, /Todo al día/);
  assert.doesNotMatch(html, /<aside id="ofCenterRight"/);
  assert.match(html, /No se encontraron fuentes que requieran atención/);
  assert.doesNotMatch(html, /var tabs=OF_TABS\.map/);
  assert.match(html, /function ofRenderModuleShell\(/);
  assert.match(html, /function ofRenderCatalogoBase\(/);
  assert.match(html, /async function ofRenderBody\(\)/);
  assert.match(html, /guarda la fuente internamente/i);
  assert.match(html, /sigue usando la ultima version publicada/i);
});

test('Admin Ofertas abre publicaciones vigentes en modo solo lectura', async () => {
  const html = await readFile(frontendPath, 'utf8');
  const route = await readFile(fuentesRoutePath, 'utf8');

  assert.match(html, /ofPublishedCategoriaForModule\(key\)/);
  assert.match(html, /api\('\/api\/fuentes-comerciales\/bases-informativas\/'\+encodeURIComponent\(publicacion\.id\)\)/);
  assert.match(html, /api\('\/api\/fuentes-comerciales\/bases-informativas\/historial\?categoria='\+encodeURIComponent\(categoria\)\)/);
  assert.match(html, /function ofDocumentoUrl\(fuenteId,inline\)/);
  assert.match(html, /function ofDocumentoPublicacionUrl\(publicacionId,inline\)/);
  assert.match(html, /function ofDocumentosPublicacionUrl\(publicacionId\)/);
  assert.match(html, /function ofDocumentosModuloUrl\(key\)/);
  assert.match(html, /async function ofCargarDocumentosPublicacion\(publicacionId,modulo\)/);
  assert.match(html, /function ofRenderDocumentosPublicacion\(documentos\)/);
  assert.match(html, /ofSeleccionarDocumentoPublicado/);
  assert.match(html, /data-doc-tipo/);
  assert.match(html, /ofSeleccionarDocumentoPublicado\(this\.dataset\.docUrl,this\.dataset\.docTipo\)/);
  assert.match(html, /var isPdf=tipo==='pdf'\|\|\/application\\\/pdf\/\.test\(tipo\)\|\|\/\\\.pdf/);
  assert.match(html, /onclick="ofAbrirVersionPublicada\(\\'/);
  assert.match(html, /ofAbrirFuenteLocal\(key\)/);
  assert.match(html, /ofCrearDocumentoBlobUrl\(documentoUrl\)\.then\(function\(url\)\{window\.open\(url/);
  assert.match(route, /fuentesComercialesRouter\.get\('\/bases-informativas\/:id\/documento', requireAdmin/);
  assert.match(route, /fuentesComercialesRouter\.get\('\/bases-informativas\/:id\/documentos', requireAdmin/);
  assert.match(route, /fuentesComercialesRouter\.get\('\/modulos\/:key\/documentos', requireAdmin/);
  assert.match(route, /resolvePublicationDocuments/);
  assert.match(route, /findLegacyDocumentBySha/);
  assert.match(route, /findLegacyDocumentsByPublicationName/);
  assert.match(route, /preferPdfDocuments/);
  assert.match(route, /LEGACY_BASE_DOCUMENT_DIRS/);
  assert.match(route, /fuentesComercialesRouter\.get\('\/:id\/documento', requireAdmin/);
  assert.match(route, /if \(!UUID_RE\.test\(id\)\) return res\.status\(400\)/);
  assert.match(route, /req\.query\.inline/);
  assert.match(route, /Content-Disposition', `inline;/);
  assert.match(route, /fuentesComercialesRouter\.get\('\/bases-informativas\/:id', requireAdmin/);
  assert.match(route, /candidatos_publicos/);
  assert.match(route, /modulos_generados/);
  assert.match(route, /function sendDocumentFile\(req, res, documentInfo\)/);
  assert.match(route, /res\.download\(filePath, filename\)/);
});

test('Ofertas Vigentes separa la carga operativa de su biblioteca documental por dominio', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /async function ofAbrirBibliotecaOfertas\(\)/);
  assert.match(html, /Oferta Fijo/);
  assert.match(html, /Ofertas M[oó]viles/);
  assert.match(html, /Beneficios/);
  assert.match(html, /function ofBibliotecaEstadoDocumento\(/);
  assert.match(html, /Falta documento oficial/);
  assert.match(html, /function ofAbrirCargaOfertas\(familia\)/);
  assert.match(html, /id="ofCenterMain"/);
  assert.match(html, /if\(body\)body\.style\.display='block';/);
  assert.match(html, /if\(key==='ofertas_vigentes'\)\{ofAbrirCargaOfertas\(\);return;\}/);
  assert.match(html, /Cargar boletín de beneficios/);
  assert.match(html, /id="ofBibliotecaAccion"/);
  assert.match(html, /id="ofCargaCard_'\+esc\(f\.key\)\+'"/);
  assert.match(html, /function ovAnalizar\(key\)/);
  assert.match(html, /Guardar borrador/);
  assert.match(html, /Ver documentos/);
});

test('Admin Ofertas conecta Analizar de Fijo con fuente y preview base reales', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /id="ofBaseDocumento_/);
  assert.match(html, /onclick="ofAnalizarCatalogoBase\(\\'/);
  assert.match(html, /async function ofAnalizarCatalogoBase\(key\)/);
  assert.match(html, /fd\.append\('familia',ofModuleSourceFamily\(key\)\)/);
  assert.match(html, /apiForm\('\/api\/fuentes-comerciales',fd\)/);
  assert.match(html, /fcBaseFuente=r\.fuente/);
  assert.match(html, /api\('\/api\/fuentes-comerciales\/'\+fcBaseFuente\.id\+'\/preview-base',\{method:'POST',body:fcBasePreviewRequestBody\(fechaDetectada\)\}\)/);
  assert.doesNotMatch(html, /if\(!fecha\)\{alert\('Ingres/);
});

test('Admin Ofertas recupera la ultima fuente base al refrescar el modulo', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /async function ofLoadCatalogoBaseState\(key\)/);
  assert.match(html, /ofLoadCatalogoBaseState\(key\)/);
  assert.match(html, /api\('\/api\/fuentes-comerciales\?familia='\+encodeURIComponent\(family\)\)/);
  assert.match(html, /fcBaseFuente=fuente/);
  assert.match(html, /Puedes generar vista previa sin volver a subir/);
  assert.match(html, /fcLoadBaseHistorial\(\)/);
});

test('Admin Ofertas trata Planes Moviles como base movil compuesta y no como Fijo Claro TV', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /let fcBaseFuente=.*fcBaseModuleKey='fijo'.*fcBaseCompanionIds=\[\]/);
  assert.match(html, /function fcBaseCategoriasActivas\(/);
  assert.match(html, /fcBaseModuleKey==='moviles'/);
  assert.match(html, /Planes Moviles'/);
  assert.match(html, /function fcBasePreviewRequestBody/);
  assert.match(html, /fuente_ids:fcBaseCompanionIds/);
  assert.match(html, /async function ofMovilCompanionIds/);
  assert.match(html, /BYOP/i);
  assert.match(html, /fcBaseTab=fcBaseTabForModule\(key\)/);
  assert.match(html, /Revisa Planes Moviles antes de guardar borrador/);
});

test('Planes Moviles base acepta solo PDF y sus errores no mencionan Fijo Claro TV', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /if\(key==='fijo'\)return ofRenderModuleShell\(\{key:key,title:title,accept:'\.pdf'/);
  assert.match(html, /if\(key==='claro_tv'\)return ofRenderModuleShell\(\{key:key,title:title,accept:'\.pdf'/);
  assert.match(html, /if\(key==='moviles'\)return ofRenderModuleShell\(\{key:key,title:title,accept:'\.pdf'/);
  assert.match(html, /fcMensajeApi\(e,key\)/);

  const source = html.match(/function fcMensajeApi\(e,key\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'fcMensajeApi debe aceptar el modulo activo');
  const context = {};
  vm.runInNewContext(source, context);
  assert.equal(
    context.fcMensajeApi(new Error('/api/fuentes-comerciales -> 422 fuente_moviles_base_incompatible'), 'moviles'),
    'Ese PDF corresponde a ofertas o accesorios. Cargalo en Ofertas Vigentes > Ofertas Moviles; Planes Moviles base usa el PDF de planes vigentes.'
  );
  assert.equal(
    context.fcMensajeApi(new Error('/api/fuentes-comerciales -> 422 formato_base_pdf_invalido'), 'fijo'),
    'Este catalogo base requiere el PDF oficial. Las tablas Excel van en Lista de Precios u Ofertas Vigentes segun corresponda.'
  );
  const message = context.fcMensajeApi(new Error('/api/fuentes-comerciales/83f17d67-8a8f-453b-84c3-40364d028d20/preview-base -> 422'), 'moviles');
  assert.equal(message, 'El documento no pudo procesarse como base de Planes Moviles. Usa el PDF oficial de planes vigentes; las tablas Excel de ofertas y financiamiento van en Ofertas Vigentes > Ofertas Moviles.');
  assert.doesNotMatch(message, /Fijo|Claro TV/);
});

test('Backend bloquea formatos equivocados antes de guardar fuentes base', async () => {
  const route = await readFile(fuentesRoutePath, 'utf8');

  assert.match(route, /const BASE_PDF_FAMILIES = new Set\(\['fijos', 'claro_tv', 'moviles', 'inalambrico_iot'\]\)/);
  assert.match(route, /function baseCatalogUploadError\(familia, originalName\)/);
  assert.match(route, /formato_base_pdf_invalido/);
  assert.match(route, /fuente_moviles_base_incompatible/);
  assert.match(route, /nuevas\?\\s\+ofertas\|accesorios/i);
  assert.match(route, /const baseUploadError = baseCatalogUploadError\(familia, req\.file\.originalname\)/);
  assert.match(route, /if \(baseUploadError\) return res\.status\(422\)\.json\(\{ ok: false, \.\.\.baseUploadError \}\)/);
});

test('Planes Moviles detecta fecha del boletin antes de pedir fecha manual', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /function ofCatalogoBaseFechaDetectada\(key,fileInput\)/);
  assert.match(html, /var fechaDetectada=ofCatalogoBaseFechaDetectada\(key,fileInput\)/);
  assert.match(html, /if\(fechaDetectada&&\$\('ofBaseHasta_'\+key\)\)\$\('ofBaseHasta_'\+key\)\.value=fechaDetectada/);
  assert.match(html, /body:fcBasePreviewRequestBody\(fechaDetectada\)/);
  assert.match(html, /function fcBaseFechaDetectada\(\)/);
  assert.match(html, /var fecha=String\(\$\('fcBaseFecha'\)&&\$\('fcBaseFecha'\)\.value\|\|fcBaseFechaDetectada\(\)\|\|''\)\.trim\(\)/);
});

test('Admin Ofertas conecta Analizar de Inalambrico al archivo oficial sin vista previa de Fijo', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /\['inalambrico_iot','Inalambrico \/ IoT'\]/);
  assert.match(html, /if\(key==='lista_precios'\|\|key==='inalambrico_iot'\)fd\.append\('publicacion_modo','borrador'\)/);
  assert.match(html, /fcBaseModuleKey==='inalambrico_iot'\?\[\['inalambrico','Inalambrico \/ IoT'\]\]/);
  assert.match(html, /key==='inalambrico_iot'\?'inalambrico'/);
  assert.match(html, /Revisa Inalambrico \/ IoT antes de guardar borrador/);
  assert.match(html, /fcBaseModuleKey==='inalambrico_iot'\?\['inalambrico'\]/);
  assert.doesNotMatch(html, /Inalambrico actualizado/);
  assert.doesNotMatch(html, /publicacion\.modulos/);
  assert.match(html, /if\(!\['fijo','claro_tv','moviles','inalambrico_iot','lista_precios'\]\.includes\(key\)\)/);
  assert.match(html, /if\(!\['fijo','claro_tv','moviles','inalambrico_iot','lista_precios'\]\.includes\(key\)\)return/);
});

test('Admin Ofertas separa ofertas vigentes de catalogos base', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /function ofRenderOfertasVigentes\(/);
  assert.match(html, /Ofertas Moviles/);
  assert.match(html, /Ofertas Fijo/);
  assert.match(html, /Beneficios/);
  assert.match(html, /Agente Movil/);
  assert.match(html, /Agente Fijo/);
  assert.match(html, /Agente de Beneficios/);
  assert.match(html, /El Excel trae la tabla; el PDF confirma condiciones/);
  assert.match(html, /Maneja: boletines de fijo/);
  assert.match(html, /catálogo consolidado desde Ofertas Móviles, Ofertas Fijo e Inalámbrico \/ IoT/);
  assert.match(html, /Sube juntos el Excel de ofertas y el PDF oficial de terminos/i);
  assert.match(html, /Beneficios es el catálogo consolidado desde Ofertas Móviles, Ofertas Fijo e Inalámbrico \/ IoT/i);
  assert.match(html, /No subas beneficios como una copia manual independiente/i);
  assert.match(html, /Vigencia desde/);
  assert.match(html, /Hasta nuevo boletin/);
  assert.match(html, /ovSinHasta_/);
  assert.match(html, /vigencia_hasta:\(sinHasta&&sinHasta\.checked\)\?'hasta_nuevo_boletin'/);
  assert.match(html, /Excel de ofertas/);
  assert.match(html, /PDF de terminos/);
  assert.match(html, /id="ovExcel_ofertas_moviles"/);
  assert.match(html, /id="ovPdf_ofertas_moviles"/);
  assert.match(html, /function ovFiles/);
  assert.match(html, /function ovLeerBorrador/);
  assert.match(html, /function ovMergeDocumentos/);
  assert.match(html, /ovRenderBorradorResumen/);
  assert.match(html, /Documentos en borrador/);
  assert.match(html, /onclick="ovAnalizar/);
  assert.match(html, /onclick="ovGuardarBorrador/);
  assert.match(html, /function ovDetectarVigenciaHasta/);
  assert.match(html, /desdeMatch/);
  assert.match(html, /rangoMes/);
  assert.match(html, /compact/);
  assert.match(html, /function ovGuardarBorrador/);
  assert.match(html, /Borrador guardado/);
  assert.match(html, /Falta PDF de terminos y condiciones/);
  assert.match(html, /Vigencia pendiente de detectar desde el PDF/);
  assert.match(html, /Excel y PDF recibidos/);
  assert.match(html, /La versión anterior sigue publicada hasta confirmar la nueva/i);
  assert.match(html, /No publica automaticamente/i);
});

test('Admin Ofertas integra Benefits publicados como una vista de lectura real', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /\['benefits','Beneficios'\]/);
  assert.match(html, /api\('\/api\/fuentes-comerciales\/benefits-vigentes'\)/);
  assert.match(html, /function ofRenderBenefitsMain\(/);
  assert.match(html, /Buscar beneficios/);
  assert.match(html, /Todas las categorias/);
  assert.match(html, /Todos los estados/);
  assert.match(html, /onclick="ofBenefitsAbrirDetalle/);
  assert.match(html, /ofBenefitsAbrirDocumento/);
  assert.match(html, /ofBenefitsAbrirHistorial/);
  assert.match(html, /ofBenefitsDocumentStatus/);
  assert.match(html, /Falta documento oficial/);
  assert.match(html, /<th>Documento<\/th>/);
  assert.doesNotMatch(html, /<th>Accion<\/th>/);
  assert.match(html, /window\.open\('about:blank','_blank'\)/);
  assert.match(html, /No hay documento original archivado para este beneficio/);
  assert.match(html, /function ofCenterOpenAction\(r\)\{\s*return 'ofSetTab/);
  assert.doesNotMatch(html, /Nuevo beneficio/);
});

test('Fuentes comerciales restaura listado y flujo de bases informativas', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /<div id="fcLista">/);
  assert.match(html, /fcLoadFuentes\(\);/);
  assert.match(html, /<th>Archivo<\/th><th>Familia<\/th><th>Tipo<\/th><th>Fecha<\/th><th>Usuario<\/th><th>Hash<\/th><th>Estado<\/th><th>Base informativa<\/th>/);
  assert.match(html, /fcFamiliaLabel\(f\.familia\)/);
  assert.match(html, /fcDocumentoTipoLabel\(f\.documento_tipo\)/);
  assert.match(html, /fcFechaFuente\(f\.creado_en\)/);
  assert.match(html, /fcEstadoFuenteLabel\(f\.estado\)/);
  assert.match(html, /Generar vista previa/);
  assert.match(html, /fecha_actualizacion_base/);
  assert.match(html, /Guardar borrador/);
  assert.match(html, /Validar/);
  assert.match(html, /Aprobar/);
  assert.match(html, /Publicar/);
  assert.ok(html.includes("fcBaseTransicion(\\'publicar\\')"));
  assert.match(html, /let fcBaseFuente=.*fcBaseMessage=''/);
  assert.match(html, /Primero gener[aá] la vista previa/i);
  assert.match(html, /Borrador guardado/i);
  assert.match(html, /fcHydrateBaseDraftsFromHistorial/);
  assert.match(html, /Transici[oó]n aplicada/i);
  assert.match(html, /No hay borrador activo/i);
  assert.match(html, /function fcFuenteVersionadoMensaje\(/);
  assert.match(html, /Archivo id[eé]ntico/i);
  assert.match(html, /Nueva revisi[oó]n detectada/i);
  assert.match(html, /mismo SHA-256/i);
  assert.match(html, /if\(\['equipos','inalambrico_iot'\]\.includes\(familia\)\)fd\.append\('publicacion_modo','borrador'\)/);
  assert.match(html, /\['fijos','claro_tv','ofertas_fijo','moviles','inalambrico_iot'\]\.includes\(f\.familia\)/);
  assert.match(html, /fcBaseModuleKey=fcModuleKeyForFuente\(fcBaseFuente\)/);
  assert.match(html, /function fcModuleKeyForFuente\(fuente\)/);
  assert.doesNotMatch(html, /if\(!fecha\)return/);
  assert.doesNotMatch(html, /var pub=fcBasePublicacionActual\(\); if\(!pub\)return/);
  assert.doesNotMatch(html, /<b>Contenido excluido<\/b>/);
  assert.doesNotMatch(html, /Aprobar versión definitiva/);
});

test('Vista previa de Fijo muestra columnas completas despues de tecnologia', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /Min\. adicional/);
  assert.match(html, /Instalaci[oó]n/);
  assert.match(html, /Activaci[oó]n/);
  assert.match(html, /Penalidad/);
  assert.match(html, /function fcMontoBase\(/);
  assert.match(html, /function fcCargoPlazos\(/);
  assert.match(html, /r\.minuto_adicional/);
  assert.match(html, /r\.instalacion/);
  assert.match(html, /r\.activacion/);
  assert.match(html, /r\.penalidad/);
});
