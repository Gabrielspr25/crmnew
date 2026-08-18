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

test('Admin Ofertas separa ofertas vigentes de catalogos base', async () => {
  const html = await readFile(frontendPath, 'utf8');

  assert.match(html, /function ofRenderOfertasVigentes\(/);
  assert.match(html, /Ofertas Moviles/);
  assert.match(html, /Ofertas Fijo/);
  assert.match(html, /Beneficios Convergentes/);
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
  assert.doesNotMatch(html, /Aprobar versión definitiva/);
});
