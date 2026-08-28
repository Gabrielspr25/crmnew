SELECT 'bases_table' AS item, COALESCE(to_regclass('public.bases_informativas_publicaciones')::text, 'missing') AS value;
SELECT 'can_insert_bases' AS item, has_table_privilege(current_user, 'public.bases_informativas_publicaciones', 'INSERT')::text AS value;
SELECT 'can_select_bases' AS item, has_table_privilege(current_user, 'public.bases_informativas_publicaciones', 'SELECT')::text AS value;
