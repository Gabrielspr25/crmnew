ALTER TABLE public.equipos_lista
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_source_url TEXT,
  ADD COLUMN IF NOT EXISTS image_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ;

DROP VIEW IF EXISTS public.v_equipos_vigentes;

CREATE OR REPLACE VIEW public.v_equipos_vigentes AS
SELECT
  e.*,
  m.mensualidades,
  p.pospago_precios
FROM public.equipos_lista e
LEFT JOIN LATERAL (
  SELECT json_agg(
    json_build_object('meses', em.meses, 'monto', em.monto)
    ORDER BY em.meses
  ) AS mensualidades
  FROM public.equipos_mensualidades em
  WHERE em.equipo_id = e.id
) m ON TRUE
LEFT JOIN LATERAL (
  SELECT json_agg(
    json_build_object('plan', ep.plan_precio, 'monto', ep.monto)
    ORDER BY ep.plan_precio
  ) AS pospago_precios
  FROM public.equipos_pospago ep
  WHERE ep.equipo_id = e.id
) p ON TRUE
WHERE e.activo = TRUE
ORDER BY e.categoria, e.marca, e.modelo;
