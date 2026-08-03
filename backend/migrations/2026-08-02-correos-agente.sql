-- Correos CRM: campañas programadas, borradores individuales y eventos Outlook.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL UNIQUE,
  name text NOT NULL,
  subject_template text NOT NULL,
  html_template text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  batch_size integer NOT NULL DEFAULT 100 CHECK (batch_size BETWEEN 1 AND 100),
  interval_minutes integer NOT NULL DEFAULT 30 CHECK (interval_minutes >= 5),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'paused', 'completed')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'sent', 'failed', 'suppressed')),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient_email)
);

CREATE TABLE IF NOT EXISTS public.email_client_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  draft_code text NOT NULL UNIQUE,
  subject text NOT NULL,
  html_body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'opened', 'sent', 'closed')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id),
  draft_id uuid REFERENCES public.email_client_drafts(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.email_campaign_recipients(id) ON DELETE CASCADE,
  outlook_entry_id text UNIQUE,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'reply', 'failed', 'interested', 'meeting', 'no_contact', 'pending_review')),
  mailbox_folder text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (campaign_id IS NOT NULL OR client_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS email_campaign_recipients_queue_idx
  ON public.email_campaign_recipients (campaign_id, status, created_at);
CREATE INDEX IF NOT EXISTS email_events_campaign_idx
  ON public.email_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_events_client_idx
  ON public.email_events (client_id, occurred_at DESC);
