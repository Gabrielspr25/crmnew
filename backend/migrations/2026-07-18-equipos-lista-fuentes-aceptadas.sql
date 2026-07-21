-- Cada lista de precios aceptada conserva su archivo y hash para que el tab
-- Ofertas pueda reutilizarla sin pedir una segunda carga. No ejecutar fuera
-- de una base local o de prueba autorizada.
BEGIN;

ALTER TABLE public.equipos_uploads
  ADD COLUMN IF NOT EXISTS nombre_archivado TEXT,
  ADD COLUMN IF NOT EXISTS ruta_archivada TEXT,
  ADD COLUMN IF NOT EXISTS sha256 CHAR(64),
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS bytes BIGINT,
  ADD COLUMN IF NOT EXISTS vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion';

ALTER TABLE public.equipos_uploads
  DROP CONSTRAINT IF EXISTS equipos_uploads_vigencia_documental_chk;

ALTER TABLE public.equipos_uploads
  ADD CONSTRAINT equipos_uploads_vigencia_documental_chk CHECK (
    vigencia_documental IN (
      'vigente',
      'vencida_pendiente_reemplazo',
      'vencida',
      'futura',
      'pendiente_confirmacion'
    )
  );

CREATE INDEX IF NOT EXISTS equipos_uploads_fuente_archivada_idx
  ON public.equipos_uploads (fecha_subida DESC)
  WHERE ruta_archivada IS NOT NULL AND sha256 IS NOT NULL;

COMMIT;
