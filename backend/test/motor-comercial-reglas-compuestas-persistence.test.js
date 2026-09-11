import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

import {
  diffCompositeRules,
  publishApprovedCompositeRulesVersion,
  persistCompositeRulesVersion,
  readCurrentPublishedCompositeRules,
  readCompositeRulesVersion,
  stableCompositeRuleKey,
} from '../src/services/motorComercialReglasCompuestasPersistence.js';
import { normalizeFijoOfferBenefitSources } from '../src/services/fijoBenefitsNormalizer.js';

const execFileAsync = promisify(execFile);

function sampleRule(overrides = {}) {
  return {
    llave_comercial: 'claro-full|3-meses-gratis|plan-$60',
    beneficio_regla_id: 'BEN-1',
    beneficio: { tipo: 'meses_gratis', meses: 3, monto: null },
    producto: { familia: 'movil', servicio: 'pospago' },
    productos_afectados: ['movil'],
    condiciones: {
      convergencia: 'requerida',
      eventos: ['linea_nueva'],
      plan_minimo: 60,
      compatibilidad: 'acumula',
      limite: null,
    },
    terminos_vinculados: [
      {
        llave_comercial: 'termino-1',
        codigo: 'T-1',
        nombre: 'Aplica a clientes nuevos y existentes convergentes',
        pagina: 5,
        condiciones: { convergencia: 'requerida' },
        estado_confianza: 'confirmado',
      },
    ],
    estado_confianza: 'confirmado',
    motivos_revision: [],
    aplicacion_automatica: false,
    traza: {
      fuente: {
        id: 'fuente-1',
        nombre_original: 'Boletin Beneficios Convergencia Claro Full PYMES.pdf',
        sha256: 'a'.repeat(64),
      },
      beneficio: { pagina: 3, texto_original: '3 Meses Gratis Movil' },
      terminos: [{ pagina: 5, texto_original: 'Terminos y Condiciones 3 Meses Gratis' }],
    },
    ...overrides,
  };
}

function fakeDb({ previousRules = [], versionRow = {} } = {}) {
  const calls = [];
  const client = {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT .*FROM public\.motor_comercial_reglas_versiones/s.test(sql)) {
        return { rows: [{ id: 'version-previa', estado_publicacion: 'vigente' }] };
      }
      if (/SELECT .*FROM public\.motor_comercial_reglas_compuestas/s.test(sql)) {
        return { rows: previousRules };
      }
      if (/INSERT INTO public\.motor_comercial_reglas_versiones/s.test(sql)) {
        return { rows: [{ id: 'version-nueva', numero: 12, estado_publicacion: params[1], ...versionRow }] };
      }
      if (/INSERT INTO public\.motor_comercial_reglas_fuentes/s.test(sql)) {
        return { rows: [{ id: 'fuente-versionada' }] };
      }
      if (/INSERT INTO public\.motor_comercial_reglas_compuestas/s.test(sql)) {
        return { rows: [{ id: `regla-${calls.filter((call) => /INSERT INTO public\.motor_comercial_reglas_compuestas/s.test(call.sql)).length}` }] };
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: 'RELEASE', params: [] });
    },
  };
  return {
    client,
    async connect() {
      return client;
    },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/FROM public\.motor_comercial_reglas_versiones/s.test(sql)) {
        return { rows: [{ id: 'version-nueva', numero: 12, dominio: 'fijo_benefits', estado_publicacion: 'aprobada' }] };
      }
      if (/FROM public\.motor_comercial_reglas_compuestas/s.test(sql)) {
        return { rows: [{ id: 'regla-1', identidad_comercial: 'fijo_benefits|meses_gratis|movil', contrato: sampleRule() }] };
      }
      if (/FROM public\.motor_comercial_reglas_terminos/s.test(sql)) {
        return { rows: [{ regla_compuesta_id: 'regla-1', termino_snapshot: sampleRule().terminos_vinculados[0] }] };
      }
      return { rows: [] };
    },
  };
}

function publicationDb({ targetRules = [sampleRule()], targetState = 'aprobada' } = {}) {
  const calls = [];
  const targetVersion = { id: 'version-aprobada', numero: 20, dominio: 'fijo_benefits', estado_publicacion: targetState, resumen: { total_reglas: targetRules.length } };
  const currentVersion = { id: 'version-vieja', numero: 19, dominio: 'fijo_benefits', estado_publicacion: 'vigente' };
  const persistedRules = targetRules.map((rule, index) => ({
    id: `regla-publicada-${index + 1}`,
    identidad_comercial: stableCompositeRuleKey(rule, { dominio: 'fijo_benefits' }),
    accion_version: 'nuevo',
    estado_confianza: rule.estado_confianza,
    estado_publicacion: targetState,
    autoaplica: false,
    contrato: rule,
  }));
  const client = {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/FROM public\.motor_comercial_reglas_versiones[\s\S]*WHERE id=\$1/s.test(sql)) return { rows: [targetVersion] };
      if (/FROM public\.motor_comercial_reglas_versiones[\s\S]*estado_publicacion='vigente'/s.test(sql)) return { rows: [currentVersion] };
      if (/SELECT id, identidad_comercial, accion_version, estado_confianza, estado_publicacion, autoaplica, contrato[\s\S]*FROM public\.motor_comercial_reglas_compuestas/s.test(sql)) {
        return { rows: persistedRules };
      }
      if (/UPDATE public\.motor_comercial_reglas_versiones[\s\S]*estado_publicacion='vigente'/s.test(sql)) {
        return { rows: [{ ...targetVersion, estado_publicacion: 'vigente' }] };
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: 'RELEASE', params: [] });
    },
  };
  return {
    calls,
    client,
    async connect() {
      return client;
    },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/FROM public\.motor_comercial_reglas_versiones[\s\S]*estado_publicacion='vigente'/s.test(sql)) {
        return { rows: [{ ...targetVersion, estado_publicacion: 'vigente' }] };
      }
      if (/FROM public\.motor_comercial_reglas_compuestas/s.test(sql)) {
        return {
          rows: persistedRules
            .map((rule) => ({ ...rule, estado_publicacion: 'vigente' }))
            .filter((rule) => rule.estado_confianza === 'confirmado' && rule.estado_publicacion === 'vigente' && rule.autoaplica === false),
        };
      }
      if (/FROM public\.motor_comercial_reglas_terminos/s.test(sql)) {
        return { rows: persistedRules.flatMap((rule) => (rule.contrato.terminos_vinculados || []).map((term) => ({ regla_compuesta_id: rule.id, termino_snapshot: term }))) };
      }
      return { rows: [] };
    },
  };
}

test('migracion local define versionado append-only de reglas compuestas', () => {
  const sql = fs.readFileSync(new URL('../migrations/2026-08-29-motor-comercial-reglas-compuestas.sql', import.meta.url), 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.motor_comercial_reglas_versiones/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.motor_comercial_reglas_fuentes/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.motor_comercial_reglas_compuestas/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.motor_comercial_reglas_terminos/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.motor_comercial_reglas_historial/);
  assert.match(sql, /nuevo','modifica','reemplaza','vence','sin_cambio/);
  assert.match(sql, /borrador','validada','aprobada','vigente','reemplazada','archivada/);
  assert.match(sql, /WHERE estado_publicacion = 'vigente'/);
  assert.match(sql, /motor_comercial_reglas_compuestas_identidad_idx[\s\S]*\(version_id, identidad_comercial\)/);
  assert.doesNotMatch(sql, /ON DELETE CASCADE/i);
  assert.doesNotMatch(sql, /identidad_comercial[^,\n]*precio/i);
});

test('identidad comercial estable no incluye precios aunque la regla traiga montos', () => {
  const key = stableCompositeRuleKey(sampleRule(), { dominio: 'fijo_benefits' });

  assert.equal(key, 'fijo_benefits|meses_gratis|movil');
  assert.doesNotMatch(key, /\$|60|74\.99|10\.00/);
});

test('diff de reglas compuestas clasifica nuevo modifica vence y sin cambio sin sobrescribir historial', () => {
  const same = sampleRule();
  const changed = sampleRule({ beneficio: { tipo: 'bono_streaming', monto: 10 }, condiciones: { ...sampleRule().condiciones, compatibilidad: 'no_acumula' } });
  const previousOnly = sampleRule({ beneficio: { tipo: 'pago_penalidad', monto: 200 }, producto: { familia: 'fijo' } });
  const currentOnly = sampleRule({ beneficio: { tipo: 'doble_velocidad' }, producto: { familia: 'internet_fijo' } });
  const diffs = diffCompositeRules({
    dominio: 'fijo_benefits',
    previousRules: [
      { identidad_comercial: stableCompositeRuleKey(same, { dominio: 'fijo_benefits' }), contrato: same },
      { identidad_comercial: stableCompositeRuleKey(changed, { dominio: 'fijo_benefits' }), contrato: sampleRule({ beneficio: { tipo: 'bono_streaming', monto: 5 } }) },
      { identidad_comercial: stableCompositeRuleKey(previousOnly, { dominio: 'fijo_benefits' }), contrato: previousOnly },
    ],
    currentRules: [same, changed, currentOnly],
  });

  assert.equal(diffs.filter((item) => item.accion_version === 'sin_cambio').length, 1);
  assert.equal(diffs.filter((item) => item.accion_version === 'modifica').length, 1);
  assert.equal(diffs.filter((item) => item.accion_version === 'nuevo').length, 1);
  assert.equal(diffs.filter((item) => item.accion_version === 'vence').length, 1);
});

test('un borrador conserva las reglas que quedaron en revision', async () => {
  const db = fakeDb();
  const result = await persistCompositeRulesVersion({
    db,
    dominio: 'fijo_benefits',
    estadoPublicacion: 'borrador',
    normalizadorVersion: 'fijo-benefits-v1',
    actor: 'tester',
    fuentes: [sampleRule().traza.fuente],
    reglasCompuestas: [sampleRule({ estado_confianza: 'requiere_revision' })],
  });

  assert.equal(result.version.estado_publicacion, 'borrador');
  assert.equal(result.resumen.pendientes, 1);
  assert.equal(result.resumen.confirmadas, 0);
  assert.ok(db.client.calls.length > 0, 'el borrador si debe escribirse');
});

test('persistencia bloquea reglas no confirmadas antes de abrir transaccion', async () => {
  const db = fakeDb();

  await assert.rejects(
    () => persistCompositeRulesVersion({
      db,
      dominio: 'fijo_benefits',
      estadoPublicacion: 'aprobada',
      normalizadorVersion: 'fijo-benefits-v1',
      actor: 'tester',
      fuentes: [sampleRule().traza.fuente],
      reglasCompuestas: [sampleRule({ estado_confianza: 'requiere_revision' })],
    }),
    /reglas_no_confirmadas/
  );
  assert.equal(db.client.calls.length, 0);
});

test('persistencia crea version atomica, fuente, regla, terminos e historial con autoaplica false', async () => {
  const db = fakeDb();
  const result = await persistCompositeRulesVersion({
    db,
    dominio: 'fijo_benefits',
    estadoPublicacion: 'aprobada',
    normalizadorVersion: 'fijo-benefits-v1',
    actor: 'tester',
    fuentes: [sampleRule().traza.fuente],
    reglasCompuestas: [sampleRule()],
  });

  assert.equal(result.version.id, 'version-nueva');
  assert.equal(result.resumen.total_reglas, 1);
  assert.equal(result.resumen.autoaplicables, 0);
  assert.equal(result.reglas[0].identidad_comercial, 'fijo_benefits|meses_gratis|movil');
  assert.equal(result.reglas[0].estado_confianza, 'confirmado');
  assert.equal(result.reglas[0].estado_publicacion, 'aprobada');
  assert.equal(result.reglas[0].accion_version, 'nuevo');
  assert.deepEqual(db.client.calls.map((call) => call.sql).filter((sql) => ['BEGIN', 'COMMIT'].includes(sql)), ['BEGIN', 'COMMIT']);
  assert.ok(db.client.calls.some((call) => /INSERT INTO public\.motor_comercial_reglas_fuentes/s.test(call.sql)));
  assert.ok(db.client.calls.some((call) => /INSERT INTO public\.motor_comercial_reglas_compuestas/s.test(call.sql)));
  assert.ok(db.client.calls.some((call) => /INSERT INTO public\.motor_comercial_reglas_terminos/s.test(call.sql)));
  assert.ok(db.client.calls.some((call) => /INSERT INTO public\.motor_comercial_reglas_historial/s.test(call.sql)));
});

test('lectura posterior reconstruye reglas compuestas persistidas con terminos y trazabilidad', async () => {
  const db = fakeDb();
  const persisted = await readCompositeRulesVersion({ db, versionId: 'version-nueva' });

  assert.equal(persisted.version.id, 'version-nueva');
  assert.equal(persisted.reglas.length, 1);
  assert.equal(persisted.reglas[0].identidad_comercial, 'fijo_benefits|meses_gratis|movil');
  assert.equal(persisted.reglas[0].contrato.traza.fuente.sha256, 'a'.repeat(64));
  assert.equal(persisted.reglas[0].terminos.length, 1);
});

test('publicacion local convierte una version aprobada en vigente y reemplaza la anterior atomicamente', async () => {
  const db = publicationDb();
  const result = await publishApprovedCompositeRulesVersion({
    db,
    dominio: 'fijo_benefits',
    versionId: 'version-aprobada',
    actor: 'tester',
  });

  assert.equal(result.version.id, 'version-aprobada');
  assert.equal(result.version.estado_publicacion, 'vigente');
  assert.equal(result.version_anterior.id, 'version-vieja');
  assert.deepEqual(db.client.calls.map((call) => call.sql).filter((sql) => ['BEGIN', 'COMMIT'].includes(sql)), ['BEGIN', 'COMMIT']);
  assert.ok(db.client.calls.some((call) => /SET estado_publicacion='reemplazada'/.test(call.sql)));
  assert.ok(db.client.calls.some((call) => /SET estado_publicacion='vigente'/.test(call.sql)));
  assert.ok(db.client.calls.some((call) => /INSERT INTO public\.motor_comercial_reglas_historial/s.test(call.sql)));
});

test('publicacion local rechaza versiones no aprobadas o reglas no publicables sin mezclar estados', async () => {
  await assert.rejects(
    () => publishApprovedCompositeRulesVersion({
      db: publicationDb({ targetState: 'borrador' }),
      dominio: 'fijo_benefits',
      versionId: 'version-borrador',
      actor: 'tester',
    }),
    /version_no_aprobada/
  );

  await assert.rejects(
    () => publishApprovedCompositeRulesVersion({
      db: publicationDb({ targetRules: [sampleRule({ estado_confianza: 'requiere_revision' })] }),
      dominio: 'fijo_benefits',
      versionId: 'version-aprobada',
      actor: 'tester',
    }),
    /reglas_no_publicables/
  );
});

test('lectura de consumidor devuelve solo reglas confirmadas publicadas y vigentes de una sola version', async () => {
  const db = publicationDb();
  const result = await readCurrentPublishedCompositeRules({ db, dominio: 'fijo_benefits' });

  assert.equal(result.version.id, 'version-aprobada');
  assert.equal(result.version.estado_publicacion, 'vigente');
  assert.equal(result.reglas.length, 1);
  assert.equal(result.reglas[0].estado_confianza, 'confirmado');
  assert.equal(result.reglas[0].estado_publicacion, 'vigente');
  assert.equal(result.reglas[0].autoaplica, false);
  assert.equal(result.reglas[0].terminos.length, 1);
  assert.ok(db.calls.some((call) => /WHERE version_id=\$1[\s\S]*estado_confianza='confirmado'[\s\S]*estado_publicacion='vigente'[\s\S]*autoaplica=false/s.test(call.sql)));
});

test('las reglas compuestas del boletin de convergencia se publican sin autoaplica y sin invadir Affinity', async () => {
  const pdf = new URL('../../documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf', import.meta.url);
  const script = new URL('../../scripts/extract_pdf_text.py', import.meta.url);
  const { stdout } = await execFileAsync(process.platform === 'win32' ? 'python' : 'python3', [fileURLToPath(script), fileURLToPath(pdf)], { maxBuffer: 10 * 1024 * 1024 });
  const extracted = JSON.parse(stdout);
  const normalized = normalizeFijoOfferBenefitSources([{
    fuente: { id: 'beneficios-local', familia: 'beneficios', nombre_original: '2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf', sha256: 'b'.repeat(64) },
    text: extracted.text,
  }]);
  const db = publicationDb({ targetRules: normalized.reglas_compuestas });
  const result = await publishApprovedCompositeRulesVersion({
    db,
    dominio: 'fijo_benefits',
    versionId: 'version-aprobada',
    actor: 'tester',
  });

  assert.equal(extracted.pages, 35);
  assert.equal(normalized.reglas_normalizadas.length, 58);
  // Eran 9: la mencion de Affinity ahora se publica desde su propio modulo con su boletin oficial.
  assert.equal(normalized.reglas_compuestas.length, 8);
  assert.equal(result.reglas.length, 8);
  assert.equal(normalized.reglas_compuestas.some((rule) => rule.beneficio?.tipo === 'descuento_affinity'), false);
  assert.ok(normalized.advertencias.some((item) => item.codigo === 'beneficio_de_dominio_propio_omitido'), 'debe avisar que la mencion de Affinity se omitio');
  assert.ok(result.reglas.every((rule) => rule.estado_confianza === 'confirmado'));
  assert.ok(result.reglas.every((rule) => rule.autoaplica === false));
});
