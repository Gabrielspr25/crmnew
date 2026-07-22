BEGIN;

ALTER TABLE public.subscribers
  DROP CONSTRAINT IF EXISTS subscribers_line_kind_check;

ALTER TABLE public.subscribers
  ADD CONSTRAINT subscribers_line_kind_check
  CHECK (line_kind IN ('movil', 'fijo', 'cloud') OR line_kind IS NULL);

COMMIT;
