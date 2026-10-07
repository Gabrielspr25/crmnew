-- Revisable. Requiere autorización expresa y respaldo antes de ejecutarse.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.sales_opportunities
  ADD COLUMN IF NOT EXISTS referred_by_name varchar(200);
COMMENT ON COLUMN public.sales_opportunities.referred_by_name IS
  'Persona que refirió la oportunidad; texto libre opcional, independiente del vendedor asignado.';
COMMIT;
