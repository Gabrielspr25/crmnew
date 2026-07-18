import { randomUUID } from 'node:crypto';
import { eligibilityRequestSchema } from './motorOfertasContract.js';
import { buildMotorOfertasImportSummary } from './motorOfertasImportSummary.js';

const REQUIRED_SOURCES = Object.freeze([
  'tabla_financiamiento',
  'lista_precios',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function actorFrom(user) {
  return user?.nick || user?.email || user?.usuario || null;
}

function firstFile(files, field) {
  const file = files?.[field];
  return Array.isArray(file) ? file[0] : null;
}

function validIsoDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const dateOnly = typeof value === 'string' ? value.slice(0, 10) : null;
  if (!dateOnly || !ISO_DATE_PATTERN.test(dateOnly)) return null;
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateOnly
    ? null
    : dateOnly;
}

function currentIsoDate(now) {
  const date = now();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function hasCurrentDocumentRange({ state, from, to }, today) {
  const desde = validIsoDate(from);
  const hasta = validIsoDate(to);
  return state === 'vigente'
    && Boolean(today)
    && Boolean(desde)
    && Boolean(hasta)
    && desde <= hasta
    && desde <= today
    && today <= hasta;
}

function offerDocumentValidity(offer) {
  let contract;
  try {
    contract = typeof offer?.contrato === 'string'
      ? JSON.parse(offer.contrato)
      : offer?.contrato;
  } catch {
    return null;
  }
  return {
    state: offer?.vigencia_documental ?? contract?.vigencia?.estado ?? null,
    from: offer?.vigencia_desde ?? contract?.vigencia?.desde ?? null,
    to: offer?.vigencia_hasta ?? contract?.vigencia?.hasta ?? null,
  };
}

function hasNonCurrentDocumentValidity(snapshot, today) {
  return (snapshot?.offers ?? []).some((offer) => {
    const validity = offerDocumentValidity(offer);
    return !validity || !hasCurrentDocumentRange(validity, today);
  });
}

function sourceDocumentValidity(source) {
  return {
    state: source?.vigencia_documental
      ?? source?.validity?.state
      ?? source?.state
      ?? null,
    from: source?.vigencia_desde
      ?? source?.validity?.from
      ?? source?.from
      ?? null,
    to: source?.vigencia_hasta
      ?? source?.validity?.to
      ?? source?.to
      ?? null,
  };
}

function persistedPreviewValidity(sources, today) {
  const ranges = REQUIRED_SOURCES.map((type) => {
    const source = (sources ?? []).find((item) => item?.tipo === type);
    return sourceDocumentValidity(source);
  });
  const dates = ranges.map(({ from, to }) => ({
    desde: validIsoDate(from),
    hasta: validIsoDate(to),
  }));
  if (!today || dates.some(({ desde, hasta }) => !desde || !hasta)) {
    return { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  }
  const desde = dates.map((range) => range.desde).sort().at(-1);
  const hasta = dates.map((range) => range.hasta).sort()[0];
  if (desde > hasta) return { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  return {
    desde,
    hasta,
    estado: today < desde ? 'futura' : today > hasta ? 'vencida' : 'vigente',
  };
}

function sourceValidityByType(sources) {
  return Object.fromEntries(REQUIRED_SOURCES.map((type) => {
    const source = (sources ?? []).find((item) => (item?.tipo ?? item?.type) === type);
    const validity = sourceDocumentValidity(source);
    return [type, {
      desde: validIsoDate(validity.from),
      hasta: validIsoDate(validity.to),
      estado: validity.state,
    }];
  }));
}

function versionDocumentValidity(version) {
  const hasDocumentValidity = version
    && (
      Object.hasOwn(version, 'vigencia_documental')
      || Object.hasOwn(version, 'vigencia_desde')
      || Object.hasOwn(version, 'vigencia_hasta')
      || Object.hasOwn(version, 'vigencia')
    );
  if (!hasDocumentValidity) return null;
  return {
    state: version.vigencia_documental ?? version.vigencia?.estado ?? null,
    from: version.vigencia_desde ?? version.vigencia?.desde ?? null,
    to: version.vigencia_hasta ?? version.vigencia?.hasta ?? null,
  };
}

function hasCompleteCurrentSources(versionWithSources, today) {
  if (!versionWithSources?.version) return false;
  const versionValidity = versionDocumentValidity(versionWithSources.version);
  if (versionValidity && !hasCurrentDocumentRange(versionValidity, today)) return false;

  const sources = Array.isArray(versionWithSources.sources)
    ? versionWithSources.sources
    : [];
  if (!REQUIRED_SOURCES.every((type) =>
    sources.some((source) =>
      source?.tipo === type
        && hasCurrentDocumentRange(sourceDocumentValidity(source), today)
    )
  )) {
    return false;
  }
  return sources.every((source) =>
    hasCurrentDocumentRange(sourceDocumentValidity(source), today)
  );
}

function repositoryValidity(validity) {
  return {
    from: validity?.desde ?? null,
    to: validity?.hasta ?? null,
    state: validity?.estado ?? 'pendiente_confirmacion',
  };
}

function validityForRange({ desde, hasta }, today) {
  const from = validIsoDate(desde);
  const to = validIsoDate(hasta);
  if (!from || !to || from > to || !today) {
    return { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  }
  return {
    desde: from,
    hasta: to,
    estado: today < from ? 'futura' : today > to ? 'vencida' : 'vigente',
  };
}

function manualValidityFrom(body, today) {
  const rawFrom = typeof body?.vigencia_inicio === 'string' ? body.vigencia_inicio.trim() : '';
  const rawTo = typeof body?.vigencia_fin === 'string' ? body.vigencia_fin.trim() : '';
  if (!rawFrom && !rawTo) return { provided: false, validity: null };
  const validity = validityForRange({ desde: rawFrom, hasta: rawTo }, today);
  return validity.estado === 'pendiente_confirmacion'
    ? { provided: true, error: 'vigencia_manual_invalida' }
    : { provided: true, validity };
}

function validityFromStoredSource(source, today) {
  const validity = sourceDocumentValidity(source);
  if (!validity.from && !validity.to) return null;
  return validityForRange({ desde: validity.from, hasta: validity.to }, today);
}

function previewValidityFromSourceValidity(validityByType, today) {
  const ranges = REQUIRED_SOURCES.map((type) => validityByType?.[type] ?? {});
  if (ranges.some((range) => !range?.desde || !range?.hasta || range.estado === 'pendiente_confirmacion')) {
    return { desde: null, hasta: null, estado: 'pendiente_confirmacion' };
  }
  return validityForRange({
    desde: ranges.map((range) => range.desde).sort().at(-1),
    hasta: ranges.map((range) => range.hasta).sort()[0],
  }, today);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function approvalInput(body) {
  if (!body || typeof body !== 'object') return null;
  const versionId = typeof body.version_id === 'string' ? body.version_id.trim() : '';
  if (!isUuid(versionId) || typeof body.activar !== 'boolean') return null;
  const expectedCurrentVersionId = body.version_vigente_esperada_id;
  if (
    expectedCurrentVersionId !== undefined
    && expectedCurrentVersionId !== null
    && (
      typeof expectedCurrentVersionId !== 'string'
      || !isUuid(expectedCurrentVersionId.trim())
    )
  ) {
    return null;
  }
  if (body.motivo !== undefined && typeof body.motivo !== 'string') return null;
  return {
    versionId,
    activate: body.activar,
    expectedCurrentVersionId: expectedCurrentVersionId?.trim() ?? null,
    reason: body.motivo?.trim() || null,
  };
}

function approvalErrorStatus(code) {
  if (code === 'version_no_encontrada') return 404;
  if ([
    'version_vigente_cambio',
    'version_cambio_concurrente',
    'contradicciones_bloqueantes',
  ].includes(code)) return 409;
  if ([
    '22P02',
    'transicion_invalida',
    'estado_version_invalido',
    'vigencia_pendiente_confirmacion',
  ].includes(code)) return 422;
  return 500;
}

const BUSINESS_RED_FAMILIES = new Set([
  'business_red_plus',
  'business_red_extreme',
  'business_red_supreme',
  'business_red_sin_fronteras',
]);

function reviewVersionId(value) {
  return typeof value === 'string' && isUuid(value.trim()) ? value.trim() : null;
}

function reviewIds(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids = [...new Set(value.map((item) => typeof item === 'string' ? item.trim() : ''))];
  return ids.length === value.length && ids.every(isUuid) ? ids : null;
}

export function createMotorOfertasHandlers({
  repository,
  normalizeOfferWorkbooks,
  archiveOfferSource,
  buildSourcesManifest,
  inferSourceValidity,
  evaluateEligibleOffers,
  readArchivedOfferSources,
  readArchivedOfferSource,
  buildOfferReviewSnapshot,
  uploadRoot,
  normalizadorVersion = '1.0.3',
  now = () => new Date(),
}) {
  if (!repository || !normalizeOfferWorkbooks || !archiveOfferSource || !buildSourcesManifest || !inferSourceValidity || !evaluateEligibleOffers || !readArchivedOfferSources || !readArchivedOfferSource || !buildOfferReviewSnapshot || !uploadRoot) {
    throw new TypeError('Dependencias incompletas para el motor de ofertas.');
  }

  async function loadReview(versionId) {
    const persisted = await repository.getVersionWithSources(versionId, {
      includeContradictions: true,
    });
    if (!persisted?.version) return null;
    const archived = await readArchivedOfferSources(persisted.sources);
    return buildOfferReviewSnapshot({
      financingBuffer: archived.financingBuffer,
      priceListBuffer: archived.priceListBuffer,
      version: persisted.version,
      contradictions: persisted.contradicciones ?? [],
      vigencia: persistedPreviewValidity(persisted.sources, currentIsoDate(now)),
    });
  }

  async function persistPreview({ req, res, files, sources, validityOverrides = {} }) {
    const requestedVersion = typeof req.body?.normalizador_version === 'string'
      ? req.body.normalizador_version.trim()
      : normalizadorVersion;
    if (!requestedVersion) {
      return res.status(422).json({ error: 'normalizador_version_requerida' });
    }
    const actor = actorFrom(req.user);
    if (!actor) return res.status(401).json({ error: 'No autenticado' });

    let manifest;
    try {
      manifest = buildSourcesManifest(sources);
    } catch {
      return res.status(422).json({ error: 'fuente_invalida' });
    }

    try {
      const existing = await repository.findVersionByIdentity({
        dominio: 'movil_equipos',
        manifestSha256: manifest.sha256,
        normalizadorVersion: requestedVersion,
      });
      if (existing) {
        const persisted = await repository.getVersionWithSources(existing.id, {
          includeContradictions: true,
        });
        if (!persisted?.version) throw new Error('version_reutilizada_no_disponible');
        return res.json({
          ok: true,
          reutilizada: true,
          version: persisted.version,
          resumen: persisted.version.resumen ?? existing.resumen ?? {},
          vigencia: persistedPreviewValidity(persisted.sources, currentIsoDate(now)),
          fuentes: sourceValidityByType(persisted.sources),
          contradicciones: persisted.contradicciones ?? [],
        });
      }
    } catch {
      return res.status(500).json({ error: 'preview_no_pudo_crearse' });
    }

    let validity;
    let normalized;
    try {
      validity = inferSourceValidity({
        financingBuffer: files.tabla_financiamiento.buffer,
        priceListBuffer: files.lista_precios.buffer,
      });
      for (const type of REQUIRED_SOURCES) {
        if (validityOverrides[type]) validity[type] = validityOverrides[type];
      }
      validity.preview = previewValidityFromSourceValidity(validity, currentIsoDate(now));
      for (const source of sources) {
        source.validity = repositoryValidity(validity[source.type]);
      }
      normalized = normalizeOfferWorkbooks({
        financingBuffer: files.tabla_financiamiento.buffer,
        priceListBuffer: files.lista_precios.buffer,
        sourceIds: Object.fromEntries(sources.map((source) => [source.type, source.id])),
        fileNames: Object.fromEntries(sources.map((source) => [source.type, source.originalName])),
        vigencia: validity.preview,
      });
    } catch {
      return res.status(422).json({ error: 'parser_error' });
    }

    try {
      const currentVersion = await repository.getCurrentVersion('movil_equipos');
      const currentSnapshot = currentVersion
        ? await repository.getEligibleSnapshot(currentVersion.id)
        : null;
      const importSummary = buildMotorOfertasImportSummary({
        normalized,
        currentSnapshot,
      });
      normalized = {
        ...normalized,
        summary: {
          ...normalized.summary,
          ...importSummary,
        },
      };
    } catch {
      return res.status(500).json({ error: 'comparacion_no_disponible' });
    }

    try {
      const created = await repository.createPreview({
        dominio: 'movil_equipos',
        manifestSha256: manifest.sha256,
        normalizadorVersion: requestedVersion,
        actor,
        sources,
        normalized,
      });
      return res.json({
        ok: true,
        reutilizada: created.reutilizada,
        version: created.version,
        resumen: created.resumen ?? normalized.summary,
        contradicciones: normalized.contradictions ?? [],
        vigencia: validity.preview,
        fuentes: sourceValidityByType(sources),
      });
    } catch {
      return res.status(500).json({ error: 'preview_no_pudo_crearse' });
    }
  }

  return Object.freeze({
    async versionVigente(_req, res) {
      try {
        const current = await repository.getCurrentVersionWithSources('movil_equipos');
        if (!current) return res.status(404).json({ error: 'version_vigente_no_encontrada' });
        return res.json({ ok: true, version: current.version, fuentes: current.sources });
      } catch {
        return res.status(500).json({ error: 'version_vigente_no_disponible' });
      }
    },

    async revisionActual(_req, res) {
      try {
        const version = await repository.getLatestReviewVersion('movil_equipos');
        if (!version) return res.status(404).json({ error: 'revision_pendiente_no_encontrada' });
        const review = await loadReview(version.id);
        if (!review) return res.status(404).json({ error: 'version_no_encontrada' });
        return res.json(review);
      } catch {
        return res.status(500).json({ error: 'revision_no_disponible' });
      }
    },

    async guardarEquivalenciaPropuesta(req, res) {
      const versionId = reviewVersionId(req.params?.versionId);
      const contradictionIds = reviewIds(req.body?.contradiccion_ids);
      const candidateId = typeof req.body?.candidate_id === 'string'
        ? req.body.candidate_id.trim()
        : '';
      const actor = actorFrom(req.user);
      if (!versionId || !contradictionIds || !candidateId || !actor) {
        return res.status(422).json({ error: 'solicitud_invalida' });
      }
      try {
        const review = await loadReview(versionId);
        if (!review) return res.status(404).json({ error: 'version_no_encontrada' });
        const selected = review.equipos.filter((item) => contradictionIds.includes(item.id));
        if (selected.length !== contradictionIds.length || selected.some((item) =>
          !item.candidatos.some((candidate) => candidate.id === candidateId)
        )) {
          return res.status(422).json({ error: 'equivalencia_no_disponible' });
        }
        const candidate = selected[0].candidatos.find((item) => item.id === candidateId);
        const saved = await repository.saveReviewDecision({
          versionId,
          contradiccionIds: contradictionIds,
          actor,
          decision: {
            tipo: 'equivalencia_propuesta',
            candidate_id: candidate.id,
            sku_sif: candidate.sku_sif,
            modelo: candidate.modelo,
            aplicada: false,
            propuesta_por: actor,
            propuesta_en: currentIsoDate(now),
          },
        });
        return res.json({ ok: true, aplicada: false, casos_afectados: saved.actualizadas });
      } catch {
        return res.status(500).json({ error: 'revision_no_disponible' });
      }
    },

    async guardarBusinessRedPropuesta(req, res) {
      const versionId = reviewVersionId(req.params?.versionId);
      const contradictionIds = reviewIds(req.body?.contradiccion_ids);
      const families = Array.isArray(req.body?.familias) ? [...new Set(req.body.familias)] : null;
      const actor = actorFrom(req.user);
      if (!versionId || !contradictionIds || !families || !families.every((family) => BUSINESS_RED_FAMILIES.has(family)) || !actor) {
        return res.status(422).json({ error: 'solicitud_invalida' });
      }
      try {
        const review = await loadReview(versionId);
        if (!review) return res.status(404).json({ error: 'version_no_encontrada' });
        const selected = review.business_red.filter((item) => contradictionIds.includes(item.id));
        if (selected.length !== contradictionIds.length) {
          return res.status(422).json({ error: 'bloqueo_revision_no_encontrado' });
        }
        const saved = await repository.saveReviewDecision({
          versionId,
          contradiccionIds: contradictionIds,
          actor,
          decision: {
            tipo: 'alcance_business_red_propuesto',
            familias,
            aplicada: false,
            propuesta_por: actor,
            propuesta_en: currentIsoDate(now),
          },
        });
        return res.json({ ok: true, aplicada: false, casos_afectados: saved.actualizadas });
      } catch {
        return res.status(500).json({ error: 'revision_no_disponible' });
      }
    },

    async preview(req, res) {
      const files = Object.fromEntries(REQUIRED_SOURCES.map((field) => [field, firstFile(req.files, field)]));
      const archivos_faltantes = REQUIRED_SOURCES.filter((field) => !files[field]);
      if (archivos_faltantes.length > 0) {
        return res.status(422).json({
          error: 'preview_incompleto',
          archivos_faltantes,
        });
      }

      let sources;
      try {
        sources = await Promise.all(REQUIRED_SOURCES.map(async (type) => {
          const file = files[type];
          const archived = await archiveOfferSource({
            rootDir: uploadRoot,
            type,
            originalName: file.originalname,
            mimeType: file.mimetype,
            buffer: file.buffer,
          });
          return { ...archived, id: randomUUID(), bytes: file.size };
        }));
      } catch {
        return res.status(422).json({ error: 'fuente_invalida' });
      }
      return persistPreview({ req, res, files, sources });
    },

    async previewTabla(req, res) {
      if (!req.file) return res.status(422).json({ error: 'tabla_financiamiento_requerida' });
      const today = currentIsoDate(now);
      const manualValidity = manualValidityFrom(req.body, today);
      if (manualValidity.error) return res.status(422).json({ error: manualValidity.error });
      let priceSource;
      let priceListBuffer;
      try {
        priceSource = await repository.getLatestPriceListSource();
        if (!priceSource) return res.status(422).json({ error: 'lista_precios_no_aceptada' });
        priceListBuffer = await readArchivedOfferSource({ rootDir: uploadRoot, source: priceSource });
      } catch {
        return res.status(422).json({ error: 'lista_precios_no_aceptada' });
      }

      let financingSource;
      try {
        const archived = await archiveOfferSource({
          rootDir: uploadRoot,
          type: 'tabla_financiamiento',
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
        });
        financingSource = { ...archived, id: randomUUID(), bytes: req.file.size };
      } catch {
        return res.status(422).json({ error: 'fuente_invalida' });
      }

      const acceptedPrice = {
        id: randomUUID(),
        type: 'lista_precios',
        originalName: priceSource.nombre_original,
        archivedName: priceSource.nombre_archivado,
        relativePath: priceSource.ruta_relativa,
        sha256: priceSource.sha256,
        mimeType: priceSource.mime_type,
        bytes: priceSource.bytes,
      };
      return persistPreview({
        req,
        res,
        files: {
          tabla_financiamiento: req.file,
          lista_precios: {
            originalname: acceptedPrice.originalName,
            mimetype: acceptedPrice.mimeType,
            buffer: priceListBuffer,
            size: acceptedPrice.bytes,
          },
        },
        sources: [financingSource, acceptedPrice],
        validityOverrides: {
          tabla_financiamiento: manualValidity.validity,
          lista_precios: validityFromStoredSource(priceSource, today),
        },
      });
    },

    async aprobar(req, res) {
      const input = approvalInput(req.body);
      const actor = actorFrom(req.user);
      if (!input || !actor) return res.status(422).json({ error: 'solicitud_invalida' });
      try {
        if (input.activate) {
          const today = currentIsoDate(now);
          const versionWithSources = await repository.getVersionWithSources(input.versionId);
          if (!versionWithSources) {
            return res.status(404).json({ error: 'version_no_encontrada' });
          }
          if (!hasCompleteCurrentSources(versionWithSources, today)) {
            return res.status(422).json({ error: 'vigencia_documental_no_vigente' });
          }
          const snapshot = await repository.getEligibleSnapshot(input.versionId);
          if (hasNonCurrentDocumentValidity(snapshot, today)) {
            return res.status(422).json({ error: 'vigencia_documental_no_vigente' });
          }
        }
        const version = await repository.approveVersion({ ...input, actor });
        return res.json({ ok: true, version });
      } catch (error) {
        const code = error?.code || 'aprobacion_no_disponible';
        return res.status(approvalErrorStatus(code)).json({
          error: code === '22P02' ? 'solicitud_invalida' : code,
        });
      }
    },

    async elegibles(req, res) {
      const parsed = eligibilityRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ error: 'solicitud_invalida' });
      try {
        const version = await repository.getCurrentVersion('movil_equipos');
        if (!version) {
          return res.json({
            ok: true,
            equipos: [],
            validaciones: [{ codigo: 'version_vigente_no_disponible', estado: 'info' }],
          });
        }
        const snapshot = await repository.getEligibleSnapshot(version.id);
        const result = evaluateEligibleOffers({ request: parsed.data, snapshot });
        return res.json({ ok: true, ...result });
      } catch {
        return res.status(500).json({ error: 'elegibilidad_no_disponible' });
      }
    },
  });
}
