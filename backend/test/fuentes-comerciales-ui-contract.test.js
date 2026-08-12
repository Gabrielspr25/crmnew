import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appHtml = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

test('Fuentes comerciales expone las familias correctas para fijo y beneficios', () => {
  const familiasBlock = appHtml.match(/const FC_FAMILIAS=\[([\s\S]*?)\];/)?.[1] || '';

  assert.match(familiasBlock, /\['ofertas_fijo','Ofertas fijo'\]/);
  assert.match(familiasBlock, /\['beneficios','Beneficios'\]/);
  assert.doesNotMatch(familiasBlock, /\['convergencia','Convergencia'\]/);
});

test('Fuentes comerciales no reutiliza el nombre de la función preview como estado', () => {
  assert.doesNotMatch(appHtml, /let\s+[^;]*\bfcPreviewPlanesFijos\s*=/);
  assert.match(appHtml, /let\s+[^;]*\bfcPreviewPlanesFijosData\s*=/);
  assert.match(appHtml, /async function fcPreviewPlanesFijos\(/);
});
