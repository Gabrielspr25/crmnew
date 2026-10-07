// Regla de identidad de cliente: decide cuándo dos registros de `clients`
// son en realidad la misma empresa, para que no se dupliquen al crear un
// cliente nuevo y para que las cuentas repetidas se agrupen solas en la
// pantalla de Clientes.
//
// Reglas (pedidas por Gabriel, 2026-09-25, caso "Ernesto Juan E Hijos"):
// - Ignora mayúsculas/minúsculas.
// - Ignora puntos y comas de más o de menos ("Inc." = "Inc").
// - Ignora espacios de más o de menos.
// - Ignora un sufijo comercial común al final del nombre (Inc, Corp, LLC...).
// - Si el Tax ID coincide, es igual de válido o mejor señal que el nombre.
//
// Esta misma lógica se usa en dos lugares y debe mantenerse igual en ambos:
//   1. `writeRoutes.js`  -> bloquea la creación de un cliente duplicado.
//   2. `clientsReal.js`  -> agrupa cuentas duplicadas en el listado.

const COMMON_SUFFIXES = ['incorporated', 'corporation', 'inc', 'corp', 'llc', 'ltd', 'co', 'se'];
const SUFFIX_ALTERNATION = COMMON_SUFFIXES.join('|');

// ---- Lado JavaScript (para normalizar lo que escribe el usuario) ----

function normalizeClientName(value) {
  let v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  v = v.replace(/[.,]/g, '');
  v = v.replace(/\s+/g, ' ').trim();
  const suffixPattern = new RegExp(`\\s+(${SUFFIX_ALTERNATION})$`);
  v = v.replace(suffixPattern, '').trim();
  return v;
}

function normalizeTaxId(value) {
  return String(value || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

// ---- Lado SQL (para comparar/agrupar directo en la base de datos) ----
// `expr` es un fragmento SQL ya resuelto (ej. "COALESCE(NULLIF(c.business_name,''), NULLIF(c.name,''), '')").

function clientNameKeySql(expr) {
  return `TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(${expr})), '[.,]', '', 'g'), '\\s+', ' ', 'g'), '\\s+(${SUFFIX_ALTERNATION})$', '', 'g'))`;
}

function taxIdKeySql(expr) {
  return `LOWER(REGEXP_REPLACE(COALESCE(${expr}::text,''), '[^0-9a-zA-Z]', '', 'g'))`;
}

export { normalizeClientName, normalizeTaxId, clientNameKeySql, taxIdKeySql };
