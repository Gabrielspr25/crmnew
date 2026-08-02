BEGIN;

ALTER TABLE IF EXISTS public.opportunity_notes
  ADD COLUMN IF NOT EXISTS scheduled_call_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS scheduled_status TEXT NOT NULL DEFAULT 'pendiente';

ALTER TABLE IF EXISTS public.opportunity_notes
  DROP CONSTRAINT IF EXISTS opportunity_notes_scheduled_status_check;

ALTER TABLE IF EXISTS public.opportunity_notes
  ADD CONSTRAINT opportunity_notes_scheduled_status_check
  CHECK (scheduled_status IN ('pendiente','completada','cancelada'));

CREATE INDEX IF NOT EXISTS idx_opportunity_notes_scheduled_call
  ON public.opportunity_notes (scheduled_call_at)
  WHERE scheduled_call_at IS NOT NULL;

COMMIT;
