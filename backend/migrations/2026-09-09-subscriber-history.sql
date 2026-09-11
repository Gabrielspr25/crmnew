CREATE TABLE IF NOT EXISTS public.subscriber_history (
  id bigserial PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id text,
  user_name_snapshot text NOT NULL DEFAULT 'Sistema',
  source text NOT NULL CHECK (source IN ('manual', 'importador', 'sistema')),
  action text NOT NULL CHECK (action IN ('updated', 'created')),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  comment_updated_at timestamptz,
  comment_updated_by text,
  import_batch_id text,
  import_name text,
  import_filename text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_subscriber_history_subscriber_created
  ON public.subscriber_history (subscriber_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriber_history_created
  ON public.subscriber_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriber_history_source
  ON public.subscriber_history (source);

COMMENT ON TABLE public.subscriber_history IS
  'Bitacora inmutable de cambios automaticos por suscriptor. Solo comment/comment_updated_* son editables.';

COMMENT ON COLUMN public.subscriber_history.changes IS
  'JSONB estructurado por campo auditable: { campo: { old, new } }.';
