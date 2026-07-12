-- Campos mínimos enriquecidos del suscriptor para archivos PS y modelo de equipo móvil.
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS equipment text;          -- modelo del equipo cuando aplica
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS product_type varchar;    -- PRODUCT_TYPE del PS
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS price_code varchar;      -- SOC / codigo de plan original
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS item_id varchar;         -- ITEM_ID del equipo
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS payments_made integer;   -- NO_OF_INSTALL_FROM: cuotas pagadas
