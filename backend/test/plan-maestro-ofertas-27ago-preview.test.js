import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const report = JSON.parse(await readFile(new URL('../../docs/constructor/preview-ofertas-27ago-plan-maestro.json', import.meta.url), 'utf8'));

test('preview compara original y RV de ofertas 27 de agosto sin publicar', () => {
  assert.equal(report.fuentes.tabla_original.sha256, 'BC46975EE50C0A33AA1A7474422001F8947DB5F8D7ECD9DB550D18881BEC48B0');
  assert.equal(report.fuentes.tabla_revision.sha256, '0969EB1C4ACD841CF23AFB18C6505A53BFE8EE179431046FFD6712A77F0E82D6');
  assert.notEqual(report.fuentes.tabla_original.sha256, report.fuentes.tabla_revision.sha256);
  assert.ok(report.original.summary.offers > 0);
  assert.ok(report.revision.summary.offers > 0);
});

test('preview detecta BREDP1 $65 en los Excel reales y no resuelve REDPLUS $60 por inferencia', () => {
  assert.equal(report.business_red_plus.original.plan.monto, 65);
  assert.equal(report.business_red_plus.revision.plan.monto, 65);
  assert.notEqual(report.business_red_plus.revision.plan.monto, 60);
});

test('preview Business RED Plus detecta grupos, equipos y vigencia en la RV', () => {
  assert.equal(report.business_red_plus.revision.vigencia.desde, '2026-08-27');
  assert.equal(report.business_red_plus.revision.vigencia.hasta, '2026-09-16');
  assert.ok(report.business_red_plus.revision.grupos >= 1);
  assert.ok(report.business_red_plus.revision.equipos >= 1);
});
