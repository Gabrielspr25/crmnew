function text(value) {
  return value == null ? '' : String(value).trim();
}

function typeToLineKind(productType) {
  switch (text(productType).toUpperCase()) {
    case 'G': return 'movil';
    case 'O':
    case 'T':
    case 'V': return 'fijo';
    case 'K': return 'cloud';
    default: return '';
  }
}

export function normalizeOperationalStatus(status) {
  const value = text(status).toLowerCase();
  if (['a', 'activo', 'active', 's', 'suspendido', 'suspended'].includes(value)) return 'activo';
  if (['c', 'cancelado', 'cancelled', 'inactivo', 'inactive'].includes(value)) return 'cancelado';
  return text(status);
}

export function normalizeImportedSubscriber(row = {}) {
  const normalized = { ...row };
  const derivedKind = typeToLineKind(normalized.product_type);

  if (text(normalized.status)) normalized.status = normalizeOperationalStatus(normalized.status);

  if (!text(normalized.line_kind) && derivedKind) normalized.line_kind = derivedKind;

  if (normalized.line_kind === 'movil'
    && !text(normalized.installment_from)
    && !text(normalized.installment_total)) {
    normalized.installment_from = 30;
    normalized.installment_total = 30;
    if (!text(normalized.remaining_payments)) normalized.remaining_payments = 0;
  }

  return normalized;
}
