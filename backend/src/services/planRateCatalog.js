import { pool } from '../db.js';
import { resolvePlanMonthlyValueFromTango } from '../tango.js';

const CATALOG_SOURCE = 'catalogo-historico-plan-rates';

function normalizedCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return code || null;
}

function catalogCandidates(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map(normalizedCode).filter(Boolean))];
}

export function resolvePlanRateFromCatalogRows(planCode, rows = []) {
  const candidates = catalogCandidates(planCode);

  for (const code of candidates) {
    const matches = rows.filter((row) => normalizedCode(row?.soc) === code);
    if (!matches.length) continue;

    const positiveRates = [...new Set(
      matches
        .map((row) => Number(row?.monthly_rate))
        .filter((rate) => Number.isFinite(rate) && rate > 0),
    )];

    if (positiveRates.length === 1) {
      return { value: positiveRates[0], source: CATALOG_SOURCE, matched_code: code };
    }

    return { value: null, source: null, matched_code: code };
  }

  return { value: null, source: null, matched_code: null };
}

export async function resolvePlanMonthlyValueFromCatalog(planCode, db = pool) {
  const candidates = catalogCandidates(planCode);
  if (!candidates.length) return { value: null, source: null, matched_code: null };

  let result;
  try {
    result = await db.query(
      `SELECT soc, monthly_rate
         FROM public.plan_rate_catalog
        WHERE soc = ANY($1::text[])`,
      [candidates],
    );
  } catch (error) {
    // Durante una instalacion gradual, la ausencia del catalogo no debe impedir
    // altas ni importaciones: simplemente no hay precio historico disponible.
    if (error?.code === '42P01') return { value: null, source: null, matched_code: null };
    throw error;
  }

  return resolvePlanRateFromCatalogRows(candidates, result.rows);
}

export async function resolvePlanRateWithFallback({
  originalCode,
  lookupCode,
  resolveTango = resolvePlanMonthlyValueFromTango,
  resolveCatalog = resolvePlanMonthlyValueFromCatalog,
} = {}) {
  const tango = await resolveTango(lookupCode || originalCode);
  if (Number.isFinite(Number(tango?.value)) && Number(tango.value) > 0) return tango;

  return resolveCatalog([originalCode, lookupCode]);
}

export { CATALOG_SOURCE };
