import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFuenteComercialUpload,
  fuenteIdentityKey,
  selectLatestPublishedFuenteRevision,
} from '../src/services/fuentesComercialesVersioning.js';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);

function source(overrides = {}) {
  const base = {
    id: 'fuente-1',
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    sha256: hashA,
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
    creado_en: '2026-08-27T10:00:00.000Z',
    revision_numero: 1,
  };
  return { ...base, ...overrides };
}

test('A: mismo archivo y mismo hash queda bloqueado como duplicado exacto', () => {
  const result = classifyFuenteComercialUpload({
    existingSources: [source()],
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    sha256: hashA,
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
  });

  assert.equal(result.action, 'block');
  assert.equal(result.codigo, 'fuente_duplicada');
  assert.equal(result.tipo, 'archivo_identico_hash');
  assert.equal(result.duplicate.id, 'fuente-1');
});

test('B: mismo nombre vigencia y modulo con hash distinto se permite como nueva revision', () => {
  const result = classifyFuenteComercialUpload({
    existingSources: [source()],
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    sha256: hashB,
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
  });

  assert.equal(result.action, 'allow');
  assert.equal(result.codigo, 'nueva_revision_fuente');
  assert.equal(result.tipo, 'nueva_revision_misma_fuente');
  assert.equal(result.revision_numero, 2);
  assert.equal(result.previous.id, 'fuente-1');
});

test('C: mismo nombre con vigencia distinta y hash distinto se permite como nueva version de vigencia', () => {
  const result = classifyFuenteComercialUpload({
    existingSources: [source()],
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    sha256: hashB,
    vigencia_desde: '2026-09-17',
    vigencia_hasta: '2026-10-01',
  });

  assert.equal(result.action, 'allow');
  assert.equal(result.codigo, 'nueva_vigencia_fuente');
  assert.equal(result.tipo, 'nueva_vigencia_misma_fuente');
  assert.equal(result.revision_numero, 1);
});

test('D: nombre diferente con mismo hash se detecta por archivo identico y no duplica', () => {
  const result = classifyFuenteComercialUpload({
    existingSources: [source({ nombre_original: 'Nombre anterior.pdf' })],
    familia: 'beneficios',
    nombre_original: 'Nombre corregido.pdf',
    sha256: hashA,
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
  });

  assert.equal(result.action, 'block');
  assert.equal(result.codigo, 'fuente_duplicada');
  assert.equal(result.tipo, 'archivo_identico_hash');
});

test('D2: mismo hash con procesamiento fallido permite reintento sin exigir renombrar archivo', () => {
  const result = classifyFuenteComercialUpload({
    existingSources: [source({
      notas: 'No se pudo validar la vigencia del boletín inalámbrico. No se reemplazó nada.',
      vigencia_documental: 'pendiente_confirmacion',
    })],
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    sha256: hashA,
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
  });

  assert.equal(result.action, 'reuse_failed');
  assert.equal(result.codigo, 'reintento_fuente_fallida');
  assert.equal(result.tipo, 'archivo_identico_reprocesable');
  assert.equal(result.previous.id, 'fuente-1');
});

test('D3: mismo hash procesado correctamente queda bloqueado como duplicado exacto', () => {
  const result = classifyFuenteComercialUpload({
    existingSources: [source({
      notas: null,
      vigencia_documental: 'vigente',
      estado: 'activa',
    })],
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    sha256: hashA,
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
  });

  assert.equal(result.action, 'block');
  assert.equal(result.codigo, 'fuente_duplicada');
  assert.equal(result.tipo, 'archivo_identico_hash');
});

test('E y F: al publicar revision 2 el consumidor selecciona la ultima revision publicada y vigente', () => {
  const identidad = fuenteIdentityKey({
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
  });
  const revision1 = source({
    id: 'revision-1',
    sha256: hashA,
    revision_numero: 1,
    identidad_comercial_key: identidad,
    estado_publicacion: 'reemplazada',
  });
  const revision2 = source({
    id: 'revision-2',
    sha256: hashB,
    revision_numero: 2,
    identidad_comercial_key: identidad,
    estado_publicacion: 'vigente',
    creado_en: '2026-08-28T10:00:00.000Z',
  });
  const revision3NoPublicada = source({
    id: 'revision-3-borrador',
    sha256: hashC,
    revision_numero: 3,
    identidad_comercial_key: identidad,
    estado_publicacion: 'borrador',
    creado_en: '2026-08-29T10:00:00.000Z',
  });

  const selected = selectLatestPublishedFuenteRevision([revision1, revision2, revision3NoPublicada], {
    familia: 'ofertas_moviles',
    nombre_original: 'Boletin Ofertas Business RED Plus 27-08-2026.pdf',
    vigencia_desde: '2026-08-27',
    vigencia_hasta: '2026-09-16',
    asOf: '2026-09-01',
  });

  assert.equal(selected.id, 'revision-2');
  assert.equal(selected.sha256, hashB);
});
