import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const report = JSON.parse(await readFile(new URL('../../docs/constructor/preview-lista-precios-plan-maestro.json', import.meta.url), 'utf8'));

test('preview de lista de precios vigente usa fuente oficial de septiembre sin publicar', () => {
  assert.match(report.fuente.nombre, /Lista de Precios 3 de septiembre al 28 de octubre de 2026/);
  assert.match(report.fuente.sha256, /^[A-F0-9]{64}$/);
  assert.equal(report.fuente.sha256, '7292BE168C2134EEFCACE773FE4C34EF62EF5FA4CCCDFD4C2BDB9EF705987538');
});

test('preview reconoce catalogo por item code y no incluye precio en la llave comercial', () => {
  assert.ok(report.preview.total > 0);
  assert.equal(report.catalogo_canonico.total_item_codes, report.preview.total);
  const sample = report.preview.reglas_normalizadas[0];
  assert.ok(sample.llave_comercial.includes(sample.item_code));
  assert.equal(sample.llave_comercial.includes(String(sample.valor.precio_regular)), false);
  assert.equal(sample.estado_publicacion, 'borrador');
});

test('preview cubre celulares, tabletas/modems o accesorios cuando la fuente los contiene', () => {
  const categorias = report.catalogo_canonico.categorias;
  assert.ok(Object.values(categorias).reduce((sum, value) => sum + value, 0) === report.preview.total);
  assert.ok(categorias.celular || categorias.tablet || categorias.modem || categorias.accesorio);
});
