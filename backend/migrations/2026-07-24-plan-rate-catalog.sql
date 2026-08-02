BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_rate_catalog (
  soc text PRIMARY KEY,
  monthly_rate numeric(12,2) NOT NULL CHECK (monthly_rate >= 0),
  source_file text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_rate_catalog IS
  'Catalogo historico de rentas por SOC. Es respaldo para datos sin precio; Tango V2 conserva prioridad para precios vigentes.';

COMMENT ON COLUMN public.plan_rate_catalog.monthly_rate IS
  'Renta reportada por el catalogo fuente. El valor 0 significa que no hay renta utilizable para completar un suscriptor.';

COMMIT;
