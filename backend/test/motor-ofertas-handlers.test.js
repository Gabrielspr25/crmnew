import assert from 'node:assert/strict';
import { test } from 'node:test';

const handlersPath = '../src/services/motorOfertasHandlers.js';

async function loadHandlers() {
  return import(handlersPath);
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function file(fieldname, name, content = 'excel') {
  return {
    fieldname,
    originalname: name,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(content),
    size: Buffer.byteLength(content),
  };
}

function validFiles() {
  return {
    tabla_financiamiento: [file('tabla_financiamiento', 'tabla.xlsx', 'tabla')],
    lista_precios: [file('lista_precios', 'lista.xlsx', 'lista')],
  };
}

function validEligibilityRequest() {
  return {
    linea: {
      id: 'linea-1',
      tipo: 'individual',
      plan: { codigo: 'PLAN-35', nombre: 'Plan 35', monto: 35 },
      evento: 'linea_nueva',
      convergente: false,
      trade_in: { estado: 'no_requiere', validado: false },
    },
    contexto_ban: {
      posicion_en_ban: 1,
      beneficios_usados_por_oferta: {},
    },
  };
}

function makeDependencies(overrides = {}) {
  const {
    repository: repositoryOverrides = {},
    ...dependencyOverrides
  } = overrides;
  const calls = {
    archive: [],
    normalize: [],
    createPreview: [],
    findIdentity: [],
    snapshot: [],
    evaluate: [],
    approve: [],
  };
  const repository = {
    async getCurrentVersionWithSources() {
      return null;
    },
    async getCurrentVersion() {
      return null;
    },
    async getEligibleSnapshot(versionId) {
      calls.snapshot.push(versionId);
      return { offers: [], equipment: [] };
    },
    async findVersionByIdentity(input) {
      calls.findIdentity.push(input);
      return null;
    },
    async createPreview(input) {
      calls.createPreview.push(input);
      return {
        reutilizada: false,
        version: { id: 'version-1', estado: 'pendiente_revision' },
        resumen: input.normalized.summary,
      };
    },
    async approveVersion(input) {
      calls.approve.push(input);
      return { id: input.versionId, estado: input.activate ? 'vigente' : 'aprobada' };
    },
    ...repositoryOverrides,
  };
  const dependencies = {
    repository,
    normalizadorVersion: '1.0.0',
    uploadRoot: 'C:\\tmp\\motor-ofertas-test',
    archiveOfferSource: async (input) => {
      calls.archive.push(input);
      return {
        type: input.type,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sha256: input.type === 'tabla_financiamiento' ? 'a'.repeat(64) : 'b'.repeat(64),
        archivedName: `${input.type}.xlsx`,
        relativePath: `${input.type}/${input.type}.xlsx`,
      };
    },
    buildSourcesManifest: (sources) => ({
      entries: sources.map(({ type, sha256 }) => ({ type, sha256 })),
      sha256: 'c'.repeat(64),
    }),
    inferSourceValidity: () => ({
      tabla_financiamiento: { desde: null, hasta: null, estado: 'pendiente_confirmacion' },
      lista_precios: { desde: null, hasta: null, estado: 'pendiente_confirmacion' },
      preview: { desde: null, hasta: null, estado: 'pendiente_confirmacion' },
    }),
    normalizeOfferWorkbooks: (input) => {
      calls.normalize.push(input);
      return { offers: [], contradictions: [], summary: { offers: 0, equipment: 0 } };
    },
    evaluateEligibleOffers: (input) => {
      calls.evaluate.push(input);
      return { equipos: [], validaciones: [] };
    },
    ...dependencyOverrides,
  };
  return { dependencies, calls };
}

test('preview incompleto responde el contrato fijo sin archivar ni persistir', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies();
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.preview({ files: {}, body: {}, user: { nick: 'admin' } }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, {
    error: 'preview_incompleto',
    archivos_faltantes: ['tabla_financiamiento', 'lista_precios'],
  });
  assert.deepEqual(calls.archive, []);
  assert.deepEqual(calls.createPreview, []);
});

test('preview reutiliza una identidad existente antes de normalizar o persistir', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const existing = { id: 'version-existente', estado: 'pendiente_revision' };
  const { dependencies, calls } = makeDependencies({
    repository: {
      async findVersionByIdentity(input) {
        calls.findIdentity.push(input);
        return existing;
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.preview({
    files: validFiles(),
    body: { normalizador_version: '1.0.0' },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, reutilizada: true, version: existing, resumen: undefined });
  assert.equal(calls.archive.length, 2);
  assert.equal(calls.normalize.length, 0);
  assert.equal(calls.createPreview.length, 0);
});

test('preview usa IDs de fuentes archivadas y no persiste si el parser falla', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    normalizeOfferWorkbooks() {
      throw new Error('xlsx invalido');
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.preview({
    files: validFiles(),
    body: { normalizador_version: '1.0.0' },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'parser_error' });
  assert.equal(calls.archive.length, 2);
  assert.equal(calls.createPreview.length, 0);
});

test('elegibles sin version vigente devuelve vacio y nunca consulta un catalogo general', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies();
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.elegibles({ body: validEligibilityRequest() }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    ok: true,
    equipos: [],
    validaciones: [{ codigo: 'version_vigente_no_disponible', estado: 'info' }],
  });
  assert.deepEqual(calls.snapshot, []);
});

test('elegibles consulta exclusivamente el snapshot de la version vigente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const current = { id: 'version-vigente', dominio: 'movil_equipos', estado: 'vigente' };
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getCurrentVersion() {
        return current;
      },
    },
    evaluateEligibleOffers(input) {
      calls.evaluate.push(input);
      return { equipos: [{ equipo: { id: 'sku-1' } }], validaciones: [] };
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.elegibles({ body: validEligibilityRequest() }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.snapshot, ['version-vigente']);
  assert.equal(calls.evaluate[0].snapshot.offers.length, 0);
  assert.deepEqual(res.body.equipos, [{ equipo: { id: 'sku-1' } }]);
});

test('aprobar usa el actor autenticado y traduce errores de dominio', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const domainError = new Error('no encontrado');
  domainError.code = 'version_no_encontrada';
  const { dependencies, calls } = makeDependencies({
    repository: {
      async approveVersion(input) {
        calls.approve.push(input);
        throw domainError;
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: 'version-a', activar: true, version_vigente_esperada_id: null, motivo: 'Revision' },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'version_no_encontrada' });
  assert.deepEqual(calls.approve[0], {
    versionId: 'version-a',
    activate: true,
    expectedCurrentVersionId: null,
    actor: 'supervisor-a',
    reason: 'Revision',
  });
});

test('aprobar no activa una version con vigencia pendiente de confirmacion', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getEligibleSnapshot() {
        return {
          offers: [{
            vigencia_documental: 'pendiente_confirmacion',
            contrato: JSON.stringify({
              vigencia: { estado: 'pendiente_confirmacion' },
            }),
          }],
          equipment: [],
        };
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: 'version-pendiente', activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'vigencia_pendiente_confirmacion' });
  assert.deepEqual(calls.approve, []);
});
