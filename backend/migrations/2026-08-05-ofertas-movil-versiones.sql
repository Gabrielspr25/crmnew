CREATE TABLE IF NOT EXISTS public.ofertas_movil_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL UNIQUE NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'vigente', 'reemplazada')),
  vigencia_desde DATE,
  vigencia_hasta DATE,
  archivo_nombre TEXT NOT NULL,
  archivo_sha256 CHAR(64) NOT NULL,
  fuentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  datos JSONB NOT NULL DEFAULT '[]'::jsonb,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  advertencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  creada_por TEXT NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  publicada_por TEXT,
  publicada_en TIMESTAMPTZ,
  reemplazada_en TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ofertas_movil_versiones_una_vigente_idx
  ON public.ofertas_movil_versiones (estado)
  WHERE estado = 'vigente';

CREATE INDEX IF NOT EXISTS ofertas_movil_versiones_historial_idx
  ON public.ofertas_movil_versiones (numero DESC, creada_en DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT, UPDATE ON public.ofertas_movil_versiones TO crm_user;
    GRANT USAGE, SELECT ON SEQUENCE public.ofertas_movil_versiones_numero_seq TO crm_user;
  END IF;
END
$$;
