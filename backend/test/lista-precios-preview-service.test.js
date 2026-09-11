import test from 'node:test';
import assert from 'node:assert/strict';
import { buildListaPreciosPreview } from '../src/services/listaPreciosPreview.js';

test('Lista de Precios genera reglas con precio como valor versionado', () => {
  const preview = buildListaPreciosPreview({
    sheetNames: ['Finan Equipos Movil', 'Accesorios'],
    items: [
      {
        item_code: '12345H',
        sap_code: '7000001',
        modelo: 'Equipo Uno',
        marca: 'samsung',
        categoria: 'celular',
        precio_regular: 999.99,
        mensualidades: [{ meses: 24, monto: 41.67 }],
      },
      {
        item_code: '54321H',
        sap_code: '7000002',
        modelo: 'Accesorio Uno',
        marca: 'apple',
        categoria: 'accesorio',
        precio_regular: 49.99,
        mensualidades: [{ meses: 6, monto: 8.33 }],
      },
    ],
  });

  assert.equal(preview.total, 2);
  assert.deepEqual(preview.resumen_categorias, { celular: 1, accesorio: 1 });
  assert.deepEqual(preview.resumen_reglas.por_tipo, { precio_equipo: 1, precio_accesorio: 1 });
  assert.deepEqual(preview.resumen_reglas.por_confianza, { confirmado: 2 });

  const equipo = preview.reglas_normalizadas.find((regla) => regla.item_code === '12345H');
  assert.equal(equipo.llave_comercial, '12345H|celular');
  assert.equal(equipo.llave_comercial.includes('999.99'), false);
  assert.equal(equipo.valor.precio_regular, 999.99);
  assert.equal(equipo.accion, 'mantener_o_actualizar_precio_base');
  assert.equal(equipo.estado_publicacion, 'borrador');

  const accesorio = preview.reglas_normalizadas.find((regla) => regla.item_code === '54321H');
  assert.equal(accesorio.tipo_regla, 'precio_accesorio');
  assert.equal(accesorio.valor.precio_regular, 49.99);
});
