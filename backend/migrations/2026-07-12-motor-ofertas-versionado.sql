CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.motor_ofertas_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL UNIQUE NOT NULL,
  dominio TEXT NOT NULL DEFAULT 'movil_equipos',
  estado TEXT NOT NULL CHECK (estado IN ('borrador','pendiente_revision','aprobada','vigente','reemplazada','archivada')),
  normalizador_version TEXT NOT NULL,
  fuentes_manifest_sha256 CHAR(64) NOT NULL,
  resumen JSONB NOT NULL DEFAULT '{}',
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_fuentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id),
  tipo TEXT NOT NULL, nombre_original TEXT NOT NULL, sha256 CHAR(64) NOT NULL,
  vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion', metadatos JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id),
  oferta_key TEXT NOT NULL, vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion', contrato JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_equipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), oferta_id UUID NOT NULL REFERENCES public.motor_ofertas(id), snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_contradicciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id),
  codigo TEXT NOT NULL, bloqueante BOOLEAN NOT NULL DEFAULT true, estado TEXT NOT NULL DEFAULT 'abierta', detalle JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version_id UUID NOT NULL REFERENCES public.motor_ofertas_versiones(id),
  estado_anterior TEXT, estado_nuevo TEXT NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
