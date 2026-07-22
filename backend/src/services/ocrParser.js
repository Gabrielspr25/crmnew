// OCR: parser + motor (Vision principal, Tesseract fallback opcional).
// Copiado VERBATIM de server-FINAL.js (viejo) — parser de la tabla de suscriptores Claro.
import fs from 'node:fs';
import { extractTextWithVision } from './ocrVisionService.js';

const VALID_PR_PHONE = /^(787|939|989)\d{7}$/;
const OCR_CHAR_MAP = {
  O: '0',
  o: '0',
  I: '1',
  l: '1',
  S: '5',
  s: '5',
  B: '8',
  b: '8',
  Z: '2',
  z: '2',
  G: '6',
  g: '6'
};

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizePlanCodeKey(value) {
  let cleaned = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  cleaned = cleaned.replace(/^(ACTIVE|ACTVE|ACIVE|CANCELLED|CANCELED|CANCELADO|INACTIVE|INACTIVO)/i, '');
  return cleaned;
}

function normalizeStatus(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('cancel')) return 'cancelado';
  if (raw.includes('actv') || raw.includes('acive') || raw.includes('actve')) return 'activo';
  if (raw.includes('active') || raw.includes('activo')) return 'activo';
  return 'activo';
}

const STATUS_TOKEN_REGEX = /\b(active|actve|acive|activo|canceled|cancelled|cancelado|inactivo)\b/i;

function hasStatusToken(value) {
  return STATUS_TOKEN_REGEX.test(String(value || ''));
}

function extractStatusOnlyLine(value) {
  const cleaned = String(value || '').trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^[-|:\s]*(active|actve|acive|activo|canceled|cancelled|cancelado|inactivo)[-|:\s]*$/i);
  return match ? normalizeStatus(match[1]) : null;
}

function normalizeOcrChars(value) {
  return String(value || '')
    .split('')
    .map((ch) => OCR_CHAR_MAP[ch] || ch)
    .join('');
}

function extractStatusFromLine(line) {
  const match = line.match(STATUS_TOKEN_REGEX);
  return normalizeStatus(match ? match[1] : 'activo');
}

function normalizePhoneCandidate(raw) {
  const cleaned = normalizeOcrChars(String(raw || '').trim());
  if (!cleaned) return { phone: null, ignored100: false };

  if (/^100[-\s]?\d+/i.test(cleaned)) {
    return { phone: null, ignored100: true, prefixCorrected: false };
  }

  let digits = cleaned.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  if (VALID_PR_PHONE.test(digits)) {
    return { phone: digits, ignored100: false, prefixCorrected: false };
  }

  return { phone: null, ignored100: false, prefixCorrected: false };
}

function extractPhoneFromLine(line) {
  const direct = normalizePhoneCandidate(line);
  if (direct.phone || direct.ignored100) return direct;

  const chunks = line.match(/\d[\d().\-\s]{6,}\d/g) || [];
  for (const chunk of chunks) {
    const candidate = normalizePhoneCandidate(chunk);
    if (candidate.phone || candidate.ignored100) return candidate;
  }

  const tokens = line.split(/\s+/);
  for (const token of tokens) {
    const candidate = normalizePhoneCandidate(token);
    if (candidate.phone || candidate.ignored100) return candidate;
  }

  return { phone: null, ignored100: false };
}

function extractPlanFromLine(line) {
  const statusMatch = line.match(STATUS_TOKEN_REGEX);
  const tail = statusMatch
    ? line.slice((statusMatch.index || 0) + statusMatch[0].length).trim()
    : line.trim();

  if (!tail) return null;
  let tailForPlan = tail.replace(new RegExp(STATUS_TOKEN_REGEX, 'gi'), '').trim();
  const token = (tailForPlan.match(/[A-Za-z0-9_-]{3,}/g) || [])[0] || null;
  return token ? token.toUpperCase() : null;
}

// Palabras inglesas comunes que NO son códigos de plan Claro. Sin esta blacklist
// "Please ENTER..." o "Subscriber Type Status" se interpretarían como planes.
const NON_PLAN_WORDS = new Set([
  'PLEASE', 'ENTER', 'DOUBLE', 'CLICK', 'SELECT', 'SUBSCRIBER', 'SUBSCRIBERS',
  'SUBSCRIBE', 'TYPE', 'STATUS', 'PRICE', 'PLAN', 'LIST', 'FOR', 'BAN',
  'OK', 'CANCEL', 'YES', 'NO', 'FROM', 'THE', 'AND', 'NULL', 'TRUE', 'FALSE'
]);

// Heurística para validar que un token parezca un código de plan Claro.
// Patrones aceptados: solo dígitos largos (1461, 69912), mezcla letras+dígitos (A1492, AUS3M, BAHOT40L),
// con guion bajo (ISP_EMP1). Rechaza palabras puras de letras (Please, Active) y tokens >12 chars (BAN-NNNNNNN).
function looksLikePlanCandidate(token) {
  const upper = String(token || '').toUpperCase();
  if (!upper || upper.length < 3 || upper.length > 12) return false;
  if (NON_PLAN_WORDS.has(upper)) return false;
  if (/^BAN[-\s]?\d/.test(upper)) return false;
  if (/^\d{3,}$/.test(upper)) return true;
  if (/[A-Z]/.test(upper) && /\d/.test(upper)) return true;
  if (upper.includes('_')) return true;
  return false;
}

function extractPlanFromStandaloneLine(line) {
  const cleaned = String(line || '').trim();
  if (!cleaned) return null;
  if (extractStatusOnlyLine(cleaned)) return null;
  const phoneCheck = extractPhoneFromLine(cleaned);
  if (phoneCheck.phone || phoneCheck.ignored100) return null;
  const cleanedForPlan = cleaned.replace(new RegExp(STATUS_TOKEN_REGEX, 'gi'), '').trim();
  const tokens = cleanedForPlan.match(/[A-Za-z0-9_-]{3,}/g) || [];
  for (const tok of tokens) {
    if (looksLikePlanCandidate(tok)) return tok.toUpperCase();
  }
  return null;
}

function rowsToClipboardText(rows) {
  const header = 'Subscriber Type Status Price Plan';
  const lines = rows
    .filter((row) => row.subscriber)
    .map((row) => [row.subscriber, row.type || 'G', row.status || 'Active', row.pricePlan || ''].filter(Boolean).join(' '));
  return [header, ...lines].join('\n').trim();
}

function extractBanFromOcrText(text) {
  const raw = String(text || '');
  const patterns = [
    /\bBAN\s*[-#:]*\s*(\d[\d\s-]{7,}\d)\b/i,
    /\bSubscriber\s+list\s+for\s+BAN\s*[-#:]*\s*(\d[\d\s-]{7,}\d)\b/i,
    /\bfor\s+BAN\s*[-#:]*\s*(\d[\d\s-]{7,}\d)\b/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const digits = String(match[1] || '').replace(/\D/g, '');
    if (digits.length === 9) return digits;
  }
  return null;
}

function normalizePhoneDigits(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return null;
}

function extractPhoneFromOcrLine(line) {
  const candidates = line.match(/(?:\+?1\s*)?(?:\(?\d{3}\)?[\s\-\.]*)\d{3}[\s\-\.]*\d{4}/g);
  if (candidates && candidates.length) {
    for (const candidate of candidates) {
      const normalized = normalizePhoneCandidate(candidate);
      if (normalized.ignored100) return null;
      if (normalized.phone) return normalized.phone;
    }
  }

  const longRuns = line.match(/\d[\d\s\-\.]{8,}\d/g);
  if (longRuns && longRuns.length) {
    for (const run of longRuns) {
      const normalized = normalizePhoneCandidate(run);
      if (normalized.ignored100) return null;
      if (normalized.phone) return normalized.phone;
    }
  }
  return null;
}

// Regla operacional de Subscriber List: 989 / tipo K / CCPRO es un suscriptor
// Cloud válido. No participa como móvil ni fijo, pero sí se guarda en subscribers.
function normalizeOcrProductType(value) {
  const type = String(value || '').trim().toUpperCase();
  // En la columna Type el OCR suele confundir la letra O con el dígito 0.
  return type === '0' ? 'O' : type;
}

function classifyOcrLineKind({ subscriber, type, pricePlan } = {}) {
  const phone = String(subscriber || '').replace(/\D/g, '');
  const sourceType = normalizeOcrProductType(type);
  const plan = normalizePlanCodeKey(pricePlan);
  if (phone.startsWith('989') || sourceType === 'K' || plan === 'CCPRO') return 'cloud';
  if (sourceType === 'G') return 'movil';
  if (['O', 'T', 'V'].includes(sourceType)) return 'fijo';
  return null;
}

function parseOcrStatus(tokens) {
  const joined = tokens.join(' ').toLowerCase();
  const map = [
    [/\bactive\b/, 'Active'],
    [/\bactve\b/, 'Active'],
    [/\bacive\b/, 'Active'],
    [/\binactive\b/, 'Inactive'],
    [/\bcancel(?:led|ed|ado)?\b/, 'Cancelled'],
    [/\bsuspend(?:ed|ido|ida)?\b/, 'Suspended']
  ];

  for (const [regex, label] of map) {
    if (regex.test(joined)) {
      const restTokens = tokens.filter((token) => !regex.test(token.toLowerCase()));
      return { status: label, restTokens };
    }
  }
  return { status: '', restTokens: tokens };
}

function parseLocalOcrText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, ' ').trim())
    .filter(Boolean);

  // Stream de eventos en orden de aparición: { kind: 'phone' | 'plan', ... }
  const events = [];
  const seen = new Set();
  for (const line of lines) {
    const phone = extractPhoneFromOcrLine(line);
    if (phone) {
      if (seen.has(phone)) continue;
      seen.add(phone);
      const lineNoPhone = line
        .replace(/(?:\+?1\s*)?(?:\(?\d{3}\)?[\s\-\.]*)\d{3}[\s\-\.]*\d{4}/, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const tokens = lineNoPhone.split(' ').filter(Boolean);
      let type = '';
      if (tokens.length && tokens[0].length <= 3) type = normalizeOcrProductType(tokens.shift());
      const parsedStatus = parseOcrStatus(tokens);
      // inlinePlan: validamos como candidato real (descarta tokens basura tipo 'F' o duplicados de status).
      let inlinePlan = '';
      for (const t of parsedStatus.restTokens) {
        if (looksLikePlanCandidate(t)) { inlinePlan = t.toUpperCase(); break; }
      }
      events.push({ kind: 'phone', phone, type, status: parsedStatus.status, inlinePlan, rawLine: line });
    } else {
      const planFromLine = extractPlanFromStandaloneLine(line);
      if (planFromLine) events.push({ kind: 'plan', plan: planFromLine });
    }
  }

  const orphanPhones = events.filter((e) => e.kind === 'phone' && !e.inlinePlan);
  const orphanPlans = events.filter((e) => e.kind === 'plan');

  if (orphanPhones.length > 0 && orphanPhones.length === orphanPlans.length) {
    // Pairing 1:1 en orden. Vision mantiene el orden visual de la tabla; el N-ésimo phone
    // huérfano corresponde al N-ésimo plan huérfano.
    for (let k = 0; k < orphanPhones.length; k += 1) {
      orphanPhones[k].assignedPlan = orphanPlans[k].plan;
    }
  } else {
    // Conteos no coinciden: fallback conservador (forward + backward limitado al primer phone).
    // Mejor "sin plan" que "asignación equivocada".
    const phoneEvents = events.filter((e) => e.kind === 'phone');
    const eventOrder = events.map((e, idx) => ({ e, idx }));
    const phoneIdxInLines = new Map();
    let cursor = 0;
    for (const { e, idx } of eventOrder) phoneIdxInLines.set(e, idx);
    for (let p = 0; p < phoneEvents.length; p += 1) {
      const phEv = phoneEvents[p];
      if (phEv.inlinePlan) continue;
      const myIdx = phoneIdxInLines.get(phEv);
      // forward hasta el próximo phone
      for (let j = myIdx + 1; j < events.length; j += 1) {
        if (events[j].kind === 'phone') break;
        if (events[j].kind === 'plan') { phEv.assignedPlan = events[j].plan; break; }
      }
      // backward sólo para el primer phone si quedó sin plan
      if (!phEv.assignedPlan && p === 0) {
        for (let j = myIdx - 1; j >= 0; j -= 1) {
          if (events[j].kind === 'phone') break;
          if (events[j].kind === 'plan') { phEv.assignedPlan = events[j].plan; break; }
        }
      }
    }
  }

  const rows = events
    .filter((e) => e.kind === 'phone')
    .map((e) => ({
      subscriber: e.phone,
      type: e.type,
      status: e.status,
      pricePlan: e.inlinePlan || e.assignedPlan || '',
      line_kind: classifyOcrLineKind({
        subscriber: e.phone,
        type: e.type,
        pricePlan: e.inlinePlan || e.assignedPlan || '',
      }),
      rawLine: e.rawLine
    }));

  const warnings = [];
  if (!rows.length) {
    warnings.push('No se detectaron telefonos de 10 digitos. Sube imagen mas nitida o recortada a la tabla.');
  }

  return { rows, warnings, lineCount: lines.length, banNumber: extractBanFromOcrText(text) };
}

async function ocrImageBuffer(buffer) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    return String(result?.data?.text || '');
  } finally {
    await worker.terminate();
  }
}

// OCR motor con Vision principal + fallback Tesseract.
// Devuelve { text, engine, ocr_warnings }. NO parsea filas.
async function extractTextForSync(buffer) {
  const mode = String(process.env.OCR_ENGINE || 'tesseract').toLowerCase().trim();
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const visionOk = credsPath && fs.existsSync(credsPath);
  const ocrWarnings = [];

  if (mode !== 'tesseract' && visionOk) {
    try {
      // documentTextDetection: optimizado para tablas/documentos densos (Subscriber List Claro).
      const r = await extractTextWithVision(buffer, { mode: 'document' });
      const rawText = String(r?.rawText || '').trim();
      if (rawText) {
        return { text: rawText, engine: 'google', ocr_warnings: ocrWarnings };
      }
      if (mode === 'google') {
        const err = new Error('Google Vision no devolvio texto');
        err.code = 'VISION_EMPTY';
        throw err;
      }
      ocrWarnings.push('vision_empty: Vision no devolvio texto; usando fallback Tesseract');
    } catch (err) {
      const msg = err?.message || 'unknown error';
      console.warn('[ocr-sync] Vision fallo:', msg);
      if (mode === 'google') throw err;
      ocrWarnings.push(`vision_failed: ${msg}`);
    }
  }

  const text = await ocrImageBuffer(buffer);
  return { text, engine: 'tesseract', ocr_warnings: ocrWarnings };
}
export { extractTextForSync, parseLocalOcrText, rowsToClipboardText, ocrImageBuffer, extractBanFromOcrText, classifyOcrLineKind };
