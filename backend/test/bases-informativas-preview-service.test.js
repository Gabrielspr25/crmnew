import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildBasesInformativasPreviews,
  diffModulosGenerados,
  diffRegistrosGenerados,
} from '../src/services/basesInformativasPreview.js';

const parser = new URL('../../scripts/parse_planes_fijos_pdf.py', import.meta.url);
const pdf = new URL('../../Planes para web/Estructura de planes/planes/LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf', import.meta.url);
const serviceSource = fs.readFileSync(new URL('../src/services/basesInformativasPreview.js', import.meta.url), 'utf8');

const fuente = Object.freeze({
  id: '197f28e0-b553-46f8-8bde-bf15f753b4f7',
  familia: 'fijos',
  nombre_original: 'LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf',
  sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  fecha_actualizacion_base: '2026-03-30',
});

let parsedMemo;

function runParser() {
  if (parsedMemo) return parsedMemo;
  assert.equal(fs.existsSync(fileURLToPath(pdf)), true, 'falta el PDF real de planes fijos');
  const run = spawnSync('python', [fileURLToPath(parser), fileURLToPath(pdf)], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  parsedMemo = JSON.parse(run.stdout);
  return parsedMemo;
}

function buildPreviews(overrides = {}) {
  return buildBasesInformativasPreviews({
    parsed: overrides.parsed || runParser(),
    fuente: overrides.fuente || fuente,
    publicacionesAnteriores: overrides.publicacionesAnteriores || {},
  });
}

test('el PDF multiseccion genera previews independientes de fijo y Claro TV', () => {
  const { previews } = buildPreviews();
  const fijo = previews.find((item) => item.categoria === 'fijo');
  const claroTv = previews.find((item) => item.categoria === 'claro_tv');

  assert.equal(previews.length, 2);
  assert.equal(fijo.candidatos_publicos.length, 80);
  assert.equal(claroTv.candidatos_publicos.length, 9);
  assert.equal(fijo.candidatos_publicos.length + claroTv.candidatos_publicos.length, 89);
  assert.equal(fijo.fuente_comercial_id, fuente.id);
  assert.equal(claroTv.fuente_comercial_id, fuente.id);
  assert.equal(fijo.fuente_sha256, fuente.sha256);
  assert.equal(claroTv.fuente_sha256, fuente.sha256);
  assert.equal(fijo.publicable, true);
  assert.equal(claroTv.publicable, true);
});

test('los candidatos publicos no mezclan fijo, Claro TV, equipos ni promociones', () => {
  const { previews } = buildPreviews();
  const fijo = previews.find((item) => item.categoria === 'fijo');
  const claroTv = previews.find((item) => item.categoria === 'claro_tv');

  assert.deepEqual(fijo.resumen.categorias_incluidas, [
    'fijo_telefonia',
    'fijo_internet_2play',
    'fijo_valores_agregados_vendibles',
  ]);
  assert.deepEqual(claroTv.resumen.categorias_incluidas, [
    'claro_tv_planes',
    'claro_tv_servicios_complementos',
  ]);
  assert.equal(fijo.candidatos_publicos.some((fila) => fila.categoria.startsWith('claro_tv')), false);
  assert.equal(claroTv.candidatos_publicos.some((fila) => fila.categoria.startsWith('fijo_')), false);
  assert.equal(claroTv.candidatos_publicos.some((fila) => /STB|DONGLE|CONTROL REMOTO/i.test(fila.descripcion)), false);
  assert.equal([...fijo.candidatos_publicos, ...claroTv.candidatos_publicos].some((fila) => /GRATIS|Affinity|DOBLE VELOCIDAD/i.test(`${fila.descripcion} ${fila.motivo_exclusion || ''}`)), false);
});

test('los modulos se agrupan y se generan en orden determinista', () => {
  const first = buildPreviews().previews;
  const second = buildPreviews().previews;
  const shape = (preview) => preview.map((item) => ({
    categoria: item.categoria,
    secciones: item.modulos_generados.map((modulo) => modulo.seccion_key),
    filas: item.modulos_generados.map((modulo) => modulo.contenido.filas.length),
  }));

  assert.deepEqual(shape(first), shape(second));
  assert.deepEqual(shape(first), [
    {
      categoria: 'fijo',
      secciones: ['fijo_telefonia', 'fijo_internet_2play', 'fijo_valores_agregados_vendibles'],
      filas: [40, 25, 15],
    },
    {
      categoria: 'claro_tv',
      secciones: ['claro_tv_planes', 'claro_tv_servicios_complementos'],
      filas: [6, 3],
    },
  ]);
});

test('A878 conserva dos variantes publicas auditadas', () => {
  const fijo = buildPreviews().previews.find((item) => item.categoria === 'fijo');
  const a878 = fijo.candidatos_publicos.filter((fila) => fila.categoria === 'fijo_internet_2play' && fila.codigo === 'A878');

  assert.equal(a878.length, 2);
  assert.deepEqual(a878.map((fila) => fila.identidad_variante).sort(), ['base', 'bundle_2l']);
  assert.equal(a878.some((fila) => fila.descripcion === 'BUS PRUS ILIM + 100M/15M' && fila.precio === 54.99), true);
  assert.equal(a878.some((fila) => fila.descripcion === 'BUS PRUS ILIM + 100M/15M (2L) BUNDLE' && fila.precio === 79.99), true);
  assert.equal(a878.every((fila) => fila.trazas_auditoria.length === 1), true);
  assert.equal(fijo.validacion.errores.some((error) => String(error.identidades || '').includes('A878')), false);
});

test('1186 se consolida en un producto con ambas trazas y alcance tecnologico completo', () => {
  const fijo = buildPreviews().previews.find((item) => item.categoria === 'fijo');
  const mundial = fijo.candidatos_publicos.filter((fila) => fila.categoria === 'fijo_valores_agregados_vendibles' && fila.codigo === '1186');

  assert.equal(mundial.length, 1);
  assert.equal(mundial[0].descripcion, 'PLAN MUNDIAL- LDI (NUEVAS TARIFAS CON/SIN CONTRATO)');
  assert.equal(mundial[0].precio, 0);
  assert.equal(mundial[0].tecnologia, 'COBRE/VRAD/GPON');
  assert.equal(mundial[0].trazas_auditoria.length, 2);
  assert.deepEqual(mundial[0].trazas_auditoria.map((traza) => traza.pagina).sort(), [2, 3]);
  assert.equal(fijo.validacion.errores.some((error) => String(error.identidades || '').includes('1186')), false);
});

test('el diff detecta nuevos, modificados, eliminados y sin cambios', () => {
  const fijo = buildPreviews().previews.find((item) => item.categoria === 'fijo');
  const [unchanged, modified, newlyAdded] = fijo.modulos_generados;
  const previous = [
    unchanged,
    { ...modified, contenido: { ...modified.contenido, filas: modified.contenido.filas.slice(1) } },
    {
      pagina: 'fijos',
      seccion_key: 'modulo_obsoleto',
      titulo: 'Modulo obsoleto',
      tipo: 'tabla',
      contenido: { filas: [{ codigo: 'OLD', descripcion: 'Anterior' }] },
    },
  ];

  const diff = diffModulosGenerados(previous, [unchanged, modified, newlyAdded]);

  assert.deepEqual(diff.resumen, { nuevos: 1, modificados: 1, eliminados: 1, sin_cambios: 1 });
  assert.deepEqual(diff.nuevos.map((item) => item.seccion_key), [newlyAdded.seccion_key]);
  assert.deepEqual(diff.modificados.map((item) => item.seccion_key), [modified.seccion_key]);
  assert.deepEqual(diff.eliminados.map((item) => item.seccion_key), ['modulo_obsoleto']);
  assert.deepEqual(diff.sin_cambios.map((item) => item.seccion_key), [unchanged.seccion_key]);
});

test('el preview separa diferencias de modulos y registros', () => {
  const fijo = buildPreviews().previews.find((item) => item.categoria === 'fijo');

  assert.ok(fijo.diferencias.modulos);
  assert.ok(fijo.diferencias.registros);
  assert.deepEqual(Object.keys(fijo.diferencias.registros.resumen).sort(), [
    'eliminados',
    'modificados',
    'nuevos',
    'sin_cambios',
    'total_actual',
    'total_anterior',
  ]);
});

test('el diff de registros usa categoria, seccion y codigo como identidad comercial', () => {
  const previous = [
    {
      seccion_key: 'fijo_telefonia',
      contenido: { filas: [
        { categoria: 'fijo_telefonia', codigo: 'A1', descripcion: 'Plan viejo', precio: 10, tecnologia: 'Cobre', alfa_code: 'OLD', pagina: 1, llave_auditoria: '1|tel|A1|Plan viejo' },
        { categoria: 'fijo_telefonia', codigo: 'B1', descripcion: 'Sin cambio', precio: 20, tecnologia: 'GPON', alfa_code: 'SAME', pagina: 1 },
        { categoria: 'fijo_telefonia', codigo: 'D1', descripcion: 'Eliminado', precio: 30, tecnologia: 'Cobre', alfa_code: 'DEL', pagina: 1 },
      ] },
    },
    {
      seccion_key: 'fijo_internet_2play',
      contenido: { filas: [
        { categoria: 'fijo_internet_2play', codigo: 'A1', descripcion: 'Mismo codigo otra seccion', precio: 99, tecnologia: 'GPON', alfa_code: 'OTHER', pagina: 2 },
      ] },
    },
  ];
  const current = [
    {
      seccion_key: 'fijo_internet_2play',
      contenido: { filas: [
        { categoria: 'fijo_internet_2play', codigo: 'A1', descripcion: 'Mismo codigo otra seccion', precio: 99, tecnologia: 'GPON', alfa_code: 'OTHER', pagina: 9 },
      ] },
    },
    {
      seccion_key: 'fijo_telefonia',
      contenido: { filas: [
        { categoria: 'fijo_telefonia', codigo: 'C1', descripcion: 'Nuevo', precio: 40, tecnologia: 'GPON', alfa_code: 'NEW', pagina: 3 },
        { categoria: 'fijo_telefonia', codigo: 'B1', descripcion: 'Sin cambio', precio: 20, tecnologia: 'GPON', alfa_code: 'SAME', pagina: 8 },
        { categoria: 'fijo_telefonia', codigo: 'A1', descripcion: 'Plan nuevo', precio: 15, tecnologia: 'Cobre', alfa_code: 'OLD', pagina: 4, llave_auditoria: '4|tel|A1|Plan nuevo' },
      ] },
    },
  ];

  const diff = diffRegistrosGenerados(previous, current);

  assert.deepEqual(diff.resumen, {
    total_anterior: 4,
    nuevos: 1,
    modificados: 1,
    eliminados: 1,
    sin_cambios: 2,
    total_actual: 4,
  });
  assert.deepEqual(diff.nuevos.map((item) => item.identidad), ['fijo_telefonia|fijo_telefonia|C1']);
  assert.deepEqual(diff.eliminados.map((item) => item.identidad), ['fijo_telefonia|fijo_telefonia|D1']);
  assert.deepEqual(diff.modificados.map((item) => item.identidad), ['fijo_telefonia|fijo_telefonia|A1']);
  assert.deepEqual(diff.modificados[0].cambios.map((item) => item.campo).sort(), ['descripcion', 'precio']);
});

test('el diff de registros ignora cambios solo de ubicacion y orden de filas', () => {
  const previous = [{
    seccion_key: 'fijo_telefonia',
    contenido: { filas: [
      { categoria: 'fijo_telefonia', codigo: 'A1', descripcion: 'A', precio: 10, pagina: 1, texto_original: 'pagina 1' },
      { categoria: 'fijo_telefonia', codigo: 'B1', descripcion: 'B', precio: 20, pagina: 2, texto_original: 'pagina 2' },
    ] },
  }];
  const current = [{
    seccion_key: 'fijo_telefonia',
    contenido: { filas: [
      { categoria: 'fijo_telefonia', codigo: 'B1', descripcion: 'B', precio: 20, pagina: 9, texto_original: 'pagina 9' },
      { categoria: 'fijo_telefonia', codigo: 'A1', descripcion: 'A', precio: 10, pagina: 8, texto_original: 'pagina 8' },
    ] },
  }];

  const diff = diffRegistrosGenerados(previous, current);

  assert.deepEqual(diff.resumen, {
    total_anterior: 2,
    nuevos: 0,
    modificados: 0,
    eliminados: 0,
    sin_cambios: 2,
    total_actual: 2,
  });
});

test('una identidad duplicada dentro de la misma seccion bloquea el preview', () => {
  const parsed = structuredClone(runParser());
  parsed.modulos.fijo_telefonia.filas[parsed.modulos.fijo_telefonia.filas.length - 1] = {
    ...parsed.modulos.fijo_telefonia.filas[0],
    precio: 999,
  };

  const { previews } = buildPreviews({ parsed });
  const fijo = previews.find((item) => item.categoria === 'fijo');

  assert.equal(fijo.publicable, false);
  assert.ok(fijo.validacion.errores.some((error) => error.codigo === 'identidad_registro_duplicada'));
});

test('una inconsistencia impide aprobar el preview', () => {
  const parsed = structuredClone(runParser());
  parsed.modulos.fijo_telefonia.filas.pop();

  const { previews } = buildPreviews({ parsed });
  const fijo = previews.find((item) => item.categoria === 'fijo');

  assert.equal(fijo.publicable, false);
  assert.ok(fijo.validacion.errores.some((error) => error.codigo === 'conteo_categoria_invalido'));
});

test('revision manual, errores de encabezado y campos obligatorios bloquean sin escribir', () => {
  const parsed = structuredClone(runParser());
  parsed.errores = [{ codigo: 'encabezado_no_encontrado', mensaje: 'Falta corte' }];
  parsed.modulos.revision_manual.filas.push({
    pagina: 1,
    categoria: 'revision_manual',
    codigo: 'MANUAL',
    descripcion: 'Revisar',
    descripcion_original: 'Revisar',
    encabezado_origen: 'Revision',
  });
  delete parsed.modulos.fijo_telefonia.filas[0].codigo;

  const { previews } = buildPreviews({ parsed });
  const fijo = previews.find((item) => item.categoria === 'fijo');

  assert.equal(fijo.publicable, false);
  assert.ok(fijo.validacion.errores.some((error) => error.codigo === 'errores_parser'));
  assert.ok(fijo.validacion.errores.some((error) => error.codigo === 'revision_manual'));
  assert.ok(fijo.validacion.errores.some((error) => error.codigo === 'campo_obligatorio_ausente'));
  assert.doesNotMatch(serviceSource, /from ['"]\.\.\/db\.js['"]/);
  assert.doesNotMatch(serviceSource, /\bpool\.query\b|\bclient\.query\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
});
