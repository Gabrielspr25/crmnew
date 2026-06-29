-- Migración: tabla de prospección (Google Places / OpenStreetMap).
-- Tabla APARTE de clients, para mapear después. Crear en PROD (no existía).
-- Ejecutar en public:  SET search_path TO public;  \i este_archivo.sql
CREATE TABLE IF NOT EXISTS public.prospectos (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE,
  name TEXT NOT NULL,
  company TEXT, email TEXT, phone TEXT, mobile TEXT, additional_phone TEXT,
  address TEXT, city TEXT, zip_code TEXT, tax_id TEXT,
  contact_person TEXT, owner_name TEXT, notes TEXT,
  website TEXT, redes JSONB,
  rubro TEXT, google_types TEXT[],
  rating NUMERIC(2,1), user_ratings_total INTEGER,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  google_maps_uri TEXT, business_status TEXT,
  source TEXT DEFAULT 'google_places',
  mapeado BOOLEAN DEFAULT FALSE, client_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospectos_city ON public.prospectos(city);
CREATE INDEX IF NOT EXISTS idx_prospectos_rubro ON public.prospectos(rubro);
CREATE INDEX IF NOT EXISTS idx_prospectos_mapeado ON public.prospectos(mapeado);
