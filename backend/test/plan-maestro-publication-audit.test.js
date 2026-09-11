import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const audit = JSON.parse(await readFile(new URL('../../docs/constructor/auditoria-publicaciones-plan-maestro.json', import.meta.url), 'utf8'));

function sourceByHash(hash) {
  return audit.cruce_inventario_publicacion.find(item => item.sha256 === hash);
}

test('auditoria de publicaciones es de solo lectura y no decide vigencias por inferencia', () => {
  assert.ok(audit.generated_at);
  assert.equal(audit.database.database, 'crm_pro');
  assert.ok(Array.isArray(audit.cruce_inventario_publicacion));
  assert.ok(audit.cruce_inventario_publicacion.length >= 20);
  assert.ok(audit.resumen);
});

test('auditoria cruza IoT junio archivado e IoT septiembre disponible por hash', () => {
  const junio = sourceByHash('9BC7EC97EB1C6B16F33CCD0B6245C5A37D0F07FBC2304979C38A153B791AAAF7');
  const septiembre = sourceByHash('C302B8EB28036D2B877C907230C887BAB541F5A3A208C633CDEC8D00EA04E076');
  assert.ok(junio);
  assert.ok(septiembre);
  assert.equal(junio.dominio_inferido, 'inalambrico_iot');
  assert.equal(septiembre.dominio_inferido, 'inalambrico_iot');
});

test('auditoria conserva REDPLUS/BREDP como fuentes separadas', () => {
  const sources = audit.cruce_inventario_publicacion.filter(item => item.dominio_inferido === 'business_red_plus');
  assert.ok(sources.length >= 3);
  assert.ok(sources.some(item => item.nombre.includes('260803')));
  assert.ok(sources.some(item => item.nombre.includes('17 marzo')));
});
