import { randomUUID } from 'node:crypto';
import { eligibilityRequestSchema } from './motorOfertasContract.js';

const REQUIRED_SOURCES = Object.freeze([
  'tabla_financiamiento',
  'lista_precios',
]);

function actorFrom(user) {
  return user?.nick || user?.email || user?.usuario || null;
}

function firstFile(files, field) {
  const file = files?.[field];
  return Array.isArray(file) ? file[0] : null;
}

function hasNonCurrentDocumentValidity(snapshot) {
  return (snapshot?.offers ?? []).some((offer) => {
    if (offer?.vigencia_documental) return offer.vigencia_documental !== 'vigente';
    try {
      const contract = typeof offer?.contrato === 'string'
        ? JSON.parse(offer.contrato)
        : offer?.contrato;
      return contract?.vigencia?.estado !== 'vigente';
    } catch {
      return true;
    }
  });
}

function sourceDocumentValidity(source) {
  return source?.vigencia_documental
    ?? source?.validity?.state
    ?? source?.state
    ?? null;
}

function hasCompleteCurrentSources(versionWithSources) {
  if (!versionWithSources?.version) return false;
  const versionValidity = versionWithSources.version.vigencia_documental
    ?? versionWithSources.version.vigencia?.estado;
  if (versionValidity !== undefined && versionValidity !== 'vigente') return false;

  const sources = Array.isArray(versionWithSources.sources)
    ? versionWithSources.sources
    : [];
  if (!REQUIRED_SOURCES.every((type) =>
    sources.some((source) => source?.tipo === type && sourceDocumentValidity(source) === 'vigente')
  )) {
    return false;
  }
  return sources.every((source) => sourceDocumentValidity(source) === 'vigente');
}

function repositoryValidity(validity) {
  return {
    from: validity?.desde ?? null,
    to: validity?.hasta ?? null,
    state: validity?.estado ?? 'pendiente_confirmacion',
  };
}

function approvalInput(body) {
  if (!body || typeof body !== 'object') return null;
  const versionId = typeof body.version_id === 'string' ? body.version_id.trim() : '';
  if (!versionId || typeof body.activar !== 'boolean') return null;
  const expectedCurrentVersionId = body.version_vigente_esperada_id;
  if (
    expectedCurrentVersionId !== undefined
    && expectedCurrentVersionId !== null
    && (typeof expectedCurrentVersionId !== 'string' || expectedCurrentVersionId.trim() === '')
  ) {
    return null;
  }
  if (body.motivo !== undefined && typeof body.motivo !== 'string') return null;
  return {
    versionId,
    activate: body.activar,
    expectedCurrentVersionId: expectedCurrentVersionId ?? null,
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
    'transicion_invalida',
    'estado_version_invalido',
    'vigencia_pendiente_confirmacion',
  ].includes(code)) return 422;
  return 500;
}

export function createMotorOfertasHandlers({
  repository,
  normalizeOfferWorkbooks,
  archiveOfferSource,
  buildSourcesManifest,
  inferSourceValidity,
  evaluateEligibleOffers,
  uploadRoot,
  normalizadorVersion = '1.0.0',
}) {
  if (!repository || !normalizeOfferWorkbooks || !archiveOfferSource || !buildSourcesManifest || !inferSourceValidity || !evaluateEligibleOffers || !uploadRoot) {
    throw new TypeError('Dependencias incompletas para el motor de ofertas.');
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

    async preview(req, res) {
      const files = Object.fromEntries(REQUIRED_SOURCES.map((field) => [field, firstFile(req.files, field)]));
      const archivos_faltantes = REQUIRED_SOURCES.filter((field) => !files[field]);
      if (archivos_faltantes.length > 0) {
        return res.status(422).json({
          error: 'preview_incompleto',
          archivos_faltantes,
        });
      }

      const requestedVersion = typeof req.body?.normalizador_version === 'string'
        ? req.body.normalizador_version.trim()
        : normalizadorVersion;
      if (!requestedVersion) {
        return res.status(422).json({ error: 'normalizador_version_requerida' });
      }
      const actor = actorFrom(req.user);
      if (!actor) return res.status(401).json({ error: 'No autenticado' });

      let sources;
      let manifest;
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
          return res.json({ ok: true, reutilizada: true, version: existing, resumen: existing.resumen });
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
        });
      } catch {
        return res.status(500).json({ error: 'preview_no_pudo_crearse' });
      }
    },

    async aprobar(req, res) {
      const input = approvalInput(req.body);
      const actor = actorFrom(req.user);
      if (!input || !actor) return res.status(422).json({ error: 'solicitud_invalida' });
      try {
        if (input.activate) {
          const versionWithSources = await repository.getVersionWithSources(input.versionId);
          if (!versionWithSources) {
            return res.status(404).json({ error: 'version_no_encontrada' });
          }
          if (!hasCompleteCurrentSources(versionWithSources)) {
            return res.status(422).json({ error: 'vigencia_documental_no_vigente' });
          }
          const snapshot = await repository.getEligibleSnapshot(input.versionId);
          if (hasNonCurrentDocumentValidity(snapshot)) {
            return res.status(422).json({ error: 'vigencia_documental_no_vigente' });
          }
        }
        const version = await repository.approveVersion({ ...input, actor });
        return res.json({ ok: true, version });
      } catch (error) {
        const code = error?.code || 'aprobacion_no_disponible';
        return res.status(approvalErrorStatus(code)).json({ error: code });
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
