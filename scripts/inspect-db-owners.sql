SELECT 'current_user' AS item, current_user AS value;
SELECT 'fuentes_comerciales_owner' AS item, tableowner AS value
FROM pg_tables
WHERE schemaname='public' AND tablename='fuentes_comerciales';
SELECT 'planes_modulos_owner' AS item, tableowner AS value
FROM pg_tables
WHERE schemaname='public' AND tablename='planes_modulos';
SELECT 'bases_table' AS item, COALESCE(to_regclass('public.bases_informativas_publicaciones')::text, 'missing') AS value;
