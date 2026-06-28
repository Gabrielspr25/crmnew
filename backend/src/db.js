// Conexión a PostgreSQL (pool reutilizable).
// Usa las variables estándar PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE del .env
// (evita problemas de codificación con claves que tengan símbolos raros).
import pg from 'pg';

const { Pool } = pg;

const SCHEMA = process.env.DB_SCHEMA || 'public';

export const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 30000,
});

// En cada conexión nueva, apuntar al schema configurado (ej: ventaspro_nuevo).
pool.on('connect', (client) => {
  client.query(`SET search_path TO ${SCHEMA}, public`);
});

export function query(text, params) {
  return pool.query(text, params);
}
