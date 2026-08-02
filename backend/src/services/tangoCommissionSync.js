export const PYMES_TANGO_TYPE_NAMES = Object.freeze([
  'ba corp new',
  'ba corp ren',
  'cloud negocios',
  'corp update new',
  'corp update ren',
  'office 365 negocios',
  'pymes fijo new',
  'pymes fijo ren',
  'pymes update new',
  'pymes update ren',
  'telemetria new',
  'telemetria ren',
]);

const PYMES_TANGO_TYPES = new Set(PYMES_TANGO_TYPE_NAMES);

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveOrNull(value) {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}

function normalizeType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isPymesTangoType(value) {
  return PYMES_TANGO_TYPES.has(normalizeType(value));
}

export function isClaroTvTangoType(value) {
  return /\bclaro\s*tv\b|\btelevision\b/.test(normalizeType(value));
}

function normalizeDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function dateValue(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function readClientName(row) {
  if (typeof row?.cliente === 'string') return row.cliente.trim();
  const personName = [row?.cliente?.nombre, row?.cliente?.apellido]
    .filter((value) => value && !/^(null|undefined|n\/a|-)$/i.test(String(value).trim()))
    .join(' ')
    .trim();
  return firstValue(
    personName,
    row?.cliente_nombre,
    row?.nombre_cliente,
    row?.nombre,
  );
}

function readVendorName(row) {
  if (typeof row?.vendedor === 'string') return row.vendedor.trim();
  return firstValue(row?.vendedor?.nombre, row?.vendedor_nombre, row?.salesperson, row?.seller);
}

function readSaleType(row) {
  return {
    id: numberOrNull(firstValue(row?.ventatipoid, row?.ventatipo_id, row?.ventatipo?.id, row?.tipo?.id)),
    name: firstValue(row?.ventatipo_nombre, row?.ventatipo?.nombre, row?.tipo?.nombre, row?.tipo_venta, row?.nombre_tipo),
  };
}

function readCommission(row) {
  const source = row?.comisiones || row?.comision || row || {};
  const directTotal = positiveOrNull(firstValue(row?.total, source?.total));
  if (directTotal !== null) return directTotal;
  const components = [
    row?.comisionclaro, row?.com_empresa, row?.company_earnings,
    row?.features, row?.bonoportabilidad, row?.bonoretencion, row?.bonovolumen,
    row?.comisionextra, row?.comisionpapper,
    source?.comisionclaro, source?.com_empresa, source?.company_earnings,
    source?.features, source?.bonoportabilidad,
    source?.bonoretencion, source?.bonovolumen, source?.comisionextra, source?.comisionpapper,
  ];
  const sum = components.reduce((total, value) => total + (positiveOrNull(value) || 0), 0);
  return sum > 0 ? Math.round(sum * 100) / 100 : numberOrNull(firstValue(row?.comisionclaro, source?.comisionclaro));
}

function readPortabilityBonus(row) {
  const source = row?.comisiones || row?.comision || row || {};
  return numberOrNull(firstValue(row?.bonoportabilidad, row?.portability_bonus, source?.bonoportabilidad));
}

function validClientName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && !['sin nombre', 'null', 'n/a', '-'].includes(normalized);
}

export function mapTangoCommissionSale(sale = {}, commission = null) {
  const saleType = readSaleType(sale);
  const commissionType = readSaleType(commission || {});
  const commissionSource = commission || sale;
  const total = readCommission(commissionSource) ?? readCommission(sale) ?? 0;
  const typeName = saleType.name || commissionType.name || null;
  const typeId = saleType.id ?? commissionType.id;
  const lineType = /\bren\b|renov/i.test(String(typeName || '')) ? 'REN' : 'NEW';
  let lineKind = 'movil';
  const normalizedType = normalizeType(typeName);
  if ([8, 121, 140, 141].includes(typeId)) lineKind = 'fijo';
  else if ([25, 26, 138, 139].includes(typeId)) lineKind = 'movil';
  else if (/cloud|office 365/.test(normalizedType)) lineKind = 'cloud';
  else if (/mpls/.test(normalizedType)) lineKind = 'mpls';
  else if (/tv|televisi/.test(normalizedType)) lineKind = 'tv';
  else if (/fijo|2 play|3 play/.test(normalizedType)) lineKind = 'fijo';

  return {
    tangoVentaId: numberOrNull(firstValue(sale?.ventaid, sale?.id, sale?.venta_id, commission?.ventaid, commission?.id)),
    banNumber: String(firstValue(sale?.ban, commission?.ban) || '').replace(/\D/g, '') || null,
    phone: normalizeDigits(firstValue(sale?.telefono, sale?.phone, sale?.numerocelularactivado, sale?.status, sale?.numero)),
    priceCode: firstValue(sale?.codigovoz, sale?.plan?.codigovoz, sale?.plan?.codigo, sale?.plan?.code),
    monthlyValue: positiveOrNull(firstValue(sale?.pagomensual, sale?.monthly_value, sale?.monthlyValue, sale?.plan?.rate, sale?.tipoplan?.rate)),
    saleDate: dateValue(firstValue(sale?.fechaactivacion, commission?.fechaactivacion)),
    clientName: readClientName(sale) || readClientName(commission || {}),
    vendorName: readVendorName(sale) || readVendorName(commission || {}),
    saleTypeId: typeId,
    saleTypeName: typeName,
    companyEarnings: total,
    vendorCommission: numberOrNull(firstValue(
      commission?.comisionvendedor, commission?.com_vendedor, commission?.vendor_commission,
      commission?.comisiones?.comisionvendedor, sale?.comisionvendedor,
      sale?.com_vendedor, sale?.vendor_commission, sale?.comisiones?.comisionvendedor
    )),
    portabilityBonus: readPortabilityBonus(commissionSource) ?? readPortabilityBonus(sale) ?? 0,
    lineKind,
    lineType,
    rawPayload: { sale, commission },
  };
}

export function classifyTangoCommissionSale(mapped, { pymesClient = false } = {}) {
  const isPymesType = isPymesTangoType(mapped?.saleTypeName);
  const isClaroTv = isClaroTvTangoType(mapped?.saleTypeName);
  if (!isPymesType && !isClaroTv) return { accepted: false, reason: 'tipo_no_pymes' };
  if (isClaroTv && !pymesClient) return { accepted: false, reason: 'claro_tv_cliente_no_pymes' };
  if (!mapped?.banNumber) return { accepted: false, reason: 'ban_tango_invalido' };
  if (!validClientName(mapped?.clientName)) return { accepted: false, reason: 'cliente_tango_sin_nombre' };
  return { accepted: true, reason: null };
}

export function shouldCreateOperationalRelation(mapped, options) {
  return classifyTangoCommissionSale(mapped, options).accepted;
}

export { validClientName };
