CREATE TABLE IF NOT EXISTS public.planes_fijos_publicaciones (
  id BIGSERIAL PRIMARY KEY,
  familia TEXT NOT NULL DEFAULT 'planes_fijos' CHECK (familia = 'planes_fijos'),
  nombre_original TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  documento_archivado TEXT NOT NULL,
  titulo_documento TEXT,
  rev TEXT,
  version_doc TEXT,
  fecha_documento DATE,
  resumen JSONB NOT NULL DEFAULT '{}',
  modulos_aplicados JSONB NOT NULL DEFAULT '[]',
  snapshot_path TEXT,
  publicado_por TEXT,
  publicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planes_fijos_publicaciones_ultima
  ON public.planes_fijos_publicaciones (familia, publicado_en DESC, id DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT ON public.planes_fijos_publicaciones TO crm_user;
    GRANT USAGE, SELECT ON SEQUENCE public.planes_fijos_publicaciones_id_seq TO crm_user;
  END IF;
END
$$;
