CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.fuentes_comerciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia TEXT NOT NULL CHECK (familia IN (
    'equipos',
    'fijos',
    'moviles',
    'inalambrico_iot',
    'servicios',
    'cloud_sva',
    'claro_tv',
    'ofertas_moviles',
    'ofertas_fijo',
    'beneficios'
  )),
  titulo TEXT NOT NULL,
  documento_tipo TEXT NOT NULL CHECK (documento_tipo IN ('pdf','excel')),
  nombre_original TEXT NOT NULL,
  nombre_archivado TEXT NOT NULL,
  ruta_relativa TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  mime_type TEXT,
  bytes BIGINT NOT NULL CHECK (bytes > 0),
  vigencia_desde DATE,
  vigencia_hasta DATE,
  vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion' CHECK (vigencia_documental IN (
    'vigente',
    'vencida_pendiente_reemplazo',
    'vencida',
    'futura',
    'pendiente_confirmacion'
  )),
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','archivada')),
  subido_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (familia, sha256)
);

CREATE INDEX IF NOT EXISTS fuentes_comerciales_familia_creado_idx
  ON public.fuentes_comerciales (familia, creado_en DESC);

CREATE INDEX IF NOT EXISTS fuentes_comerciales_vigencia_idx
  ON public.fuentes_comerciales (vigencia_documental, vigencia_hasta);
