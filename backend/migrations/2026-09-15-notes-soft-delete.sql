BEGIN;

ALTER TABLE IF EXISTS public.client_notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT NULL;

ALTER TABLE IF EXISTS public.opportunity_notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_username TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_client_notes_client_active_created
  ON public.client_notes (client_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_notes_opportunity_active_created
  ON public.opportunity_notes (opportunity_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMIT;
