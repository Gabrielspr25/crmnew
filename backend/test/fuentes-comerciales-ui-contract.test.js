import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Fuentes comerciales expone las familias correctas para fijo y beneficios', () => {
  const familiasBlock = appHtml.match(/const FC_FAMILIAS=\[([\s\S]*?)\];/)?.[1] || '';

  assert.match(familiasBlock, /\['ofertas_fijo','Ofertas fijo'\]/);
  assert.match(familiasBlock, /\['ofertas_moviles','Ofertas móviles'\]/);
  assert.match(familiasBlock, /\['beneficios','Beneficios'\]/);
  assert.doesNotMatch(familiasBlock, /\['convergencia','Convergencia'\]/);
});

test('Lista de fuentes muestra metadatos operativos y etiqueta Ofertas móviles', () => {
  assert.match(appHtml, /function fcFamiliaLabel\(value\)/);
  assert.match(appHtml, /return item\?item\[1\]/);
  assert.match(appHtml, /function fcDocumentoTipoLabel\(value\)/);
  assert.match(appHtml, /function fcEstadoFuenteLabel\(value\)/);
  assert.match(appHtml, /function fcFechaFuente\(value\)/);
  assert.match(appHtml, /<th>Archivo<\/th><th>Familia<\/th><th>Tipo<\/th><th>Fecha<\/th><th>Usuario<\/th><th>Hash<\/th><th>Estado<\/th>/);
  assert.match(appHtml, /fcFamiliaLabel\(f\.familia\)/);
  assert.match(appHtml, /fcDocumentoTipoLabel\(f\.documento_tipo\)/);
  assert.match(appHtml, /fcFechaFuente\(f\.creado_en\)/);
  assert.match(appHtml, /fcEstadoFuenteLabel\(f\.estado\)/);
  assert.match(appHtml, /f\.subido_por/);
  assert.match(appHtml, /f\.sha256/);
});

test('Fuentes comerciales no reutiliza el nombre de la función preview como estado', () => {
  assert.doesNotMatch(appHtml, /let\s+[^;]*\bfcPreviewPlanesFijos\s*=/);
  assert.match(appHtml, /let\s+[^;]*\bfcPreviewPlanesFijosData\s*=/);
  assert.match(appHtml, /async function fcPreviewPlanesFijos\(/);
});
