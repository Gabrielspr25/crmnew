-- Compatibilidad con la tabla histórica de campañas ya existente en producción.
-- No elimina ni modifica las campañas anteriores; agrega los campos del agente local.
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS campaign_code text,
  ADD COLUMN IF NOT EXISTS subject_template text,
  ADD COLUMN IF NOT EXISTS html_template text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS batch_size integer,
  ADD COLUMN IF NOT EXISTS interval_minutes integer,
  ADD COLUMN IF NOT EXISTS created_by text;

ALTER TABLE public.email_campaigns
  ALTER COLUMN ends_at DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_campaigns_campaign_code_unique
  ON public.email_campaigns (campaign_code)
  WHERE campaign_code IS NOT NULL;
