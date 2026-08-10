ALTER TABLE ventaspro_nuevo.audit_log
  ADD COLUMN IF NOT EXISTS ip_address TEXT;
