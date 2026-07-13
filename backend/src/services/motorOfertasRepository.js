import { randomUUID as nodeRandomUUID } from 'node:crypto';
import { parseOfferContract } from './motorOfertasContract.js';
import {
  activationTransitions,
  assertTransition,
} from './motorOfertasLifecycle.js';

function repositoryError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function asJson(value) {
  return JSON.stringify(value ?? {});
}

function asTimestamp(value) {
  return value instanceof Date ? value : new Date(value);
}

function previewSummary(normalized) {
  const contradictions = normalized.contradictions ?? [];
  return {
    ofertas: normalized.summary?.offers ?? normalized.offers?.length ?? 0,
    equipos: normalized.summary?.equipment
      ?? normalized.offers?.reduce(
        (total, offer) => total + (offer.equipment?.length ?? 0),
        0
      )
      ?? 0,
    contradicciones_abiertas: contradictions.length,
    contradicciones_bloqueantes: contradictions.filter(
      (item) => item.blocking
    ).length,
  };
}

function sourceParams(source, versionId, sourceId) {
  return [
    sourceId,
    versionId,
    source.type,
    source.originalName,
    source.archivedName,
    source.relativePath,
    source.sha256,
    source.mimeType,
    source.bytes,
    source.validity?.from ?? null,
    source.validity?.to ?? null,
    source.validity?.state ?? 'pendiente_confirmacion',
    source.sheet ?? null,
    source.page ?? null,
    source.rowFrom ?? null,
    source.rowTo ?? null,
    asJson(source.metadata),
    source.extractedText ?? null,
  ];
}

async function insertSource(client, { source, versionId, sourceId }) {
  await client.query(
    `INSERT INTO public.motor_ofertas_fuentes (
      id,
      version_id,
      tipo,
      nombre_original,
      nombre_archivado,
      ruta_relativa,
      sha256,
      mime_type,
      bytes,
      vigencia_desde,
      vigencia_hasta,
      vigencia_documental,
      hoja,
      pagina,
      fila_desde,
      fila_hasta,
      metadatos,
      texto_extraido
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18
    )`,
    sourceParams(source, versionId, sourceId)
  );
}

async function insertOffer(client, {
  normalizedOffer,
  versionId,
  offerId,
}) {
  const contract = parseOfferContract(normalizedOffer.contract);
  const trace = normalizedOffer.trace ?? {};
  const derived = normalizedOffer.derived ?? {};

  await client.query(
    `INSERT INTO public.motor_ofertas (
      id,
      version_id,
      oferta_key,
      nombre,
      estado_comercial,
      vigencia_documental,
      vigencia_desde,
      vigencia_hasta,
      tipos_plan,
      familias,
      eventos,
      plazos,
      plan_monto_minimo,
      plan_monto_maximo,
      fuente_principal_id,
      fuente_hoja,
      fuente_fila,
      contrato,
      trazabilidad
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb
    )`,
    [
      offerId,
      versionId,
      contract.id,
      contract.nombre,
      contract.estado,
      contract.vigencia.estado,
      contract.vigencia.desde,
      contract.vigencia.hasta,
      contract.tipos_plan,
      contract.familias,
      contract.eventos,
      contract.plazos,
      derived.planMontoMinimo ?? null,
      derived.planMontoMaximo ?? null,
      trace.sourceId ?? null,
      trace.sheet ?? contract.fuente.hoja ?? null,
      trace.row ?? contract.fuente.fila ?? null,
      asJson(contract),
      asJson(trace),
    ]
  );

  return contract;
}

async function insertEquipment(client, {
  equipment,
  contract,
  offerId,
  equipmentId,
  ruleSourceId,
  term,
}) {
  const installment = (equipment.mensualidades ?? []).find(
    (item) => item.meses === term
  );

  await client.query(
    `INSERT INTO public.motor_ofertas_equipos (
      id,
      oferta_id,
      equipo_lista_id,
      equipo_key,
      modelo_comercial,
      modelo_oficial,
      sku_sif,
      sap,
      precio_regular,
      plazo,
      pago_mensual,
      descuento,
      credito,
      beneficio_tipo,
      fuente_precio_id,
      fuente_regla_id,
      coincidencia,
      snapshot
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb
    )`,
    [
      equipmentId,
      offerId,
      equipment.equipo_lista_id ?? null,
      equipment.equipo_key,
      equipment.modelo_comercial,
      equipment.modelo_oficial ?? null,
      equipment.sku_sif ?? null,
      equipment.sap ?? null,
      equipment.precio_regular ?? null,
      term,
      installment?.monto ?? equipment.pago_mensual ?? null,
      equipment.descuento ?? null,
      equipment.credito ?? null,
      equipment.beneficio_tipo ?? null,
      equipment.fuente_precio_id ?? null,
      ruleSourceId ?? null,
      equipment.coincidencia,
      asJson({
        ...equipment,
        oferta_key: contract.id,
        plazo: term,
      }),
    ]
  );
}

async function insertContradiction(client, {
  contradiction,
  contradictionId,
  versionId,
  offerId,
  actor,
}) {
  await client.query(
    `INSERT INTO public.motor_ofertas_contradicciones (
      id,
      version_id,
      oferta_id,
      codigo,
      severidad,
      bloqueante,
      estado,
      detalle,
      fuentes_enfrentadas,
      creada_por
    ) VALUES (
      $1, $2, $3, $4, $5, $6, 'abierta', $7, $8::jsonb, $9
    )`,
    [
      contradictionId,
      versionId,
      offerId ?? null,
      contradiction.code,
      contradiction.severity,
      Boolean(contradiction.blocking),
      contradiction.detail,
      asJson(
        contradiction.sources?.length
          ? contradiction.sources
          : contradiction.source
            ? [contradiction.source]
            : []
      ),
      actor,
    ]
  );
}

async function insertHistory(client, {
  versionId,
  from,
  to,
  actor,
  reason,
  timestamp,
}) {
  await client.query(
    `INSERT INTO public.motor_ofertas_historial (
      version_id,
      estado_anterior,
      estado_nuevo,
      actor,
      motivo,
      creado_en
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [versionId, from, to, actor, reason ?? null, timestamp]
  );
}

async function transitionVersion(client, {
  versionId,
  from,
  to,
  actor,
  reason,
  timestamp,
  replacesVersionId = null,
}) {
  assertTransition(from, to);

  const result = await client.query(
    `UPDATE public.motor_ofertas_versiones
     SET estado = $2,
         actualizada_en = $3,
         aprobada_por = CASE WHEN $2 = 'aprobada' THEN $4 ELSE aprobada_por END,
         aprobada_en = CASE WHEN $2 = 'aprobada' THEN $3 ELSE aprobada_en END,
         activada_por = CASE WHEN $2 = 'vigente' THEN $4 ELSE activada_por END,
         activada_en = CASE WHEN $2 = 'vigente' THEN $3 ELSE activada_en END,
         reemplazada_en = CASE WHEN $2 = 'reemplazada' THEN $3 ELSE reemplazada_en END,
         archivada_por = CASE WHEN $2 = 'archivada' THEN $4 ELSE archivada_por END,
         archivada_en = CASE WHEN $2 = 'archivada' THEN $3 ELSE archivada_en END,
         reemplaza_version_id = CASE
           WHEN $2 = 'vigente' THEN $6
           ELSE reemplaza_version_id
         END
     WHERE id = $1 AND estado = $5
     RETURNING *`,
    [versionId, to, timestamp, actor, from, replacesVersionId]
  );

  if (result.rowCount !== 1) {
    throw repositoryError(
      'version_cambio_concurrente',
      `La version ${versionId} cambio durante la transaccion.`,
      { versionId, from, to }
    );
  }

  await insertHistory(client, {
    versionId,
    from,
    to,
    actor,
    reason,
    timestamp,
  });

  return result.rows[0] ?? { id: versionId, estado: to };
}

async function rollbackQuietly(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original transaction error.
  }
}

export function createMotorOfertasRepository({
  pool,
  randomUUID = nodeRandomUUID,
  now = () => new Date(),
}) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    throw new TypeError('El repositorio requiere un pool PostgreSQL');
  }

  async function findVersionByIdentity({
    dominio,
    manifestSha256,
    normalizadorVersion,
  }, executor = pool) {
    const result = await executor.query(
      `SELECT *
       FROM public.motor_ofertas_versiones
       WHERE dominio = $1
         AND fuentes_manifest_sha256 = $2
         AND normalizador_version = $3`,
      [dominio, manifestSha256, normalizadorVersion]
    );
    return result.rows[0] ?? null;
  }

  async function getCurrentVersion(dominio = 'movil_equipos') {
    const result = await pool.query(
      `SELECT *
       FROM public.motor_ofertas_versiones
       WHERE dominio = $1 AND estado = 'vigente'`,
      [dominio]
    );
    return result.rows[0] ?? null;
  }

  async function getCurrentVersionWithSources(dominio = 'movil_equipos') {
    const version = await getCurrentVersion(dominio);
    if (!version) return null;
    const sources = await pool.query(
      `SELECT *
       FROM public.motor_ofertas_fuentes
       WHERE version_id = $1
       ORDER BY tipo, nombre_original`,
      [version.id]
    );
    return { version, sources: sources.rows };
  }

  async function getEligibleSnapshot(versionId) {
    const offers = await pool.query(
      `SELECT *
       FROM public.motor_ofertas
       WHERE version_id = $1
       ORDER BY oferta_key`,
      [versionId]
    );
    const equipment = await pool.query(
      `SELECT e.*
       FROM public.motor_ofertas_equipos e
       INNER JOIN public.motor_ofertas o ON o.id = e.oferta_id
       WHERE o.version_id = $1
       ORDER BY o.oferta_key, e.equipo_key, e.plazo`,
      [versionId]
    );
    return { offers: offers.rows, equipment: equipment.rows };
  }

  async function createPreview({
    dominio = 'movil_equipos',
    manifestSha256,
    normalizadorVersion,
    actor,
    sources,
    normalized,
  }) {
    const client = await pool.connect();
    const timestamp = asTimestamp(now());
    const versionId = randomUUID();
    const summary = previewSummary(normalized);

    try {
      await client.query('BEGIN');
      const created = await client.query(
        `INSERT INTO public.motor_ofertas_versiones (
          id,
          dominio,
          estado,
          normalizador_version,
          fuentes_manifest_sha256,
          resumen,
          creada_por,
          creada_en,
          actualizada_en
        ) VALUES ($1, $2, 'borrador', $3, $4, $5::jsonb, $6, $7, $7)
        ON CONFLICT (
          dominio,
          fuentes_manifest_sha256,
          normalizador_version
        ) DO NOTHING
        RETURNING *`,
        [
          versionId,
          dominio,
          normalizadorVersion,
          manifestSha256,
          asJson(summary),
          actor,
          timestamp,
        ]
      );

      if (created.rowCount === 0) {
        const existing = await findVersionByIdentity({
          dominio,
          manifestSha256,
          normalizadorVersion,
        }, client);
        if (!existing) {
          throw repositoryError(
            'version_idempotente_no_disponible',
            'La identidad existe, pero la version no pudo recuperarse.'
          );
        }
        await client.query('COMMIT');
        return { reutilizada: true, version: existing, resumen: existing.resumen };
      }

      await insertHistory(client, {
        versionId,
        from: null,
        to: 'borrador',
        actor,
        reason: 'Preview normalizado creado',
        timestamp,
      });

      for (const source of sources ?? []) {
        await insertSource(client, {
          source,
          versionId,
          sourceId: source.id ?? randomUUID(),
        });
      }

      const offerIds = new Map();
      for (const normalizedOffer of normalized.offers ?? []) {
        const offerId = randomUUID();
        const contract = await insertOffer(client, {
          normalizedOffer,
          versionId,
          offerId,
        });
        offerIds.set(contract.id, offerId);

        for (const equipment of normalizedOffer.equipment ?? contract.equipos) {
          const confirmedTerms = new Set(
            (equipment.mensualidades ?? []).map((item) => item.meses)
          );
          for (const term of contract.plazos.filter((item) => confirmedTerms.has(item))) {
            await insertEquipment(client, {
              equipment,
              contract,
              offerId,
              equipmentId: randomUUID(),
              ruleSourceId: normalizedOffer.trace?.sourceId,
              term,
            });
          }
        }
      }

      for (const contradiction of normalized.contradictions ?? []) {
        await insertContradiction(client, {
          contradiction,
          contradictionId: randomUUID(),
          versionId,
          offerId: offerIds.get(contradiction.offerKey),
          actor,
        });
      }

      assertTransition('borrador', 'pendiente_revision');
      const finalized = await client.query(
        `UPDATE public.motor_ofertas_versiones
         SET estado = $1,
             resumen = $2::jsonb,
             actualizada_en = $3
         WHERE estado = $4 AND id = $5
         RETURNING *`,
        [
          'pendiente_revision',
          asJson(summary),
          timestamp,
          'borrador',
          versionId,
        ]
      );
      if (finalized.rowCount !== 1) {
        throw repositoryError(
          'version_cambio_concurrente',
          'La version no pudo pasar a pendiente_revision.'
        );
      }

      await insertHistory(client, {
        versionId,
        from: 'borrador',
        to: 'pendiente_revision',
        actor,
        reason: 'Fuentes y ofertas persistidas',
        timestamp,
      });
      await client.query('COMMIT');

      return {
        reutilizada: false,
        version: finalized.rows[0] ?? {
          ...created.rows[0],
          estado: 'pendiente_revision',
          resumen: summary,
        },
        resumen: summary,
      };
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async function approveVersion({
    versionId,
    activate = false,
    expectedCurrentVersionId = null,
    actor,
    reason = null,
  }) {
    const client = await pool.connect();
    const timestamp = asTimestamp(now());

    try {
      await client.query('BEGIN');
      const targetResult = await client.query(
        `SELECT *
         FROM public.motor_ofertas_versiones
         WHERE id = $1
         FOR UPDATE`,
        [versionId]
      );
      const target = targetResult.rows[0];
      if (!target) {
        throw repositoryError(
          'version_no_encontrada',
          `No existe la version ${versionId}.`
        );
      }

      const contradictionResult = await client.query(
        `SELECT COUNT(*)::integer AS bloqueantes
         FROM public.motor_ofertas_contradicciones
         WHERE version_id = $1
           AND bloqueante = TRUE
           AND estado = 'abierta'`,
        [versionId]
      );
      const blocking = Number(contradictionResult.rows[0]?.bloqueantes ?? 0);
      if (blocking > 0) {
        throw repositoryError(
          'contradicciones_bloqueantes',
          'La version tiene contradicciones bloqueantes abiertas.',
          { versionId, blocking }
        );
      }

      if (!activate) {
        const approved = await transitionVersion(client, {
          versionId,
          from: target.estado,
          to: 'aprobada',
          actor,
          reason,
          timestamp,
        });
        await client.query('COMMIT');
        return approved;
      }

      const steps = activationTransitions(target.estado);
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [target.dominio]
      );
      const currentResult = await client.query(
        `SELECT *
         FROM public.motor_ofertas_versiones
         WHERE dominio = $1 AND estado = 'vigente'
         FOR UPDATE`,
        [target.dominio]
      );
      const current = currentResult.rows[0] ?? null;
      const currentId = current?.id ?? null;
      if (currentId !== expectedCurrentVersionId) {
        throw repositoryError(
          'version_vigente_cambio',
          'La version vigente no coincide con la esperada.',
          {
            expectedCurrentVersionId,
            currentVersionId: currentId,
          }
        );
      }

      let finalVersion = target;
      if (steps[0][0] === 'pendiente_revision') {
        finalVersion = await transitionVersion(client, {
          versionId,
          from: 'pendiente_revision',
          to: 'aprobada',
          actor,
          reason,
          timestamp,
        });
      }

      if (current) {
        await transitionVersion(client, {
          versionId: current.id,
          from: 'vigente',
          to: 'reemplazada',
          actor,
          reason: `Reemplazada por ${versionId}`,
          timestamp,
        });
      }

      finalVersion = await transitionVersion(client, {
        versionId,
        from: 'aprobada',
        to: 'vigente',
        actor,
        reason,
        timestamp,
        replacesVersionId: currentId,
      });
      await client.query('COMMIT');
      return { ...finalVersion, id: versionId, estado: 'vigente' };
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  return Object.freeze({
    findVersionByIdentity,
    getCurrentVersion,
    getCurrentVersionWithSources,
    getEligibleSnapshot,
    createPreview,
    approveVersion,
  });
}
