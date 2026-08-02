BEGIN;

CREATE TABLE IF NOT EXISTS public.subscriber_gpon_reviews (
  subscriber_id uuid PRIMARY KEY REFERENCES public.subscribers(id) ON DELETE CASCADE,
  gpon_applies boolean NULL,
  gpon_note text NULL,
  reviewed_at date NULL,
  reviewed_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriber_gpon_reviews IS
  'Revision comercial manual de disponibilidad GPON/aumento por linea fija. No reemplaza datos importados de cartera, Tango ni suscriptores.';

COMMENT ON COLUMN public.subscriber_gpon_reviews.gpon_note IS
  'Nota corta del aumento u oportunidad aplicable, por ejemplo +10, +15, GPON +20 o 300M.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriber_gpon_reviews TO crm_user;
  END IF;
END $$;

COMMIT;
