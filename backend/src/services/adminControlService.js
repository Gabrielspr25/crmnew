import { readFile } from 'node:fs/promises';
import { readBenefitsPortalCatalog } from './benefitsPortalCatalog.js';
import { loadProjectPlan } from './projectPlanService.js';
import { dateOnly } from './vigenciaTexto.js';

const MODULES = [
  { key: 'fijo', title: 'Planes Fijos', category: 'fijo', page: 'fijos', families: ['fijos'], destination: 'index', provides: ['Codigo de plan', 'Descripcion', 'Renta', 'Tecnologia'] },
  { key: 'claro_tv', title: 'Claro TV', category: 'claro_tv', page: 'claro_tv', families: ['claro_tv', 'fijos'], destination: 'claro-tv', provides: ['Codigo de plan', 'Descripcion', 'Renta', 'Complementos'] },
  { key: 'moviles', title: 'Planes Moviles', category: 'movil', page: 'moviles', families: ['moviles'], destination: 'movil', provides: ['Codigo de plan', 'Renta', 'Cantidad de lineas', 'Modelo de cobro'] },
  { key: 'inalambrico_iot', title: 'Inalambrico / IoT', category: 'inalambrico', page: 'inalambrico', families: ['inalambrico_iot'], destination: 'banda-ancha', provides: ['Codigo', 'Equipo', 'Plan', 'Precio', 'Vigencia'] },
  { key: 'lista_precios', title: 'Lista de Precios', families: ['equipos'], destination: 'equipos', provides: ['Item code', 'Modelo', 'Marca', 'Precio regular', 'Mensualidades', 'Precio por plan'] },
  { key: 'servicios', title: 'Servicios', category: 'servicios', page: 'servicios', families: ['servicios'], destination: 'servicios', static: true, provides: ['Codigo', 'Descripcion', 'Precio'] },
  { key: 'beneficios', title: 'Beneficios', tab: 'benefits', domain: 'fijo_benefits', families: ['beneficios', 'ofertas_fijo', 'ofertas_moviles'], destination: 'benefits', provides: ['Dominio', 'Tipo de beneficio', 'Condiciones', 'Fuente', 'Vigencia'] },
  { key: 'affinity', title: 'Affinity', domain: 'affinity_benefits', families: ['affinity'], destination: 'affinity', provides: ['Programa', 'Descuento', 'Condiciones', 'Fuente', 'Vigencia'] },
  { key: 'ofertas', title: 'Ofertas', tab: 'ofertas_vigentes', families: ['ofertas_moviles', 'ofertas_fijo'], destination: 'movil', provides: ['Version', 'Oferta', 'Equipo', 'Evento', 'Fuente', 'Vigencia'] },
  { key: 'directorio_fijo', title: 'Directorio de Fijo', families: [], destination: 'directorio-fijo', static: true, provides: ['Nombre', 'Area', 'Telefono', 'Correo'] },
];

// Pasos previstos del alcance del Plan; no reactivan la interfaz retirada (PM-027).
const CONSTRUCTOR_STEPS = {
  fijo: 'Integracion prevista: seleccion de plan fijo; sin conexion actual. Escenario fijo del Plan, pendiente de redefinir en el Constructor nuevo.',
  claro_tv: 'Integracion prevista: seleccion de plan TV y complementos; sin conexion actual. Paso definitivo del Constructor nuevo sin verificar.',
  moviles: 'Integracion prevista: seleccion de plan movil y modalidad de lineas; sin conexion actual. Catalogo base separado de promociones.',
  inalambrico_iot: 'Integracion prevista: seleccion de equipo y plan de Banda Ancha Individual o IoT; sin conexion actual.',
  lista_precios: 'Integracion prevista: seleccion de equipo y consulta de precios; sin conexion actual. Cruce definitivo con ofertas pendiente en el Plan.',
  beneficios: 'Integracion prevista: revision de beneficios y convergencia del escenario; sin conexion actual.',
  affinity: 'Integracion prevista: revision del beneficio Affinity independiente; sin conexion actual. Paso definitivo del Constructor nuevo sin verificar.',
  ofertas: 'Integracion prevista: revision de ofertas y candidatos por linea; sin conexion actual. Promocion del Motor como calculo definitivo pendiente.',
  servicios: 'Integracion prevista; sin conexion actual. Paso de Servicios sin definir ni verificar en el Constructor nuevo.',
  directorio_fijo: 'Integracion prevista; sin conexion actual. No hay un paso comercial propio del Directorio registrado para el Constructor nuevo.',
};

// Lecturas independientes: un circuito inaccesible no borra la evidencia de otro.
const QUERIES = {
  sources: `SELECT id, familia, titulo, nombre_original, sha256, creado_en,
    vigencia_desde, vigencia_hasta, vigencia_documental, estado FROM public.fuentes_comerciales ORDER BY creado_en DESC`,
  bases: `SELECT id, numero, categoria, estado, version_etiqueta, fuente_comercial_id, fuente_nombre,
    fuente_sha256, cargada_en, validada_en, aprobada_en, publicada_en, validacion, auditoria,
    jsonb_array_length(candidatos_publicos) AS candidatos_total
    FROM public.bases_informativas_publicaciones ORDER BY numero DESC`,
  contents: `SELECT pagina, seccion_key, vigencia_desde, vigencia_hasta, updated_at,
    (contenido IS NOT NULL AND contenido NOT IN ('null'::jsonb, '{}'::jsonb, '[]'::jsonb)) AS has_content
    FROM public.planes_modulos WHERE activo=true ORDER BY pagina, orden, id`,
  uploads: `SELECT u.id, u.fuente_comercial_id, u.nombre_archivo, u.fecha_subida, u.vigencia_inicio, u.vigencia_fin,
    to_jsonb(u)->>'estado_publicacion' AS estado_publicacion, to_jsonb(u)->>'publicado_en' AS publicado_en,
    to_jsonb(u)->>'sha256' AS sha256 FROM public.equipos_uploads u ORDER BY u.fecha_subida DESC`,
  equipment: `SELECT upload_id, count(*)::integer AS total FROM public.equipos_lista WHERE activo=true GROUP BY upload_id`,
  versions: `SELECT id, numero, dominio, estado_publicacion, resumen, creada_en, aprobada_en, publicada_en
    FROM public.motor_comercial_reglas_versiones WHERE dominio IN ('fijo_benefits', 'affinity_benefits') ORDER BY numero DESC`,
  versionSources: `SELECT version_id, fuente_comercial_id, sha256, vigencia_desde, vigencia_hasta
    FROM public.motor_comercial_reglas_fuentes`,
  rules: `SELECT version_id, count(*)::integer AS total,
    count(*) FILTER (WHERE estado_confianza='confirmado' AND estado_publicacion='vigente'
      AND autoaplica=false AND accion_version <> 'vence')::integer AS publicadas
    FROM public.motor_comercial_reglas_compuestas GROUP BY version_id`,
  offers: `SELECT id, numero, estado, fuentes, resumen, vigencia_desde, vigencia_hasta, creada_en, publicada_en,
    jsonb_array_length(datos) AS candidatos_total FROM public.ofertas_movil_versiones ORDER BY numero DESC`,
};

const array = (value) => Array.isArray(value) ? value : [];
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '')) ? String(value) : null;
const hash = (value) => String(value || '').trim().toLowerCase();
const time = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).getTime() : 0;
const iso = (value) => time(value) ? new Date(value).toISOString() : null;
const created = (row) => time(row?.cargada_en || row?.creada_en || row?.fecha_subida || row?.creado_en);
const published = (row) => time(row?.publicada_en || row?.publicado_en) || created(row);
const state = (row) => row?.estado_publicacion || row?.estado;
const latest = (rows) => [...rows].sort((a, b) => Number(b.numero || 0) - Number(a.numero || 0) || created(b) - created(a))[0] || null;
const alert = (what, why, how) => ({ what, why, how });

function validity(rows, today) {
  if (!rows.length) return 'Sin verificar';
  const states = rows.map((row) => {
    const from = dateOnly(row.vigencia_desde || row.vigencia_inicio);
    const to = dateOnly(row.vigencia_hasta || row.vigencia_fin);
    if (from && to && from > to) return 'Sin verificar';
    if (to && to < today) return 'Vencida';
    if (from && from > today) return 'Futura';
    return from && to ? 'Vigente' : 'Sin verificar';
  });
  if (states.includes('Vencida')) return 'Vencida';
  if (states.includes('Sin verificar')) return 'Sin verificar';
  if (states.includes('Futura')) return 'Futura';
  return 'Vigente';
}

function validityPeriod(rows) {
  return [...new Set(rows.map((row) => {
    const from = dateOnly(row.vigencia_desde || row.vigencia_inicio);
    const to = dateOnly(row.vigencia_hasta || row.vigencia_fin);
    return from || to ? `${from || 'Inicio sin verificar'} a ${to || 'Fin sin verificar'}` : '';
  }).filter(Boolean))].join('; ');
}

function linkedSources(refs, sources) {
  return sources.filter((source) => refs.some((ref) => {
    const id = ref.fuente_comercial_id || ref.id;
    // Priorizar IDs resueltos; referencias historicas sin fila solo admiten hash exacto.
    const resolved = id && sources.find((candidate) => String(candidate.id) === String(id));
    return resolved ? source.id === resolved.id
      : /^[0-9a-f]{64}$/.test(hash(ref.fuente_sha256 || ref.sha256)) && hash(source.sha256) === hash(ref.fuente_sha256 || ref.sha256);
  }));
}

function offerRefs(row) {
  return [...array(row?.fuentes), ...array(row?.resumen?.business_red_plus?.fuentes)];
}

function baseRefs(row) {
  return [{ fuente_comercial_id: row.fuente_comercial_id, sha256: row.fuente_sha256 }, ...array(row.auditoria?.fuentes)];
}

async function readDirectory() {
  const [html, data] = await Promise.all([
    readFile(new URL('../../../Planes para web/directorio-fijo.html', import.meta.url), 'utf8'),
    readFile(new URL('../../../Planes para web/directorio-fijo-data.js', import.meta.url), 'utf8'),
  ]);
  return html.includes('directorio-fijo-data.js') && data.includes('window.DIRECTORIO_FIJO_DATA');
}

function runtimeLabel(value) {
  const label = String(value || '').trim();
  return label && label.length <= 80 && /^[\p{L}\p{N} ._()-]+$/u.test(label) ? label : 'Instancia consultada';
}

function publication(row, sources, today, detail) {
  return {
    label: `Version ${row.numero ?? row.id} publicada`,
    version: row.numero == null ? row.id : Number(row.numero),
    status: state(row) || 'publicada',
    published_at: iso(row.publicada_en || row.publicado_en),
    source_name: row.fuente_nombre || row.nombre_archivo || sources.map(s => s.nombre_original || s.titulo).filter(Boolean).join(' + ') || null,
    validity: validity([...(row.vigencia_desde || row.vigencia_hasta || row.vigencia_inicio || row.vigencia_fin ? [row] : []), ...sources], today),
    validity_period: validityPeriod([row, ...sources]),
    detail,
  };
}

function buildModule(config, evidence, checkedAt, plan) {
  const today = checkedAt.slice(0, 10);
  const rows = (name) => evidence[name].rows;
  const sources = rows('sources');
  const tab = config.tab || config.key;
  const destination = `/constructor/${config.destination}.html`;
  const result = {
    key: config.key, title: config.title, provides: config.key === 'servicios' ? config.provides.map((field) => `${field} (previsto; fuente sin verificar)`) : [...config.provides],
    consumers: [{ label: `Portal: ${config.title}`, path: destination, kind: config.static ? 'estatico' : 'conectado' }],
    constructor_step: CONSTRUCTOR_STEPS[config.key],
    documents: [], publication: null, pending: null, stages: [],
    verification: { status: 'Sin verificar', detail: 'Lectura de BD realizada; destino publico no comprobado por HTTP ni por UI.', checked_at: checkedAt },
    alerts: [], actions: [],
  };
  const motorReader = ['lista_precios', 'inalambrico_iot', 'ofertas'].includes(config.key);
  result.consumers.push(motorReader
    ? { label: 'Motor Comercial: lector de elegibilidad existente; ejecucion sin verificar', path: '/api/motor-ofertas/elegibles', kind: 'conectado' }
    : { label: 'Motor Comercial: conexion de este dominio sin verificar', path: '', kind: 'previsto' });
  let dependencies = ['sources'];
  let versions = [];
  let active = null;
  let activeRefs = [];
  let persistedAnalysis = false;
  let activeSources = [];
  let currentContent = [];

  if (config.category) {
    dependencies.push('bases', 'contents');
    versions = rows('bases').filter((r) => r.categoria === config.category);
    active = latest(versions.filter((r) => r.estado === 'publicada'));
    currentContent = rows('contents').filter((r) => r.pagina === config.page && r.has_content);
    if (active) {
      activeRefs = baseRefs(active);
      activeSources = linkedSources(activeRefs, sources);
      result.publication = publication(active, activeSources, today, `Publicacion registrada en bases_informativas_publicaciones; ${active.candidatos_total ?? 'sin conteo de'} candidatos. Contenido activo en BD: ${evidence.contents.ok ? currentContent.length : 'Sin verificar'} modulos.`);
      persistedAnalysis = Number(active.candidatos_total) > 0;
    } else if (currentContent.length) {
      result.publication = { label: 'Contenido disponible sin version', version: null, status: 'contenido_sin_version', published_at: null, validity: validity(currentContent, today), validity_period: validityPeriod(currentContent), detail: `${currentContent.length} modulos activos con contenido en planes_modulos; cabecera de bases ${evidence.bases.ok ? 'no encontrada' : 'Sin verificar'}. Fecha de actualizacion no equivale a publicacion.` };
    }
  } else if (config.key === 'lista_precios') {
    dependencies.push('uploads', 'equipment');
    versions = rows('uploads');
    const catalogIds = new Set(rows('equipment').filter((r) => Number(r.total) > 0).map((r) => String(r.upload_id)));
    active = latest(versions.filter((r) => catalogIds.has(String(r.id))))
      || latest(versions.filter((r) => state(r) === 'publicada'));
    if (active) {
      activeRefs = [{ fuente_comercial_id: active.fuente_comercial_id, sha256: active.sha256 }];
      activeSources = linkedSources(activeRefs, sources);
      const count = rows('equipment').find((r) => String(r.upload_id) === String(active.id))?.total;
      result.publication = publication(active, activeSources, today, `Upload ${active.id}; ${evidence.equipment.ok ? Number(count || 0) : 'Sin verificar'} equipos activos asociados en equipos_lista. Una fecha de publicacion nula no anula el catalogo.`);
      persistedAnalysis = Number(count) > 0;
    } else if (catalogIds.size) {
      result.publication = { label: 'Catalogo disponible sin version', version: null, status: 'contenido_sin_version', published_at: null, validity: 'Sin verificar', detail: 'Existen equipos activos; su upload no pudo vincularse.' };
    }
  } else if (config.domain) {
    dependencies.push('versions', 'versionSources', 'rules');
    versions = rows('versions').filter((r) => r.dominio === config.domain);
    active = latest(versions.filter((r) => state(r) === 'vigente'));
    if (active) {
      activeRefs = rows('versionSources').filter((r) => r.version_id === active.id);
      activeSources = linkedSources(activeRefs, sources);
      const counts = rows('rules').find((r) => r.version_id === active.id);
      if (Number(counts?.total) > 0) result.provides.push('Condiciones y elegibilidad de reglas persistidas');
      if (Number(counts?.publicadas) > 0) result.provides.push('Reglas confirmadas y publicadas: autoaplica=false');
      result.publication = publication(active, [...activeRefs, ...activeSources], today, `${config.domain} v${active.numero}; ${evidence.rules.ok ? Number(counts?.publicadas || 0) : 'Sin verificar'} reglas publicadas para el consumidor.`);
      persistedAnalysis = Number(counts?.total) > 0;
    }
    if (config.key === 'beneficios') {
      dependencies.push('offers', 'benefits');
      const mobile = latest(rows('offers').filter((r) => r.estado === 'vigente'));
      const projected = mobile?.resumen?.business_red_plus;
      if (projected) {
        activeRefs = [...activeRefs, ...offerRefs(mobile)];
        activeSources = linkedSources(activeRefs, sources);
        const projectionDetail = `ofertas_moviles v${mobile.numero}: proyeccion desde ofertas_movil_versiones y catalogo de equipos; no es otra version de fijo_benefits.`;
        if (result.publication) result.publication.detail += ` ${projectionDetail}`;
        else result.publication = { ...publication(mobile, activeSources, today, projectionDetail), label: 'Proyeccion de ofertas moviles publicada' };
      }
      if (result.publication) {
        result.publication.label = 'Catalogo agregado por dominio';
        result.publication.version = null;
        result.publication.validity = 'Por entrada; Sin verificar global';
        result.publication.validity_period = 'Consultar las fechas de cada entrada en Beneficios.';
        result.publication.detail += evidence.benefits.ok ? ` Agregador consultado: ${array(evidence.benefits.value?.beneficios).length} entradas. Vigencia y fuente se revisan por entrada.` : ' Agregador: Sin verificar.';
      }
    }
  } else if (config.key === 'ofertas') {
    dependencies.push('offers');
    versions = rows('offers');
    active = latest(versions.filter((r) => r.estado === 'vigente'));
    if (active) {
      activeRefs = offerRefs(active);
      activeSources = linkedSources(activeRefs, sources);
      result.publication = publication(active, activeSources, today, `ofertas_movil_versiones v${active.numero}, consumida por la API de ofertas moviles. Motor de ofertas tiene numeracion independiente; no se equiparan versiones.`);
      persistedAnalysis = Number(active.candidatos_total) > 0;
    }
  } else if (config.key === 'directorio_fijo') {
    dependencies = ['directory'];
    if (evidence.directory.ok && evidence.directory.value) result.publication = { label: 'Contenido estatico disponible', version: null, status: 'estatica', published_at: null, validity: 'Sin verificar', detail: 'HTML y JS propios presentes en esta instancia. No hereda la version de Fijo ni acredita publicacion HTTP, aprobacion o vigencia.' };
    result.verification.detail = 'Archivos del directorio consultados en esta instancia; destino publico no comprobado por HTTP ni por UI.';
  }

  const failures = dependencies.filter((name) => !evidence[name].ok);
  if (failures.length) {
    result.alerts.push(alert('Lectura sin verificar', `No se pudo consultar: ${failures.join(', ')}. No demuestra ausencia de publicacion.`, 'Reintentar la lectura y revisar disponibilidad del circuito.'));
    result.verification.detail = `Lectura parcial: ${failures.join(', ')} Sin verificar; destino publico no comprobado por HTTP ni por UI.`;
  }

  const families = config.families;
  const relevant = sources.filter((s) => families.includes(s.familia) || activeSources.some((a) => a.id === s.id));
  const publishedHashes = new Set([...activeRefs.map((r) => hash(r.sha256 || r.fuente_sha256)), ...activeSources.map((s) => hash(s.sha256))].filter(Boolean));
  const cutoff = Math.max(0, ...activeSources.map(created)) || (active ? created(active) : Math.max(0, ...currentContent.map((r) => time(r.updated_at))));
  const newSources = [...relevant].sort((a, b) => created(b) - created(a)).filter((s) => s.estado !== 'archivada' && !activeSources.some((a) => a.id === s.id)
    && !publishedHashes.has(hash(s.sha256)) && (!result.publication || (cutoff > 0 && created(s) > cutoff)));
  const newSource = newSources[0];
  const draft = latest(versions.filter((r) => ['borrador', 'pendiente_validacion', 'validada', 'aprobada', 'pendiente_revision'].includes(state(r))
    && (!active || created(r) > published(active))));
  const draftRefs = draft ? config.domain ? rows('versionSources').filter((r) => r.version_id === draft.id)
    : config.key === 'ofertas' ? offerRefs(draft) : baseRefs(draft) : [];
  const draftSources = linkedSources(draftRefs, sources);
  const draftSource = draftSources.find((s) => s.id === draft?.fuente_comercial_id) || draftSources[0];
  // Un archivo posterior no debe abrir un borrador de una fuente distinta y antigua.
  const focusDraft = draft && (!newSource || draftSources.some((s) => s.id === newSource.id || (hash(s.sha256) && hash(s.sha256) === hash(newSource.sha256)))) ? draft : null;
  const pendingSource = focusDraft ? draftSource : newSource;
  if (focusDraft || newSource) result.pending = {
    label: focusDraft ? `Version ${focusDraft.numero ?? focusDraft.id}: ${state(focusDraft)}` : 'Fuente pendiente de analizar',
    detail: focusDraft ? (state(focusDraft) === 'aprobada' ? 'Aprobacion registrada; pendiente de publicacion explicita y comprobacion del destino. La version anterior se conserva.' : state(focusDraft) === 'validada' ? 'Revision validada; pendiente de aprobacion antes de publicar.' : 'Version persistida posterior a la publicada; revisar su analisis y diferencias antes de validar y aprobar.') : 'Documento recibido con hash distinto; analisis persistido y publicacion de esta fuente sin comprobar.',
    draft_id: uuid(focusDraft?.id), source_id: uuid(pendingSource?.id || focusDraft?.fuente_comercial_id),
  };

  const pendingIds = new Set([result.pending?.source_id, ...newSources.map((s) => s.id), ...(focusDraft ? draftSources.map((s) => s.id) : [])].filter(Boolean));
  const documentSources = [...new Map([...activeSources, ...relevant, ...draftSources].filter((s) => uuid(s.id)).map((s) => [s.id, s])).values()];
  result.documents = documentSources.flatMap((s) => {
    const roles = [];
    if (activeSources.some((a) => a.id === s.id)) roles.push('Publicada');
    if (pendingIds.has(s.id)) roles.push('Pendiente');
    if (!roles.length) roles.push('Archivada');
    return roles.map((role) => ({ id: uuid(s.id), name: String(s.nombre_original || s.titulo || 'Documento oficial'),
      url: `/api/fuentes-comerciales/${encodeURIComponent(s.id)}/documento?download=0`, role }));
  });

  const focus = focusDraft || (!newSource ? active : null);
  const errors = array(focus?.validacion?.errores);
  const failedAnalysis = errors.length > 0 || focus?.validacion?.publicable === false;
  const analysis = focusDraft ? (config.domain ? Number(rows('rules').find((r) => r.version_id === focusDraft.id)?.total) > 0 : Number(focusDraft.candidatos_total) > 0) : !newSource && persistedAnalysis;
  const publicationStage = result.pending ? 'Pendiente' : !result.publication ? 'Sin verificar'
    : result.publication.status === 'estatica' ? 'Disponible en instancia' : 'Publicada';
  result.stages = [
    { label: 'Documento', status: result.documents.length ? 'Registrado' : 'Sin verificar', detail: result.documents.length ? 'Fuentes registradas y enlace autenticado al original; integridad del archivo no comprobada en esta lectura.' : 'Sin documento vinculado comprobable en esta lectura.' },
    { label: 'Analisis', status: failedAnalysis ? 'Requiere revision' : analysis ? 'Analizado' : 'Sin verificar', detail: failedAnalysis ? 'El analisis persistido contiene errores o no es publicable; se conserva la publicada.' : analysis ? 'Existen resultados de analisis persistidos para la version indicada.' : 'Recepcion del documento o preview efimera no acredita analisis persistido.' },
    { label: 'Revision', status: iso(focus?.validada_en) ? 'Validada' : result.pending ? 'Pendiente' : 'Sin verificar', detail: iso(focus?.validada_en) ? `Validacion registrada: ${iso(focus.validada_en)}.` : 'Sin fecha de validacion comprobada para el proceso actual.' },
    { label: 'Aprobacion', status: iso(focus?.aprobada_en) ? 'Aprobada' : 'Sin verificar', detail: iso(focus?.aprobada_en) ? `Aprobacion registrada: ${iso(focus.aprobada_en)}.` : 'Sin fecha de aprobacion comprobada; no se deduce de recepcion ni publicacion.' },
    { label: 'Publicacion', status: publicationStage, detail: result.pending ? `Actualizacion sin publicar.${result.publication ? ` La anterior ${result.publication.version == null ? result.publication.label : `v${result.publication.version}`} permanece publicada.` : ' Publicacion anterior sin verificar.'}` : result.publication?.detail || (failures.length ? 'No se pudo verificar el circuito de publicacion.' : 'Sin version encontrada en el circuito consultado; no certifica inexistencia en otros circuitos.') },
    { label: 'Comprobacion', status: 'Sin verificar', detail: result.verification.detail },
  ];
  if (failedAnalysis) result.alerts.push(alert('Analisis requiere revision', 'Errores persistidos en la version pendiente. La publicacion anterior se conserva.', 'Abrir el flujo y revisar el analisis antes de cualquier publicacion.'));
  if (result.publication?.validity === 'Vencida') result.alerts.push(alert('Vigencia vencida', 'Las fechas registradas vencieron aunque el estado de la version siga publicado o vigente.', 'Revisar reemplazo y fuente oficial; conservar la publicacion hasta una decision explicita.'));
  if (result.publication && /Sin verificar/.test(result.publication.validity)) result.alerts.push(alert('Vigencia sin verificar', 'Faltan fechas completas o la vigencia corresponde a cada entrada del agregador.', 'Revisar las fechas de las fuentes vinculadas; no deducirlas del nombre del archivo.'));
  const tracking = plan?.operating_control?.modules?.find((m) => m.key === config.key);
  if (result.publication && (config.key === 'claro_tv' || tracking)) result.alerts.push(alert('Seguimiento del Plan y publicacion', `El Plan registra seguimiento; la BD acredita ${result.publication.label.toLowerCase()}. Sus estados no son equivalentes.`, 'Conservar la publicacion y revisar por separado el seguimiento, la vigencia y el destino.'));
  if (config.key === 'servicios') result.alerts.push(alert('Destino estatico', 'La pagina de Servicios no consulta una API; su texto no demuestra el estado de publicacion en BD.', 'Revisar su circuito y fuente especifica.'));
  if (config.key === 'affinity') result.alerts.push(alert('Circuito Affinity independiente', 'Las reglas historicas de Fijo en Beneficios no prueban una version affinity_benefits. Un preview temporal no equivale a borrador guardado.', 'Revisar fuente, decisiones y borrador persistido en su flujo.'));

  const flowSourceId = result.pending?.source_id || uuid(active?.fuente_comercial_id) || uuid(activeSources[0]?.id);
  const flowLabel = failedAnalysis ? 'Revisar analisis' : newSource && !focusDraft ? 'Revisar fuente'
    : focusDraft ? 'Revisar actualizacion' : /Sin verificar|Vencida|Futura/.test(result.publication?.validity || '') ? 'Revisar vigencia'
      : result.publication ? 'Revisar publicacion' : 'Revisar fuente';
  result.actions.push({ label: flowLabel, kind: 'flow', tab, ...(flowSourceId ? { source_id: flowSourceId } : {}) });
  for (const s of newSources.filter((s) => uuid(s.id) && s.id !== flowSourceId)) result.actions.push({ label: 'Revisar otra fuente pendiente', kind: 'flow', tab, source_id: uuid(s.id) });
  if (config.category && uuid(focusDraft?.id)) result.actions.push({ label: 'Revisar borrador', kind: 'draft', tab, id: uuid(focusDraft.id), ...(result.pending?.source_id ? { source_id: result.pending.source_id } : {}) });
  if (config.category && uuid(active?.id)) result.actions.push({ label: 'Ver publicacion', kind: 'published', tab, id: uuid(active.id) });
  for (const doc of result.documents) result.actions.push({ label: `Documento: ${doc.name}`, kind: 'document', tab, id: doc.id, url: doc.url });
  result.actions.push({ label: 'Abrir destino', kind: 'destination', tab, url: destination });
  return result;
}

export async function loadAdminControlModules({ db, now = new Date(), environmentLabel, readStatic = readDirectory, loadPlan = loadProjectPlan } = {}) {
  const checkedAt = new Date(now).toISOString();
  const evidence = {};
  await Promise.all(Object.entries(QUERIES).map(async ([key, sql]) => {
    try { evidence[key] = { ok: true, rows: (await db.query(sql)).rows }; }
    catch { evidence[key] = { ok: false, rows: [] }; }
  }));
  const [benefits, directory, plan] = await Promise.allSettled([
    readBenefitsPortalCatalog({ db }), readStatic(), loadPlan(),
  ]);
  evidence.benefits = { ok: benefits.status === 'fulfilled', value: benefits.value };
  evidence.directory = { ok: directory.status === 'fulfilled', value: directory.value };
  return {
    environment: runtimeLabel(environmentLabel), checked_at: checkedAt,
    modules: MODULES.map((config) => buildModule(config, evidence, checkedAt, plan.value)),
  };
}
