import assert from 'node:assert/strict';
import { test } from 'node:test';

test('resume altas, bajas y cambios contra la version vigente', async () => {
  const { buildMotorOfertasImportSummary } = await import('../src/services/motorOfertasImportSummary.js');
  const summary = buildMotorOfertasImportSummary({
    normalized: {
      summary: { filas_procesadas: 3, equipment: 3 },
      offers: [
        {
          contract: { id: 'oferta-a', nombre: 'Oferta A', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] },
          equipment: [{ equipo_key: 'equipo-a', modelo_comercial: 'Equipo A', precio_regular: 100 }],
        },
        {
          contract: { id: 'oferta-b', nombre: 'Oferta B actualizada', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] },
          equipment: [{ equipo_key: 'equipo-b', modelo_comercial: 'Equipo B', precio_regular: 150 }],
        },
        {
          contract: { id: 'oferta-c', nombre: 'Oferta C', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] },
          equipment: [{ equipo_key: 'equipo-c', modelo_comercial: 'Equipo C', precio_regular: 200 }],
        },
      ],
    },
    currentSnapshot: {
      offers: [
        { id: 'a', oferta_key: 'oferta-a', contrato: { id: 'oferta-a', nombre: 'Oferta A', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] } },
        { id: 'b', oferta_key: 'oferta-b', contrato: { id: 'oferta-b', nombre: 'Oferta B anterior', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] } },
        { id: 'z', oferta_key: 'oferta-z', contrato: { id: 'oferta-z', nombre: 'Oferta retirada', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] } },
      ],
      equipment: [
        { oferta_id: 'a', equipo_key: 'equipo-a', modelo_comercial: 'Equipo A', precio_regular: 100 },
        { oferta_id: 'b', equipo_key: 'equipo-b', modelo_comercial: 'Equipo B', precio_regular: 120 },
        { oferta_id: 'z', equipo_key: 'equipo-z', modelo_comercial: 'Equipo Z', precio_regular: 300 },
      ],
    },
  });

  assert.deepEqual(summary, {
    filas_procesadas: 3,
    ofertas_nuevas: 1,
    ofertas_modificadas: 1,
    ofertas_salieron: 1,
    equipos_nuevos: 1,
    equipos_salieron: 1,
    precios_nuevos_modificados: 2,
    cambios_detectados: 7,
  });
});

test('trata la primera importacion como altas sin version vigente', async () => {
  const { buildMotorOfertasImportSummary } = await import('../src/services/motorOfertasImportSummary.js');
  const summary = buildMotorOfertasImportSummary({
    normalized: {
      summary: { filas_procesadas: 1, equipment: 1 },
      offers: [{
        contract: { id: 'oferta-a', nombre: 'Oferta A', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] },
        equipment: [{ equipo_key: 'equipo-a', modelo_comercial: 'Equipo A', precio_regular: 100 }],
      }],
    },
    currentSnapshot: null,
  });

  assert.equal(summary.ofertas_nuevas, 1);
  assert.equal(summary.equipos_nuevos, 1);
  assert.equal(summary.precios_nuevos_modificados, 1);
  assert.equal(summary.cambios_detectados, 3);
});
