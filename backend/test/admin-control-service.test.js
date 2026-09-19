import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAdminControlModules } from '../src/services/adminControlService.js';

const NOW = new Date('2026-09-17T16:00:00.000Z');
const ids = Array.from({ length: 12 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const source = (extra = {}) => ({ id: ids[0], familia: 'fijos', nombre_original: 'Base oficial.pdf', sha256: 'a'.repeat(64), creado_en: '2026-08-01T00:00:00Z', ...extra });
const base = (extra = {}) => ({ id: ids[1], numero: 14, categoria: 'claro_tv', estado: 'publicada', fuente_comercial_id: ids[0], fuente_sha256: 'a'.repeat(64), cargada_en: '2026-08-20T16:00:00Z', publicada_en: '2026-08-20T17:00:00Z', validada_en: '2026-08-20T17:00:00Z', aprobada_en: '2026-08-20T17:00:00Z', candidatos_total: 9, validacion: { errores: [] }, ...extra });

function database(tables = {}, failures = []) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push(sql);
      assert.match(sql.trim(), /^SELECT\b/i);
      assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|CALL)\b/i);
      const table = sql.match(/FROM public\.(\w+)/i)?.[1];
      assert.ok(table, `Consulta reconocible: ${sql}`);
      if (failures.includes(table)) throw Error('connection password=secreto');
      let rows = tables[table] || [];
      if (/WHERE dominio=\$1/.test(sql)) rows = rows.filter((r) => r.dominio === params[0]);
      if (/estado_publicacion='vigente'/.test(sql) && !/GROUP BY/.test(sql)) rows = rows.filter((r) => r.estado_publicacion === 'vigente');
      if (/WHERE version_id=\$1/.test(sql)) rows = rows.filter((r) => r.version_id === params[0]);
      if (/WHERE estado='vigente'/.test(sql)) rows = rows.filter((r) => r.estado === 'vigente');
      return { rows: structuredClone(rows) };
    },
  };
}
const load = async (db, options = {}) => {
  const result = await loadAdminControlModules({ db, now: NOW, readStatic: async () => false, ...options });
  // Verificar tambien fuera del doble de BD: el fallback no debe ocultar una escritura.
  for (const sql of db.queries) {
    assert.match(sql.trim(), /^SELECT\b/i);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|CALL)\b/i);
  }
  return result;
};
const moduleFor = (result, key) => result.modules.find((m) => m.key === key);
const stage = (module, label) => module.stages.find((s) => s.label === label);

test('contrato completo: diez modulos, seis etapas, destinos y tabs existentes', async () => {
  const result = await load(database());
  assert.equal(result.environment, 'Instancia consultada');
  assert.equal(result.checked_at, NOW.toISOString());
  assert.deepEqual(result.modules.map((m) => m.key), ['fijo', 'claro_tv', 'moviles', 'inalambrico_iot', 'lista_precios', 'servicios', 'beneficios', 'affinity', 'ofertas', 'directorio_fijo']);
  const tabs = ['fijo', 'claro_tv', 'moviles', 'inalambrico_iot', 'lista_precios', 'servicios', 'benefits', 'affinity', 'ofertas_vigentes', 'directorio_fijo'];
  for (const m of result.modules) {
    assert.deepEqual(Object.keys(m).sort(), ['key', 'title', 'provides', 'consumers', 'constructor_step', 'documents', 'publication', 'pending', 'stages', 'verification', 'alerts', 'actions'].sort());
    assert.ok(m.provides.length && m.provides.every((s) => typeof s === 'string'));
    assert.match(m.constructor_step, /prevista.*sin conexion/i);
    assert.deepEqual(m.stages.map((s) => s.label), ['Documento', 'Analisis', 'Revision', 'Aprobacion', 'Publicacion', 'Comprobacion']);
    assert.equal(m.verification.checked_at, result.checked_at);
    for (const c of m.consumers) {
      assert.ok(['conectado', 'estatico', 'previsto'].includes(c.kind));
      assert.ok(c.path === '' || /^\/constructor\/[a-z-]+\.html$/.test(c.path) || c.path.startsWith('/api/'));
    }
    for (const a of m.actions) {
      assert.ok(tabs.includes(a.tab));
      assert.ok(['flow', 'draft', 'published', 'document', 'destination'].includes(a.kind));
    }
  }
  assert.doesNotMatch(JSON.stringify(result), /retiredConstructor|oferta-const\.html|ofertas\.html|PM-021/);
});

test('TV v14 publicada conserva la fuente fija vinculada, no PDF homonimo de TV', async () => {
  const result = await load(database({ fuentes_comerciales: [source(), source({ id: ids[2], familia: 'claro_tv', sha256: 'b'.repeat(64), creado_en: '2026-07-01' })], bases_informativas_publicaciones: [base()] }));
  const tv = moduleFor(result, 'claro_tv');
  assert.equal(tv.publication.version, 14);
  assert.equal(tv.publication.status, 'publicada');
  assert.ok(tv.alerts.some((a) => /seguimiento/i.test(a.what) && /BD/.test(a.why)));
  assert.equal(tv.publication.validity, 'Sin verificar');
  assert.deepEqual(tv.documents.filter((d) => d.role === 'Publicada').map((d) => d.id), [ids[0]]);
  assert.equal(tv.pending, null);
  assert.match(tv.documents[0].url, new RegExp(`/api/fuentes-comerciales/${ids[0]}/documento`));
});

test('nombre documental del snapshot sigue visible aunque su fuente no tenga ID resoluble', async () => {
  const tv=moduleFor(await load(database({bases_informativas_publicaciones:[base({fuente_comercial_id:null,fuente_nombre:'Original historico.pdf'})]})), 'claro_tv');
  assert.equal(tv.publication.source_name,'Original historico.pdf');
  assert.equal(tv.publication.version,14);
});

test('actualizacion aprobada identifica version y siguiente paso sin reemplazar la publicada', async () => {
  const draft = base({ id: ids[3], numero: 18, estado: 'aprobada', cargada_en: '2026-09-12', publicada_en: null, aprobada_en: '2026-09-13', validada_en: '2026-09-12' });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source()], bases_informativas_publicaciones: [base(), draft] })), 'claro_tv');
  assert.equal(tv.publication.version, 14);
  assert.match(tv.pending.label, /18.*aprobada/);
  assert.match(tv.pending.detail, /publicacion explicita/i);
  assert.equal(stage(tv, 'Publicacion').status, 'Pendiente');
});

test('publicada y fuente posterior son independientes; recepcion no completa analisis', async () => {
  const result = await load(database({ fuentes_comerciales: [source(), source({ id: ids[2], sha256: 'b'.repeat(64), creado_en: '2026-09-10' })], bases_informativas_publicaciones: [base()] }));
  const tv = moduleFor(result, 'claro_tv');
  assert.equal(tv.publication.version, 14);
  assert.equal(tv.pending.source_id, ids[2]);
  assert.equal(tv.pending.draft_id, null);
  assert.equal(tv.actions.find((a) => a.kind === 'flow').source_id, ids[2]);
  assert.equal(stage(tv, 'Analisis').status, 'Sin verificar');
  assert.equal(stage(tv, 'Aprobacion').status, 'Sin verificar');
});

test('analisis fallido posterior nunca elimina la publicada', async () => {
  const draft = base({ id: ids[3], numero: 18, estado: 'borrador', cargada_en: '2026-09-12', publicada_en: null, aprobada_en: null, validada_en: null, validacion: { errores: ['formato no reconocido'] } });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source()], bases_informativas_publicaciones: [base(), draft] })), 'claro_tv');
  assert.equal(tv.publication.version, 14);
  assert.equal(tv.pending.draft_id, ids[3]);
  assert.equal(stage(tv, 'Analisis').status, 'Requiere revision');
  assert.ok(tv.alerts.some((a) => /analisis/i.test(a.what)));
  assert.ok(tv.actions.some((a) => a.kind === 'draft' && a.id === ids[3]));
});

test('borrador anterior, fuente anterior y copia del mismo hash no son pendiente nuevo', async () => {
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source(), source({ id: ids[2], creado_en: '2026-09-12' }), source({ id: ids[4], sha256: 'c'.repeat(64), creado_en: '2026-07-01' })], bases_informativas_publicaciones: [base(), base({ id: ids[3], numero: 12, estado: 'borrador', cargada_en: '2026-08-19', publicada_en: null })] })), 'claro_tv');
  assert.equal(tv.pending, null);
  assert.equal(tv.actions.some((a) => a.kind === 'draft'), false);
});

test('fallo de consulta conserva evidencia de otros circuitos y declara Sin verificar', async () => {
  const result = await load(database({ bases_informativas_publicaciones: [base()] }, ['fuentes_comerciales']));
  const tv = moduleFor(result, 'claro_tv');
  assert.equal(tv.publication.version, 14);
  assert.equal(tv.verification.status, 'Sin verificar');
  assert.ok(tv.alerts.some((a) => /lectura/i.test(a.what)));
  assert.doesNotMatch(JSON.stringify(result), /password|secreto|Falta fuente/);
  const unavailable = moduleFor(await load(database({}, ['bases_informativas_publicaciones', 'planes_modulos'])), 'fijo');
  assert.equal(unavailable.publication, null);
  assert.equal(stage(unavailable, 'Publicacion').status, 'Sin verificar');
});

test('ofertas vencidas por DATE/Date aunque el estado almacenado sea vigente', async () => {
  const offers = moduleFor(await load(database({ ofertas_movil_versiones: [{ id: ids[4], numero: 2, estado: 'vigente', vigencia_desde: new Date('2026-08-06'), vigencia_hasta: new Date('2026-08-26'), publicada_en: '2026-08-07', fuentes: [] }] })), 'ofertas');
  assert.equal(offers.publication.status, 'vigente');
  assert.equal(offers.publication.validity, 'Vencida');
  assert.ok(offers.alerts.some((a) => /vencid/i.test(a.what)));
});

test('IoT con contenido en planes_modulos sin historia no se declara sin publicacion', async () => {
  const iot = moduleFor(await load(database({ planes_modulos: [{ pagina: 'inalambrico', seccion_key: 'iot', has_content: true, vigencia_desde: '2026-08-01', vigencia_hasta: '2026-08-31', updated_at: '2026-08-15' }] })), 'inalambrico_iot');
  assert.ok(iot.publication);
  assert.equal(iot.publication.version, null);
  assert.match(iot.publication.label, /sin version/i);
  assert.equal(iot.publication.validity, 'Vencida');
  assert.equal(iot.publication.published_at, null);
});

test('equipos publicados con publicado_en null y catalogo real no pierden publicacion', async () => {
  const equipment = moduleFor(await load(database({ equipos_uploads: [{ id: 8, fuente_comercial_id: ids[0], estado_publicacion: 'publicada', publicado_en: null, fecha_subida: '2026-09-01' }], equipos_lista: [{ upload_id: 8, total: 477 }], fuentes_comerciales: [source({ familia: 'equipos' })] })), 'lista_precios');
  assert.equal(equipment.publication.version, 8);
  assert.equal(equipment.publication.published_at, null);
  assert.match(equipment.publication.detail, /477/);
  assert.equal(stage(equipment, 'Aprobacion').status, 'Sin verificar');
});

test('Affinity sin version no convierte preview efimera ni PDF recibido en analisis persistido', async () => {
  const affinity = moduleFor(await load(database({ fuentes_comerciales: [source({ familia: 'affinity' })] })), 'affinity');
  assert.equal(affinity.publication, null);
  assert.equal(stage(affinity, 'Analisis').status, 'Sin verificar');
  assert.equal(affinity.pending.source_id, ids[0]);
  assert.doesNotMatch(JSON.stringify(affinity), /lector.*ausente|instalar|GPON 50/);
});

test('Benefits vincula fuentes por version/dominio y ofertas JSON sin mezclar Affinity', async () => {
  const tables = {
    fuentes_comerciales: [source({ familia: 'beneficios' }), source({ id: ids[5], familia: 'affinity', sha256: 'b'.repeat(64) }), source({ id: ids[6], familia: 'ofertas_moviles', sha256: 'c'.repeat(64) })],
    motor_comercial_reglas_versiones: [{ id: ids[7], numero: 1, dominio: 'fijo_benefits', estado_publicacion: 'vigente', publicada_en: '2026-08-30' }, { id: ids[8], numero: 2, dominio: 'affinity_benefits', estado_publicacion: 'vigente', publicada_en: '2026-09-01' }],
    motor_comercial_reglas_fuentes: [{ version_id: ids[7], fuente_comercial_id: ids[0], sha256: 'a'.repeat(64) }, { version_id: ids[8], fuente_comercial_id: ids[5], sha256: 'b'.repeat(64) }],
    ofertas_movil_versiones: [{ id: ids[9], numero: 3, estado: 'vigente', fuentes: [{ id: ids[6], sha256: 'c'.repeat(64) }], resumen: { business_red_plus: { fuentes: [{ id: ids[6], sha256: 'c'.repeat(64) }] } } }],
  };
  const result = await load(database(tables));
  const benefits = moduleFor(result, 'beneficios');
  assert.ok(benefits.publication);
  assert.match(benefits.publication.detail, /fijo_benefits/);
  assert.match(benefits.publication.detail, /ofertas_moviles/);
  assert.ok(benefits.documents.some((d) => d.id === ids[0] && d.role === 'Publicada'));
  assert.equal(benefits.documents.some((d) => d.id === ids[5]), false);
  assert.deepEqual(moduleFor(result, 'affinity').documents.map((d) => d.id), [ids[5]]);
});

test('lectura BD no certifica destino; directorio estatico no hereda Fijo', async () => {
  const result = await load(database({ bases_informativas_publicaciones: [base({ categoria: 'fijo', numero: 13 })] }), { readStatic: async () => true });
  assert.equal(moduleFor(result, 'fijo').verification.status, 'Sin verificar');
  assert.match(moduleFor(result, 'fijo').verification.detail, /destino.*no comprobado/i);
  const directory = moduleFor(result, 'directorio_fijo');
  assert.equal(directory.publication.version, null);
  assert.equal(directory.publication.status, 'estatica');
  assert.equal(stage(directory, 'Publicacion').status, 'Disponible en instancia');
  assert.equal(directory.documents.length, 0);
  assert.equal(directory.verification.status, 'Sin verificar');
  assert.equal(directory.consumers[0].kind, 'estatico');
});

test('etiqueta runtime explicita sin inferencia NODE_ENV ni exposicion de conexion', async () => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal((await load(database())).environment, 'Instancia consultada');
    assert.equal((await load(database(), { environmentLabel: 'CRM laboratorio' })).environment, 'CRM laboratorio');
    assert.equal((await load(database(), { environmentLabel: 'postgres://user:secret@host/db' })).environment, 'Instancia consultada');
  } finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
});

test('actualizacion pendiente muestra Publicacion Pendiente conservando bloque anterior', async () => {
  const draft = base({ id: ids[3], numero: 18, estado: 'borrador', cargada_en: '2026-09-12', publicada_en: null, aprobada_en: null, validada_en: null });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source()], bases_informativas_publicaciones: [base(), draft] })), 'claro_tv');
  assert.equal(tv.publication.status, 'publicada');
  assert.equal(stage(tv, 'Publicacion').status, 'Pendiente');
  assert.match(stage(tv, 'Publicacion').detail, /anterior.*14.*permanece publicada/i);
  assert.deepEqual(tv.documents.filter((d) => d.id === ids[0]).map((d) => d.role).sort(), ['Pendiente', 'Publicada']);
});

test('manifiesto de bases conserva principal y todos los companions BYOP', async () => {
  const companion = source({ id: ids[2], familia: 'moviles', sha256: 'b'.repeat(64) });
  const main = source({ familia: 'moviles' });
  const published = base({ categoria: 'movil', auditoria: { fuentes: [{ id: main.id, sha256: main.sha256 }, { id: companion.id, sha256: companion.sha256 }] } });
  const result = await load(database({ fuentes_comerciales: [main, companion], bases_informativas_publicaciones: [published] }));
  const mobile = moduleFor(result, 'moviles');
  assert.deepEqual(mobile.documents.filter((d) => d.role === 'Publicada').map((d) => d.id).sort(), [main.id, companion.id].sort());
  assert.equal(mobile.pending, null);
  assert.equal(mobile.actions.find((a) => a.kind === 'flow').source_id, main.id);
});

test('varias fuentes nuevas conservan acciones exactas y no abren borrador de otra fuente', async () => {
  const next = source({ id: ids[2], sha256: 'b'.repeat(64), creado_en: '2026-09-10' });
  const other = source({ id: ids[3], sha256: 'c'.repeat(64), creado_en: '2026-09-11' });
  const oldSourceDraft = base({ id: ids[4], numero: 18, estado: 'borrador', cargada_en: '2026-09-12', publicada_en: null });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source(), next, other], bases_informativas_publicaciones: [base(), oldSourceDraft] })), 'claro_tv');
  assert.equal(tv.pending.source_id, other.id);
  assert.equal(tv.pending.draft_id, null);
  assert.ok(tv.documents.some((d) => d.id === next.id && d.role === 'Pendiente'));
  assert.ok(tv.actions.some((a) => a.kind === 'flow' && a.source_id === next.id));
  assert.equal(tv.documents.some((d) => d.id === ids[0] && d.role === 'Pendiente'), false);
});

test('pasos concretos previstos, Servicios declarado previsto, Motor solo lectores reales', async () => {
  const result = await load(database());
  for (const key of ['fijo', 'claro_tv', 'moviles']) assert.match(moduleFor(result, key).constructor_step, /seleccion.*plan/i);
  assert.match(moduleFor(result, 'lista_precios').constructor_step, /seleccion.*equipo/i);
  assert.match(moduleFor(result, 'beneficios').constructor_step, /revision.*benefici/i);
  assert.ok(moduleFor(result, 'servicios').provides.every((s) => /previst/i.test(s)));
  for (const key of ['lista_precios', 'inalambrico_iot', 'ofertas']) {
    assert.ok(moduleFor(result, key).consumers.some((c) => /Motor Comercial/.test(c.label) && c.kind === 'conectado' && c.path.startsWith('/api/')));
  }
  assert.ok(moduleFor(result, 'claro_tv').consumers.some((c) => /Motor Comercial.*sin verificar/i.test(c.label) && c.kind === 'previsto'));
});

test('vigencia multifuente no omite la fuente sin fechas y mantiene vencimiento prioritario', async () => {
  const main = source({ vigencia_desde: '2026-09-01', vigencia_hasta: '2026-09-30' });
  const companion = source({ id: ids[2], sha256: 'b'.repeat(64) });
  const published = base({ auditoria: { fuentes: [{ id: ids[2], sha256: companion.sha256 }] } });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [main, companion], bases_informativas_publicaciones: [published] })), 'claro_tv');
  assert.equal(tv.publication.validity, 'Sin verificar');
});

test('IDs no UUID nunca se entregan a acciones ni endpoints autenticados', async () => {
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source({ id: "x');alert(1)//" })], bases_informativas_publicaciones: [base({ id: "x');alert(1)//", fuente_comercial_id: "x');alert(1)//" })] })), 'claro_tv');
  assert.equal(tv.documents.length, 0);
  assert.equal(tv.actions.some((a) => a.kind === 'published'), false);
});

test('fuente nueva se compara con la fuente publicada, no con actualizaciones del destino', async () => {
  const next = source({ id: ids[2], sha256: 'b'.repeat(64), creado_en: '2026-08-15' });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source(), next], bases_informativas_publicaciones: [base()], planes_modulos: [{ pagina: 'claro_tv', has_content: true, updated_at: '2026-09-17' }] })), 'claro_tv');
  assert.equal(tv.pending.source_id, next.id);
});

test('reglas con ID historico no UUID enlazan fuente archivada por hash', async () => {
  const affinity = moduleFor(await load(database({ fuentes_comerciales: [source({ familia: 'affinity' })], motor_comercial_reglas_versiones: [{ id: ids[1], dominio: 'affinity_benefits', estado_publicacion: 'vigente', numero: 1 }], motor_comercial_reglas_fuentes: [{ version_id: ids[1], fuente_comercial_id: 'fuente-local-anterior', sha256: 'a'.repeat(64) }] })), 'affinity');
  assert.ok(affinity.documents.some((d) => d.id === ids[0] && d.role === 'Publicada'));
});

test('ID inexistente permite hash exacto; un ID resuelto no se sustituye por otro hash', async () => {
  const first = source();
  const other = source({ id: ids[2], sha256: 'b'.repeat(64) });
  for (const [ref, expected] of [[{ fuente_comercial_id: ids[8], fuente_sha256: first.sha256 }, first.id], [{ fuente_comercial_id: first.id, fuente_sha256: other.sha256 }, first.id]]) {
    const tv = moduleFor(await load(database({ fuentes_comerciales: [first, other], bases_informativas_publicaciones: [base(ref)] })), 'claro_tv');
    assert.deepEqual(tv.documents.filter((d) => d.role === 'Publicada').map((d) => d.id), [expected]);
  }
});

test('sin fechas no afirma vigente, futuro se separa, fin inclusivo sigue vigente', async () => {
  for (const [dates, expected] of [
    [{}, 'Sin verificar'],
    [{ vigencia_desde: '2026-09-20', vigencia_hasta: '2026-10-01' }, 'Futura'],
    [{ vigencia_desde: '2026-09-01', vigencia_hasta: '2026-09-17' }, 'Vigente'],
    [{ vigencia_desde: '2026-10-01', vigencia_hasta: '2026-09-01' }, 'Sin verificar'],
  ]) {
    const offers = moduleFor(await load(database({ ofertas_movil_versiones: [{ id: ids[1], numero: 2, estado: 'vigente', ...dates }] })), 'ofertas');
    assert.equal(offers.publication.validity, expected);
  }
});

test('equipos y reglas no ofrecen published con IDs ajenos a bases', async () => {
  const result = await load(database({ equipos_uploads: [{ id: 8, estado_publicacion: 'publicada' }], motor_comercial_reglas_versiones: [{ id: ids[1], dominio: 'affinity_benefits', estado_publicacion: 'vigente', numero: 1 }] }));
  for (const key of ['lista_precios', 'affinity']) assert.equal(moduleFor(result, key).actions.some((a) => a.kind === 'published'), false);
});

test('una fuente retirada del flujo no se ofrece como actualizacion pendiente', async () => {
  const retired = source({ id: ids[2], sha256: 'b'.repeat(64), creado_en: '2026-09-17', estado: 'archivada' });
  const tv = moduleFor(await load(database({ fuentes_comerciales: [source(), retired], bases_informativas_publicaciones: [base()] })), 'claro_tv');
  assert.equal(tv.publication.version, 14);
  assert.equal(tv.pending, null);
  assert.equal(tv.actions.some((a) => a.kind === 'flow' && a.source_id === retired.id), false);
  assert.ok(tv.documents.some((d) => d.id === retired.id && d.role === 'Archivada'));
});

test('la vigencia expone las fechas registradas sin deducirlas del archivo', async () => {
  const result = await load(database({ ofertas_movil_versiones: [{ id: ids[1], numero: 2, estado: 'vigente', vigencia_desde: '2026-08-01', vigencia_hasta: '2026-08-31' }] }));
  assert.equal(moduleFor(result, 'ofertas').publication.validity_period, '2026-08-01 a 2026-08-31');
  const unknown = moduleFor(await load(database({ bases_informativas_publicaciones: [base()] })), 'claro_tv');
  assert.equal(unknown.publication.validity_period, '');
});

test('acciones concretas para fuente nueva, vigencia y analisis fallido sin aprobar', async () => {
  const tables = { fuentes_comerciales: [source()], bases_informativas_publicaciones: [base()] };
  const current = moduleFor(await load(database(tables)), 'claro_tv');
  assert.equal(current.actions.find((a) => a.kind === 'flow').label, 'Revisar vigencia');
  tables.fuentes_comerciales.push(source({ id: ids[2], sha256: 'b'.repeat(64), creado_en: '2026-09-10' }));
  const next = moduleFor(await load(database(tables)), 'claro_tv');
  assert.equal(next.actions.find((a) => a.kind === 'flow').label, 'Revisar fuente');
  tables.bases_informativas_publicaciones.push(base({ id: ids[3], numero: 18, estado: 'borrador', fuente_comercial_id: ids[2], cargada_en: '2026-09-12', publicada_en: null, validacion: { errores: ['formato invalido'] } }));
  const failed = moduleFor(await load(database(tables)), 'claro_tv');
  assert.equal(failed.actions.find((a) => a.kind === 'flow').label, 'Revisar analisis');
  assert.ok(failed.actions.every((a) => !/aprobar|publicar/i.test(a.label)));
});

test('provides describe reglas persistidas y autoaplica false solo con confirmacion publicada', async () => {
  for (const [total, publicadas] of [[0, 0], [2, 0], [2, 2]]) {
    const affinity = moduleFor(await load(database({
      motor_comercial_reglas_versiones: [{ id: ids[1], dominio: 'affinity_benefits', estado_publicacion: 'vigente', numero: 1 }],
      motor_comercial_reglas_compuestas: [{ version_id: ids[1], total, publicadas }],
    })), 'affinity');
    assert.equal(affinity.provides.some((s) => /Condiciones y elegibilidad de reglas persistidas/.test(s)), total > 0);
    assert.equal(affinity.provides.some((s) => /confirmadas.*autoaplica=false/.test(s)), publicadas > 0);
  }
});
