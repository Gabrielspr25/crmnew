-- Activation date belongs to the subscriber/line in the CRM UI.
-- Keep bans.activation_date for backward compatibility; do not drop old data.
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS activation_date date;
