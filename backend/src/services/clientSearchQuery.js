// Busqueda de clientes por BAN, nombre, apellido o empresa.
//
// Cada palabra que escribe el vendedor se busca por separado y todas deben aparecer,
// sin importar el orden: "CORDERO JOSE" encuentra a "DR JOSE CORDERO" igual que "JOSE CORDERO".
// Los comodines de SQL (% y _) se buscan como texto literal.

const MAX_TERMINOS = 6;

const CAMPOS = (i) => `
      c.name ILIKE $${i} ESCAPE '\\'
      OR c.business_name ILIKE $${i} ESCAPE '\\'
      OR c.owner_name ILIKE $${i} ESCAPE '\\'
      OR c.contact_person ILIKE $${i} ESCAPE '\\'
      OR c.email ILIKE $${i} ESCAPE '\\'
      OR CAST(c.phone AS text) ILIKE $${i} ESCAPE '\\'
      OR CAST(c.cellular AS text) ILIKE $${i} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM bans bq WHERE bq.client_id = c.id AND CAST(bq.ban_number AS text) ILIKE $${i} ESCAPE '\\')
      OR EXISTS (SELECT 1 FROM subscribers sq JOIN bans bqs ON sq.ban_id = bqs.id WHERE bqs.client_id = c.id AND CAST(sq.phone AS text) ILIKE $${i} ESCAPE '\\')`;

function escaparComodines(termino) {
  return termino.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

export function terminosDeBusqueda(q) {
  return String(q || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TERMINOS);
}

// startIndex = cuantos parametros ya lleva la consulta ($1, $2, ...) antes de esta parte.
export function buildClientSearchFilter(q, startIndex = 0) {
  const terminos = terminosDeBusqueda(q);
  if (!terminos.length) return { sql: '', params: [] };

  const params = terminos.map((t) => `%${escaparComodines(t)}%`);
  const bloques = terminos.map((_, n) => `(${CAMPOS(startIndex + n + 1)}\n    )`);
  return { sql: bloques.join(' AND '), params };
}
