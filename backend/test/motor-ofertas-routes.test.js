import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const routesPath = '../src/routes/motorOfertasRoutes.js';

async function withServer(router, run) {
  const app = express();
  app.use(express.json());
  app.use('/api/motor-ofertas', router);
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}/api/motor-ofertas`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function dependencies() {
  return {
    normalizadorVersion: '1.0.0',
    uploadRoot: 'C:\\tmp\\motor-ofertas-test',
    repository: {
      async getCurrentVersionWithSources() {
        return { version: { id: 'vigente-1', estado: 'vigente' }, sources: [] };
      },
      async getCurrentVersion() {
        return null;
      },
      async getLatestPriceListSource() {
        return null;
      },
      async findVersionByIdentity() {
        return null;
      },
      async createPreview() {
        return { reutilizada: false, version: { id: 'preview-1' }, resumen: {} };
      },
      async approveVersion() {
        return { id: 'preview-1', estado: 'aprobada' };
      },
      async getEligibleSnapshot() {
        return { offers: [], equipment: [] };
      },
      async getLatestReviewVersion() {
        return null;
      },
      async saveReviewDecision() {
        return { actualizadas: 0 };
      },
    },
    archiveOfferSource: async (input) => ({
      type: input.type,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sha256: input.type === 'tabla_financiamiento' ? 'a'.repeat(64) : 'b'.repeat(64),
      archivedName: `${input.type}.xlsx`,
      relativePath: `${input.type}/${input.type}.xlsx`,
    }),
    buildSourcesManifest: () => ({ entries: [], sha256: 'c'.repeat(64) }),
    inferSourceValidity: () => ({
      tabla_financiamiento: { desde: null, hasta: null, estado: 'pendiente_confirmacion' },
      lista_precios: { desde: null, hasta: null, estado: 'pendiente_confirmacion' },
      preview: { desde: null, hasta: null, estado: 'pendiente_confirmacion' },
    }),
    normalizeOfferWorkbooks: () => ({ offers: [], contradictions: [], summary: {} }),
    evaluateEligibleOffers: () => ({ equipos: [], validaciones: [] }),
    readArchivedOfferSources: async () => ({
      financingBuffer: Buffer.from('tabla'),
      priceListBuffer: Buffer.from('lista'),
    }),
    readArchivedOfferSource: async () => Buffer.from('lista'),
    buildOfferReviewSnapshot: () => ({
      ok: true,
      resumen: {},
      equipos: [],
      business_red: [],
    }),
  };
}

function token(rol) {
  return jwt.sign({ nick: `${rol}-user`, rol }, process.env.JWT_SECRET || 'dev-secret-cambiar', { expiresIn: '1h' });
}

test('el default real versiona el snapshot comercial actualizado', async () => {
  const { DEFAULT_NORMALIZADOR_VERSION } = await import(routesPath);

  assert.equal(DEFAULT_NORMALIZADOR_VERSION, '1.0.3');
});

test('las rutas del motor rechazan Bearer ausente o invalido incluso con DEV_LOGIN=1', async () => {
  const { createMotorOfertasRouter } = await import(routesPath);
  const previous = process.env.DEV_LOGIN;
  process.env.DEV_LOGIN = '1';
  try {
    await withServer(createMotorOfertasRouter(dependencies()), async (baseUrl) => {
      for (const [path, options] of [
        ['/version-vigente', {}],
        ['/revision-actual', {}],
        ['/versiones/00000000-0000-4000-8000-000000000001/revision/equivalencias', { method: 'POST' }],
        ['/versiones/00000000-0000-4000-8000-000000000001/revision/business-red', { method: 'POST' }],
        ['/preview', { method: 'POST' }],
        ['/aprobar', { method: 'POST' }],
        ['/elegibles', { method: 'POST' }],
      ]) {
        const missing = await fetch(`${baseUrl}${path}`, options);
        assert.equal(missing.status, 401, `${path} sin Bearer`);
        const invalid = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: { Authorization: 'Bearer invalido' },
        });
        assert.equal(invalid.status, 401, `${path} con Bearer invalido`);
      }
    });
  } finally {
    if (previous === undefined) delete process.env.DEV_LOGIN;
    else process.env.DEV_LOGIN = previous;
  }
});

test('las revisiones, preview y aprobar exigen admin o supervisor, mientras version vigente admite vendedor', async () => {
  const { createMotorOfertasRouter } = await import(routesPath);
  await withServer(createMotorOfertasRouter(dependencies()), async (baseUrl) => {
    const vendedor = { Authorization: `Bearer ${token('vendedor')}` };
    const admin = { Authorization: `Bearer ${token('admin')}` };
    const version = await fetch(`${baseUrl}/version-vigente`, { headers: vendedor });
    assert.equal(version.status, 200);
    const revision = await fetch(`${baseUrl}/revision-actual`, { headers: vendedor });
    assert.equal(revision.status, 403);
    const preview = await fetch(`${baseUrl}/preview`, { method: 'POST', headers: vendedor });
    assert.equal(preview.status, 403);
    const aprobar = await fetch(`${baseUrl}/aprobar`, {
      method: 'POST',
      headers: { ...vendedor, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: 'preview-1', activar: false }),
    });
    assert.equal(aprobar.status, 403);
    const previewIncompleto = await fetch(`${baseUrl}/preview`, { method: 'POST', headers: admin });
    assert.equal(previewIncompleto.status, 422);
    assert.deepEqual(await previewIncompleto.json(), {
      error: 'preview_incompleto',
      archivos_faltantes: ['tabla_financiamiento', 'lista_precios'],
    });
  });
});

test('el preview desde el tab Ofertas exige admin y no acepta una lista inexistente', async () => {
  const { createMotorOfertasRouter } = await import(routesPath);
  await withServer(createMotorOfertasRouter(dependencies()), async (baseUrl) => {
    const form = new FormData();
    form.append('tabla_financiamiento', new Blob(['tabla'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }), 'boletin.xlsx');

    const vendedor = await fetch(`${baseUrl}/preview-tabla`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('vendedor')}` },
      body: form,
    });
    assert.equal(vendedor.status, 403);

    const adminForm = new FormData();
    adminForm.append('tabla_financiamiento', new Blob(['tabla'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }), 'boletin.xlsx');
    const admin = await fetch(`${baseUrl}/preview-tabla`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: adminForm,
    });
    assert.equal(admin.status, 422);
    assert.deepEqual(await admin.json(), { error: 'lista_precios_no_aceptada' });
  });
});
