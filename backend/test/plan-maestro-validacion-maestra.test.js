import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const report = JSON.parse(await readFile(new URL('../../docs/constructor/validacion-maestra-constructor-local.json', import.meta.url), 'utf8'));

test('validacion maestra cubre los 14 casos solicitados sin produccion ni autoaplica', () => {
  assert.equal(report.ok, true);
  assert.equal(report.entorno, 'local');
  assert.equal(report.produccion, false);
  assert.equal(report.autoaplica, false);
  assert.equal(report.resumen.total_casos, 14);
  assert.equal(report.resumen.fallas, 0);
});

test('caso Business RED Plus S26 usa totales multilínea esperados', () => {
  const s26 = report.casos.find((item) => item.id === 'VM-002');
  assert.ok(s26);
  assert.equal(s26.decision_motor.plan_regular, 350);
  assert.equal(s26.decision_motor.plan_autopay, 250);
  assert.equal(s26.decision_motor.equipos_neto_estimado, 224);
  assert.equal(s26.decision_motor.total_regular_estimado, 574);
  assert.equal(s26.decision_motor.total_autopay_estimado, 474);
});

test('validacion de tres entradas conserva la misma decision Motor', () => {
  assert.deepEqual(report.validacion_tres_entradas.map((item) => item.modo), ['CRM', 'Manual', 'Agente/Consulta']);
  assert.ok(report.validacion_tres_entradas.every((item) => item.equivalente === true));
  assert.ok(report.validacion_tres_entradas.every((item) => item.decision_motor.autoaplica === false));
});

test('bloqueos comerciales quedan aislados y no se resuelven por inferencia', () => {
  const blocked = report.casos.filter((item) => item.status === 'bloqueo_esperado');
  assert.equal(blocked.length, 2);
  assert.ok(blocked.some((item) => item.bloqueos.join(' ').includes('FUENTE_AMBIGUA')));
  assert.ok(blocked.some((item) => item.bloqueos.join(' ').includes('Comparacion anterior')));
  assert.equal(report.resumen.listo_para_promocion, false);
});

test('conclusion permite prueba controlada pero no promocion definitiva', () => {
  assert.equal(report.conclusion, 'LISTO_PARA_PRUEBA_CONTROLADA');
  assert.ok(report.riesgos.some((item) => item.includes('No promover Motor')));
});
