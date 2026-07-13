import assert from 'node:assert/strict';
import { test } from 'node:test';

const repositoryPath = '../src/services/motorOfertasRepository.js';
const VERSION_ID = '00000000-0000-4000-8000-000000000001';
const OFFER_ID = '00000000-0000-4000-8000-000000000002';
const EQUIPMENT_ID = '00000000-0000-4000-8000-000000000003';
const CONTRADICTION_ID = '00000000-0000-4000-8000-000000000004';
const FINANCING_SOURCE_ID = '00000000-0000-4000-8000-000000000010';
const PRICE_SOURCE_ID = '00000000-0000-4000-8000-000000000011';
const CURRENT_VERSION_ID = '00000000-0000-4000-8000-000000000099';

async function loadRepository() {
  try {
    return await import(repositoryPath);
  } catch (error) {
    assert.fail(`falta motorOfertasRepository.js: ${error.message}`);
  }
}

function compactSql(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function createFakePool(responder = () => ({ rowCount: 1, rows: [] })) {
  const calls = [];
  let released = false;
  let connections = 0;

  const query = async (sql, params = []) => {
    const call = { sql: compactSql(sql), params };
    calls.push(call);
    return responder(call, calls) ?? { rowCount: 1, rows: [] };
  };
  const client = {
    query,
    release() {
      released = true;
    },
  };
  const pool = {
    async connect() {
      connections += 1;
      return client;
    },
    query,
  };

  return {
    pool,
    calls,
    get released() {
      return released;
    },
    get connections() {
      return connections;
    },
  };
}

function makeUuidSequence(values = [
  VERSION_ID,
  OFFER_ID,
  EQUIPMENT_ID,
  CONTRADICTION_ID,
]) {
  let index = 0;
  return () => values[index++] ?? `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function makePreviewInput(overrides = {}) {
  const contract = {
    id: 'equipo-gratis-plan-35-fila-4',
    nombre: 'Equipo gratis',
    estado: 'confirmada',
    vigencia: {
      desde: '2026-07-04',
      hasta: '2026-07-15',
      estado: 'vigente',
    },
    tipos_plan: ['individual'],
    familias: [],
    eventos: ['linea_nueva', 'portabilidad'],
    plazos: [24],
    limite_ban: {
      aplica: true,
      cantidad: 4,
      fuera_limite: 'pendiente_fuente',
    },
    equipos: [{
      equipo_key: '33979H',
      modelo_comercial: 'Samsung Galaxy A37 5G 128GB',
      modelo_oficial: 'Samsung Galaxy A37 5G 128GB',
      sku_sif: '33979H',
      sap: 'SAP-A37',
      precio_regular: 349.99,
      coincidencia: 'exacta',
      fuente_precio_id: PRICE_SOURCE_ID,
      mensualidades: [{ meses: 24, monto: 14.58 }],
    }],
    fuente: {
      tipo: 'tabla_financiamiento',
      hoja: 'Ofertas Equipos en Portafolio',
      fila: 4,
    },
  };

  return {
    dominio: 'movil_equipos',
    manifestSha256: 'a'.repeat(64),
    normalizadorVersion: '1.0.0',
    actor: 'admin@newcrm.local',
    sources: [
      {
        id: FINANCING_SOURCE_ID,
        type: 'tabla_financiamiento',
        originalName: 'Tabla Ofertas Financiamiento.xlsx',
        archivedName: `${'b'.repeat(64)}-tabla-ofertas-financiamiento.xlsx`,
        relativePath: `tabla_financiamiento/${'b'.repeat(64)}-tabla-ofertas-financiamiento.xlsx`,
        sha256: 'b'.repeat(64),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        bytes: 1200,
        validity: {
          from: '2026-07-04',
          to: '2026-07-15',
          state: 'vigente',
        },
        sheet: 'Ofertas Equipos en Portafolio',
      },
      {
        id: PRICE_SOURCE_ID,
        type: 'lista_precios',
        originalName: 'Lista de Precios.xlsx',
        archivedName: `${'c'.repeat(64)}-lista-de-precios.xlsx`,
        relativePath: `lista_precios/${'c'.repeat(64)}-lista-de-precios.xlsx`,
        sha256: 'c'.repeat(64),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        bytes: 800,
        validity: {
          from: '2026-07-01',
          to: null,
          state: 'vigente',
        },
      },
    ],
    normalized: {
      offers: [{
        contract,
        derived: {
          planMontoMinimo: 35,
          planMontoMaximo: 35,
        },
        equipment: contract.equipos,
        trace: {
          sourceId: FINANCING_SOURCE_ID,
          fileName: 'Tabla Ofertas Financiamiento.xlsx',
          sheet: 'Ofertas Equipos en Portafolio',
          row: 4,
          cells: {
            offer: 'Equipo gratis',
            plan: '$35',
            equipment: 'Samsung Galaxy A37 5G 128GB',
          },
        },
      }],
      contradictions: [{
        code: 'equipo_sin_coincidencia_exacta',
        severity: 'error',
        blocking: true,
        offerKey: contract.id,
        detail: 'No hay coincidencia exacta.',
        source: {
          sheet: 'Ofertas Equipos en Portafolio',
          row: 6,
        },
      }],
      summary: {
        offers: 1,
        equipment: 1,
        blockingContradictions: 1,
      },
    },
    ...overrides,
  };
}

function successResponder(call) {
  if (call.sql.startsWith('INSERT INTO public.motor_ofertas_versiones')) {
    return {
      rowCount: 1,
      rows: [{ id: VERSION_ID, numero: 1, estado: 'borrador' }],
    };
  }
  if (
    call.sql.startsWith('UPDATE public.motor_ofertas_versiones')
    && call.params.includes('pendiente_revision')
  ) {
    return {
      rowCount: 1,
      rows: [{ id: VERSION_ID, numero: 1, estado: 'pendiente_revision' }],
    };
  }
  return { rowCount: 1, rows: [] };
}

test('createPreview persiste una version trazable dentro de una transaccion', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool(successResponder);
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  const result = await repository.createPreview(makePreviewInput());
  const sql = fake.calls.map((call) => call.sql);

  assert.equal(result.reutilizada, false);
  assert.equal(result.version.estado, 'pendiente_revision');
  assert.equal(sql[0], 'BEGIN');
  assert.equal(sql.at(-1), 'COMMIT');
  assert.ok(sql.some((value) => value.startsWith('INSERT INTO public.motor_ofertas_versiones')));
  assert.ok(sql.some((value) => value.startsWith('INSERT INTO public.motor_ofertas_fuentes')));
  assert.ok(sql.some((value) => value.startsWith('INSERT INTO public.motor_ofertas ')));
  assert.ok(sql.some((value) => value.startsWith('INSERT INTO public.motor_ofertas_equipos')));
  assert.ok(sql.some((value) => value.startsWith('INSERT INTO public.motor_ofertas_contradicciones')));
  assert.equal(sql.filter((value) => value.startsWith('INSERT INTO public.motor_ofertas_historial')).length, 2);
  assert.ok(sql.every((value) => !/\bDELETE\b/i.test(value)));
  assert.equal(fake.connections, 1);
  assert.equal(fake.released, true);
});

test('persiste trazabilidad y mantiene estados separados', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool(successResponder);
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  await repository.createPreview(makePreviewInput());

  const sourceInsert = fake.calls.find((call) =>
    call.sql.startsWith('INSERT INTO public.motor_ofertas_fuentes')
  );
  const offerInsert = fake.calls.find((call) =>
    call.sql.startsWith('INSERT INTO public.motor_ofertas ')
  );
  const contradictionInsert = fake.calls.find((call) =>
    call.sql.startsWith('INSERT INTO public.motor_ofertas_contradicciones')
  );

  assert.ok(sourceInsert.params.includes('Tabla Ofertas Financiamiento.xlsx'));
  assert.ok(sourceInsert.params.includes('Ofertas Equipos en Portafolio'));
  assert.ok(offerInsert.params.includes('confirmada'));
  assert.ok(offerInsert.params.includes('vigente'));
  assert.ok(offerInsert.params.includes('Ofertas Equipos en Portafolio'));
  assert.ok(offerInsert.params.includes(4));
  const storedContract = offerInsert.params.find((value) =>
    typeof value === 'string'
      && value.startsWith('{')
      && value.includes('equipo-gratis-plan-35-fila-4')
  );
  assert.equal(JSON.parse(storedContract).estado, 'confirmada');
  assert.ok(contradictionInsert.params.includes('equipo_sin_coincidencia_exacta'));
  assert.ok(!offerInsert.params.includes('contradiccion'));
  assert.ok(!offerInsert.params.includes('vencida'));
});

test('reutiliza la identidad existente sin duplicar contenido', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool((call) => {
    if (call.sql.startsWith('INSERT INTO public.motor_ofertas_versiones')) {
      return { rowCount: 0, rows: [] };
    }
    if (call.sql.includes('FROM public.motor_ofertas_versiones')) {
      return {
        rowCount: 1,
        rows: [{ id: VERSION_ID, numero: 7, estado: 'pendiente_revision' }],
      };
    }
    return { rowCount: 1, rows: [] };
  });
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  const result = await repository.createPreview(makePreviewInput());
  const sql = fake.calls.map((call) => call.sql);

  assert.equal(result.reutilizada, true);
  assert.equal(result.version.numero, 7);
  assert.ok(sql.some((value) => value.includes('FROM public.motor_ofertas_versiones')));
  assert.ok(sql.every((value) => !value.startsWith('INSERT INTO public.motor_ofertas_fuentes')));
  assert.ok(sql.every((value) => !value.startsWith('INSERT INTO public.motor_ofertas ')));
  assert.ok(sql.every((value) => !value.startsWith('UPDATE public.motor_ofertas_versiones')));
  assert.equal(sql.at(-1), 'COMMIT');
});

test('una nueva version del normalizador crea otra version sin sobrescribir la anterior', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  let created = 0;
  const fake = createFakePool((call) => {
    if (call.sql.startsWith('INSERT INTO public.motor_ofertas_versiones')) {
      created += 1;
      return {
        rowCount: 1,
        rows: [{
          id: created === 1 ? VERSION_ID : '00000000-0000-4000-8000-000000000101',
          numero: created,
          estado: 'borrador',
        }],
      };
    }
    if (call.sql.startsWith('UPDATE public.motor_ofertas_versiones')) {
      return {
        rowCount: 1,
        rows: [{ id: call.params.at(-1), numero: created, estado: 'pendiente_revision' }],
      };
    }
    return { rowCount: 1, rows: [] };
  });
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence([
      VERSION_ID,
      OFFER_ID,
      EQUIPMENT_ID,
      CONTRADICTION_ID,
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000104',
    ]),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  await repository.createPreview(makePreviewInput());
  await repository.createPreview(makePreviewInput({ normalizadorVersion: '1.1.0' }));

  const versionInserts = fake.calls.filter((call) =>
    call.sql.startsWith('INSERT INTO public.motor_ofertas_versiones')
  );
  assert.equal(versionInserts.length, 2);
  assert.ok(versionInserts[0].params.includes('1.0.0'));
  assert.ok(versionInserts[1].params.includes('1.1.0'));
  assert.ok(fake.calls.every((call) => !/\bDELETE\b/i.test(call.sql)));
});

test('createPreview revierte la transaccion ante un fallo de persistencia', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool((call) => {
    if (call.sql.startsWith('INSERT INTO public.motor_ofertas_versiones')) {
      return {
        rowCount: 1,
        rows: [{ id: VERSION_ID, numero: 1, estado: 'borrador' }],
      };
    }
    if (call.sql.startsWith('INSERT INTO public.motor_ofertas ')) {
      throw new Error('fallo simulado');
    }
    return { rowCount: 1, rows: [] };
  });
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  await assert.rejects(
    () => repository.createPreview(makePreviewInput()),
    /fallo simulado/
  );

  assert.ok(fake.calls.some((call) => call.sql === 'ROLLBACK'));
  assert.ok(fake.calls.every((call) => call.sql !== 'COMMIT'));
  assert.equal(fake.released, true);
});

test('approveVersion bloquea filas y registra aprobacion, reemplazo y activacion', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool((call) => {
    if (
      call.sql.includes('FROM public.motor_ofertas_versiones')
      && call.sql.includes('WHERE id = $1')
      && call.sql.includes('FOR UPDATE')
    ) {
      return {
        rowCount: 1,
        rows: [{ id: VERSION_ID, dominio: 'movil_equipos', estado: 'pendiente_revision' }],
      };
    }
    if (call.sql.includes('FROM public.motor_ofertas_contradicciones')) {
      return { rowCount: 1, rows: [{ bloqueantes: 0 }] };
    }
    if (
      call.sql.includes('FROM public.motor_ofertas_versiones')
      && call.sql.includes("estado = 'vigente'")
      && call.sql.includes('FOR UPDATE')
    ) {
      return {
        rowCount: 1,
        rows: [{ id: CURRENT_VERSION_ID, dominio: 'movil_equipos', estado: 'vigente' }],
      };
    }
    return { rowCount: 1, rows: [] };
  });
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  const result = await repository.approveVersion({
    versionId: VERSION_ID,
    activate: true,
    expectedCurrentVersionId: CURRENT_VERSION_ID,
    actor: 'supervisor@newcrm.local',
    reason: 'Fuentes revisadas',
  });

  const updates = fake.calls.filter((call) =>
    call.sql.startsWith('UPDATE public.motor_ofertas_versiones')
  );
  const histories = fake.calls.filter((call) =>
    call.sql.startsWith('INSERT INTO public.motor_ofertas_historial')
  );
  assert.equal(result.estado, 'vigente');
  assert.ok(fake.calls.some((call) => call.sql.includes('WHERE id = $1') && call.sql.includes('FOR UPDATE')));
  assert.ok(fake.calls.some((call) => call.sql.includes("estado = 'vigente'") && call.sql.includes('FOR UPDATE')));
  assert.ok(updates.some((call) => call.params.includes('pendiente_revision') && call.params.includes('aprobada')));
  assert.ok(updates.some((call) => call.params.includes('vigente') && call.params.includes('reemplazada')));
  assert.ok(updates.some((call) => call.params.includes('aprobada') && call.params.includes('vigente')));
  assert.equal(histories.length, 3);
  assert.equal(fake.calls.at(-1).sql, 'COMMIT');
});

test('approveVersion bloquea contradicciones abiertas sin cambiar estados', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool((call) => {
    if (
      call.sql.includes('FROM public.motor_ofertas_versiones')
      && call.sql.includes('WHERE id = $1')
    ) {
      return {
        rowCount: 1,
        rows: [{ id: VERSION_ID, dominio: 'movil_equipos', estado: 'pendiente_revision' }],
      };
    }
    if (call.sql.includes('FROM public.motor_ofertas_contradicciones')) {
      return { rowCount: 1, rows: [{ bloqueantes: 1 }] };
    }
    return { rowCount: 1, rows: [] };
  });
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  await assert.rejects(
    () => repository.approveVersion({
      versionId: VERSION_ID,
      activate: true,
      expectedCurrentVersionId: null,
      actor: 'supervisor@newcrm.local',
    }),
    (error) => error.code === 'contradicciones_bloqueantes'
  );

  assert.ok(fake.calls.some((call) => call.sql === 'ROLLBACK'));
  assert.ok(fake.calls.every((call) =>
    !call.sql.startsWith('UPDATE public.motor_ofertas_versiones')
  ));
});

test('el repositorio no expone operaciones destructivas', async () => {
  const { createMotorOfertasRepository } = await loadRepository();
  const fake = createFakePool();
  const repository = createMotorOfertasRepository({
    pool: fake.pool,
    randomUUID: makeUuidSequence(),
    now: () => new Date('2026-07-12T12:00:00.000Z'),
  });

  assert.equal(repository.deleteVersion, undefined);
  assert.equal(repository.deleteOffer, undefined);
});
