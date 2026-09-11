function cleanText(value) {
  return String(value || '').trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeDate(value) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function sourceDate(row, key) {
  const value = row?.[key];
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return normalizeDate(value);
}

function sortNewestFirst(a, b) {
  return String(b?.creado_en || '').localeCompare(String(a?.creado_en || ''));
}

function revisionNumber(row) {
  const direct = Number(row?.revision_numero);
  if (Number.isInteger(direct) && direct > 0) return direct;
  return 1;
}

function isFailedOrIncompleteSource(row) {
  const estado = normalizeText(row?.estado);
  const documental = normalizeText(row?.vigencia_documental);
  const notas = normalizeText(row?.notas);
  return ['fallida', 'incompleta', 'pendiente_validacion'].includes(estado)
    || (documental === 'pendiente_confirmacion' && notas.length > 0);
}

export function fuenteIdentityKey({ familia, nombre_original, vigencia_desde = null, vigencia_hasta = null }) {
  return [
    normalizeText(familia),
    normalizeText(nombre_original),
    normalizeDate(vigencia_desde) || 'sin_desde',
    normalizeDate(vigencia_hasta) || 'sin_hasta',
  ].join('|');
}

export function classifyFuenteComercialUpload({ existingSources = [], familia, nombre_original, sha256, vigencia_desde = null, vigencia_hasta = null }) {
  const normalizedHash = cleanText(sha256).toLowerCase();
  const normalizedFamily = cleanText(familia);
  const normalizedName = cleanText(nombre_original);
  const proposedDesde = normalizeDate(vigencia_desde);
  const proposedHasta = normalizeDate(vigencia_hasta);

  const sameHash = existingSources.find((row) => cleanText(row?.sha256).toLowerCase() === normalizedHash);
  if (sameHash) {
    if (isFailedOrIncompleteSource(sameHash)) {
      return {
        action: 'reuse_failed',
        codigo: 'reintento_fuente_fallida',
        tipo: 'archivo_identico_reprocesable',
        message: 'El archivo existe por hash, pero el procesamiento anterior quedo incompleto; se reutiliza la fuente archivada para reprocesar.',
        previous: sameHash,
        revision_numero: revisionNumber(sameHash),
        identidad_comercial_key: fuenteIdentityKey({ familia: normalizedFamily, nombre_original: normalizedName, vigencia_desde: proposedDesde, vigencia_hasta: proposedHasta }),
      };
    }
    return {
      action: 'block',
      codigo: 'fuente_duplicada',
      tipo: 'archivo_identico_hash',
      message: 'El archivo ya existe por hash; no se crea otra fuente.',
      duplicate: sameHash,
      revision_numero: revisionNumber(sameHash),
    };
  }

  const sameFamilyAndName = existingSources
    .filter((row) => cleanText(row?.familia) === normalizedFamily)
    .filter((row) => normalizeText(row?.nombre_original) === normalizeText(normalizedName));

  const sameIdentity = sameFamilyAndName
    .filter((row) => sourceDate(row, 'vigencia_desde') === proposedDesde && sourceDate(row, 'vigencia_hasta') === proposedHasta)
    .sort(sortNewestFirst);

  if (sameIdentity.length) {
    const previous = sameIdentity[0];
    const maxRevision = Math.max(...sameIdentity.map(revisionNumber));
    return {
      action: 'allow',
      codigo: 'nueva_revision_fuente',
      tipo: 'nueva_revision_misma_fuente',
      message: 'Mismo nombre, módulo y vigencia con hash distinto; se guarda como revisión nueva.',
      previous,
      revision_numero: maxRevision + 1,
      identidad_comercial_key: fuenteIdentityKey({ familia: normalizedFamily, nombre_original: normalizedName, vigencia_desde: proposedDesde, vigencia_hasta: proposedHasta }),
    };
  }

  const sameNameDifferentVigencia = sameFamilyAndName.sort(sortNewestFirst)[0] || null;
  if (sameNameDifferentVigencia) {
    return {
      action: 'allow',
      codigo: 'nueva_vigencia_fuente',
      tipo: 'nueva_vigencia_misma_fuente',
      message: 'Mismo nombre y módulo con vigencia distinta; se guarda como nueva versión de vigencia.',
      previous: sameNameDifferentVigencia,
      revision_numero: 1,
      identidad_comercial_key: fuenteIdentityKey({ familia: normalizedFamily, nombre_original: normalizedName, vigencia_desde: proposedDesde, vigencia_hasta: proposedHasta }),
    };
  }

  return {
    action: 'allow',
    codigo: 'nueva_fuente',
    tipo: 'nueva_fuente',
    message: 'Fuente nueva permitida.',
    previous: null,
    revision_numero: 1,
    identidad_comercial_key: fuenteIdentityKey({ familia: normalizedFamily, nombre_original: normalizedName, vigencia_desde: proposedDesde, vigencia_hasta: proposedHasta }),
  };
}

export function selectLatestPublishedFuenteRevision(sources = [], { familia, nombre_original, vigencia_desde = null, vigencia_hasta = null, asOf = null } = {}) {
  const key = fuenteIdentityKey({ familia, nombre_original, vigencia_desde, vigencia_hasta });
  const date = normalizeDate(asOf);
  return sources
    .filter((row) => row?.estado_publicacion === 'publicada' || row?.estado_publicacion === 'vigente')
    .filter((row) => (row?.identidad_comercial_key || fuenteIdentityKey(row)) === key)
    .filter((row) => {
      const desde = sourceDate(row, 'vigencia_desde');
      const hasta = sourceDate(row, 'vigencia_hasta');
      if (!date) return true;
      return (!desde || desde <= date) && (!hasta || hasta >= date);
    })
    .sort((a, b) => revisionNumber(b) - revisionNumber(a) || sortNewestFirst(a, b))[0] || null;
}
