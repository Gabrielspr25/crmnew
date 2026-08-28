// Conexion a PostgreSQL (pool reutilizable).
// Usa PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE del .env.
import pg from 'pg';

const { Pool } = pg;

const SCHEMA = process.env.DB_SCHEMA || 'public';
const safeSchema = String(SCHEMA).replace(/[^a-zA-Z0-9_]/g, '') || 'public';
const requestedPoolMax = Number.parseInt(process.env.DB_POOL_MAX || '20', 10);
const POOL_MAX = Number.isFinite(requestedPoolMax) ? Math.min(50, Math.max(5, requestedPoolMax)) : 20;

export const pool = new Pool({
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
  options: `-c search_path=${safeSchema},public`,
});

export function query(text, params) {
  return pool.query(text, params);
}
