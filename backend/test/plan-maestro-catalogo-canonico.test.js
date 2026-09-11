import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const report = JSON.parse(await readFile(new URL('../../docs/constructor/catalogo-canonico-equipos-local.json', import.meta.url), 'utf8'));

test('catalogo canonico local usa item_code y categoria sin precio en la llave', () => {
  assert.equal(report.ok, true);
  assert.equal(report.resumen.precio_en_llave, false);
  assert.equal(report.resumen.total_registros, 477);
  assert.equal(report.resumen.total_identidades_canonicas, 477);
  assert.equal(report.resumen.duplicados_identidad_canonica, 0);
  for (const item of report.identidades) {
    assert.equal(item.identidad_canonica, `${item.item_code}|${item.familia_canonica}`);
  }
});

test('catalogo canonico separa smartphones tablets modems accesorios y otros', () => {
  const families = report.resumen.por_familia_canonica;
  assert.equal(families.smartphone, 75);
  assert.equal(families.tablet_ipad, 22);
  assert.equal(families.modem_mifi, 8);
  assert.equal(families.accesorio, 159);
  assert.equal(families.pospago, 213);
});

test('modelos repetidos quedan en revision y no se fusionan por inferencia', () => {
  assert.equal(report.modelos_repetidos_sin_fusionar.length, 9);
  assert.ok(report.modelos_repetidos_sin_fusionar.every((item) => item.estado === 'requiere_revision'));
  assert.ok(report.modelos_repetidos_sin_fusionar.every((item) => item.motivo.includes('no se fusiona')));
});
