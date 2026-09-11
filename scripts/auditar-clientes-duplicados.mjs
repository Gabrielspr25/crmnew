import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const packagePath = existsSync(resolve(process.cwd(), 'package.json'))
  ? resolve(process.cwd(), 'package.json')
  : resolve(import.meta.dirname, '../backend/package.json');
const requireFromBackend = createRequire(pathToFileURL(packagePath));
const dotenv = requireFromBackend('dotenv');
const pg = requireFromBackend('pg');

dotenv.config({ path: resolve(process.cwd(), '.env') });

const { Pool } = pg;

const pool = new Pool({
  max: 5,
  idleTimeoutMillis: 30000,
  options: '-c search_path=ventaspro_nuevo,public',
});

const normalizeNameSql = `
  lower(
    regexp_replace(
      trim(coalesce(nullif(business_name, ''), nullif(name, ''), '')),
      '\\s+',
      ' ',
      'g'
    )
  )
`;

const normalizeTaxSql = `regexp_replace(coalesce(tax_id, ''), '\\D', '', 'g')`;

async function query(label, sql, params = []) {
  const { rows } = await pool.query(sql, params);
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(rows, null, 2));
}

try {
  await query(
    'conexion',
    `SELECT current_database() AS db, current_schema() AS schema, inet_server_addr() AS host`,
  );

  await query(
    'memorial',
    `SELECT
       c.id,
       c.name,
       c.business_name,
       c.tax_id,
       c.email,
       (SELECT count(*)::int FROM public.bans b WHERE b.client_id = c.id) AS ban_count,
       (SELECT string_agg(b.ban_number::text, ', ' ORDER BY b.ban_number::text)
          FROM public.bans b
         WHERE b.client_id = c.id) AS bans
     FROM public.clients c
     WHERE c.name ILIKE $1 OR c.business_name ILIKE $1
     ORDER BY coalesce(c.business_name, c.name)`,
    ['%MEMORIAL%'],
  );

  await query(
    'nombres_repetidos',
    `WITH groups AS (
       SELECT
         ${normalizeNameSql} AS key,
         array_agg(id ORDER BY created_at DESC NULLS LAST, id) AS ids,
         array_agg(coalesce(nullif(business_name, ''), nullif(name, ''), '') ORDER BY created_at DESC NULLS LAST, id) AS names,
         count(*)::int AS client_records,
         sum((SELECT count(*) FROM public.bans b WHERE b.client_id = clients.id))::int AS bans,
         sum((SELECT count(*) FROM public.subscribers s JOIN public.bans b ON b.id = s.ban_id WHERE b.client_id = clients.id))::int AS subscribers
       FROM public.clients
       GROUP BY 1
       HAVING count(*) > 1
     )
     SELECT *
     FROM groups
     WHERE key <> ''
     ORDER BY client_records DESC, key
     LIMIT 200`,
  );

  await query(
    'tax_id_repetidos',
    `WITH groups AS (
       SELECT
         ${normalizeTaxSql} AS key,
         array_agg(id ORDER BY created_at DESC NULLS LAST, id) AS ids,
         array_agg(coalesce(nullif(business_name, ''), nullif(name, ''), '') ORDER BY created_at DESC NULLS LAST, id) AS names,
         count(*)::int AS client_records,
         sum((SELECT count(*) FROM public.bans b WHERE b.client_id = clients.id))::int AS bans,
         sum((SELECT count(*) FROM public.subscribers s JOIN public.bans b ON b.id = s.ban_id WHERE b.client_id = clients.id))::int AS subscribers
       FROM public.clients
       GROUP BY 1
       HAVING ${normalizeTaxSql} <> '' AND count(*) > 1
     )
     SELECT *
     FROM groups
     ORDER BY client_records DESC, key
     LIMIT 200`,
  );
} finally {
  await pool.end();
}
