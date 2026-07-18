import assert from 'node:assert/strict';
import { test } from 'node:test';

const handlersPath = '../src/services/motorOfertasHandlers.js';
const VERSION_ID = '00000000-0000-4000-8000-000000000001';

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
    versionSources: [],
    review: [],
    reviewDecision: [],
    readPriceSource: [],
  };
  const repository = {
    async getCurrentVersionWithSources() {
      return null;
    },
    async getCurrentVersion() {
      return null;
    },
    async getLatestPriceListSource() {
      return null;
    },
    async getVersionWithSources(versionId) {
      calls.versionSources.push(versionId);
      return {
        version: { id: versionId, dominio: 'movil_equipos', estado: 'pendiente_revision' },
        sources: [
          {
            tipo: 'tabla_financiamiento',
            vigencia_documental: 'vigente',
            vigencia_desde: '2026-07-01',
            vigencia_hasta: '2026-07-31',
          },
          {
            tipo: 'lista_precios',
            vigencia_documental: 'vigente',
            vigencia_desde: '2026-07-01',
            vigencia_hasta: '2026-07-31',
          },
        ],
      };
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
    async getLatestReviewVersion() {
      return { id: VERSION_ID, numero: 4, estado: 'pendiente_revision' };
    },
    async saveReviewDecision(input) {
      calls.reviewDecision.push(input);
      return { actualizadas: input.contradiccionIds.length };
    },
    ...repositoryOverrides,
  };
  const dependencies = {
    repository,
    normalizadorVersion: '1.0.0',
    now: () => new Date('2026-07-13T12:00:00.000Z'),
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
    readArchivedOfferSources: async () => ({
      financingBuffer: Buffer.from('tabla'),
      priceListBuffer: Buffer.from('lista'),
    }),
    readArchivedOfferSource: async (input) => {
      calls.readPriceSource.push(input);
      return Buffer.from('lista');
    },
    buildOfferReviewSnapshot: (input) => {
      calls.review.push(input);
      return {
        ok: true,
        version: input.version,
        resumen: { bloqueos_totales: 54, bloqueos_equipos: 49, bloqueos_business_red: 5 },
        equipos: [],
        business_red: [],
      };
    },
    ...dependencyOverrides,
  };
  return { dependencies, calls };
}

test('revision actual lee la version pendiente y no altera contratos comerciales', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getVersionWithSources(versionId) {
        return {
          version: { id: versionId, numero: 4, estado: 'pendiente_revision' },
          sources: [
            { tipo: 'tabla_financiamiento', ruta_relativa: 'tabla.xlsx', sha256: 'a'.repeat(64) },
            { tipo: 'lista_precios', ruta_relativa: 'lista.xlsx', sha256: 'b'.repeat(64) },
          ],
          contradicciones: [{ id: 'equipo-1', codigo: 'equipo_sin_coincidencia_exacta' }],
        };
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.revisionActual({ user: { nick: 'admin' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.resumen.bloqueos_totales, 54);
  assert.equal(calls.review.length, 1);
  assert.deepEqual(calls.approve, []);
  assert.deepEqual(calls.createPreview, []);
});

test('guardar equivalencia propuesta cambia solo los bloqueos enviados explicitamente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    buildOfferReviewSnapshot: () => ({
      equipos: [{
        id: '00000000-0000-4000-8000-000000000011',
        candidatos: [{ id: 'SIF-A37|Finan Equipos Movil|18', sku_sif: 'SIF-A37', modelo: 'Samsung Galaxy A37' }],
      }],
      business_red: [],
    }),
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.guardarEquivalenciaPropuesta({
    params: { versionId: VERSION_ID },
    body: {
      contradiccion_ids: ['00000000-0000-4000-8000-000000000011'],
      candidate_id: 'SIF-A37|Finan Equipos Movil|18',
    },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.reviewDecision[0].contradiccionIds, ['00000000-0000-4000-8000-000000000011']);
  assert.equal(calls.reviewDecision[0].decision.aplicada, false);
  assert.deepEqual(calls.approve, []);
});

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

test('preview informa solo la fuente requerida ausente sin archivar ni persistir', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies();
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.preview({
    files: { tabla_financiamiento: validFiles().tabla_financiamiento },
    body: {},
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, {
    error: 'preview_incompleto',
    archivos_faltantes: ['lista_precios'],
  });
  assert.deepEqual(calls.archive, []);
  assert.deepEqual(calls.createPreview, []);
});

test('el boletin de Ofertas usa la ultima lista aceptada sin pedir que se cargue de nuevo', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const priceSource = {
    tipo: 'lista_precios',
    nombre_original: 'lista-vigente.xlsx',
    nombre_archivado: 'lista-vigente-archivada.xlsx',
    ruta_relativa: 'lista_precios/lista-vigente-archivada.xlsx',
    sha256: 'b'.repeat(64),
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes: 123,
    vigencia_desde: '2026-05-28',
    vigencia_hasta: '2026-07-31',
    vigencia_documental: 'vigente',
  };
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getLatestPriceListSource() {
        return priceSource;
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.previewTabla({
    file: file('tabla_financiamiento', 'boletin-ofertas.xlsx', 'tabla-nueva'),
    body: { normalizador_version: '1.0.0' },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.archive.length, 1);
  assert.equal(calls.archive[0].type, 'tabla_financiamiento');
  assert.deepEqual(calls.readPriceSource, [{
    rootDir: 'C:\\tmp\\motor-ofertas-test',
    source: priceSource,
  }]);
  assert.equal(calls.normalize[0].financingBuffer.toString(), 'tabla-nueva');
  assert.equal(calls.normalize[0].priceListBuffer.toString(), 'lista');
  assert.deepEqual(calls.createPreview[0].sources.map((source) => source.type), [
    'tabla_financiamiento',
    'lista_precios',
  ]);
});

test('el boletin conserva la vigencia oficial ingresada cuando el nombre no trae fechas', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const priceSource = {
    tipo: 'lista_precios',
    nombre_original: 'lista-vigente.xlsx',
    nombre_archivado: 'lista-vigente-archivada.xlsx',
    ruta_relativa: 'lista_precios/lista-vigente-archivada.xlsx',
    sha256: 'b'.repeat(64),
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes: 123,
    vigencia_desde: '2026-07-01',
    vigencia_hasta: '2026-07-31',
    vigencia_documental: 'vigente',
  };
  const { dependencies, calls } = makeDependencies({
    repository: { async getLatestPriceListSource() { return priceSource; } },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.previewTabla({
    file: file('tabla_financiamiento', 'boletin-sin-fecha.xlsx', 'tabla-nueva'),
    body: {
      normalizador_version: '1.0.0',
      vigencia_inicio: '2026-07-10',
      vigencia_fin: '2026-07-21',
    },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.createPreview[0].sources[0].validity, {
    from: '2026-07-10',
    to: '2026-07-21',
    state: 'vigente',
  });
  assert.deepEqual(calls.normalize[0].vigencia, {
    desde: '2026-07-10',
    hasta: '2026-07-21',
    estado: 'vigente',
  });
});

test('el boletin rechaza una vigencia manual incompleta sin archivar ni persistir', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies();
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.previewTabla({
    file: file('tabla_financiamiento', 'boletin-sin-fecha.xlsx'),
    body: { normalizador_version: '1.0.0', vigencia_inicio: '2026-07-16' },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'vigencia_manual_invalida' });
  assert.deepEqual(calls.archive, []);
  assert.deepEqual(calls.createPreview, []);
});

test('el boletin de Ofertas no crea version si todavia no hay lista de precios aceptada', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies();
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.previewTabla({
    file: file('tabla_financiamiento', 'boletin-ofertas.xlsx'),
    body: { normalizador_version: '1.0.0' },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'lista_precios_no_aceptada' });
  assert.deepEqual(calls.archive, []);
  assert.deepEqual(calls.createPreview, []);
});

test('preview reutilizado devuelve vigencia y contradicciones persistidas sin normalizar ni persistir', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const existing = {
    id: '00000000-0000-4000-8000-000000000099',
    estado: 'pendiente_revision',
    resumen: { ofertas: 2, equipos: 4, contradicciones_abiertas: 1, contradicciones_bloqueantes: 1 },
  };
  const persisted = {
    version: existing,
    sources: [
      { tipo: 'tabla_financiamiento', vigencia_desde: '2026-07-01T04:00:00.000Z', vigencia_hasta: '2026-07-31T04:00:00.000Z', vigencia_documental: 'vigente' },
      { tipo: 'lista_precios', vigencia_desde: '2026-07-01T04:00:00.000Z', vigencia_hasta: '2026-07-31T04:00:00.000Z', vigencia_documental: 'vigente' },
    ],
    contradicciones: [{
      id: '00000000-0000-4000-8000-000000000098',
      codigo: 'equipo_sin_coincidencia_exacta',
      bloqueante: true,
      estado: 'abierta',
      detalle: 'Modelo sin coincidencia exacta.',
    }],
  };
  const { dependencies, calls } = makeDependencies({
    repository: {
      async findVersionByIdentity(input) {
        calls.findIdentity.push(input);
        return existing;
      },
      async getVersionWithSources(versionId, options) {
        calls.versionSources.push({ versionId, options });
        return persisted;
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
  assert.deepEqual(res.body, {
    ok: true,
    reutilizada: true,
    version: existing,
    resumen: existing.resumen,
    vigencia: { desde: '2026-07-01', hasta: '2026-07-31', estado: 'vigente' },
    fuentes: {
      tabla_financiamiento: { desde: '2026-07-01', hasta: '2026-07-31', estado: 'vigente' },
      lista_precios: { desde: '2026-07-01', hasta: '2026-07-31', estado: 'vigente' },
    },
    contradicciones: persisted.contradicciones,
  });
  assert.deepEqual(calls.versionSources, [{
    versionId: existing.id,
    options: { includeContradictions: true },
  }]);
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

test('preview adapta la vigencia inferida al shape persistido por el repositorio', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    inferSourceValidity: () => ({
      tabla_financiamiento: { desde: '2026-07-04', hasta: '2026-07-15', estado: 'vigente' },
      lista_precios: { desde: '2026-05-28', hasta: '2026-07-31', estado: 'vigente' },
      preview: { desde: '2026-07-04', hasta: '2026-07-15', estado: 'vigente' },
    }),
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.preview({
    files: validFiles(),
    body: { normalizador_version: '1.0.0' },
    user: { nick: 'admin' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.createPreview[0].sources.map((source) => source.validity), [
    { from: '2026-07-04', to: '2026-07-15', state: 'vigente' },
    { from: '2026-05-28', to: '2026-07-31', state: 'vigente' },
  ]);
  assert.deepEqual(calls.normalize[0].vigencia, {
    desde: '2026-07-04',
    hasta: '2026-07-15',
    estado: 'vigente',
  });
  assert.deepEqual(res.body.vigencia, {
    desde: '2026-07-04',
    hasta: '2026-07-15',
    estado: 'vigente',
  });
  assert.deepEqual(res.body.fuentes, {
    tabla_financiamiento: {
      desde: '2026-07-04',
      hasta: '2026-07-15',
      estado: 'vigente',
    },
    lista_precios: {
      desde: '2026-05-28',
      hasta: '2026-07-31',
      estado: 'vigente',
    },
  });
});

test('preview persiste y devuelve el resumen de cambios contra la version vigente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const snapshotsConsultados = [];
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getCurrentVersion() {
        return { id: 'version-vigente', estado: 'vigente' };
      },
      async getEligibleSnapshot(versionId) {
        snapshotsConsultados.push(versionId);
        return {
          offers: [{
            id: 'oferta-a',
            oferta_key: 'oferta-a',
            contrato: { id: 'oferta-a', nombre: 'Oferta anterior', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] },
          }],
          equipment: [{ oferta_id: 'oferta-a', equipo_key: 'equipo-a', precio_regular: 100 }],
        };
      },
    },
    normalizeOfferWorkbooks() {
      return {
        summary: { filas_procesadas: 1, offers: 1, equipment: 1 },
        contradictions: [],
        offers: [{
          contract: { id: 'oferta-a', nombre: 'Oferta actualizada', tipos_plan: ['individual'], eventos: ['linea_nueva'], plazos: [30] },
          equipment: [{ equipo_key: 'equipo-a', precio_regular: 120 }],
        }],
      };
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
  assert.deepEqual(snapshotsConsultados, ['version-vigente']);
  assert.deepEqual(calls.createPreview[0].normalized.summary, {
    filas_procesadas: 1,
    offers: 1,
    equipment: 1,
    ofertas_nuevas: 0,
    ofertas_modificadas: 1,
    ofertas_salieron: 0,
    equipos_nuevos: 0,
    equipos_salieron: 0,
    precios_nuevos_modificados: 1,
    cambios_detectados: 2,
  });
  assert.equal(res.body.resumen.cambios_detectados, 2);
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
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null, motivo: 'Revision' },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'version_no_encontrada' });
  assert.deepEqual(calls.approve[0], {
    versionId: VERSION_ID,
    activate: true,
    expectedCurrentVersionId: null,
    actor: 'supervisor-a',
    reason: 'Revision',
  });
});

test('aprobar responde 409 ante contradicciones bloqueantes', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const domainError = new Error('contradicciones abiertas');
  domainError.code = 'contradicciones_bloqueantes';
  const { dependencies } = makeDependencies({
    repository: {
      async approveVersion() {
        throw domainError;
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: VERSION_ID, activar: false },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'contradicciones_bloqueantes' });
});

test('aprobar no activa una version con vigencia documental distinta de vigente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  for (const vigencia of ['pendiente_confirmacion', 'vencida']) {
    const { dependencies, calls } = makeDependencies({
      repository: {
        async getEligibleSnapshot() {
          return {
            offers: [{
              vigencia_documental: vigencia,
              contrato: JSON.stringify({ vigencia: { estado: vigencia } }),
            }],
            equipment: [],
          };
        },
      },
    });
    const handlers = createMotorOfertasHandlers(dependencies);
    const res = response();

    await handlers.aprobar({
      body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
      user: { nick: 'supervisor-a' },
    }, res);

    assert.equal(res.statusCode, 422, vigencia);
    assert.deepEqual(res.body, { error: 'vigencia_documental_no_vigente' }, vigencia);
    assert.deepEqual(calls.approve, [], vigencia);
  }
});

test('aprobar bloquea una version sin ofertas si una fuente requerida no esta vigente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getVersionWithSources(versionId) {
        calls.versionSources.push(versionId);
        return {
          version: { id: versionId, dominio: 'movil_equipos', estado: 'pendiente_revision' },
          sources: [
            { tipo: 'tabla_financiamiento', vigencia_documental: 'vencida' },
            { tipo: 'lista_precios', vigencia_documental: 'vigente' },
          ],
        };
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'vigencia_documental_no_vigente' });
  assert.deepEqual(calls.approve, []);
});

test('aprobar bloquea una version sin las dos fuentes requeridas', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getVersionWithSources(versionId) {
        calls.versionSources.push(versionId);
        return {
          version: { id: versionId, dominio: 'movil_equipos', estado: 'pendiente_revision' },
          sources: [{ tipo: 'tabla_financiamiento', vigencia_documental: 'vigente' }],
        };
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'vigencia_documental_no_vigente' });
  assert.deepEqual(calls.approve, []);
});

test('aprobar permite una version sin ofertas cuando ambas fuentes requeridas estan vigentes', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies();
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.versionSources, [VERSION_ID]);
  assert.equal(calls.approve.length, 1);
});

test('aprobar acepta fechas Date de node-postgres dentro de la vigencia', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const desde = new Date('2026-07-04T00:00:00.000Z');
  const hasta = new Date('2026-07-15T00:00:00.000Z');
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getVersionWithSources(versionId) {
        calls.versionSources.push(versionId);
        return {
          version: { id: versionId, dominio: 'movil_equipos', estado: 'pendiente_revision' },
          sources: [
            {
              tipo: 'tabla_financiamiento',
              vigencia_documental: 'vigente',
              vigencia_desde: desde,
              vigencia_hasta: hasta,
            },
            {
              tipo: 'lista_precios',
              vigencia_documental: 'vigente',
              vigencia_desde: desde,
              vigencia_hasta: hasta,
            },
          ],
        };
      },
      async getEligibleSnapshot() {
        return {
          offers: [{
            vigencia_documental: 'vigente',
            vigencia_desde: desde,
            vigencia_hasta: hasta,
            contrato: JSON.stringify({
              vigencia: { desde: '2026-07-04', hasta: '2026-07-15', estado: 'vigente' },
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
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.approve.length, 1);
});

test('aprobar bloquea una fuente vencida por fecha aunque su estado sea vigente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getVersionWithSources(versionId) {
        calls.versionSources.push(versionId);
        return {
          version: { id: versionId, dominio: 'movil_equipos', estado: 'pendiente_revision' },
          sources: [
            {
              tipo: 'tabla_financiamiento',
              vigencia_documental: 'vigente',
              vigencia_desde: '2026-07-01',
              vigencia_hasta: '2026-07-12',
            },
            {
              tipo: 'lista_precios',
              vigencia_documental: 'vigente',
              vigencia_desde: '2026-07-01',
              vigencia_hasta: '2026-07-31',
            },
          ],
        };
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'vigencia_documental_no_vigente' });
  assert.deepEqual(calls.approve, []);
});

test('aprobar bloquea una oferta vencida por fecha aunque su estado sea vigente', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const { dependencies, calls } = makeDependencies({
    repository: {
      async getEligibleSnapshot() {
        return {
          offers: [{
            vigencia_documental: 'vigente',
            vigencia_desde: '2026-07-01',
            vigencia_hasta: '2026-07-12',
            contrato: JSON.stringify({
              vigencia: {
                desde: '2026-07-01',
                hasta: '2026-07-12',
                estado: 'vigente',
              },
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
    body: { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: null },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'vigencia_documental_no_vigente' });
  assert.deepEqual(calls.approve, []);
});

test('aprobar rechaza UUIDs invalidos antes de consultar el repositorio', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  for (const body of [
    { version_id: 'no-es-uuid', activar: true },
    { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: 'no-es-uuid' },
    { version_id: VERSION_ID, activar: true, version_vigente_esperada_id: 42 },
  ]) {
    const { dependencies, calls } = makeDependencies();
    const handlers = createMotorOfertasHandlers(dependencies);
    const res = response();

    await handlers.aprobar({ body, user: { nick: 'supervisor-a' } }, res);

    assert.equal(res.statusCode, 422);
    assert.deepEqual(res.body, { error: 'solicitud_invalida' });
    assert.deepEqual(calls.versionSources, []);
    assert.deepEqual(calls.approve, []);
  }
});

test('aprobar traduce 22P02 a solicitud invalida', async () => {
  const { createMotorOfertasHandlers } = await loadHandlers();
  const databaseError = new Error('invalid input syntax for type uuid');
  databaseError.code = '22P02';
  const { dependencies } = makeDependencies({
    repository: {
      async approveVersion() {
        throw databaseError;
      },
    },
  });
  const handlers = createMotorOfertasHandlers(dependencies);
  const res = response();

  await handlers.aprobar({
    body: { version_id: VERSION_ID, activar: false },
    user: { nick: 'supervisor-a' },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: 'solicitud_invalida' });
});
