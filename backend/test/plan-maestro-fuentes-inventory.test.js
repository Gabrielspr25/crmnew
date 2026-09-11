import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const inventory = JSON.parse(await readFile(new URL('../../docs/constructor/inventario-fuentes-plan-maestro.json', import.meta.url), 'utf8'));

function sourceByName(fragment) {
  const normalized = fragment.toLowerCase();
  return inventory.fuentes.find(item => item.nombre.toLowerCase().includes(normalized));
}

test('inventario de fuentes conserva evidencia local con hashes verificables', () => {
  assert.ok(inventory.generated_at);
  assert.ok(inventory.resumen.total_fuentes >= 20);
  assert.ok(inventory.resumen.por_origen.archivo_newcrm >= 1);
  assert.ok(inventory.resumen.por_origen.boletines_vigentes_dropbox >= 1);

  for (const item of inventory.fuentes) {
    assert.match(item.sha256, /^[A-F0-9]{64}$/);
    assert.ok(item.dominio_inferido);
    assert.ok(item.estado_archivo_newcrm);
    assert.equal(item.estado_publicacion, 'no_determinado_por_inventario');
  }
});

test('inventario incluye lista de precios vigente de septiembre y hojas Excel', () => {
  const source = sourceByName('Lista de Precios 3 de septiembre al 28 de octubre de 2026');
  assert.ok(source);
  assert.equal(source.dominio_inferido, 'lista_precios');
  assert.equal(source.extension, '.xlsx');
  assert.ok(source.hojas_excel.length > 0);
  assert.equal(source.estado_archivo_newcrm, 'no_archivado_por_hash');
});

test('inventario incluye tabla de ofertas 27 de agosto y revision RV separada', () => {
  const original = sourceByName('Tabla Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026- PYMES.xlsx');
  const revision = sourceByName('Tabla Ofertas Update Plus y Financiamiento 27 de agosto al 16 de septiembre de 2026- PYMES-rv.xlsx');
  assert.ok(original);
  assert.ok(revision);
  assert.equal(original.dominio_inferido, 'ofertas_financiamiento');
  assert.equal(revision.dominio_inferido, 'ofertas_financiamiento');
  assert.notEqual(original.sha256, revision.sha256);
});

test('inventario detecta fuentes de tabletas/modems e inalambrico IoT', () => {
  const tablets = sourceByName('Descuentos Modems, MIFI y Tablets');
  const iot = sourceByName('Boletin INT Go, Claro Oficina y IoT 1al30sept2026');
  assert.ok(tablets);
  assert.ok(iot);
  assert.equal(tablets.dominio_inferido, 'tabletas_modems_mifi');
  assert.equal(iot.dominio_inferido, 'inalambrico_iot');
});
