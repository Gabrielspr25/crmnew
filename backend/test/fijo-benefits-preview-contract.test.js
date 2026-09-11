import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('preview de Ofertas Fijo y Benefits expone reglas normalizadas sin conectar Constructor', async () => {
  const route = await readFile(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
  const normalizer = await readFile(new URL('../src/services/fijoBenefitsNormalizer.js', import.meta.url), 'utf8');

  assert.match(route, /normalizeFijoOfferBenefitSources/);
  assert.match(route, /extract_pdf_text\.py/);
  assert.match(route, /reglas_normalizadas:\s*reglasComerciales\.reglas_normalizadas/);
  assert.match(route, /benefits:\s*reglasComerciales\.benefits/);
  assert.match(route, /contradicciones:\s*reglasComerciales\.contradicciones/);
  assert.match(route, /resumen_reglas:\s*reglasComerciales\.resumen_reglas/);
  assert.match(route, /reglas_compuestas:\s*reglasComerciales\.reglas_compuestas/);
  assert.match(route, /relaciones_ambiguas:\s*reglasComerciales\.relaciones_ambiguas/);
  assert.match(route, /resumen_compuestas:\s*reglasComerciales\.resumen_compuestas/);
  assert.match(route, /publicable:\s*planAplicacion\.length > 0 && reglasComerciales\.contradicciones\.length === 0/);
  assert.match(route, /persistCompositeRulesVersion/);
  assert.match(route, /publishApprovedCompositeRulesVersion/);
  assert.match(route, /readCompositeRulesVersion/);
  assert.match(route, /readCurrentPublishedCompositeRules/);
  assert.match(route, /post\('\/planes-fijos\/reglas-compuestas\/persistir'/);
  assert.match(route, /get\('\/planes-fijos\/reglas-compuestas\/:versionId'/);
  assert.match(route, /post\('\/planes-fijos\/reglas-compuestas\/:versionId\/publicar-local'/);
  assert.match(route, /get\('\/planes-fijos\/reglas-compuestas-publicadas\/vigente'/);
  assert.match(route, /version_vigente_no_disponible/);
  assert.match(route, /estado_publicacion_no_autorizado/);
  assert.match(route, /\['borrador', 'validada', 'aprobada'\]\.includes\(estadoPublicacion\)/);
  assert.doesNotMatch(route, /constructor/i);

  assert.match(normalizer, /estado_confianza/);
  assert.match(normalizer, /aplicacion_automatica/);
  assert.match(normalizer, /no_determinado/);
  assert.match(normalizer, /cambio_precio_oficial/);
  assert.match(normalizer, /oferta_temporal/);
  assert.match(normalizer, /reglas_compuestas/);
});
