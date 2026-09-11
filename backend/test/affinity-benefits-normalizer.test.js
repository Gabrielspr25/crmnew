import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { AFFINITY_DOMINIO, normalizeAffinityBenefitSources } from '../src/services/affinityBenefitsNormalizer.js';

const textoOficial = readFileSync(new URL('./fixtures/affinity-boletin-5nov2025.txt', import.meta.url), 'utf8');

const fuente = {
  id: 'fuente-affinity',
  familia: 'affinity',
  nombre_original: 'Boletin Affinity Movil y Fijo desde el 5 de noviembre del 2025.pdf',
  sha256: 'a'.repeat(64),
  vigencia_desde: null,
  vigencia_hasta: null,
};

function normalizar(text = textoOficial, overrides = {}, opciones = undefined) {
  return normalizeAffinityBenefitSources([{ fuente: { ...fuente, ...overrides }, text }], opciones);
}

test('lee la vigencia abierta del boletin oficial', () => {
  const result = normalizar();
  assert.equal(result.dominio, AFFINITY_DOMINIO);
  assert.deepEqual(result.vigencia, { desde: '2025-11-05', hasta: null });
});

test('detecta el descuento Affinity 8% por servicio con su codigo oficial', () => {
  const result = normalizar();

  assert.equal(result.reglas_compuestas.length, 2);
  const movil = result.reglas_compuestas.find((item) => item.producto === 'movil');
  const fijo = result.reglas_compuestas.find((item) => item.producto === 'fijo');

  assert.ok(movil, 'falta la regla de Movil');
  assert.deepEqual(movil.beneficio, { tipo: 'descuento_affinity', porcentaje: 8, codigo: 'AFFINITY8', aplicacion: 'renta_mensual' });
  assert.deepEqual(movil.productos_afectados, ['movil']);

  assert.ok(fijo, 'falta la regla de Fijo');
  assert.equal(fijo.beneficio.porcentaje, 8);
  assert.equal(fijo.beneficio.codigo, 'AFFINITY8');
  assert.deepEqual(fijo.codigos_facturacion, ['7382', '7382TV']);

  assert.ok(result.reglas_compuestas.every((item) => item.aplicacion_automatica === false));
  assert.equal(result.beneficios_affinity, 2);
});

test('conserva las condiciones comerciales de Movil sin inventarlas', () => {
  const movil = normalizar().reglas_compuestas.find((item) => item.producto === 'movil');

  assert.equal(movil.condiciones.plan_minimo, 45);
  assert.deepEqual(movil.condiciones.planes_minimos, { smartphone: 45, internet_on_the_go: 30, linea_familiar: 30 });
  assert.deepEqual(movil.condiciones.plazos_meses, [20, 24, 30, 36]);
  assert.deepEqual(movil.condiciones.limite, { cantidad: 8, unidad: 'lineas_por_cliente' });
  assert.deepEqual(movil.condiciones.eventos.sort(), ['cliente_nuevo', 'renovacion']);
  assert.equal(movil.condiciones.compatibilidad, 'incompatible');
  assert.equal(movil.condiciones.nivel_aplicacion, 'subscriptor');
  assert.deepEqual(movil.condiciones.modalidades, ['update_plus', 'financiamiento']);
  assert.deepEqual(movil.condiciones.excluye, ['corporativos', 'pospago', 'claro_libre', 'prepago', 'byop']);
});

test('conserva las condiciones comerciales de Fijo sin mezclarlas con Movil', () => {
  const fijo = normalizar().reglas_compuestas.find((item) => item.producto === 'fijo');

  assert.deepEqual(fijo.condiciones.plazos_meses, [0, 12, 24]);
  assert.deepEqual(fijo.condiciones.eventos.sort(), ['cliente_nuevo', 'renovacion']);
  assert.equal(fijo.condiciones.nivel_aplicacion, 'subscriptor');
  assert.equal(fijo.condiciones.plan_minimo, null, 'Fijo no publica renta minima, solo velocidades');
  assert.deepEqual(fijo.condiciones.servicios, ['2play', '3play']);

  const cobre = fijo.condiciones.tecnologias.find((item) => item.tecnologia === 'cobre_vrad');
  assert.equal(cobre.velocidad_minima_megas, 10);
  assert.equal(cobre.velocidades_en_conflicto, undefined, 'Cobre/VRAD es consistente en las tres menciones');
  assert.equal(cobre.menciones.length, 3);
  assert.ok(cobre.menciones.every((item) => item.megas === 10));
});

// "menos de 10M en VRAD y menos de 100M en GPON": cada velocidad debe quedar con su tecnologia.
test('asigna cada velocidad a su tecnologia aunque compartan la misma frase', () => {
  const fijo = normalizar().reglas_compuestas.find((item) => item.producto === 'fijo');
  const cobre = fijo.condiciones.tecnologias.find((item) => item.tecnologia === 'cobre_vrad');
  const gpon = fijo.condiciones.tecnologias.find((item) => item.tecnologia === 'gpon');

  const exclusionCobre = cobre.menciones.find((item) => item.sentido === 'excluye_debajo_de');
  const exclusionGpon = gpon.menciones.find((item) => item.sentido === 'excluye_debajo_de');
  assert.equal(exclusionCobre.megas, 10);
  assert.equal(exclusionGpon.megas, 100);
  assert.equal(cobre.menciones.some((item) => item.megas === 100), false, 'el 100M de GPON no puede atribuirse a VRAD');
});

// El boletin oficial declara GPON con dos velocidades minimas distintas (pagina 6: 100 megas, pagina 7: 50 megas).
// El motor no elige una: la reporta como contradiccion para que la resuelva el area comercial.
test('reporta la contradiccion de velocidad GPON del propio boletin en vez de elegir una', () => {
  const result = normalizar();
  const fijo = result.reglas_compuestas.find((item) => item.producto === 'fijo');
  const gpon = fijo.condiciones.tecnologias.find((item) => item.tecnologia === 'gpon');

  assert.ok(gpon.velocidades_en_conflicto, 'GPON deberia quedar marcado en conflicto');
  assert.deepEqual(gpon.velocidades_en_conflicto.map((item) => item.megas).sort((a, b) => a - b), [50, 100]);
  assert.ok(fijo.motivos_revision.includes('velocidad_minima_contradictoria'));
  assert.equal(fijo.estado_confianza, 'requiere_revision');

  // La evidencia que necesita el area comercial: 100 megas aparece dos veces (oferta y regla de exclusion),
  // 50 megas una sola vez (termino 1).
  const cien = gpon.velocidades_en_conflicto.find((item) => item.megas === 100);
  const cincuenta = gpon.velocidades_en_conflicto.find((item) => item.megas === 50);
  assert.equal(cien.menciones, 2);
  assert.equal(cincuenta.menciones, 1);
  assert.equal(cien.origen, 'oferta + terminos');

  const contradiccion = result.contradicciones.find((item) => item.codigo === 'velocidad_minima_contradictoria');
  assert.ok(contradiccion, 'la contradiccion debe viajar al preview del admin');
  assert.equal(contradiccion.bloqueante, true);
  assert.match(contradiccion.detalle, /GPON/);
  assert.match(contradiccion.detalle, /2 menciones/);
  assert.equal(result.contradicciones.length, 1, 'Cobre/VRAD no debe generar contradiccion');
  assert.equal(result.publicable, false, 'no se publica un boletin con contradiccion abierta');
});

test('vincula los terminos oficiales de cada servicio y no los convierte en beneficios', () => {
  const result = normalizar();
  const movil = result.reglas_compuestas.find((item) => item.producto === 'movil');
  const fijo = result.reglas_compuestas.find((item) => item.producto === 'fijo');

  assert.ok(movil.terminos_vinculados.length >= 8, `Movil deberia conservar sus terminos, trajo ${movil.terminos_vinculados.length}`);
  assert.equal(fijo.terminos_vinculados.length, 12);
  assert.ok(fijo.terminos_vinculados.every((term) => term.pagina === 7));

  // Los bonos citados dentro de los terminos son condiciones del descuento, no beneficios Affinity publicables.
  const tipos = result.reglas_compuestas.map((item) => item.beneficio.tipo);
  assert.deepEqual([...new Set(tipos)], ['descuento_affinity']);
  assert.ok(movil.terminos_vinculados.some((term) => /bono de portabilidad de \$150/i.test(term.nombre)));
});

test('descarta las paginas de procedimiento de venta', () => {
  const result = normalizar();
  const paginas = result.reglas_normalizadas.map((regla) => regla.traza?.pagina);

  assert.equal(paginas.includes(4), false, 'la pagina 4 es procedimiento de canal directo');
  assert.equal(paginas.includes(5), false, 'la pagina 5 es procedimiento de canal indirecto');
  assert.equal(paginas.includes(8), false, 'la pagina 8 es procedimiento');
  assert.equal(result.reglas_compuestas.some((item) => item.beneficio.tipo === 'no_determinado'), false);
});

test('Movil queda confirmado y publicable; Fijo espera la aclaracion de GPON', () => {
  const result = normalizar();
  const movil = result.reglas_compuestas.find((item) => item.producto === 'movil');
  const fijo = result.reglas_compuestas.find((item) => item.producto === 'fijo');

  assert.equal(movil.estado_confianza, 'confirmado');
  assert.deepEqual(movil.motivos_revision, []);
  assert.equal(fijo.estado_confianza, 'requiere_revision');
  assert.deepEqual(result.advertencias, []);
  assert.equal(result.publicable, false, 'con una contradiccion abierta el boletin no se aprueba completo');
});

// La contradiccion la resuelve una persona; el codigo no elige una velocidad por su cuenta.
test('una aclaracion comercial resuelve la contradiccion y deja la traza de lo descartado', () => {
  const result = normalizar(textoOficial, {}, { resoluciones: { gpon: { megas: 100, actor: 'Gabriel', motivo: 'aclaracion_comercial' } } });
  const fijo = result.reglas_compuestas.find((item) => item.producto === 'fijo');
  const gpon = fijo.condiciones.tecnologias.find((item) => item.tecnologia === 'gpon');

  assert.equal(gpon.velocidad_minima_megas, 100);
  assert.equal(gpon.velocidades_en_conflicto, undefined);
  assert.equal(gpon.resolucion.actor, 'Gabriel');
  assert.deepEqual(gpon.resolucion.descartadas, [50]);
  assert.equal(gpon.resolucion.menciones_originales.length, 3, 'la evidencia original se conserva');

  assert.equal(fijo.estado_confianza, 'confirmado');
  assert.deepEqual(fijo.motivos_revision, []);
  assert.equal(result.publicable, true);

  const registro = result.contradicciones.find((item) => item.codigo === 'velocidad_minima_aclarada');
  assert.equal(registro.estado, 'resuelta');
  assert.equal(registro.bloqueante, false);
  assert.match(registro.detalle, /Gabriel/);
});

test('solo se acepta una aclaracion con un valor que el boletin realmente menciona', () => {
  const inventada = normalizar(textoOficial, {}, { resoluciones: { gpon: { megas: 75, actor: 'Gabriel' } } });
  const fijo = inventada.reglas_compuestas.find((item) => item.producto === 'fijo');
  const gpon = fijo.condiciones.tecnologias.find((item) => item.tecnologia === 'gpon');

  assert.ok(gpon.velocidades_en_conflicto, '75 no esta en el documento: la contradiccion sigue abierta');
  assert.equal(gpon.resolucion, undefined);
  assert.equal(inventada.publicable, false);
});

test('un PDF sin descuento Affinity reconocible no es publicable y avisa', () => {
  const result = normalizar('===== PAGE 1 =====\nBoletin de planes fijos\n1. Internet 100 Mbps por $49.99\n');

  assert.equal(result.reglas_compuestas.length, 0);
  assert.equal(result.publicable, false);
  assert.ok(result.advertencias.some((item) => item.codigo === 'sin_beneficios_affinity_detectados' && item.bloqueante));
});

test('usa la vigencia cargada por el admin cuando el documento no la trae', () => {
  const sinVigencia = textoOficial.replace(/Desde el 5 de noviembre\s*\ndel 2025/g, '').replace(/desde el 5 de noviembre del 2025/gi, '');
  const result = normalizar(sinVigencia, { vigencia_desde: '2025-11-05', vigencia_hasta: '2026-12-31' });
  assert.deepEqual(result.vigencia, { desde: '2025-11-05', hasta: '2026-12-31' });
});
