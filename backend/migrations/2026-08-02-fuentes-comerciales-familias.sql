BEGIN;

ALTER TABLE public.fuentes_comerciales
  DROP CONSTRAINT IF EXISTS fuentes_comerciales_familia_check;

ALTER TABLE public.fuentes_comerciales
  ADD CONSTRAINT fuentes_comerciales_familia_check CHECK (familia IN (
    'equipos', 'fijos', 'moviles', 'inalambrico_iot', 'servicios',
    'cloud_sva', 'claro_tv', 'ofertas_moviles', 'ofertas_fijo', 'beneficios'
  ));

COMMIT;
