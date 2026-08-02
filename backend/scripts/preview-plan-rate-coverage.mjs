import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });
const { pool } = await import('../src/db.js');

const result = await pool.query(`
  WITH candidate_codes AS (
    SELECT s.id,
           NULLIF(upper(trim(s.price_code)), '') AS price_code,
           NULLIF(upper(trim(s.plan)), '') AS plan,
           s.monthly_value
      FROM public.subscribers s
  ), matches AS (
    SELECT c.id,
           c.monthly_value,
           c.price_code,
           c.plan,
           COALESCE(pc.monthly_rate, pp.monthly_rate) AS catalog_rate
      FROM candidate_codes c
      LEFT JOIN public.plan_rate_catalog pc ON pc.soc = c.price_code
      LEFT JOIN public.plan_rate_catalog pp ON pp.soc = c.plan
  )
  SELECT
    COUNT(*) FILTER (WHERE monthly_value IS NULL OR monthly_value <= 0)::int AS sin_precio_actual,
    COUNT(*) FILTER (WHERE (monthly_value IS NULL OR monthly_value <= 0) AND catalog_rate > 0)::int AS completables_catalogo,
    COUNT(*) FILTER (WHERE (monthly_value IS NULL OR monthly_value <= 0) AND catalog_rate = 0)::int AS catalogo_renta_cero,
    COUNT(*) FILTER (WHERE (monthly_value IS NULL OR monthly_value <= 0) AND catalog_rate IS NULL)::int AS sin_coincidencia_catalogo,
    COUNT(*) FILTER (WHERE monthly_value > 0)::int AS ya_con_precio
  FROM matches
`);

console.log(JSON.stringify(result.rows[0], null, 2));
await pool.end();
