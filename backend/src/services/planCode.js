function cleanPlanCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return code || null;
}

function suffixContractTerm(suffix) {
  if (suffix === '1') return 12;
  if (suffix === '2') return 24;
  return null;
}

export function planCodeLookupCandidates(value) {
  const original = cleanPlanCode(value);
  if (!original) return [];

  const candidates = [{ code: original, contract_term: null, suffix_stripped: false }];
  const suffix = original.slice(-1);
  const term = suffixContractTerm(suffix);
  const base = original.slice(0, -1);
  if (term && base.length >= 3) {
    candidates.push({ code: base, contract_term: term, suffix_stripped: true });
  }
  return candidates;
}

export function applyPlanCodeDefaults(row = {}) {
  const plan = cleanPlanCode(row.plan);
  const explicitPriceCode = cleanPlanCode(row.price_code);
  const source = explicitPriceCode || plan;
  const productType = cleanPlanCode(row.product_type);
  const lineKind = cleanPlanCode(row.line_kind);
  // En móvil el sufijo forma parte del SOC comercial: BREDP1, BREDP2, etc.
  const isMobile = productType === 'G' || lineKind === 'MOVIL';
  const candidates = isMobile
    ? [{ code: source, contract_term: null, suffix_stripped: false }]
    : planCodeLookupCandidates(source);
  const normalized = candidates.find(c => c.suffix_stripped) || candidates[0] || null;
  const contractTerm = Number(row.contract_term) || normalized?.contract_term || null;

  return {
    plan,
    price_code: normalized?.code || explicitPriceCode || null,
    contract_term: contractTerm,
  };
}
