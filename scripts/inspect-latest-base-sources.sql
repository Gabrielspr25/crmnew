SELECT id, familia, documento_tipo, nombre_original, ruta_relativa, creado_en
FROM public.fuentes_comerciales
WHERE familia IN ('fijos','claro_tv')
ORDER BY creado_en DESC
LIMIT 8;
