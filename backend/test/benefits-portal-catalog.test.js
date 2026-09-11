import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  buildBenefitsPortalCatalog,
  buildSpecialEquipmentBenefitEntries,
  compositeBenefitToPortalEntry,
} from '../src/services/benefitsPortalCatalog.js';

const version = {
  id: 'version-1',
  numero: 1,
  dominio: 'fijo_benefits',
  estado_publicacion: 'vigente',
};

const claroFullSource = {
  id: 'fuente-1',
  nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES @23.JUL.2026 (16)-260713.pdf',
  vigencia_desde: '2026-07-23',
  vigencia_hasta: null,
  vigencia_documental: 'vigente',
};

test('normaliza una regla compuesta confirmada para el catalogo publico de Benefits', () => {
  const entry = compositeBenefitToPortalEntry({
    version,
    source: claroFullSource,
    rule: {
      id: 'rule-1',
      identidad_comercial: 'fijo_benefits|bono_streaming|fijo',
      estado_confianza: 'confirmado',
      estado_publicacion: 'vigente',
      autoaplica: false,
      contrato: {
        beneficio: { tipo: 'bono_streaming', nombre: 'Bono Streaming por Convergencia', monto: 10 },
        productos: ['fijo', 'movil'],
        condiciones: [{ tipo: 'convergencia', descripcion: 'Cliente convergente Claro Full PYMES' }],
        compatibilidad: { modo: 'no_acumula' },
        limite: { unidad: 'BAN', cantidad: 1 },
        fuente: { nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES @23.JUL.2026 (16)-260713.pdf', pagina: 30 },
      },
      terminos: [
        { nombre: 'Duracion 12 meses Bono Streaming', descripcion: 'Aplica por 12 meses.' },
        { nombre: 'Solo un bono de $10 por BAN', limite: { unidad: 'BAN', cantidad: 1 } },
      ],
    },
  });

  assert.equal(entry.categoria, 'Streaming');
  assert.equal(entry.beneficio, '$10');
  assert.equal(entry.estado_vigente, 'vigente');
  assert.equal(entry.confirmado, true);
  assert.equal(entry.publicado, true);
  assert.equal(entry.autoaplica, false);
  assert.equal(entry.vigencia.desde, '2026-07-23');
  assert.match(entry.fuente.nombre, /Claro Full PYMES/);
  assert.match(entry.terminos_principales.join(' '), /Duracion 12 meses/);
});

test('agrega Tabletas y Modems desde la elegibilidad movil sin duplicar reglas en frontend', () => {
  const entries = buildSpecialEquipmentBenefitEntries({
    mobileVersion: { id: 'movil-2', numero: 2, estado: 'vigente' },
    equipmentResult: {
      equipos: [
        {
          equipo: { categoria: 'tablet', marca: 'Apple', modelo_oficial: 'iPad Pro', precio_regular: 1099.99, precio_financiado: 969.99 },
          beneficio: { tipo: 'descuento_monto', monto: 130 },
          plazos: [
            { meses: 24, pago_mensual: 40.42, price_code: 'F13024' },
            { meses: 30, pago_mensual: 32.33, price_code: 'F13030' },
          ],
          condiciones: ['Business Red Plus, lineas 1 a 10, modems/MIFI/tablets en financiamiento.'],
          fuente: { hoja: 'Boletin Oferta Descuentos Modems, MIFI y Tablets', pagina: 6, vigencia_desde: '2026-04-16' },
          vigencia: { desde: '2026-04-16', hasta: null },
          autoaplica: false,
        },
        {
          equipo: { categoria: 'modem', marca: 'Franklin', modelo_oficial: 'R910 MiFi', precio_regular: 139.99, precio_financiado: 9.99 },
          beneficio: { tipo: 'descuento_monto', monto: 130 },
          plazos: [
            { meses: 24, pago_mensual: 0.42, price_code: 'F13024' },
            { meses: 30, pago_mensual: 0.33, price_code: 'F13030' },
          ],
          condiciones: ['Business Red Plus, lineas 1 a 10, modems/MIFI/tablets en financiamiento.'],
          fuente: { hoja: 'Boletin Oferta Descuentos Modems, MIFI y Tablets', pagina: 6, vigencia_desde: '2026-04-16' },
          vigencia: { desde: '2026-04-16', hasta: null },
          autoaplica: false,
        },
      ],
    },
  });

  assert.deepEqual(entries.map((entry) => entry.categoria), ['Tabletas', 'Modems']);
  assert.ok(entries.every((entry) => entry.beneficio === '$130'));
  assert.ok(entries.every((entry) => entry.codigos.includes('F13024') && entry.codigos.includes('F13030')));
  assert.ok(entries.every((entry) => entry.autoaplica === false));
  assert.ok(entries.every((entry) => entry.fuente.id === null));
  assert.ok(entries.every((entry) => /Boletin Oferta Descuentos/.test(entry.fuente.nombre)));
});

test('catalogo publico agrupa fijo_benefits y beneficios de equipos especiales', () => {
  const catalog = buildBenefitsPortalCatalog({
    fixedVersion: version,
    fixedSource: claroFullSource,
    fixedRules: [
      {
        id: 'rule-1',
        identidad_comercial: 'fijo_benefits|doble_data|movil',
        estado_confianza: 'confirmado',
        estado_publicacion: 'vigente',
        autoaplica: false,
        contrato: {
          beneficio: { tipo: 'doble_data', nombre: 'Doble Data' },
          productos: ['movil'],
          condiciones: [{ descripcion: 'Cliente convergente Claro Full PYMES' }],
          fuente: { nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES @23.JUL.2026 (16)-260713.pdf', pagina: 3 },
        },
        terminos: [],
      },
    ],
    specialEquipmentEntries: [
      {
        categoria: 'Tabletas',
        nombre: 'Tabletas Business Red Plus',
        beneficio: '$130',
        publicado: true,
        confirmado: true,
        autoaplica: false,
      },
    ],
  });

  assert.equal(catalog.resumen.total_beneficios, 3);
  assert.deepEqual(catalog.resumen.dominios.sort(), ['fijo_benefits', 'ofertas_moviles']);
  assert.ok(catalog.beneficios.some((entry) => entry.categoria === 'Convergencia'));
  assert.ok(catalog.beneficios.some((entry) => entry.categoria === 'Doble data'));
  assert.ok(catalog.beneficios.some((entry) => entry.categoria === 'Tabletas'));
});

// Affinity tiene pagina propia en el portal; si tambien saliera aqui el vendedor lo veria duplicado.
test('el catalogo de Beneficios no incluye Affinity: tiene su propia vista', () => {
  const catalog = buildBenefitsPortalCatalog({
    fixedVersion: version,
    fixedSource: claroFullSource,
    fixedRules: [
      {
        id: 'rule-1',
        identidad_comercial: 'fijo_benefits|doble_data|movil',
        estado_confianza: 'confirmado',
        estado_publicacion: 'vigente',
        autoaplica: false,
        contrato: { beneficio: { tipo: 'doble_data', nombre: 'Doble Data' }, productos: ['movil'] },
        terminos: [],
      },
    ],
  });

  assert.equal(catalog.beneficios.some((entry) => entry.categoria === 'Affinity'), false);
  assert.equal(catalog.beneficios.some((entry) => entry.dominio === 'affinity_benefits'), false);
  assert.equal(catalog.resumen.dominios.includes('affinity_benefits'), false);
  assert.ok(catalog.beneficios.some((entry) => entry.categoria === 'Doble data'), 'el resto del catalogo sigue');

  const servicio = fs.readFileSync(new URL('../src/services/benefitsPortalCatalog.js', import.meta.url), 'utf8');
  assert.match(servicio, /Affinity no entra en este catalogo/);
});

// Affinity guarda la vigencia plana en el contrato; Fijo Benefits la guarda como objeto. El portal debe leer ambas.
test('la vigencia del portal se lee tanto plana como en objeto', () => {
  const base = { id: 'r', identidad_comercial: 'affinity_benefits|descuento_affinity|movil', estado_confianza: 'confirmado', estado_publicacion: 'vigente', autoaplica: false, terminos: [] };

  const plana = compositeBenefitToPortalEntry({
    version, source: null,
    rule: { ...base, contrato: { beneficio: { tipo: 'descuento_affinity', porcentaje: 8 }, vigencia_desde: '2025-11-05', vigencia_hasta: null } },
  });
  assert.equal(plana.vigencia.desde, '2025-11-05');
  assert.equal(plana.vigencia.hasta, null);

  const objeto = compositeBenefitToPortalEntry({
    version, source: null,
    rule: { ...base, contrato: { beneficio: { tipo: 'descuento_affinity', porcentaje: 8 }, vigencia: { desde: '2026-01-02', hasta: '2026-03-04' } } },
  });
  assert.equal(objeto.vigencia.desde, '2026-01-02');
  assert.equal(objeto.vigencia.hasta, '2026-03-04');
});

test('catalogo publico expone advertencias cuando faltan beneficios de equipos especiales', () => {
  const catalog = buildBenefitsPortalCatalog({
    fixedVersion: version,
    fixedSource: claroFullSource,
    fixedRules: [],
    specialEquipmentEntries: [],
    advertencias: [{ codigo: 'equipos_especiales_no_disponibles', validaciones: [{ codigo: 'sin_equipos_elegibles', estado: 'warning' }] }],
  });

  assert.equal(catalog.ok, true);
  assert.deepEqual(catalog.advertencias.map((item) => item.codigo), ['equipos_especiales_no_disponibles']);
  assert.deepEqual(buildBenefitsPortalCatalog({ fixedVersion: version, fixedSource: claroFullSource }).advertencias, []);

  const serviceSource = fs.readFileSync(new URL('../src/services/benefitsPortalCatalog.js', import.meta.url), 'utf8');
  assert.match(serviceSource, /equipos_especiales_no_disponibles/);
  assert.match(serviceSource, /version_movil_no_publicada/);
  assert.match(serviceSource, /readSpecialDiscountVigencia/);
});

test('ruta publica de Benefits lee motores publicados y no PDFs', () => {
  const routeSource = fs.readFileSync(new URL('../src/routes/fuentesComercialesRoutes.js', import.meta.url), 'utf8');
  assert.match(routeSource, /get\('\/benefits-vigentes'/);
  assert.match(routeSource, /readBenefitsPortalCatalog/);
  assert.doesNotMatch(routeSource, /benefits-vigentes[\s\S]{0,300}requireAdmin/);

  const serviceSource = fs.readFileSync(new URL('../src/services/benefitsPortalCatalog.js', import.meta.url), 'utf8');
  assert.match(serviceSource, /motor_comercial_reglas_versiones/);
  assert.match(serviceSource, /ofertas_movil_versiones/);
  assert.match(serviceSource, /v_equipos_vigentes/);
  assert.match(serviceSource, /upload_id identifies the equipment price-list history/);
  assert.doesNotMatch(serviceSource, /extract_pdf_text|pdfplumber|readFileSync|runParser/);
});

test('Portal de Beneficios consume API agregada sin codificar el descuento oficial', () => {
  const html = fs.readFileSync(new URL('../../Planes para web/benefits.html', import.meta.url), 'utf8');
  assert.match(html, /\/api\/fuentes-comerciales\/benefits-vigentes/);
  assert.match(html, /Beneficios vigentes/);
  assert.doesNotMatch(html, /\$130/);
  assert.doesNotMatch(html, /extract_pdf|\.pdf\s*['"`]/);
});
