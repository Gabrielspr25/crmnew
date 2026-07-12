// Conexion a PostgreSQL (pool reutilizable).
// Usa PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE del .env.
import pg from 'pg';

const { Pool } = pg;

const SCHEMA = process.env.DB_SCHEMA || 'public';
const safeSchema = String(SCHEMA).replace(/[^a-zA-Z0-9_]/g, '') || 'public';

export const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 30000,
  options: `-c search_path=${safeSchema},public`,
});

export function query(text, params) {
  return pool.query(text, params);
}
