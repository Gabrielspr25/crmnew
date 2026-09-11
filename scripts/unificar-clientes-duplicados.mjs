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
const apply = process.env.APPLY === '1';
const onlyKey = process.env.CLIENT_GROUP_KEY || '';

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

const mergeableClientColumns = [
  'name',
  'business_name',
  'owner_name',
  'contact_person',
  'email',
  'phone',
  'additional_phone',
  'cellular',
  'address',
  'city',
  'zip_code',
  'tax_id',
  'source',
  'salesperson_id',
];

function sqlIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function qualified(schema, table) {
  return `${sqlIdent(schema)}.${sqlIdent(table)}`;
}

function firstValue(rows, column) {
  for (const row of rows) {
    const value = row[column];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return null;
}

async function discoverClientReferences(client) {
  const { rows } = await client.query(`
    SELECT c.table_schema, c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
     WHERE c.column_name = 'client_id'
       AND c.table_schema IN ('public', 'ventaspro_nuevo')
       AND c.data_type = 'uuid'
       AND t.table_type = 'BASE TABLE'
       AND NOT (c.table_schema = 'public' AND c.table_name = 'clients')
       AND c.table_name NOT ILIKE 'backup_%'
       AND c.table_name NOT ILIKE 'bak_%'
       AND c.table_name NOT ILIKE 'tmp_%'
       AND c.table_name NOT ILIKE 'temp_%'
     ORDER BY c.table_schema, c.table_name
  `);
  return rows;
}

async function clientNotesColumns(client) {
  const { rows } = await client.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'client_notes'
  `);
  return new Set(rows.map((row) => row.column_name));
}

async function duplicateGroups(client) {
  const { rows } = await client.query(`
    WITH keyed AS (
      SELECT
        c.*,
        ${normalizeNameSql} AS merge_key,
        (SELECT count(*)::int FROM public.bans b WHERE b.client_id = c.id) AS ban_count,
        (SELECT count(*)::int
           FROM public.subscribers s
           JOIN public.bans b ON b.id = s.ban_id
          WHERE b.client_id = c.id) AS subscriber_count
      FROM public.clients c
    )
    SELECT
      merge_key,
      json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'business_name', business_name,
          'email', email,
          'tax_id', tax_id,
          'created_at', created_at,
          'ban_count', ban_count,
          'subscriber_count', subscriber_count
        )
        ORDER BY ban_count DESC, created_at DESC NULLS LAST, id
      ) AS clients
    FROM keyed
    WHERE merge_key <> ''
      AND ($1 = '' OR merge_key = $1)
    GROUP BY merge_key
    HAVING count(*) > 1
    ORDER BY count(*) DESC, merge_key
  `, [onlyKey]);
  return rows;
}

async function mergeGroup(client, refs, noteColumns, group) {
  const ids = group.clients.map((row) => row.id);
  const masterId = group.clients[0].id;
  const duplicateIds = ids.slice(1);
  const before = await client.query(
    `SELECT *
       FROM public.clients
      WHERE id = ANY($1::uuid[])
      ORDER BY (id = $2::uuid) DESC, created_at DESC NULLS LAST, id`,
    [ids, masterId],
  );

  const updates = [];
  const values = [];
  for (const column of mergeableClientColumns) {
    const current = before.rows.find((row) => row.id === masterId)?.[column];
    if (current !== null && current !== undefined && String(current).trim() !== '') continue;
    const value = firstValue(before.rows, column);
    if (value === null) continue;
    values.push(value);
    updates.push(`${sqlIdent(column)} = $${values.length}`);
  }
  if (updates.length) {
    values.push(masterId);
    await client.query(
      `UPDATE public.clients
          SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${values.length}`,
      values,
    );
  }

  const referenceUpdates = [];
  for (const ref of refs) {
    const result = await client.query(
      `UPDATE ${qualified(ref.table_schema, ref.table_name)}
          SET client_id = $1
        WHERE client_id = ANY($2::uuid[])`,
      [masterId, duplicateIds],
    );
    if (result.rowCount) {
      referenceUpdates.push({
        table: `${ref.table_schema}.${ref.table_name}`,
        rows: result.rowCount,
      });
    }
  }

  if (noteColumns.has('client_id') && noteColumns.has('note')) {
    const mergedSummary = before.rows.map((row) => {
      const name = row.business_name || row.name || '';
      const email = row.email || '';
      const tax = row.tax_id || '';
      return `${row.id} | ${name} | email=${email || '-'} | tax=${tax || '-'}`;
    }).join('\n');
    const columns = ['client_id'];
    const params = [masterId];
    if (noteColumns.has('type')) {
      columns.push('type');
      params.push('nota');
    }
    columns.push('note');
    params.push(`Unificacion automatica de clientes duplicados por nombre exacto "${group.merge_key}". Registros integrados:\n${mergedSummary}`);
    if (noteColumns.has('created_by_name')) {
      columns.push('created_by_name');
      params.push('Codex');
    } else if (noteColumns.has('created_by')) {
      columns.push('created_by');
      params.push(null);
    }
    await client.query(
      `INSERT INTO public.client_notes (${columns.map(sqlIdent).join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
      params,
    );
  }

  const deleted = await client.query(
    `DELETE FROM public.clients WHERE id = ANY($1::uuid[])`,
    [duplicateIds],
  );

  return {
    key: group.merge_key,
    master_id: masterId,
    merged_ids: duplicateIds,
    client_records_deleted: deleted.rowCount,
    reference_updates: referenceUpdates,
  };
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL search_path TO public');
  const refs = await discoverClientReferences(client);
  const noteColumns = await clientNotesColumns(client);
  const groups = await duplicateGroups(client);
  const results = [];
  for (const group of groups) {
    results.push(await mergeGroup(client, refs, noteColumns, group));
  }
  if (apply) {
    await client.query('COMMIT');
  } else {
    await client.query('ROLLBACK');
  }
  console.log(JSON.stringify({
    mode: apply ? 'APPLIED' : 'DRY_RUN_ROLLED_BACK',
    group_count: groups.length,
    results,
  }, null, 2));
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
