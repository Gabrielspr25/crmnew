BEGIN;

DROP INDEX IF EXISTS public.subscribers_phone_norm_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_ban_phone_norm_uniq
  ON public.subscribers (ban_id, phone_norm)
  WHERE phone_norm IS NOT NULL AND phone_norm <> '';

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_active_phone_norm_uniq
  ON public.subscribers (phone_norm)
  WHERE phone_norm IS NOT NULL
    AND phone_norm <> ''
    AND LOWER(TRIM(COALESCE(status, ''))) IN ('activo', 'activa', 'active', 'a');

COMMIT;
