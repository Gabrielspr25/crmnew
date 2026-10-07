function dateParts(value) {
  const source = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '');
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() + 1 === parts[1]
    && date.getUTCDate() === parts[2] ? parts : null;
}

function puertoRicoToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function remainingContractPayments(startDate, term, today = puertoRicoToday()) {
  const start = dateParts(startDate);
  const current = dateParts(today);
  const months = Number(term);
  if (!start || !current || !Number.isInteger(months) || months <= 0) return null;
  let elapsed = Math.max(0, (current[0] - start[0]) * 12 + current[1] - start[1]);
  const anniversaryDay = Math.min(start[2], new Date(Date.UTC(current[0], current[1], 0)).getUTCDate());
  if (elapsed > 0 && current[2] < anniversaryDay) elapsed--;
  return Math.max(0, months - elapsed);
}

// Valor operativo por calendario; no modifica la fila original ni exige origen Tango.
export function effectiveContractPayments(subscriber, today = puertoRicoToday()) {
  const remaining = remainingContractPayments(subscriber.contract_start_date, subscriber.contract_term, today);
  if (remaining === null) return subscriber;
  return { ...subscriber, remaining_payments: remaining, payments_made: Number(subscriber.contract_term) - remaining };
}
