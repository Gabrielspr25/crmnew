ALTER TABLE public.equipos_uploads
  ADD COLUMN IF NOT EXISTS fuente_comercial_id UUID REFERENCES public.fuentes_comerciales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipos_uploads_fuente_comercial
  ON public.equipos_uploads (fuente_comercial_id);
