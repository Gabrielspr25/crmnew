import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const frontendPath = process.env.FRONTEND_HTML_PATH
  ? resolve(process.env.FRONTEND_HTML_PATH)
  : resolve(process.cwd(), '..', 'frontend', 'app.html');

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
  assert.match(html, /function ofRenderModuleShell\(/);
  assert.match(html, /function ofRenderCatalogoBase\(/);
  assert.match(html, /async function ofRenderBody\(\)/);
  assert.match(html, /guarda la fuente internamente/i);
  assert.match(html, /sigue usando la ultima version publicada/i);
});

test('Admin Ofertas conecta Analizar de Fijo con fuente y preview base reales', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /id="ofBaseDocumento_/);
  assert.match(html, /onclick="ofAnalizarCatalogoBase\(\\'/);
  assert.match(html, /async function ofAnalizarCatalogoBase\(key\)/);
  assert.match(html, /fd\.append\('familia',ofModuleSourceFamily\(key\)\)/);
  assert.match(html, /apiForm\('\/api\/fuentes-comerciales',fd\)/);
  assert.match(html, /fcBaseFuente=r\.fuente/);
  assert.match(html, /api\('\/api\/fuentes-comerciales\/'\+fcBaseFuente\.id\+'\/preview-base',\{method:'POST',body:fcBasePreviewRequestBody\(''\)\}\)/);
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
  assert.match(html, /fcBaseTab=key==='moviles'\?'movil'/);
  assert.match(html, /Revisa Planes Moviles antes de guardar borrador/);
});

test('Admin Ofertas conecta Analizar de Inalambrico al archivo oficial sin vista previa de Fijo', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /\['inalambrico_iot','Inalambrico \/ IoT'\]/);
  assert.match(html, /if\(key==='inalambrico_iot'\)\{/);
  assert.match(html, /publicacion\.modulos/);
  assert.match(html, /Inalambrico actualizado/);
  assert.match(html, /if\(!\['fijo','claro_tv','moviles','inalambrico_iot','lista_precios'\]\.includes\(key\)\)/);
  assert.match(html, /if\(!\['fijo','claro_tv','moviles','inalambrico_iot','lista_precios'\]\.includes\(key\)\)return/);
});

test('Admin Ofertas separa ofertas vigentes de catalogos base', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /function ofRenderOfertasVigentes\(/);
  assert.match(html, /Ofertas Moviles/);
  assert.match(html, /Ofertas Fijo/);
  assert.match(html, /Benefits/);
  assert.match(html, /Agente Movil/);
  assert.match(html, /Agente Fijo/);
  assert.match(html, /Agente Benefits/);
  assert.match(html, /Maneja: Excel de ofertas, PDF de terminos/);
  assert.match(html, /Maneja: boletines de fijo/);
  assert.match(html, /Maneja: descuentos, convergencia, meses gratis/);
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
  assert.match(html, /La version anterior sigue publicada hasta confirmar la nueva/i);
  assert.match(html, /No publica automaticamente/i);
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
