const CRM_CODE = /\[(CRM-(?:CAMP|CLI)-[A-Z0-9-]+)\]/i;

const FOLDERS = {
  interested: 'Interesados',
  pending_review: 'Pendientes de responder',
  meeting: 'Reunión / llamada agendada',
  no_contactar: 'No contactar / baja',
  failed: 'Fallidos',
};

function normalized(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function extractCrmCode(subject = '') {
  return String(subject).match(CRM_CODE)?.[1]?.toUpperCase() || null;
}

export function classifyReply(text = '') {
  const content = normalized(text);
  if (/no (?:deseo|quiero)|no contactar|elimin(?:a|e)me|dar(?:me)? de baja|unsubscribe/.test(content)) return 'no_contactar';
  if (/reunion|reunirnos|llamada|agend|disponib(?:le|ilidad)|jueves|viernes|lunes|martes|miercoles/.test(content)) return 'meeting';
  if (/me interesa|interesad|quiero revisar|enviame propuesta|cotizacion/.test(content)) return 'interested';
  return 'pending_review';
}

export function folderForClassification(classification) {
  return FOLDERS[classification] || FOLDERS.pending_review;
}

export function campaignSubject(subject, code) {
  const clean = String(subject || '').trim();
  return extractCrmCode(clean) ? clean : `${clean} [${code}]`.trim();
}
