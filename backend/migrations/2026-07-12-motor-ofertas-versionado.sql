-- Motor versionado de ofertas para newcrm.
-- Requiere que 2026-06-07-equipos-lista.sql ya exista.
-- Esta migracion se crea para revision. No ejecutarla sin backup y autorizacion.

BEGIN;

CREATE TABLE IF NOT EXISTS public.motor_ofertas_versiones (
  id UUID PRIMARY KEY,
  numero BIGSERIAL UNIQUE NOT NULL,
  dominio TEXT NOT NULL DEFAULT 'movil_equipos',
  estado TEXT NOT NULL,
  normalizador_version TEXT NOT NULL,
  fuentes_manifest_sha256 CHAR(64) NOT NULL,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  reemplaza_version_id UUID
    REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  creada_por TEXT NOT NULL,
  aprobada_por TEXT,
  activada_por TEXT,
  archivada_por TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aprobada_en TIMESTAMPTZ,
  activada_en TIMESTAMPTZ,
  reemplazada_en TIMESTAMPTZ,
  archivada_en TIMESTAMPTZ,
  CONSTRAINT motor_ofertas_versiones_estado_chk CHECK (estado IN (
    'borrador',
    'pendiente_revision',
    'aprobada',
    'vigente',
    'reemplazada',
    'archivada'
  )),
  CONSTRAINT motor_ofertas_versiones_identidad_uk UNIQUE (
    dominio,
    fuentes_manifest_sha256,
    normalizador_version
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS motor_ofertas_versiones_vigente_uk
  ON public.motor_ofertas_versiones (dominio)
  WHERE estado = 'vigente';

CREATE TABLE IF NOT EXISTS public.motor_ofertas_fuentes (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL
    REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  nombre_archivado TEXT NOT NULL,
  ruta_relativa TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  mime_type TEXT NOT NULL,
  bytes BIGINT NOT NULL CHECK (bytes >= 0),
  vigencia_desde DATE,
  vigencia_hasta DATE,
  vigencia_documental TEXT NOT NULL DEFAULT 'pendiente_confirmacion',
  hoja TEXT,
  pagina INTEGER,
  fila_desde INTEGER,
  fila_hasta INTEGER,
  metadatos JSONB NOT NULL DEFAULT '{}'::jsonb,
  texto_extraido TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_fuentes_tipo_chk CHECK (tipo IN (
    'tabla_financiamiento',
    'lista_precios',
    'boletin',
    'seguro',
    'aprobacion_negocio',
    'otra'
  )),
  CONSTRAINT motor_ofertas_fuentes_vigencia_chk CHECK (vigencia_documental IN (
    'vigente',
    'vencida_pendiente_reemplazo',
    'vencida',
    'futura',
    'pendiente_confirmacion'
  )),
  CONSTRAINT motor_ofertas_fuentes_hash_uk UNIQUE (version_id, tipo, sha256)
);

CREATE TABLE IF NOT EXISTS public.motor_ofertas (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL
    REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  oferta_key TEXT NOT NULL,
  nombre TEXT NOT NULL,
  estado_comercial TEXT NOT NULL,
  vigencia_documental TEXT NOT NULL,
  vigencia_desde DATE,
  vigencia_hasta DATE,
  tipos_plan TEXT[] NOT NULL DEFAULT '{}',
  familias TEXT[] NOT NULL DEFAULT '{}',
  eventos TEXT[] NOT NULL DEFAULT '{}',
  plazos SMALLINT[] NOT NULL DEFAULT '{}',
  plan_monto_minimo NUMERIC(10,2),
  plan_monto_maximo NUMERIC(10,2),
  fuente_principal_id UUID
    REFERENCES public.motor_ofertas_fuentes(id) ON DELETE RESTRICT,
  fuente_hoja TEXT,
  fuente_fila INTEGER,
  contrato JSONB NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_estado_comercial_chk CHECK (estado_comercial IN (
    'confirmada',
    'confirmada_parcial',
    'pendiente_fuente',
    'pendiente_vigencia',
    'pendiente_negocio',
    'contradiccion',
    'implementacion_referencia',
    'archivada'
  )),
  CONSTRAINT motor_ofertas_vigencia_documental_chk CHECK (vigencia_documental IN (
    'vigente',
    'vencida_pendiente_reemplazo',
    'vencida',
    'futura',
    'pendiente_confirmacion'
  )),
  CONSTRAINT motor_ofertas_oferta_version_uk UNIQUE (version_id, oferta_key)
);

CREATE INDEX IF NOT EXISTS motor_ofertas_busqueda_idx
  ON public.motor_ofertas (version_id, estado_comercial, plan_monto_minimo);

CREATE INDEX IF NOT EXISTS motor_ofertas_tipos_plan_gin
  ON public.motor_ofertas USING GIN (tipos_plan);

CREATE INDEX IF NOT EXISTS motor_ofertas_eventos_gin
  ON public.motor_ofertas USING GIN (eventos);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_equipos (
  id UUID PRIMARY KEY,
  oferta_id UUID NOT NULL
    REFERENCES public.motor_ofertas(id) ON DELETE RESTRICT,
  equipo_lista_id INTEGER REFERENCES public.equipos_lista(id) ON DELETE SET NULL,
  equipo_key TEXT NOT NULL,
  modelo_comercial TEXT NOT NULL,
  modelo_oficial TEXT,
  sku_sif TEXT,
  sap TEXT,
  precio_regular NUMERIC(10,2),
  plazo SMALLINT NOT NULL CHECK (plazo > 0),
  pago_mensual NUMERIC(10,2),
  descuento NUMERIC(10,2),
  credito NUMERIC(10,2),
  beneficio_tipo TEXT,
  fuente_precio_id UUID
    REFERENCES public.motor_ofertas_fuentes(id) ON DELETE RESTRICT,
  fuente_regla_id UUID
    REFERENCES public.motor_ofertas_fuentes(id) ON DELETE RESTRICT,
  coincidencia TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_equipos_coincidencia_chk CHECK (coincidencia IN (
    'exacta',
    'equivalencia_aprobada',
    'pendiente'
  )),
  CONSTRAINT motor_ofertas_equipos_oferta_uk UNIQUE (
    oferta_id,
    equipo_key,
    plazo
  )
);

CREATE INDEX IF NOT EXISTS motor_ofertas_equipos_sku_idx
  ON public.motor_ofertas_equipos (sku_sif);

CREATE TABLE IF NOT EXISTS public.motor_ofertas_contradicciones (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL
    REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  oferta_id UUID
    REFERENCES public.motor_ofertas(id) ON DELETE RESTRICT,
  codigo TEXT NOT NULL,
  severidad TEXT NOT NULL,
  bloqueante BOOLEAN NOT NULL DEFAULT FALSE,
  estado TEXT NOT NULL DEFAULT 'abierta',
  detalle TEXT NOT NULL,
  fuentes_enfrentadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolucion JSONB,
  creada_por TEXT NOT NULL,
  resuelta_por TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en TIMESTAMPTZ,
  CONSTRAINT motor_ofertas_contradicciones_severidad_chk CHECK (severidad IN (
    'info',
    'warning',
    'error'
  )),
  CONSTRAINT motor_ofertas_contradicciones_estado_chk CHECK (estado IN (
    'abierta',
    'resuelta',
    'descartada'
  ))
);

CREATE INDEX IF NOT EXISTS motor_ofertas_contradicciones_abiertas_idx
  ON public.motor_ofertas_contradicciones (version_id, bloqueante)
  WHERE estado = 'abierta';

CREATE TABLE IF NOT EXISTS public.motor_ofertas_historial (
  id BIGSERIAL PRIMARY KEY,
  version_id UUID NOT NULL
    REFERENCES public.motor_ofertas_versiones(id) ON DELETE RESTRICT,
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  actor TEXT NOT NULL,
  motivo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motor_ofertas_historial_estado_anterior_chk CHECK (
    estado_anterior IS NULL OR estado_anterior IN (
      'borrador',
      'pendiente_revision',
      'aprobada',
      'vigente',
      'reemplazada',
      'archivada'
    )
  ),
  CONSTRAINT motor_ofertas_historial_estado_nuevo_chk CHECK (estado_nuevo IN (
    'borrador',
    'pendiente_revision',
    'aprobada',
    'vigente',
    'reemplazada',
    'archivada'
  ))
);

CREATE OR REPLACE FUNCTION public.motor_ofertas_historial_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'motor_ofertas_historial es append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_motor_ofertas_historial_append_only
  ON public.motor_ofertas_historial;

CREATE TRIGGER trg_motor_ofertas_historial_append_only
  BEFORE UPDATE OR DELETE ON public.motor_ofertas_historial
  FOR EACH ROW
  EXECUTE FUNCTION public.motor_ofertas_historial_append_only();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT, UPDATE
      ON public.motor_ofertas_versiones,
         public.motor_ofertas_contradicciones
      TO crm_user;

    GRANT SELECT, INSERT
      ON public.motor_ofertas_fuentes,
         public.motor_ofertas,
         public.motor_ofertas_equipos,
         public.motor_ofertas_historial
      TO crm_user;

    GRANT USAGE, SELECT
      ON SEQUENCE public.motor_ofertas_versiones_numero_seq,
                  public.motor_ofertas_historial_id_seq
      TO crm_user;
  END IF;
END;
$$;

COMMIT;
