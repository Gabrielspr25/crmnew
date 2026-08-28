-- Migracion revisable: estado de sincronizacion Airtable para public.prospectos.
-- No ejecutar sin backup y autorizacion expresa.

ALTER TABLE public.prospectos
  ADD COLUMN IF NOT EXISTS airtable_record_id TEXT,
  ADD COLUMN IF NOT EXISTS airtable_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS airtable_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_prospectos_airtable_record_id
  ON public.prospectos(airtable_record_id)
  WHERE airtable_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospectos_apify_google
  ON public.prospectos(google_id)
  WHERE source = 'apify_google_maps' AND google_id IS NOT NULL;
