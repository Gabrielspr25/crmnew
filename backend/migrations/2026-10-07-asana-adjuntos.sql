BEGIN;
CREATE TABLE IF NOT EXISTS public.opportunity_note_attachments (
 id uuid PRIMARY KEY,
 note_id uuid NOT NULL REFERENCES public.opportunity_notes(id) ON DELETE CASCADE,
 opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE CASCADE,
 filename varchar(180) NOT NULL,
 storage_key varchar(80) NOT NULL UNIQUE,
 mime_type varchar(120) NOT NULL,
 size_bytes integer NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),
 created_by_username text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunity_note_attachments_note_idx ON public.opportunity_note_attachments(note_id,created_at);
COMMIT;
