CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.motor_comercial_reglas_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL UNIQUE NOT NULL,
  dominio TEXT NOT NULL,
  estado_publicacion TEXT NOT NULL CHECK (estado_publicacion IN ('borrador','validada','aprobada','vigente','reemplazada','archivada')),
  normalizador_version TEXT NOT NULL,
  fuentes_manifest_sha256 CHAR(64) NOT NULL,
  reglas_manifest_sha256 CHAR(64) NOT NULL,
  version_anterior_id UUID NULL REFERENCES public.motor_comercial_reglas_versiones(id),
  resumen JSONB NOT NULL DEFAULT '{}',
  creada_por TEXT NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada_por TEXT NULL,
  aprobada_en TIMESTAMPTZ NULL,
  publicada_por TEXT NULL,
  publicada_en TIMESTAMPTZ NULL,
  reemplazada_en TIMESTAMPTZ NULL,
  UNIQUE (dominio, fuentes_manifest_sha256, reglas_manifest_sha256, normalizador_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS motor_comercial_reglas_una_vigente_idx
  ON public.motor_comercial_reglas_versiones (dominio)
  WHERE estado_publicacion = 'vigente';

CREATE TABLE IF NOT EXISTS public.motor_comercial_reglas_fuentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.motor_comercial_reglas_versiones(id),
  fuente_comercial_id TEXT NULL,
  familia TEXT NULL,
  nombre_original TEXT NOT NULL,
  ruta_relativa TEXT NULL,
  sha256 CHAR(64) NOT NULL,
  mime_type TEXT NULL,
  bytes BIGINT NULL,
  vigencia_desde DATE NULL,
  vigencia_hasta DATE NULL,
  vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion',
  pagina_inicio INTEGER NULL,
  pagina_fin INTEGER NULL,
  seccion_original TEXT NULL,
  metadatos JSONB NOT NULL DEFAULT '{}',
  texto_extraido TEXT NULL
);

CREATE TABLE IF NOT EXISTS public.motor_comercial_reglas_compuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.motor_comercial_reglas_versiones(id),
  identidad_comercial TEXT NOT NULL,
  accion_version TEXT NOT NULL CHECK (accion_version IN ('nuevo','modifica','reemplaza','vence','sin_cambio')),
  version_anterior_regla_id UUID NULL REFERENCES public.motor_comercial_reglas_compuestas(id),
  beneficio_regla_id TEXT NULL,
  beneficio JSONB NOT NULL,
  terminos_vinculados JSONB NOT NULL DEFAULT '[]',
  condiciones JSONB NOT NULL DEFAULT '{}',
  elegibilidad JSONB NOT NULL DEFAULT '{}',
  compatibilidad TEXT NOT NULL DEFAULT 'no_determinado',
  limite JSONB NULL,
  vigencia_desde DATE NULL,
  vigencia_hasta DATE NULL,
  estado_confianza TEXT NOT NULL,
  estado_publicacion TEXT NOT NULL,
  autoaplica BOOLEAN NOT NULL DEFAULT false,
  fuente_versionada_id UUID NULL REFERENCES public.motor_comercial_reglas_fuentes(id),
  fuente_comercial_id TEXT NULL,
  fuente_sha256 CHAR(64) NULL,
  fuente_pagina INTEGER NULL,
  fuente_seccion TEXT NULL,
  contrato JSONB NOT NULL,
  contrato_sha256 CHAR(64) NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, identidad_comercial)
);

CREATE INDEX IF NOT EXISTS motor_comercial_reglas_compuestas_identidad_idx
  ON public.motor_comercial_reglas_compuestas (version_id, identidad_comercial);

CREATE TABLE IF NOT EXISTS public.motor_comercial_reglas_terminos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regla_compuesta_id UUID NOT NULL REFERENCES public.motor_comercial_reglas_compuestas(id),
  llave_comercial TEXT NOT NULL,
  codigo TEXT NULL,
  nombre TEXT NOT NULL,
  pagina INTEGER NULL,
  estado_confianza TEXT NOT NULL,
  condiciones JSONB NOT NULL DEFAULT '{}',
  termino_snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public.motor_comercial_reglas_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.motor_comercial_reglas_versiones(id),
  regla_compuesta_id UUID NULL REFERENCES public.motor_comercial_reglas_compuestas(id),
  estado_anterior TEXT NULL,
  estado_nuevo TEXT NOT NULL,
  accion_version TEXT NULL CHECK (accion_version IS NULL OR accion_version IN ('nuevo','modifica','reemplaza','vence','sin_cambio')),
  actor TEXT NOT NULL,
  motivo TEXT NULL,
  detalle JSONB NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
