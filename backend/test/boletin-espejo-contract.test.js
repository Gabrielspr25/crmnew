import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const url = (p) => new URL(p, import.meta.url);
const read = (p) => readFile(url(p), 'utf8');

const pyScript = await read('../../scripts/extract_pdf_text.py');
const route = await read('../src/routes/boletinRoutes.js');
const server = await read('../src/server.js');
const html = await read('../../Planes para web/boletin-espejo.html');

test('el script python extrae texto con pdfplumber y NO interpreta montos', () => {
  assert.match(pyScript, /pdfplumber/);
  assert.match(pyScript, /extract_text/);
  assert.match(pyScript, /json\.dumps/);
  // espejo fiel: no debe intentar parsear montos ni condiciones
  assert.doesNotMatch(pyScript, /\$\s*\d/);
  assert.doesNotMatch(pyScript, /re\.(search|findall|match)\([^)]*\\\$/);
});

test('el endpoint recibe el PDF, corre python y devuelve texto', () => {
  assert.match(route, /multer/);
  assert.match(route, /spawn/);
  assert.match(route, /extract_pdf_text\.py/);
  assert.match(route, /extraer-texto/);
  assert.match(route, /requireAuth/);
  // no memoriza datos del boletin
  assert.doesNotMatch(route, /\$\s*\d{2,}/);
});

test('el router de boletin se monta en server.js', () => {
  assert.match(server, /boletinRouter/);
  assert.match(server, /\/api\/boletin/);
});

test('la herramienta HTML sube el PDF y muestra el texto extraido tal cual', () => {
  assert.match(html, /type="file"/);
  assert.match(html, /accept="[^"]*pdf/i);
  assert.match(html, /\/api\/boletin\/extraer-texto/);
  // muestra el texto que devuelve el endpoint (no un catalogo fijo)
  assert.match(html, /texto|paginas/);
});

test('la comparacion lee el constructor en vivo, no una copia', () => {
  // trae la fuente real del constructor para comparar el hueco
  assert.match(html, /\/constructor\/ofertas-logic\.js/);
  assert.match(html, /\/constructor\/oferta-const\.html/);
});

test('REGLA CERO-HARDCODEO: la herramienta no contiene montos ni datos del boletin', () => {
  // Sin montos de dinero escritos a mano (los template literals ${...} no cuentan:
  // son '$' seguido de '{', no de un digito).
  assert.doesNotMatch(html, /\$\s*\d/);            // $60, $200, $150...
  // Sin nombres/condiciones de beneficios copiados del boletin.
  assert.doesNotMatch(html, /3\s*meses\s*gratis/i);
  assert.doesNotMatch(html, /penalidad|affinity|super\s*bundle/i);
  assert.doesNotMatch(html, /bono\s*(de\s*)?streaming/i);
  assert.doesNotMatch(html, /doble\s*(de\s*)?(data|velocidad)/i);
});
