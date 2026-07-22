import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManifestHash } from '../src/services/motorOfertasRepository.js';

test('el manifiesto es idempotente aunque los archivos lleguen en otro orden', () => {
  const a = buildManifestHash({ dominio: 'movil_equipos', normalizadorVersion: '1.0.0', fuentes: [
    { tipo: 'lista_precios', sha256: 'b'.repeat(64) },
    { tipo: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
  ] });
  const b = buildManifestHash({ dominio: 'movil_equipos', normalizadorVersion: '1.0.0', fuentes: [
    { tipo: 'tabla_financiamiento', sha256: 'a'.repeat(64) },
    { tipo: 'lista_precios', sha256: 'b'.repeat(64) },
  ] });
  assert.equal(a, b);
});
