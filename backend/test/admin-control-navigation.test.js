import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../frontend/app.html', import.meta.url), 'utf8');
const sourceUrl = new URL('../../frontend/app.html', import.meta.url).pathname;

function between(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `No se encontro el bloque ${start}`);
  return html.slice(from, to);
}

// El parser de JavaScript delimita las funciones, incluidos templates y funciones internas.
function functionSource(name) {
  const start = html.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, `Falta ${name} en el HTML`);
  let source = '';
  for (const line of html.slice(start).split('\n')) {
    source += `${line}\n`;
    try {
      new vm.Script(`(${source})`);
      return source;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  assert.fail(`No se pudo extraer ${name}`);
}

const functions = [
  'esc', 'ofRenderBody', 'ofLoadCatalogoBaseState', 'ofModuleSourceFamily',
  'ofPrimaryFuenteForCatalogo', 'ofMovilCompanionIds', 'fcMensajeApi',
  'fcBaseTabForModule', 'fcBasePublicacionActual', 'fcBaseCategoriasActivas',
  'fcBaseFechaDetectada', 'ovDetectarVigenciaHasta', 'fcCountBase',
  'fcRenderBasePanel', 'fcRenderBasePreviewBody', 'fcLoadBaseHistorial',
  'ofRenderListaPreciosPanel',
  'ofAbrirDetallePublicacion', 'ofAbrirDocumentoFuente', 'ofAbrirDocumentoActual',
  'ofDocumentoUrl', 'ofDocumentoPublicacionUrl', 'ofCrearDocumentoBlobUrl',
].map(functionSource).join('\n');
const script = new vm.Script([
  between('const OF_TABS=', 'function fcFamiliaLabel('),
  between('let tareasReglasModules=', 'async function viewHistorial()'),
  functions,
].join('\n'), { filename: sourceUrl });

const tabs = [
  ['fijo', 'fijo', 'catalogo'], ['claro_tv', 'claro_tv', 'catalogo'],
  ['moviles', 'moviles', 'catalogo'], ['inalambrico_iot', 'inalambrico_iot', 'catalogo'],
  ['lista_precios', 'lista_precios', 'lista'], ['servicios', 'servicios', 'servicios'],
  ['directorio_fijo', 'directorio_fijo', 'directorio'], ['affinity', 'affinity', 'affinity'],
  ['beneficios', 'benefits', null], ['ofertas', 'ofertas_vigentes', 'ofertas'],
];
const basePath = '/api/fuentes-comerciales/bases-informativas/';

function runtime() {
  const calls = [], opened = [], alerts = [], rendered = [], unexpected = [];
  const data = { modules: [], sources: [], details: {}, history: [], fetchOk: true };
  const nodes = new Map();
  for (const id of ['ofBody', 'ofCenterMain', 'fcBasePreviewPanel', 'fcBaseHistorial',
    'ofListaPreciosPanel', ...tabs.map(([, tab]) => `ofBaseEstado_${tab}`)]) {
    nodes.set(id, { innerHTML: '', style: {}, textContent: '' });
  }
  const context = vm.createContext({
    API: 'https://crm.test', token: 'sesion-ficticia',
    $: id => nodes.get(id) || null,
    location: { hash: '#/tareas-reglas-admin' },
    window: { open: (...args) => opened.push(args) },
    alert: message => alerts.push(message),
    URL: { createObjectURL: blob => { assert.equal(blob, 'pdf-ficticio'); return 'blob:original-autenticado'; } },
    fetch: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', headers: options.headers });
      return { ok: data.fetchOk, status: data.fetchOk ? 200 : 401, blob: async () => 'pdf-ficticio' };
    },
    api: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET' });
      if (options.method && options.method !== 'GET') {
        unexpected.push(`Escritura no permitida: ${options.method} ${url}`);
        throw new Error(unexpected.at(-1));
      }
      if (url === '/api/admin-control/modules') return { modules: data.modules };
      if (url === '/api/admin-control/closure-checklist') return null;
      if (url === `${basePath}historial`) return { publicaciones: structuredClone(data.history) };
      if (url.startsWith(basePath)) {
        if (data.detailError) throw data.detailError;
        const id = decodeURIComponent(url.slice(basePath.length));
        if (Object.hasOwn(data.details, id)) return { publicacion: structuredClone(data.details[id]) };
      }
      if (url === '/api/fuentes-comerciales' || url.startsWith('/api/fuentes-comerciales?familia=')) {
        if (data.sourceError) throw data.sourceError;
        const family = new URL(url, 'https://crm.test').searchParams.get('familia');
        return { fuentes: structuredClone(data.sources.filter(source => !family || source.familia === family)) };
      }
      unexpected.push(`Consulta no prevista: ${url}`);
      throw new Error(unexpected.at(-1));
    },
    router: async () => rendered.push(['router']),
    ofRenderCatalogoBase: key => rendered.push(['catalogo', key]),
    ofRenderListaPrecios: () => rendered.push(['lista']),
    ofRenderServiciosBase: () => rendered.push(['servicios']),
    ofRenderDirectorioFijo: () => rendered.push(['directorio']),
    ofRenderAffinity: () => rendered.push(['affinity']),
    ofRenderOfertasVigentes: () => rendered.push(['ofertas']),
    ofRenderVersionModal: (publication, options) => rendered.push(['publicacion', publication, options]),
  });
  script.runInContext(context);
  const run = code => vm.runInContext(code, context);
  return {
    data, calls, opened, alerts, rendered, unexpected, nodes, context, run,
    read: code => JSON.parse(run(`JSON.stringify(${code})`)),
    assertReadOnly() {
      assert.deepEqual(unexpected, [], 'El entorno no debe ocultar dependencias o escrituras inesperadas');
      assert.ok(calls.every(call => call.method === 'GET'), JSON.stringify(calls));
    },
  };
}

async function navigate(r, action, { key = action.tab, pending = { source_id: 'pending-distinta' } } = {}) {
  r.data.modules = [{ key, title: key, pending, actions: [action] }];
  await r.run('viewTareasReglasAdmin()');
  await r.run('tareasReglasAccion(0, 0)');
}

async function load(r, key) {
  await r.run(`ofLoadCatalogoBaseState(${JSON.stringify(key)})`);
  await setImmediate(); // Espera el GET de historial lanzado por la funcion real.
  r.assertReadOnly();
}

// Datos sinteticos: prueban navegacion y comparacion, no precios comerciales.
function source(id, familia = 'fijos') {
  return { id, familia, estado: 'activa', nombre_original: `${id}.pdf`, sha256: 'hash-de-prueba' };
}

function draft(id, sourceId, categoria = 'claro_tv') {
  return {
    id, fuente_comercial_id: sourceId, categoria, estado: 'aprobada', numero: 7,
    fecha_actualizacion_base: '2026-09-17', validacion: { publicable: true },
    diferencias: { registros: {
      nuevos: [{ registro: { codigo: 'NUEVO-TEST', descripcion: 'Alta sintetica', precio: 101 } }],
      modificados: [{ codigo: 'CAMBIO-TEST', cambios: [{ campo: 'precio', antes: 202, ahora: 203 }] }],
      eliminados: [{ registro: { codigo: 'BAJA-TEST', descripcion: 'Baja sintetica', precio: 304 } }],
    } },
  };
}

function enabledPublishButtons(markup) {
  return [...markup.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
    .filter(button => /fcBaseTransicion|ofPublicarListaPrecios/.test(button) && !/\bdisabled\b/.test(button));
}

test('la matriz cubre los diez tabs actuales y Beneficios utiliza benefits', () => {
  const r = runtime();
  assert.deepEqual(r.read('OF_TABS.map(tab => tab[0])'), tabs.map(([, tab]) => tab));
});

for (const [key, tab, renderer] of tabs) {
  for (const kind of ['flow', 'draft']) {
    test(`${kind}: ${key} navega al tab ${tab} y conserva la seleccion`, async () => {
      const r = runtime();
      await navigate(r, { kind, tab, id: 'draft-seleccionado', source_id: 'fuente-seleccionada' }, { key });
      assert.equal(r.context.location.hash, `#/ofertas/${tab}`);
      assert.equal(r.run('ofTab'), tab);
      assert.deepEqual(r.read('tareasReglasFlowTarget'), {
        tab, source_id: 'fuente-seleccionada', draft_id: kind === 'draft' ? 'draft-seleccionado' : null,
      });
      await r.run('ofRenderBody()');
      if (renderer) assert.equal(r.rendered.at(-1)[0], renderer);
      else {
        assert.equal(r.nodes.get('ofBody').style.display, 'none');
        assert.equal(r.nodes.get('ofCenterMain').style.display, 'block');
      }
      r.assertReadOnly();
    });
  }
}

test('misma ruta recarga el router y flow descarta el borrador anterior', async () => {
  const r = runtime();
  await navigate(r, { kind: 'draft', tab: 'claro_tv', id: 'draft-viejo', source_id: 'fuente-vieja' });
  await navigate(r, { kind: 'flow', tab: 'claro_tv' }, { pending: { source_id: 'fuente-nueva' } });
  assert.deepEqual(r.rendered, [['router']]);
  assert.deepEqual(r.read('tareasReglasFlowTarget'), { tab: 'claro_tv', source_id: 'fuente-nueva', draft_id: null });
  r.assertReadOnly();
});

test('tab desconocido y accion desconocida no navegan ni abren ventanas', async () => {
  for (const action of [{ kind: 'flow', tab: 'beneficios' }, { kind: 'flow', tab: '../oferta-const' }, { kind: 'delete', tab: 'fijo' }]) {
    const r = runtime();
    await navigate(r, action);
    assert.equal(r.context.location.hash, '#/tareas-reglas-admin');
    assert.equal(r.run('tareasReglasFlowTarget'), null);
    assert.deepEqual(r.opened, []);
    r.assertReadOnly();
  }
});

for (const [tab, category, family] of [
  ['fijo', 'fijo', 'fijos'], ['claro_tv', 'claro_tv', 'fijos'],
  ['moviles', 'movil', 'moviles'], ['inalambrico_iot', 'inalambrico', 'inalambrico_iot'],
]) {
  test(`draft ${tab}: hidrata fuente vinculada, modulo y diferencias mediante GET`, async () => {
    const r = runtime();
    const selected = source('fuente-vinculada', family);
    const publication = draft('draft / solicitado', selected.id, category);
    r.data.sources = [source('mas-reciente', family), selected];
    r.data.details[publication.id] = publication;
    await navigate(r, { kind: 'draft', tab, id: publication.id, source_id: selected.id });
    await load(r, tab);
    assert.equal(r.run('fcBaseModuleKey'), tab);
    assert.equal(r.run('fcBaseTab'), category);
    assert.deepEqual(r.read('fcBaseFuente'), selected);
    assert.deepEqual(r.read(`fcBaseDrafts[${JSON.stringify(category)}]`), publication);
    assert.deepEqual(r.read(`fcBasePreview.previews[${JSON.stringify(category)}].diferencias`), publication.diferencias);
    assert.equal(r.run('tareasReglasFlowTarget'), null);
    assert.ok(r.calls.some(call => call.url === `${basePath}${encodeURIComponent(publication.id)}`));
    const panel = r.nodes.get('fcBasePreviewPanel').innerHTML;
    for (const expected of ['fuente-vinculada.pdf', 'NUEVO-TEST', 'CAMBIO-TEST', 'BAJA-TEST', '101', '202', '203', '304']) {
      assert.ok(panel.includes(expected), `Falta ${expected} en la comparacion de ${tab}`);
    }
    assert.equal(enabledPublishButtons(panel).length, 1, 'La fixture aprobada comprueba que el detector ve Publicar habilitado');
    assert.deepEqual(r.alerts, []);
  });
}

test('flow TV elige la fuente nueva exacta de familia fijos y elimina la comparacion anterior', async () => {
  const r = runtime();
  r.data.sources = [source('tv-de-otra-familia', 'claro_tv'), source('otra-fija'), source('tv-nueva')];
  r.context.previousDraft = draft('draft-anterior', 'otra-fija');
  r.run('fcBasePreview={previews:{claro_tv:previousDraft}};fcBaseDrafts={claro_tv:previousDraft}');
  await navigate(r, { kind: 'flow', tab: 'claro_tv', source_id: 'tv-nueva' });
  await load(r, 'claro_tv');
  assert.equal(r.run('fcBaseFuente.id'), 'tv-nueva');
  assert.equal(r.run('fcBaseFuente.familia'), 'fijos');
  assert.equal(r.run('fcBaseTab'), 'claro_tv');
  assert.equal(r.run('fcBasePreview'), null);
  assert.deepEqual(r.read('fcBaseDrafts'), {});
  assert.deepEqual(enabledPublishButtons(r.nodes.get('fcBasePreviewPanel').innerHTML), []);
  assert.equal(r.calls.some(call => call.url.startsWith(basePath) && !call.url.endsWith('/historial')), false);
});

for (const withChanges of [true, false]) {
  test(`comparacion guardada ${withChanges ? 'con' : 'sin'} cambios no infiere publicable desde validacion sin esa propiedad`, async () => {
    const r = runtime();
    const publication = draft('sin-revalidar', 'fuente-tv');
    publication.estado = 'borrador';
    publication.validacion = { errores: [] };
    if (!withChanges) publication.diferencias.registros = { nuevos: [], modificados: [], eliminados: [] };
    r.data.sources = [source('fuente-tv')];
    r.data.details[publication.id] = publication;
    await navigate(r, { kind: 'draft', tab: 'claro_tv', id: publication.id, source_id: 'fuente-tv' });
    await load(r, 'claro_tv');
    const preview = r.read('fcBasePreview.previews.claro_tv');
    assert.equal(preview.comparacion_guardada, true);
    assert.equal(Object.hasOwn(preview, 'publicable'), false, 'Ausencia de validacion.publicable no significa false');
    assert.deepEqual(preview.validacion, { errores: [] });
    assert.deepEqual(preview.diferencias, publication.diferencias);
    const comparison = r.run('fcRenderBasePreviewBody()');
    assert.match(comparison, /Comparacion guardada.*no revalidada contra la publicacion actual/i);
    assert.doesNotMatch(comparison, /No se puede publicar|Bloqueado|Publicable/i);
    if (!withChanges) {
      assert.match(comparison, /Sin cambios en la comparacion guardada/i);
      assert.doesNotMatch(comparison, /Sin cambios respecto a la version publicada/i);
    }
  });
}

const invalidLoads = [
  ['fuente desaparecida', r => { r.data.sources = [source('otra-fuente')]; }],
  ['fuente archivada', r => { r.data.sources = [{ ...source('seleccionada'), estado: 'archivada' }]; }],
  ['borrador de otro modulo', r => { r.data.details.solicitado.categoria = 'fijo'; }],
  ['borrador de otra fuente', r => { r.data.details.solicitado.fuente_comercial_id = 'otra-fuente'; }],
  ['borrador inexistente', r => { r.data.details.solicitado = null; }],
  ['GET del borrador falla', r => { r.data.detailError = new Error('HTTP 404'); }],
  ['respuesta trae otro ID de borrador', r => { r.data.details.solicitado.id = 'otro-borrador'; }],
];

for (const [scenario, invalidate] of invalidLoads) {
  test(`${scenario}: no conserva contenido ni acciones habilitadas de la revision previa`, async () => {
    const r = runtime();
    r.data.sources = [source('anterior'), source('seleccionada')];
    r.data.details.anterior = draft('anterior', 'anterior');
    await navigate(r, { kind: 'draft', tab: 'claro_tv', id: 'anterior', source_id: 'anterior' });
    await load(r, 'claro_tv');
    assert.equal(enabledPublishButtons(r.nodes.get('fcBasePreviewPanel').innerHTML).length, 1);

    r.data.details.solicitado = draft('solicitado', 'seleccionada');
    invalidate(r);
    await navigate(r, { kind: 'draft', tab: 'claro_tv', id: 'solicitado', source_id: 'seleccionada' });
    await load(r, 'claro_tv');
    const panel = r.nodes.get('fcBasePreviewPanel').innerHTML;
    assert.deepEqual(enabledPublishButtons(panel), [], `${scenario}: siguen habilitadas acciones de publicacion`);
    assert.doesNotMatch(panel, /anterior\.pdf|NUEVO-TEST|CAMBIO-TEST|BAJA-TEST/);
    assert.equal(r.run('fcBasePreview'), null);
    assert.deepEqual(r.read('fcBaseDrafts'), {});
    assert.match(r.nodes.get('ofBaseEstado_claro_tv').innerHTML, /no se pudo|no.*disponible|no coincide/i);
    assert.equal(r.run('tareasReglasFlowTarget'), null);
  });
}

test('Lista de Precios: fuente desaparecida deshabilita la publicacion de la lista anterior', async () => {
  const r = runtime();
  r.context.previousSource = source('lista-anterior', 'equipos');
  r.run('ofListaPreciosFuente=previousSource;ofListaPreciosPreview={total:1};ofListaPreciosDraft=true;ofRenderListaPreciosPanel()');
  assert.equal(enabledPublishButtons(r.nodes.get('ofListaPreciosPanel').innerHTML).length, 1);
  await navigate(r, { kind: 'flow', tab: 'lista_precios', source_id: 'lista-desaparecida' });
  await load(r, 'lista_precios');
  assert.deepEqual(enabledPublishButtons(r.nodes.get('ofListaPreciosPanel').innerHTML), []);
  assert.doesNotMatch(r.nodes.get('ofListaPreciosPanel').innerHTML, /lista-anterior/);
  assert.equal(r.run('ofListaPreciosFuente'), null);
  assert.equal(r.run('ofListaPreciosPreview'), null);
  assert.equal(r.run('ofListaPreciosDraft'), false);
});

test('accion published consulta el detalle por GET y conserva el modulo en la modal', async () => {
  const r = runtime();
  const publication = draft('publicada / 14', 'fuente-publicada');
  publication.estado = 'publicada';
  r.data.details[publication.id] = publication;
  await navigate(r, { kind: 'published', tab: 'claro_tv', id: publication.id });
  const [, actual, options] = r.rendered.at(-1);
  assert.deepEqual(actual, publication);
  assert.equal(options.modulo, 'claro_tv');
  assert.equal(r.context.location.hash, '#/tareas-reglas-admin');
  assert.ok(r.calls.some(call => call.url === `${basePath}${encodeURIComponent(publication.id)}`));
  r.assertReadOnly();
});

for (const entry of ['documento', 'accion']) {
  test(`original desde ${entry}: descarga autenticada y apertura del blob`, async () => {
    const r = runtime();
    const id = 'original / prueba';
    r.data.modules = [{ key: 'claro_tv', title: 'TV', documents: [{ id }], actions: [{ kind: 'document', id }] }];
    await r.run('viewTareasReglasAdmin()');
    await r.run(entry === 'documento' ? 'tareasReglasDocumento(0, 0)' : 'tareasReglasAccion(0, 0)');
    await setImmediate();
    const request = r.calls.find(call => call.url.includes('/documento'));
    assert.equal(request.url, `https://crm.test/api/fuentes-comerciales/${encodeURIComponent(id)}/documento?inline=1`);
    assert.equal(request.headers.Authorization, 'Bearer sesion-ficticia');
    assert.deepEqual(r.opened, [['blob:original-autenticado', '_blank', 'noopener']]);
    assert.deepEqual(r.alerts, []);
    r.assertReadOnly();
  });
}

test('original sin autorizacion no abre el endpoint ni una ventana sin documento', async () => {
  const r = runtime();
  r.data.fetchOk = false;
  await navigate(r, { kind: 'document', id: 'original' });
  await setImmediate();
  assert.deepEqual(r.opened, []);
  assert.equal(r.alerts.length, 1);
  assert.match(r.alerts[0], /401/);
  r.assertReadOnly();
});

test('destinos permiten paginas del portal y rechazan externos y Constructor retirado', async () => {
  const allowed = ['index', 'claro-tv', 'movil', 'banda-ancha', 'equipos', 'servicios', 'benefits', 'affinity', 'directorio-fijo']
    .map(page => `/constructor/${page}.html`);
  const blocked = [
    '/constructor/oferta-const.html', '/constructor/ofertas.html',
    '/constructor/OFERTA-CONST.html', '/constructor/OFERTAS.html',
    'javascript:alert(1)', 'https://evil.test/constructor/index.html', '//evil.test/index.html',
    '/constructor/../oferta-const.html', '/constructor/%6fferta-const.html',
    '/constructor/index.html?next=//evil.test', '/constructor/index.html#token=secreto',
  ];
  for (const [urls, safe] of [[allowed, true], [blocked, false]]) {
    for (const url of urls) {
      const r = runtime();
      assert.equal(r.run(`tareasReglasDestinoSeguro(${JSON.stringify(url)})`), safe, url);
      await navigate(r, { kind: 'destination', url });
      assert.deepEqual(r.opened, safe ? [[url, '_blank', 'noopener']] : [], url);
      assert.equal(r.context.location.hash, '#/tareas-reglas-admin');
      assert.equal(r.run('tareasReglasFlowTarget'), null);
      r.assertReadOnly();
    }
  }
});
