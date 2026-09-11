import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientSearchFilter } from '../src/services/clientSearchQuery.js';

test('un solo termino busca en nombre, empresa, BAN y telefono', () => {
  const { sql, params } = buildClientSearchFilter('CORDERO', 0);

  assert.deepEqual(params, ['%CORDERO%']);
  assert.match(sql, /c\.name ILIKE \$1/);
  assert.match(sql, /c\.business_name ILIKE \$1/);
  assert.match(sql, /bq\.ban_number AS text\) ILIKE \$1/);
  assert.match(sql, /sq\.phone AS text\) ILIKE \$1/);
});

test('nombre y apellido se encuentran en cualquier orden', () => {
  const { sql, params } = buildClientSearchFilter('CORDERO JOSE', 0);

  // cada palabra es su propio parametro y todas deben aparecer
  assert.deepEqual(params, ['%CORDERO%', '%JOSE%']);
  assert.match(sql, /\$1/);
  assert.match(sql, /\$2/);
  assert.match(sql, /\)\s*AND\s*\(/);
});

test('los espacios de mas no rompen la busqueda', () => {
  const { params } = buildClientSearchFilter('  cordero   jose  ', 0);
  assert.deepEqual(params, ['%cordero%', '%jose%']);
});

test('los comodines de SQL se buscan como texto, no como comodin', () => {
  const conPorciento = buildClientSearchFilter('%', 0);
  assert.deepEqual(conPorciento.params, ['%\\%%']);

  const conGuionBajo = buildClientSearchFilter('a_b', 0);
  assert.deepEqual(conGuionBajo.params, ['%a\\_b%']);

  assert.match(conPorciento.sql, /ESCAPE '\\'/);
});

test('respeta parametros ya usados por la consulta', () => {
  const { sql, params } = buildClientSearchFilter('TAQUERIA', 3);

  assert.deepEqual(params, ['%TAQUERIA%']);
  assert.match(sql, /\$4/);
  assert.doesNotMatch(sql, /\$1\b/);
});

test('una busqueda vacia no genera filtro', () => {
  for (const vacio of ['', '   ', null, undefined]) {
    const { sql, params } = buildClientSearchFilter(vacio, 0);
    assert.equal(sql, '');
    assert.deepEqual(params, []);
  }
});

test('se limita la cantidad de terminos para no armar consultas gigantes', () => {
  const muchas = Array.from({ length: 20 }, (_, i) => 'palabra' + i).join(' ');
  const { params } = buildClientSearchFilter(muchas, 0);

  assert.ok(params.length <= 6, 'no debe superar 6 terminos, recibio ' + params.length);
});
