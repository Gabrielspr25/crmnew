CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'nota',
  note TEXT NOT NULL,
  created_by TEXT NULL,
  created_by_name TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT client_notes_type_check CHECK (type IN ('nota','no_renueva','pendiente','riesgo','otro'))
);

ALTER TABLE public.client_notes
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'nota';

ALTER TABLE public.client_notes
  ADD COLUMN IF NOT EXISTS created_by_name TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'client_notes_type_check'
       AND conrelid = 'public.client_notes'::regclass
  ) THEN
    ALTER TABLE public.client_notes
      ADD CONSTRAINT client_notes_type_check
      CHECK (type IN ('nota','no_renueva','pendiente','riesgo','otro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_notes_client_created
  ON public.client_notes (client_id, created_at DESC);
