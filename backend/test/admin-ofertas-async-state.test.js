import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

const html = readFileSync(new URL('../../frontend/app.html', import.meta.url), 'utf8');

function fn(name) {
  const start = html.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, `Falta ${name}`);
  let code = '';
  for (const line of html.slice(start).split('\n')) {
    code += line + '\n';
    try { new vm.Script(`(${code})`); return code; } catch {}
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const historyPath = '/api/fuentes-comerciales/bases-informativas/historial';
const functions = [
  'esc', 'fcBasePublicacionActual', 'fcBaseCategoriasActivas',
  'fcBaseFechaDetectada', 'fcCountBase', 'fcRenderBasePanel',
  'fcRenderBasePreviewBody', 'fcSetBaseTab', 'fcBaseTransicion',
  'fcLoadBaseHistorial', 'ofLoadCatalogoBaseState', 'ofModuleSourceFamily',
  'ofPrimaryFuenteForCatalogo', 'fcBaseTabForModule', 'ofMovilCompanionIds',
  'fcGenerarBasePreview', 'fcGuardarBaseBorrador', 'fcBasePreviewRequestBody',
  'ofAnalizarCatalogoBase', 'ofCatalogoBaseFechaDetectada',
];
// La regresion debe seguir ejecutandose si se elimina el helper de hidratacion.
if (/^function fcHydrateBaseDraftsFromHistorial\(/m.test(html)) {
  functions.push('fcHydrateBaseDraftsFromHistorial');
}

function preview(publicable = true) {
  const category = () => ({
    publicable,
    candidatos_publicos: [],
    diferencias: { registros: { nuevos: [], modificados: [], eliminados: [] } },
  });
  return {
    ok: true,
    fecha_actualizacion_base: '2026-03-30',
    preview_fingerprint: 'a'.repeat(64),
    previews: { fijo: category(), claro_tv: category() },
  };
}

function runtime(respond) {
  const calls = [], alerts = [], unexpected = [];
  const nodes = new Map([
    'fcBasePreviewPanel', 'fcBaseHistorial', 'fcBaseEstado', 'fcBaseFecha',
    'ofBaseEstado_fijo', 'ofBaseEstado_claro_tv', 'ofListaPreciosPanel',
    'ofBaseDocumento_fijo', 'ofBaseAnalizar_fijo', 'ofBaseHasta_fijo',
  ].map(id => [id, { innerHTML: '', textContent: '', value: '', style: {} }]));
  const evidence = {
    modules: [{ key: 'claro_tv', publication: { version: 14, label: 'Version 14 publicada' } }],
  };
  const ctx = vm.createContext({
    Date, FormData,
    $: id => nodes.get(id) || null,
    ofTab: 'fijo',
    tareasReglasFlowTarget: null,
    ofCenterEvidence: evidence,
    fcBaseGeneration: 0,
    fcBaseFuente: { id: 'source-A', familia: 'fijos', nombre_original: 'A.pdf', sha256: 'a'.repeat(64) },
    fcBasePreview: preview(),
    fcBaseDrafts: {},
    fcBaseTab: 'fijo',
    fcBaseModuleKey: 'fijo',
    fcBaseCompanionIds: [],
    fcBaseSearch: '',
    fcBaseMessage: '',
    fcBaseBusy: false,
    ofListaPreciosFuente: null,
    ofListaPreciosPreview: null,
    ofListaPreciosDraft: false,
    ofListaPreciosBusy: false,
    ofAffinityPreview: null,
    ofAffinityVersion: null,
    ofRenderListaPreciosPanel: () => {},
    ofRefreshOperationalState: () => {},
    ofReloadOperationalEvidence: async () => {},
    confirm: () => true,
    alert: message => alerts.push(message),
    fcMensajeApi: error => {
      if (['ReferenceError', 'TypeError'].includes(error?.name)) unexpected.push(String(error));
      return error.message;
    },
    api: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET' });
      const result = respond(url, options);
      if (result !== undefined) return result;
      unexpected.push(`Solicitud inesperada: ${options.method || 'GET'} ${url}`);
      throw new Error(unexpected.at(-1));
    },
  });
  ctx.apiForm = (url, body) => ctx.api(url, { method: 'POST', body, multipart: true });
  vm.runInContext(functions.map(fn).join('\n'), ctx);
  return {
    ctx, nodes, calls,
    panel: () => nodes.get('fcBasePreviewPanel').innerHTML,
    assertHarness() {
      assert.deepEqual(unexpected, [], 'El fallo no debe provenir de globals o stubs incompletos');
      assert.deepEqual(alerts, [], 'No deben ocultarse errores de ejecucion en alert()');
      assert.equal(ctx.ofCenterEvidence.modules[0].publication.version, 14);
    },
  };
}

function publishEnabled(markup) {
  return [...markup.matchAll(/<button\b[^>]*>/g)].some(([button]) =>
    button.includes("fcBaseTransicion('publicar')") && !/\bdisabled\b/.test(button));
}

test('aprobar Fijo en vuelo no atribuye su respuesta a Claro TV al cambiar de pestana', async () => {
  const approval = deferred();
  const path = '/api/fuentes-comerciales/bases-informativas/draft-fijo/aprobar';
  const r = runtime(url => {
    if (url === path) return approval.promise;
    if (url === historyPath) return { publicaciones: [] };
  });
  const draft = {
    id: 'draft-fijo', fuente_comercial_id: 'source-A',
    categoria: 'fijo', estado: 'validada', numero: 7,
  };
  r.ctx.fcBaseDrafts = { fijo: draft };

  const pending = r.ctx.fcBaseTransicion('aprobar');
  assert.equal(r.calls[0].url, path);
  assert.equal(r.calls[0].method, 'POST');
  r.ctx.fcSetBaseTab('claro_tv');
  approval.resolve({ ok: true, publicacion: { ...draft, estado: 'aprobada' } });
  await pending;
  await setImmediate();

  r.assertHarness();
  assert.equal(r.ctx.fcBaseTab, 'claro_tv');
  assert.equal(r.ctx.fcBaseDrafts.claro_tv, undefined,
    'La respuesta de Fijo no debe crear una aprobacion bajo la categoria Claro TV');
  assert.equal(publishEnabled(r.panel()), false, 'TV no tiene un borrador aprobado para publicar');
  assert.doesNotMatch(r.ctx.fcBaseMessage, /claro_tv.*aprobada/);
  assert.equal(r.ctx.fcBaseBusy, false, 'Cambiar de categoria no deja el flujo bloqueado');
  assert.doesNotMatch(r.ctx.fcBaseMessage, /Procesando aprobar/, 'La categoria nueva no conserva progreso de otra operacion');
});

for (const staleFails of [false, true]) {
  test(`preview anterior ${staleFails ? 'fallido' : 'exitoso'} no reemplaza ni desbloquea otro analisis`, async () => {
    const first = deferred(), second = deferred();
    let requests = 0;
    const r = runtime(url => url.endsWith('/preview-base') ? (++requests === 1 ? first.promise : second.promise) : undefined);
    const old = r.ctx.fcGenerarBasePreview();
    const latest = r.ctx.fcGenerarBasePreview();
    if (staleFails) first.reject(new Error('Analisis anterior fallo'));
    else first.resolve({ ...preview(), preview_fingerprint: 'old' });
    await old;
    const whileLatestPending = { busy: r.ctx.fcBaseBusy, preview: r.ctx.fcBasePreview };
    second.resolve({ ...preview(), preview_fingerprint: 'latest' });
    await latest;

    r.assertHarness();
    assert.equal(whileLatestPending.busy, true, 'El finally anterior no libera el analisis nuevo');
    assert.equal(whileLatestPending.preview, null, 'La respuesta anterior no se muestra durante el nuevo analisis');
    assert.equal(r.ctx.fcBasePreview.preview_fingerprint, 'latest');
    assert.equal(r.ctx.fcBaseBusy, false);
  });
}

test('guardar pendiente no inserta sus borradores en una nueva generacion de preview', async () => {
  const save = deferred();
  const r = runtime(url => {
    if (url.endsWith('/preview-base/borradores')) return save.promise;
    if (url.endsWith('/preview-base')) return { ...preview(), preview_fingerprint: 'latest' };
    if (url === '/api/admin-control/modules') return { modules: [] };
    if (url === historyPath) return { publicaciones: [] };
  });
  const pending = r.ctx.fcGuardarBaseBorrador();
  await r.ctx.fcGenerarBasePreview();
  save.resolve({ ok: true, publicaciones: [{ id: 'old-draft', fuente_comercial_id: 'source-A', categoria: 'fijo', estado: 'borrador' }] });
  await pending;
  await setImmediate();

  r.assertHarness();
  assert.equal(Object.keys(r.ctx.fcBaseDrafts).length, 0);
  assert.equal(r.ctx.fcBasePreview.preview_fingerprint, 'latest');
  assert.doesNotMatch(r.ctx.fcBaseMessage, /Borrador guardado/);
});

test('load anterior no reemplaza la fuente de un modulo cargado despues', async () => {
  const load = deferred();
  const r = runtime(url => {
    if (url.endsWith('?familia=fijos')) return load.promise;
    if (url.endsWith('?familia=claro_tv')) return { fuentes: [{ id: 'source-TV', nombre_original: 'TV.pdf' }] };
    if (url === historyPath) return { publicaciones: [] };
  });
  const pending = r.ctx.ofLoadCatalogoBaseState('fijo');
  r.ctx.ofTab = 'claro_tv';
  await r.ctx.ofLoadCatalogoBaseState('claro_tv');
  load.resolve({ fuentes: [{ id: 'old-source', nombre_original: 'Old.pdf' }] });
  await pending;
  await setImmediate();

  r.assertHarness();
  assert.equal(r.ctx.fcBaseFuente.id, 'source-TV');
  assert.equal(r.ctx.fcBaseTab, 'claro_tv');
  assert.doesNotMatch(r.panel(), /Old\.pdf/);
});

test('upload pendiente no inicia analisis ni cambia seleccion tras cargar otro modulo', async () => {
  const upload = deferred();
  const r = runtime((url, options) => {
    if (options.multipart) return upload.promise;
    if (url.endsWith('?familia=claro_tv')) return { fuentes: [{ id: 'source-TV', nombre_original: 'TV.pdf' }] };
    if (url.endsWith('/preview-base')) return preview();
    if (url === '/api/admin-control/modules') return { modules: [] };
    if (url === historyPath) return { publicaciones: [] };
  });
  r.nodes.get('ofBaseDocumento_fijo').files = [new File(['fixture'], 'Nuevo.pdf', { type: 'application/pdf' })];
  const pending = r.ctx.ofAnalizarCatalogoBase('fijo');
  r.ctx.ofTab = 'claro_tv';
  await r.ctx.ofLoadCatalogoBaseState('claro_tv');
  upload.resolve({ ok: true, fuente: { id: 'uploaded-old-source', nombre_original: 'Nuevo.pdf' } });
  await pending;
  await setImmediate();

  r.assertHarness();
  assert.equal(r.ctx.fcBaseFuente.id, 'source-TV');
  assert.equal(r.ctx.fcBasePreview, null);
  assert.equal(r.calls.some(call => call.url.endsWith('/preview-base')), false);
});

test('historial en vuelo no renderiza filas de una generacion anterior', async () => {
  const history = deferred();
  const r = runtime(url => {
    if (url === historyPath) return history.promise;
    if (url.endsWith('/preview-base')) return preview();
  });
  const pending = r.ctx.fcLoadBaseHistorial();
  await r.ctx.fcGenerarBasePreview();
  history.resolve({ publicaciones: [{ categoria: 'fijo', fuente_nombre: 'Historial-obsoleto.pdf', estado: 'aprobada' }] });
  await pending;

  r.assertHarness();
  assert.doesNotMatch(r.nodes.get('fcBaseHistorial').innerHTML, /Historial-obsoleto/);
});

test('Historial no recupera una aprobacion antigua sobre una comparacion nueva', async () => {
  const old = {
    id: 'old-approved', fuente_comercial_id: 'source-A', fuente_nombre: 'A.pdf',
    categoria: 'claro_tv', estado: 'aprobada', numero: 7,
    fecha_actualizacion_base: '2026-03-30', candidatos_total: 1,
  };
  const r = runtime(url => url === historyPath ? { publicaciones: [old] } : undefined);
  r.ctx.ofTab = r.ctx.fcBaseModuleKey = r.ctx.fcBaseTab = 'claro_tv';
  const fresh = preview(false);
  r.ctx.fcBasePreview = fresh;
  r.ctx.fcRenderBasePanel();
  assert.equal(publishEnabled(r.panel()), false);

  await r.ctx.fcLoadBaseHistorial();

  r.assertHarness();
  assert.match(r.nodes.get('fcBaseHistorial').innerHTML, /aprobada/, 'El historial sigue siendo visible');
  assert.equal(r.ctx.fcBasePreview, fresh, 'Consultar historial no cambia la comparacion revisada');
  assert.equal(Object.keys(r.ctx.fcBaseDrafts).length, 0,
    'Consultar historial no debe seleccionar automaticamente un borrador anterior');
  assert.equal(publishEnabled(r.panel()), false, 'Una comparacion nueva no hereda la aprobacion antigua');
  assert.doesNotMatch(r.panel(), /class="pill green">aprobada/);
});

test('cargar sin target limpia de inmediato la seleccion previa aunque falle el GET', async () => {
  const load = deferred();
  const r = runtime(url => url === '/api/fuentes-comerciales?familia=fijos' ? load.promise : undefined);
  r.ctx.ofTab = r.ctx.fcBaseModuleKey = r.ctx.fcBaseTab = 'claro_tv';
  r.ctx.fcBaseFuente = { id: 'old-source', nombre_original: 'Anterior-TV.pdf', sha256: 'b'.repeat(64) };
  r.ctx.fcBaseDrafts = {
    claro_tv: { id: 'old-draft', fuente_comercial_id: 'old-source', categoria: 'claro_tv', estado: 'aprobada' },
  };
  r.ctx.fcRenderBasePanel();
  assert.equal(publishEnabled(r.panel()), true, 'La fixture previa debe tener Publicar habilitado');

  r.ctx.ofTab = 'fijo';
  const pending = r.ctx.ofLoadCatalogoBaseState('fijo');
  const duringLoad = {
    source: r.ctx.fcBaseFuente, preview: r.ctx.fcBasePreview,
    draftIds: Object.keys(r.ctx.fcBaseDrafts), panel: r.panel(),
  };
  // Resolver el rechazo antes de las aserciones evita dejar promesas pendientes en RED.
  load.reject(new Error('GET de fuentes fallo'));
  await pending;
  await setImmediate();

  r.assertHarness();
  assert.match(r.nodes.get('ofBaseEstado_fijo').innerHTML, /GET de fuentes fallo/);
  assert.equal(duringLoad.source, null, 'La fuente anterior debe limpiarse antes de esperar el GET, aun sin target');
  assert.equal(duringLoad.preview, null);
  assert.deepEqual(duringLoad.draftIds, []);
  assert.equal(publishEnabled(duringLoad.panel), false);
  assert.equal(r.ctx.fcBaseFuente, null);
  assert.equal(r.ctx.fcBasePreview, null);
  assert.equal(Object.keys(r.ctx.fcBaseDrafts).length, 0);
  assert.equal(publishEnabled(r.panel()), false);
  assert.doesNotMatch(r.panel(), /Anterior-TV\.pdf/);
});

test('el flujo de la seleccion vigente permite analizar, guardar, validar y aprobar sin publicar', async () => {
  const source = { id: 'source-A', familia: 'fijos', nombre_original: 'Nuevo.pdf' };
  const draft = { id: 'draft-fijo', fuente_comercial_id: source.id, categoria: 'fijo', estado: 'borrador' };
  const r = runtime((url, options) => {
    if (options.multipart) return { ok: true, fuente: source };
    if (url.endsWith('/preview-base')) return preview();
    if (url.endsWith('/preview-base/borradores')) return { ok: true, publicaciones: [draft] };
    if (url.endsWith('/validar')) return { ok: true, publicacion: { ...draft, estado: 'validada' } };
    if (url.endsWith('/aprobar')) return { ok: true, publicacion: { ...draft, estado: 'aprobada' } };
    if (url === '/api/admin-control/modules') return r.ctx.ofCenterEvidence;
    if (url === historyPath) return { publicaciones: [] };
  });
  r.nodes.get('ofBaseDocumento_fijo').files = [new File(['fixture'], 'Nuevo.pdf', { type: 'application/pdf' })];
  await r.ctx.ofAnalizarCatalogoBase('fijo');
  assert.equal(r.ctx.fcBaseFuente.id, source.id);
  assert.equal(r.ctx.fcBasePreview.ok, true);
  await r.ctx.fcGuardarBaseBorrador();
  assert.equal(r.ctx.fcBaseDrafts.fijo.estado, 'borrador');
  await r.ctx.fcBaseTransicion('validar');
  assert.equal(r.ctx.fcBaseDrafts.fijo.estado, 'validada');
  await r.ctx.fcBaseTransicion('aprobar');
  await setImmediate();

  r.assertHarness();
  assert.equal(r.ctx.fcBaseDrafts.fijo.estado, 'aprobada');
  assert.equal(publishEnabled(r.panel()), true);
  assert.equal(r.calls.some(call => call.url.endsWith('/publicar')), false);
  assert.equal(r.ctx.fcBaseBusy, false);
});

test('carga normal no hereda aprobacion y reanudar conserva el borrador exacto ante historial posterior', async () => {
  const source = { id: 'source-A', familia: 'claro_tv', nombre_original: 'A.pdf' };
  const selected = {
    id: 'selected-v7', fuente_comercial_id: source.id, categoria: 'claro_tv',
    numero: 7, estado: 'borrador', diferencias: preview().previews.claro_tv.diferencias,
  };
  const latest = { ...selected, id: 'latest-v8', numero: 8, estado: 'aprobada' };
  const r = runtime(url => {
    if (url === '/api/fuentes-comerciales' || url.endsWith('?familia=claro_tv')) return { fuentes: [source] };
    if (url.endsWith('/selected-v7')) return { publicacion: selected };
    if (url === historyPath) return { publicaciones: [latest, selected] };
  });
  r.ctx.ofTab = 'claro_tv';
  await r.ctx.ofLoadCatalogoBaseState('claro_tv');
  await setImmediate();
  assert.equal(Object.keys(r.ctx.fcBaseDrafts).length, 0);
  assert.equal(r.ctx.fcBasePreview, null);
  assert.match(r.panel(), /Elegí “Comparar cambios”/);
  r.ctx.tareasReglasFlowTarget = { tab: 'claro_tv', source_id: source.id, draft_id: selected.id };
  await r.ctx.ofLoadCatalogoBaseState('claro_tv');
  await setImmediate();

  r.assertHarness();
  assert.equal(r.ctx.fcBaseDrafts.claro_tv.id, selected.id);
  assert.equal(r.ctx.fcBasePreview.previews.claro_tv.id, selected.id);
  assert.equal(publishEnabled(r.panel()), false);
  assert.ok(r.calls.every(call => call.method === 'GET'));
});

test('confirmacion de publicacion identifica la instancia sin asumir un portal local', async () => {
  const r = runtime(() => undefined);
  r.ctx.fcBaseDrafts = { fijo: { id: 'draft', fuente_comercial_id: 'source-A', categoria: 'fijo', estado: 'aprobada' } };
  let message = '';
  r.ctx.confirm = value => { message = value; return false; };
  await r.ctx.fcBaseTransicion('publicar');

  r.assertHarness();
  assert.match(message, /portal de la instancia consultada/);
  assert.doesNotMatch(message, /portal local/);
  assert.equal(r.calls.length, 0);
});
