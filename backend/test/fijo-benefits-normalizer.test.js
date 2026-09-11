import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { normalizeFijoOfferBenefitSources } from '../src/services/fijoBenefitsNormalizer.js';

const claroFullExtract = new URL('../../docs/motor-ofertas/extractos/Boletin Beneficios Convergencia Claro Full PYMES @12.NOV.2025.txt', import.meta.url);
const ofertasFijoExtract = new URL("../../docs/motor-ofertas/extractos/BOLETIN OFERTAS PYMES 2026 - DEL 1 JUN@31 JUL'26-260601.txt", import.meta.url);

test('Benefits normaliza beneficios de convergencia desde extracto oficial sin inventar aplicacion automatica', async () => {
  const text = await readFile(claroFullExtract, 'utf8');
  const result = normalizeFijoOfferBenefitSources([{
    fuente: {
      id: 'beneficios-1',
      familia: 'beneficios',
      nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES @12.NOV.2025.pdf',
      sha256: 'a'.repeat(64),
    },
    text,
  }]);

  assert.equal(result.advertencias.length, 0);
  assert.equal(result.resumen_reglas.por_tipo.beneficio >= 9, true);
  assert.equal(result.resumen_reglas.por_confianza.confirmado >= 7, true);
  assert.ok(result.reglas_normalizadas.every((regla) => regla.fuente_comercial_id === 'beneficios-1'));
  assert.ok(result.reglas_normalizadas.every((regla) => !/\$\d|\b150\b|\b200\b|\b10\b/.test(regla.llave_comercial)));
  assert.ok(result.reglas_normalizadas.some((regla) => regla.valor.beneficio.tipo === 'meses_gratis' && regla.condiciones.plan_minimo === 60));
  assert.ok(result.reglas_normalizadas.some((regla) => regla.valor.beneficio.tipo === 'descuento_accesorios' && regla.valor.beneficio.porcentaje === 10));
  assert.ok(result.reglas_normalizadas.some((regla) => regla.valor.beneficio.tipo === 'pago_penalidad' && regla.valor.beneficio.monto === 200));
  assert.ok(result.reglas_normalizadas.some((regla) => regla.valor.beneficio.tipo === 'bono_portabilidad' && regla.valor.beneficio.monto === 150));
  assert.ok(result.reglas_normalizadas.some((regla) => regla.valor.beneficio.tipo === 'bono_streaming' && regla.valor.beneficio.monto === 10));
  assert.ok(result.reglas_normalizadas.some((regla) => regla.condiciones.convergencia === 'requerida'));
});

test('Ofertas Fijo normaliza ofertas promocionales y separa condiciones de convergencia', async () => {
  const text = await readFile(ofertasFijoExtract, 'utf8');
  const result = normalizeFijoOfferBenefitSources([{
    fuente: {
      id: 'ofertas-fijo-1',
      familia: 'ofertas_fijo',
      nombre_original: "BOLETIN OFERTAS PYMES 2026 - DEL 1 JUN@31 JUL'26-260601.pdf",
      sha256: 'b'.repeat(64),
    },
    text,
  }]);

  assert.equal(result.reglas_normalizadas.length >= 5, true);
  assert.equal(result.resumen_reglas.por_tipo.oferta_temporal >= 5, true);
  const businessPack = result.reglas_normalizadas.find((regla) => /claro-business-pack/.test(regla.codigo));
  assert.ok(businessPack);
  assert.equal(businessPack.valor.beneficio.tipo, 'velocidad_gratis');
  assert.equal(businessPack.valor.beneficio.meses, 6);
  assert.equal(businessPack.condiciones.contrato_meses, 24);
  assert.equal(businessPack.llave_comercial.includes('74.99'), false);
  assert.ok(result.benefits.some((benefit) => benefit.condiciones.convergencia === 'requerida'));
});

test('una fuente sin beneficio claro queda en advertencia sin crear regla inventada', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'x', familia: 'ofertas_fijo', nombre_original: 'fuente.pdf' },
    text: 'Documento informativo sin promociones, beneficios, precios ni condiciones.',
  }]);

  assert.equal(result.reglas_normalizadas.length, 0);
  assert.equal(result.advertencias[0].codigo, 'sin_bloques_oferta_beneficio');
});

test('Benefits hereda convergencia y acumulacion desde la lista oficial Claro Full', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'claro-full-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 3 =====
Válido desde el 23 de julio de 2026
Beneficios de Claro Full PYMES para Clientes Convergentes:
1. 3 Meses Gratis Móvil -En la renta de planes móviles de $60 en adelante individual o multilíneas.
8. Bono de "Streaming" - $10 de descuento para que lo use en alguna de estas opciones:
a. Móvil-Bono mensual para que te suscribas a Netflix.
b. Fijo-Bono mensual para que te suscribas a Netflix.
Todos estos beneficios aplican y pueden ser combinados, según los servicios que adquiera el cliente.
*En el beneficio 8 arriba mencionado el cliente tiene que escoger una (1) de las dos (2) opciones disponibles.
`,
  }]);

  const mesesGratis = result.reglas_normalizadas.find((regla) => regla.valor.beneficio.tipo === 'meses_gratis');
  assert.ok(mesesGratis);
  assert.equal(mesesGratis.estado_confianza, 'confirmado');
  assert.equal(mesesGratis.condiciones.convergencia, 'requerida');
  assert.equal(mesesGratis.condiciones.compatibilidad, 'acumula');
  assert.equal(mesesGratis.aplicacion_automatica, false);

  const streaming = result.reglas_normalizadas.find((regla) => regla.valor.beneficio.tipo === 'bono_streaming');
  assert.ok(streaming);
  assert.equal(streaming.condiciones.compatibilidad, 'no_acumula');
});

test('terminos oficiales de un beneficio no se normalizan como beneficios nuevos', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'claro-full-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 5 =====
3 Meses Gratis en la Renta del Plan Móvil de $60 en adelante
Válido desde el 23 de julio de 2026
Términos y Condiciones 3 Meses Gratis en la Renta del Plan de $60 en adelante de Móvil:
1. Aplica a clientes nuevos y existentes convergentes.
5. Los tres (3) meses gratis son luego de aplicar crédito a la factura, correspondiente a la renta mensual del plan, no incluye impuestos.
9. Esta oferta aplica a los siguientes Account Types:
• Business Credit Limit
• Business Regular
• Business Wireline Small
`,
  }]);

  assert.equal(result.resumen_reglas.por_tipo.terminos, 3);
  assert.equal(result.resumen_reglas.por_confianza.confirmado, 3);
  assert.equal(result.resumen_reglas.por_confianza.requiere_revision || 0, 0);
  assert.ok(result.reglas_normalizadas.every((regla) => regla.accion === 'vincular_terminos'));
  assert.equal(result.benefits.length, 0);
});

test('terminos de bono streaming conservan limite por BAN y no acumulacion', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'streaming-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 30 =====
Bono Streaming de $10 por Convergencia
Válido desde el 23 de julio de 2026
Términos y Condiciones: Bono de Streaming $10 por Convergencia para Móvil + Fijo + Fijo Inalámbrico
1. Aplica a portabilidades, líneas nuevas y a clientes existentes que sean convergentes.
9. El cliente sólo puede solicitar un (1) bono de $10 por cuenta. Debe escoger entre el Bono de Streaming de móvil o el Bono de Streaming de fijo.
10. Sólo aplica un bono de $10.00 por BAN.
`,
  }]);

  const noAcumula = result.reglas_normalizadas.find((regla) => regla.condiciones.compatibilidad === 'no_acumula');
  assert.ok(noAcumula);
  assert.equal(noAcumula.tipo_regla, 'terminos');
  assert.equal(noAcumula.condiciones.compatibilidad, 'no_acumula');
  assert.equal(noAcumula.estado_confianza, 'confirmado');

  const limiteBan = result.reglas_normalizadas.find((regla) => /por-ban/.test(regla.codigo));
  assert.ok(limiteBan);
  assert.deepEqual(limiteBan.condiciones.limite, { cantidad: 1, unidad: 'BAN' });
  assert.equal(limiteBan.estado_confianza, 'confirmado');
  assert.equal(noAcumula.aplicacion_automatica, false);
  assert.equal(limiteBan.aplicacion_automatica, false);
});

test('vigencia y velocidades no se interpretan como precio minimo de plan', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'fechas-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 30 =====
Bono Streaming de $10 por Convergencia
Válido desde el 23 de julio de 2026
Términos y Condiciones: Bono de Streaming $10 por Convergencia para Móvil + Fijo + Fijo Inalámbrico
5. Cliente Fijo: Aplica en planes regulares 2 Play de 100 megas en adelante, en tecnología GPON.
6. Cliente Nuevo o Existente de Fijo Inalámbrico (5G FWA) –que se suscriba a un plan de 50M en adelante.
`,
  }]);

  assert.ok(result.reglas_normalizadas.length > 0);
  assert.ok(result.reglas_normalizadas.every((regla) => regla.condiciones.plan_minimo == null));
});

test('compone 3 meses gratis con sus terminos oficiales sin activar aplicacion automatica', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'claro-full-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 3 =====
Válido desde el 23 de julio de 2026
Beneficios de Claro Full PYMES para Clientes Convergentes:
1. 3 Meses Gratis Móvil -En la renta de planes móviles de $60 en adelante individual o multilíneas.
Todos estos beneficios aplican y pueden ser combinados, según los servicios que adquiera el cliente.
===== PAGE 5 =====
3 Meses Gratis en la Renta del Plan Móvil de $60 en adelante
Términos y Condiciones 3 Meses Gratis en la Renta del Plan de $60 en adelante de Móvil:
1. Aplica a clientes nuevos y existentes convergentes.
3. Aplica en planes regulares de $60 en adelante, individuales o multilíneas Business Red y Claro Sin Fronteras. En planes multilíneas Business Red sólo aplica en las primeras 2 líneas.
6. Los créditos en factura serán aplicados en el mes 2, 4, y 6 y el cliente debe permanecer activo.
`,
  }]);

  assert.equal(result.reglas_compuestas.length, 1);
  const compuesta = result.reglas_compuestas[0];
  assert.equal(compuesta.beneficio.tipo, 'meses_gratis');
  assert.equal(compuesta.estado_confianza, 'confirmado');
  assert.equal(compuesta.aplicacion_automatica, false);
  assert.equal(compuesta.terminos_vinculados.length, 3);
  assert.deepEqual(compuesta.condiciones.plan_minimo, 60);
  assert.equal(compuesta.condiciones.convergencia, 'requerida');
  assert.equal(compuesta.condiciones.compatibilidad, 'acumula');
  assert.ok(compuesta.traza.terminos.every((termino) => termino.pagina === 5));
});

test('compone bono streaming con incompatibilidad y limite por BAN desde terminos vinculados', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'streaming-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 3 =====
Beneficios de Claro Full PYMES para Clientes Convergentes:
8. Bono de "Streaming" - $10 de descuento para que lo use en alguna de estas opciones:
a. Móvil-Bono mensual para que te suscribas a Netflix.
b. Fijo-Bono mensual para que te suscribas a Netflix.
Todos estos beneficios aplican y pueden ser combinados, según los servicios que adquiera el cliente.
*En el beneficio 8 arriba mencionado el cliente tiene que escoger una (1) de las dos (2) opciones disponibles.
===== PAGE 30 =====
Bono Streaming de $10 por Convergencia
Términos y Condiciones: Bono de Streaming $10 por Convergencia para Móvil + Fijo + Fijo Inalámbrico
1. Aplica a portabilidades, líneas nuevas y a clientes existentes que sean convergentes.
9. El cliente sólo puede solicitar un (1) bono de $10 por cuenta. Debe escoger entre el Bono de Streaming de móvil o el Bono de Streaming de fijo.
10. Sólo aplica un bono de $10.00 por BAN.
`,
  }]);

  const compuesta = result.reglas_compuestas.find((regla) => regla.beneficio.tipo === 'bono_streaming');
  assert.ok(compuesta);
  assert.equal(compuesta.estado_confianza, 'confirmado');
  assert.equal(compuesta.condiciones.compatibilidad, 'no_acumula');
  assert.deepEqual(compuesta.condiciones.limite, { cantidad: 1, unidad: 'BAN' });
  assert.equal(compuesta.terminos_vinculados.length, 3);
});

test('beneficio sin terminos demostrables queda compuesto en revision sin inventar relacion', () => {
  const result = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'accesorios-v16', familia: 'beneficios', nombre_original: 'Claro Full V.16.pdf' },
    text: `
===== PAGE 3 =====
Beneficios de Claro Full PYMES para Clientes Convergentes:
7. 10% de Descuento -Aplica a accesorios, computadoras y Tablets.
Todos estos beneficios aplican y pueden ser combinados, según los servicios que adquiera el cliente.
`,
  }]);

  const compuesta = result.reglas_compuestas.find((regla) => regla.beneficio.tipo === 'descuento_accesorios');
  assert.ok(compuesta);
  assert.equal(compuesta.estado_confianza, 'requiere_revision');
  assert.equal(compuesta.motivos_revision[0], 'sin_terminos_vinculados');
  assert.equal(result.relaciones_ambiguas.length, 1);
  assert.equal(compuesta.aplicacion_automatica, false);
});
