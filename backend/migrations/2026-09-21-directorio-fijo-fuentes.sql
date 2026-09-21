-- Directorio de Fijo es una fuente independiente de Planes Fijos.
-- Requiere respaldo previo y se ejecuta como propietario de public.fuentes_comerciales.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

ALTER TABLE public.fuentes_comerciales
  DROP CONSTRAINT IF EXISTS fuentes_comerciales_familia_check;

ALTER TABLE public.fuentes_comerciales
  ADD CONSTRAINT fuentes_comerciales_familia_check CHECK (familia IN (
    'equipos', 'fijos', 'moviles', 'inalambrico_iot', 'servicios',
    'cloud_sva', 'claro_tv', 'ofertas_moviles', 'ofertas_fijo', 'beneficios',
    'affinity', 'directorio_fijo'
  ));

CREATE TABLE IF NOT EXISTS public.directorio_fijo_publicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL UNIQUE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada', 'reemplazada')),
  fuente_comercial_id UUID NOT NULL REFERENCES public.fuentes_comerciales(id) ON DELETE RESTRICT,
  fuente_nombre TEXT NOT NULL,
  fuente_sha256 CHAR(64) NOT NULL CHECK (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  contenido JSONB NOT NULL,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  diferencias JSONB NOT NULL DEFAULT '{}'::jsonb,
  respaldo_anterior TEXT NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  publicada_por TEXT,
  publicada_en TIMESTAMPTZ,
  reemplazada_en TIMESTAMPTZ,
  CONSTRAINT directorio_fijo_publicaciones_contenido_objeto CHECK (jsonb_typeof(contenido) = 'object'),
  CONSTRAINT directorio_fijo_publicaciones_publicacion_fecha CHECK (
    (estado = 'publicada' AND publicada_por IS NOT NULL AND publicada_en IS NOT NULL)
    OR estado IN ('borrador', 'reemplazada')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS directorio_fijo_publicaciones_una_vigente_idx
  ON public.directorio_fijo_publicaciones ((estado))
  WHERE estado = 'publicada';

CREATE INDEX IF NOT EXISTS directorio_fijo_publicaciones_fuente_idx
  ON public.directorio_fijo_publicaciones (fuente_comercial_id, numero DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT, UPDATE ON public.directorio_fijo_publicaciones TO crm_user;
    GRANT USAGE, SELECT ON SEQUENCE public.directorio_fijo_publicaciones_numero_seq TO crm_user;
  END IF;
END
$$;

COMMIT;
