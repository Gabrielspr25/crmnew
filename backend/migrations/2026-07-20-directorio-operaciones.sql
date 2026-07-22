CREATE SCHEMA IF NOT EXISTS ventaspro_nuevo;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.directorio_operaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district TEXT,
  code TEXT,
  full_name TEXT NOT NULL,
  employee_number TEXT NOT NULL UNIQUE,
  job_title TEXT,
  municipalities TEXT,
  mobile TEXT,
  email TEXT,
  source_file TEXT,
  source_sheet TEXT NOT NULL DEFAULT 'DIRECTORIO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directorio_operaciones_district
  ON ventaspro_nuevo.directorio_operaciones (district);

CREATE INDEX IF NOT EXISTS idx_directorio_operaciones_name
  ON ventaspro_nuevo.directorio_operaciones (full_name);
