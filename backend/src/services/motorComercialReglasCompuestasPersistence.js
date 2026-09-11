import crypto from 'node:crypto';

const VERSION_STATES = new Set(['borrador', 'validada', 'aprobada', 'vigente', 'reemplazada', 'archivada']);

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sourceSha(source) {
  return source?.sha256 || source?.fuente_sha256 || source?.traza?.fuente?.sha256 || '';
}

function normalizeSource(source = {}) {
  return {
    fuente_comercial_id: source.id || source.fuente_comercial_id || null,
    familia: source.familia || null,
    nombre_original: source.nombre_original || source.nombre || 'fuente-oficial',
    ruta_relativa: source.ruta_relativa || null,
    sha256: sourceSha(source),
    mime_type: source.mime_type || null,
    bytes: source.bytes ?? null,
    vigencia_desde: source.vigencia_desde || null,
    vigencia_hasta: source.vigencia_hasta || null,
    vigencia_documental: source.vigencia_documental || 'vigente',
    pagina_inicio: source.pagina_inicio ?? null,
    pagina_fin: source.pagina_fin ?? null,
    seccion_original: source.seccion_original || null,
    metadatos: source.metadatos || {},
    texto_extraido: source.texto_extraido || null,
  };
}

function ruleProductKey(rule) {
  const affected = Array.isArray(rule.productos_afectados) ? rule.productos_afectados : [];
  const product = rule.producto?.familia || rule.producto?.servicio || affected[0] || 'producto_no_determinado';
  return fold(product);
}

export function stableCompositeRuleKey(rule, { dominio = 'fijo_benefits' } = {}) {
  const benefitType = fold(rule?.beneficio?.tipo || 'beneficio_no_determinado');
  return [fold(dominio), benefitType, ruleProductKey(rule)].filter(Boolean).join('|');
}

function ruleContract(rule, { dominio, estadoPublicacion }) {
  const source = normalizeSource(rule.traza?.fuente || {});
  return {
    ...rule,
    identidad_comercial: stableCompositeRuleKey(rule, { dominio }),
    estado_publicacion: estadoPublicacion,
    autoaplica: false,
    aplicacion_automatica: false,
    fuente: {
      id: source.fuente_comercial_id,
      nombre_original: source.nombre_original,
      sha256: source.sha256,
      pagina: rule.traza?.beneficio?.pagina ?? null,
      seccion: rule.traza?.beneficio?.seccion || rule.traza?.fuente?.seccion_original || null,
    },
  };
}

function contractHash(rule) {
  return sha256(stableJson({
    beneficio: rule.beneficio,
    producto: rule.producto,
    productos_afectados: rule.productos_afectados,
    condiciones: rule.condiciones,
    terminos_vinculados: rule.terminos_vinculados,
    vigencia_desde: rule.vigencia_desde,
    vigencia_hasta: rule.vigencia_hasta,
    estado_confianza: rule.estado_confianza,
    traza: rule.traza,
  }));
}

export function diffCompositeRules({ dominio = 'fijo_benefits', previousRules = [], currentRules = [] } = {}) {
  const previous = new Map(previousRules.map((row) => [row.identidad_comercial, row]));
  const current = new Map(currentRules.map((rule) => [stableCompositeRuleKey(rule, { dominio }), rule]));
  const diffs = [];

  for (const [identidad, rule] of current) {
    const prior = previous.get(identidad);
    if (!prior) {
      diffs.push({ identidad_comercial: identidad, accion_version: 'nuevo', regla: rule, regla_anterior: null });
      continue;
    }
    const previousHash = prior.contrato_sha256 || contractHash(prior.contrato || {});
    const currentHash = contractHash(rule);
    diffs.push({
      identidad_comercial: identidad,
      accion_version: previousHash === currentHash ? 'sin_cambio' : 'modifica',
      regla: rule,
      regla_anterior: prior,
    });
  }

  for (const [identidad, prior] of previous) {
    if (!current.has(identidad)) {
      diffs.push({
        identidad_comercial: identidad,
        accion_version: 'vence',
        regla: prior.contrato,
        regla_anterior: prior,
      });
    }
  }

  return diffs;
}

// Un borrador conserva el trabajo en curso tal cual lo dejo el documento, incluidas las reglas que quedaron
// en revision. Exigir que todo este confirmado corresponde a validar/aprobar, que es lo que habilita publicar.
const ESTADOS_QUE_EXIGEN_CONFIRMACION = new Set(['validada', 'aprobada', 'vigente']);

function validateConfirmedRules(reglas, estadoPublicacion) {
  if (!ESTADOS_QUE_EXIGEN_CONFIRMACION.has(estadoPublicacion)) return;
  const invalid = reglas.filter((rule) => rule.estado_confianza !== 'confirmado');
  if (invalid.length) {
    throw Object.assign(new Error('reglas_no_confirmadas'), {
      code: 'reglas_no_confirmadas',
      reglas: invalid.map((rule) => rule.llave_comercial || rule.beneficio?.tipo),
    });
  }
}

function versionSummary({ reglas, relacionesAmbiguas = [], contradicciones = [] }) {
  return {
    total_reglas: reglas.length,
    confirmadas: reglas.filter((rule) => rule.estado_confianza === 'confirmado').length,
    pendientes: reglas.filter((rule) => rule.estado_confianza !== 'confirmado').length,
    contradicciones: contradicciones.length,
    relaciones_ambiguas: relacionesAmbiguas.length,
    autoaplicables: reglas.filter((rule) => rule.aplicacion_automatica === true || rule.autoaplica === true).length,
  };
}

async function loadPreviousRules(client, dominio) {
  const version = await client.query(
    `SELECT id, estado_publicacion
     FROM public.motor_comercial_reglas_versiones
     WHERE dominio=$1 AND estado_publicacion IN ('aprobada','vigente')
     ORDER BY numero DESC
     LIMIT 1`,
    [dominio]
  );
  const previousVersion = version.rows[0] || null;
  if (!previousVersion) return { previousVersion: null, previousRules: [] };

  const previousRules = await client.query(
    `SELECT id, identidad_comercial, contrato, contrato_sha256
     FROM public.motor_comercial_reglas_compuestas
     WHERE version_id=$1`,
    [previousVersion.id]
  );
  return { previousVersion, previousRules: previousRules.rows };
}

export async function persistCompositeRulesVersion({
  db,
  dominio = 'fijo_benefits',
  estadoPublicacion = 'aprobada',
  normalizadorVersion,
  actor,
  fuentes = [],
  reglasCompuestas = [],
  relacionesAmbiguas = [],
  contradicciones = [],
} = {}) {
  if (!db?.connect) throw new Error('db_requerida');
  if (!VERSION_STATES.has(estadoPublicacion)) throw new Error('estado_publicacion_invalido');
  if (!normalizadorVersion) throw new Error('normalizador_version_requerida');
  if (!actor) throw new Error('actor_requerido');
  validateConfirmedRules(reglasCompuestas, estadoPublicacion);

  const summary = versionSummary({ reglas: reglasCompuestas, relacionesAmbiguas, contradicciones });
  const sourceSnapshots = fuentes.map(normalizeSource);
  const fuentesManifestSha256 = sha256(stableJson(sourceSnapshots.map((source) => ({
    nombre_original: source.nombre_original,
    sha256: source.sha256,
    familia: source.familia,
  }))));
  const reglasManifestSha256 = sha256(stableJson(reglasCompuestas.map((rule) => ({
    identidad_comercial: stableCompositeRuleKey(rule, { dominio }),
    contrato_sha256: contractHash(rule),
  }))));

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { previousVersion, previousRules } = await loadPreviousRules(client, dominio);
    const diffs = diffCompositeRules({ dominio, previousRules, currentRules: reglasCompuestas });
    if (estadoPublicacion === 'vigente' && previousVersion) {
      await client.query(
        `UPDATE public.motor_comercial_reglas_versiones
         SET estado_publicacion='reemplazada', reemplazada_en=now()
         WHERE id=$1`,
        [previousVersion.id]
      );
    }

    const versionResult = await client.query(
      `INSERT INTO public.motor_comercial_reglas_versiones
        (dominio, estado_publicacion, normalizador_version, fuentes_manifest_sha256,
         reglas_manifest_sha256, version_anterior_id, resumen, creada_por,
         aprobada_por, aprobada_en, publicada_por, publicada_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
         CASE WHEN $2 IN ('aprobada','vigente') THEN $8 ELSE NULL END,
         CASE WHEN $2 IN ('aprobada','vigente') THEN now() ELSE NULL END,
         CASE WHEN $2 = 'vigente' THEN $8 ELSE NULL END,
         CASE WHEN $2 = 'vigente' THEN now() ELSE NULL END)
       RETURNING id, numero, dominio, estado_publicacion, resumen`,
      [dominio, estadoPublicacion, normalizadorVersion, fuentesManifestSha256, reglasManifestSha256, previousVersion?.id || null, JSON.stringify(summary), actor]
    );
    const version = versionResult.rows[0];

    const fuenteIds = new Map();
    for (const source of sourceSnapshots) {
      const result = await client.query(
        `INSERT INTO public.motor_comercial_reglas_fuentes
          (version_id, fuente_comercial_id, familia, nombre_original, ruta_relativa, sha256,
           mime_type, bytes, vigencia_desde, vigencia_hasta, vigencia_documental,
           pagina_inicio, pagina_fin, seccion_original, metadatos, texto_extraido)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [version.id, source.fuente_comercial_id, source.familia, source.nombre_original, source.ruta_relativa,
          source.sha256, source.mime_type, source.bytes, source.vigencia_desde, source.vigencia_hasta,
          source.vigencia_documental, source.pagina_inicio, source.pagina_fin, source.seccion_original,
          JSON.stringify(source.metadatos), source.texto_extraido]
      );
      fuenteIds.set(source.sha256, result.rows[0].id);
    }

    const insertedRules = [];
    for (const diff of diffs) {
      const rule = diff.regla;
      const source = normalizeSource(rule?.traza?.fuente || {});
      const contrato = ruleContract(rule, { dominio, estadoPublicacion });
      const hash = contractHash(rule);
      const result = await client.query(
        `INSERT INTO public.motor_comercial_reglas_compuestas
          (version_id, identidad_comercial, accion_version, version_anterior_regla_id,
           beneficio_regla_id, beneficio, terminos_vinculados, condiciones, elegibilidad,
           compatibilidad, limite, vigencia_desde, vigencia_hasta, estado_confianza,
           estado_publicacion, autoaplica, fuente_versionada_id, fuente_comercial_id,
           fuente_sha256, fuente_pagina, fuente_seccion, contrato, contrato_sha256)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16,$17,$18,$19,$20,$21,$22)
         RETURNING id`,
        [version.id, diff.identidad_comercial, diff.accion_version, diff.regla_anterior?.id || null,
          rule?.beneficio_regla_id || null, JSON.stringify(rule?.beneficio || {}),
          JSON.stringify(rule?.terminos_vinculados || []), JSON.stringify(rule?.condiciones || {}),
          JSON.stringify({ eventos: rule?.condiciones?.eventos || [], productos: rule?.productos_afectados || [] }),
          rule?.condiciones?.compatibilidad || 'no_determinado', JSON.stringify(rule?.condiciones?.limite || null),
          rule?.vigencia_desde || null, rule?.vigencia_hasta || null, rule?.estado_confianza || 'confirmado',
          estadoPublicacion, fuenteIds.get(source.sha256) || null, source.fuente_comercial_id, source.sha256 || null,
          rule?.traza?.beneficio?.pagina ?? null, rule?.traza?.beneficio?.seccion || source.seccion_original,
          JSON.stringify(contrato), hash]
      );
      const inserted = {
        id: result.rows[0].id,
        identidad_comercial: diff.identidad_comercial,
        accion_version: diff.accion_version,
        estado_confianza: rule.estado_confianza,
        estado_publicacion: estadoPublicacion,
      };
      insertedRules.push(inserted);

      for (const term of rule.terminos_vinculados || []) {
        await client.query(
          `INSERT INTO public.motor_comercial_reglas_terminos
            (regla_compuesta_id, llave_comercial, codigo, nombre, pagina,
             estado_confianza, condiciones, termino_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [inserted.id, term.llave_comercial, term.codigo || null, term.nombre, term.pagina ?? null,
            term.estado_confianza || 'confirmado', JSON.stringify(term.condiciones || {}), JSON.stringify(term)]
        );
      }

      await client.query(
        `INSERT INTO public.motor_comercial_reglas_historial
          (version_id, regla_compuesta_id, estado_anterior, estado_nuevo, accion_version, actor, motivo, detalle)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [version.id, inserted.id, diff.regla_anterior?.estado_publicacion || null, estadoPublicacion,
          diff.accion_version, actor, 'persistencia_regla_compuesta', JSON.stringify({ identidad_comercial: diff.identidad_comercial })]
      );
    }

    await client.query(
      `INSERT INTO public.motor_comercial_reglas_historial
        (version_id, estado_anterior, estado_nuevo, accion_version, actor, motivo, detalle)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [version.id, previousVersion?.estado_publicacion || null, estadoPublicacion,
        previousVersion ? 'reemplaza' : 'nuevo', actor, 'persistencia_version_compuesta',
        JSON.stringify({ version_anterior_id: previousVersion?.id || null })]
    );

    await client.query('COMMIT');
    return { version, resumen: summary, reglas: insertedRules, fuentes: sourceSnapshots };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function listCompositeRulesVersions({ db, dominio = 'fijo_benefits', limit = 20 } = {}) {
  if (!db?.query) throw new Error('db_requerida');
  const { rows } = await db.query(
    `SELECT id, numero, dominio, estado_publicacion, normalizador_version, resumen,
            creada_por, creada_en, aprobada_por, aprobada_en, publicada_por, publicada_en, reemplazada_en
     FROM public.motor_comercial_reglas_versiones
     WHERE dominio=$1
     ORDER BY numero DESC
     LIMIT $2`,
    [dominio, Math.max(1, Math.min(100, Number(limit) || 20))]
  );
  return rows;
}

export async function readCompositeRulesVersion({ db, versionId }) {
  if (!db?.query) throw new Error('db_requerida');
  const versionResult = await db.query(
    `SELECT id, numero, dominio, estado_publicacion, resumen
     FROM public.motor_comercial_reglas_versiones
     WHERE id=$1`,
    [versionId]
  );
  const version = versionResult.rows[0] || null;
  if (!version) return null;

  const rulesResult = await db.query(
    `SELECT id, identidad_comercial, accion_version, estado_confianza, estado_publicacion, contrato
     FROM public.motor_comercial_reglas_compuestas
     WHERE version_id=$1
     ORDER BY identidad_comercial`,
    [versionId]
  );
  const termResult = await db.query(
    `SELECT regla_compuesta_id, termino_snapshot
     FROM public.motor_comercial_reglas_terminos
     WHERE regla_compuesta_id = ANY($1)`,
    [rulesResult.rows.map((row) => row.id)]
  );
  const termsByRule = new Map();
  for (const term of termResult.rows) {
    if (!termsByRule.has(term.regla_compuesta_id)) termsByRule.set(term.regla_compuesta_id, []);
    termsByRule.get(term.regla_compuesta_id).push(term.termino_snapshot);
  }

  return {
    version,
    reglas: rulesResult.rows.map((rule) => ({
      ...rule,
      terminos: termsByRule.get(rule.id) || [],
    })),
  };
}

function isPublishableRule(rule) {
  return rule.estado_confianza === 'confirmado'
    && ['aprobada', 'vigente'].includes(rule.estado_publicacion)
    && rule.autoaplica === false;
}

export async function publishApprovedCompositeRulesVersion({
  db,
  dominio = 'fijo_benefits',
  versionId,
  actor,
} = {}) {
  if (!db?.connect) throw new Error('db_requerida');
  if (!versionId) throw new Error('version_id_requerida');
  if (!actor) throw new Error('actor_requerido');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const targetResult = await client.query(
      `SELECT id, numero, dominio, estado_publicacion, resumen
       FROM public.motor_comercial_reglas_versiones
       WHERE id=$1 AND dominio=$2
       FOR UPDATE`,
      [versionId, dominio]
    );
    const target = targetResult.rows[0];
    if (!target) throw Object.assign(new Error('version_no_encontrada'), { code: 'version_no_encontrada' });
    if (target.estado_publicacion !== 'aprobada') throw Object.assign(new Error('version_no_aprobada'), { code: 'version_no_aprobada' });

    const rulesResult = await client.query(
      `SELECT id, identidad_comercial, accion_version, estado_confianza, estado_publicacion, autoaplica, contrato
       FROM public.motor_comercial_reglas_compuestas
       WHERE version_id=$1
       ORDER BY identidad_comercial
       FOR UPDATE`,
      [versionId]
    );
    const invalid = rulesResult.rows.filter((rule) => !isPublishableRule(rule));
    if (!rulesResult.rows.length || invalid.length) {
      throw Object.assign(new Error('reglas_no_publicables'), {
        code: 'reglas_no_publicables',
        reglas: invalid.map((rule) => rule.identidad_comercial),
      });
    }

    const currentResult = await client.query(
      `SELECT id, numero, dominio, estado_publicacion
       FROM public.motor_comercial_reglas_versiones
       WHERE dominio=$1 AND estado_publicacion='vigente'
       ORDER BY numero DESC
       LIMIT 1
       FOR UPDATE`,
      [dominio]
    );
    const current = currentResult.rows[0] || null;
    if (current && current.id !== target.id) {
      await client.query(
        `UPDATE public.motor_comercial_reglas_versiones
         SET estado_publicacion='reemplazada', reemplazada_en=now()
         WHERE id=$1`,
        [current.id]
      );
      await client.query(
        `UPDATE public.motor_comercial_reglas_compuestas
         SET estado_publicacion='reemplazada'
         WHERE version_id=$1`,
        [current.id]
      );
    }

    const publishedResult = await client.query(
      `UPDATE public.motor_comercial_reglas_versiones
       SET estado_publicacion='vigente', publicada_por=$2, publicada_en=now()
       WHERE id=$1
       RETURNING id, numero, dominio, estado_publicacion, resumen`,
      [target.id, actor]
    );
    await client.query(
      `UPDATE public.motor_comercial_reglas_compuestas
       SET estado_publicacion='vigente'
       WHERE version_id=$1 AND estado_confianza='confirmado' AND autoaplica=false`,
      [target.id]
    );
    await client.query(
      `INSERT INTO public.motor_comercial_reglas_historial
        (version_id, estado_anterior, estado_nuevo, accion_version, actor, motivo, detalle)
       VALUES ($1,$2,'vigente','reemplaza',$3,'publicacion_version_compuesta',$4)`,
      [target.id, target.estado_publicacion, actor, JSON.stringify({ version_anterior_id: current?.id || null })]
    );

    await client.query('COMMIT');
    return {
      version: publishedResult.rows[0],
      version_anterior: current,
      reglas: rulesResult.rows.map((rule) => ({ ...rule, estado_publicacion: 'vigente', autoaplica: false })),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function readCurrentPublishedCompositeRules({ db, dominio = 'fijo_benefits' } = {}) {
  if (!db?.query) throw new Error('db_requerida');
  const versionResult = await db.query(
    `SELECT id, numero, dominio, estado_publicacion, resumen
     FROM public.motor_comercial_reglas_versiones
     WHERE dominio=$1 AND estado_publicacion='vigente'
     ORDER BY numero DESC
     LIMIT 1`,
    [dominio]
  );
  const version = versionResult.rows[0] || null;
  if (!version) return null;

  const rulesResult = await db.query(
    `SELECT id, identidad_comercial, accion_version, estado_confianza, estado_publicacion, autoaplica, contrato
     FROM public.motor_comercial_reglas_compuestas
     WHERE version_id=$1
       AND estado_confianza='confirmado'
       AND estado_publicacion='vigente'
       AND autoaplica=false
       AND accion_version <> 'vence'
     ORDER BY identidad_comercial`,
    [version.id]
  );
  const termResult = await db.query(
    `SELECT regla_compuesta_id, termino_snapshot
     FROM public.motor_comercial_reglas_terminos
     WHERE regla_compuesta_id = ANY($1)`,
    [rulesResult.rows.map((row) => row.id)]
  );
  const termsByRule = new Map();
  for (const term of termResult.rows) {
    if (!termsByRule.has(term.regla_compuesta_id)) termsByRule.set(term.regla_compuesta_id, []);
    termsByRule.get(term.regla_compuesta_id).push(term.termino_snapshot);
  }

  return {
    version,
    reglas: rulesResult.rows.map((rule) => ({
      ...rule,
      terminos: termsByRule.get(rule.id) || [],
    })),
  };
}
