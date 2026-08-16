CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.bases_informativas_publicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL UNIQUE NOT NULL,
  categoria TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador',
  version_etiqueta TEXT,
  fuente_comercial_id UUID REFERENCES public.fuentes_comerciales(id) ON DELETE RESTRICT,
  fuente_nombre TEXT NOT NULL,
  fuente_sha256 CHAR(64) NOT NULL,
  fecha_actualizacion_base DATE NOT NULL,
  extraccion_original JSONB NOT NULL DEFAULT '{}'::jsonb,
  registros_normalizados JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidatos_publicos JSONB NOT NULL DEFAULT '[]'::jsonb,
  modulos_generados JSONB NOT NULL DEFAULT '[]'::jsonb,
  contenido_excluido JSONB NOT NULL DEFAULT '[]'::jsonb,
  auditoria JSONB NOT NULL DEFAULT '{}'::jsonb,
  duplicados JSONB NOT NULL DEFAULT '[]'::jsonb,
  validacion JSONB NOT NULL DEFAULT '{}'::jsonb,
  diferencias JSONB NOT NULL DEFAULT '{}'::jsonb,
  cargada_por TEXT NOT NULL,
  cargada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  validada_por TEXT,
  validada_en TIMESTAMPTZ,
  aprobada_por TEXT,
  aprobada_en TIMESTAMPTZ,
  publicada_por TEXT,
  publicada_en TIMESTAMPTZ,
  reemplazada_en TIMESTAMPTZ,
  observaciones TEXT,
  CONSTRAINT bases_informativas_publicaciones_categoria_chk CHECK (categoria IN (
    'fijo',
    'claro_tv',
    'movil',
    'servicios',
    'inalambrico',
    'cloud'
  )),
  CONSTRAINT bases_informativas_publicaciones_estado_chk CHECK (estado IN (
    'borrador',
    'pendiente_validacion',
    'validada',
    'aprobada',
    'publicada',
    'reemplazada',
    'archivada'
  )),
  CONSTRAINT bases_informativas_publicaciones_hash_chk CHECK (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT bases_informativas_publicaciones_json_arrays_chk CHECK (
    jsonb_typeof(registros_normalizados) = 'array'
    AND jsonb_typeof(candidatos_publicos) = 'array'
    AND jsonb_typeof(modulos_generados) = 'array'
    AND jsonb_typeof(contenido_excluido) = 'array'
    AND jsonb_typeof(duplicados) = 'array'
  ),
  CONSTRAINT bases_informativas_publicaciones_json_objects_chk CHECK (
    jsonb_typeof(extraccion_original) = 'object'
    AND jsonb_typeof(auditoria) = 'object'
    AND jsonb_typeof(validacion) = 'object'
    AND jsonb_typeof(diferencias) = 'object'
  ),
  CONSTRAINT bases_informativas_publicaciones_validacion_fecha_chk CHECK (
    (validada_por IS NULL AND validada_en IS NULL)
    OR (validada_por IS NOT NULL AND validada_en IS NOT NULL)
  ),
  CONSTRAINT bases_informativas_publicaciones_aprobacion_fecha_chk CHECK (
    (aprobada_por IS NULL AND aprobada_en IS NULL)
    OR (aprobada_por IS NOT NULL AND aprobada_en IS NOT NULL)
  ),
  CONSTRAINT bases_informativas_publicaciones_publicacion_fecha_chk CHECK (
    (publicada_por IS NULL AND publicada_en IS NULL)
    OR (publicada_por IS NOT NULL AND publicada_en IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS bases_informativas_publicaciones_una_publicada_idx
  ON public.bases_informativas_publicaciones (categoria)
  WHERE estado = 'publicada';

CREATE INDEX IF NOT EXISTS bases_informativas_publicaciones_categoria_estado_idx
  ON public.bases_informativas_publicaciones (categoria, estado, numero DESC);

CREATE INDEX IF NOT EXISTS bases_informativas_publicaciones_fuente_idx
  ON public.bases_informativas_publicaciones (fuente_comercial_id);

CREATE INDEX IF NOT EXISTS bases_informativas_publicaciones_cargada_idx
  ON public.bases_informativas_publicaciones (cargada_en DESC, numero DESC);

CREATE OR REPLACE FUNCTION public.fn_bases_informativas_bloquear_aprobada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado IN ('aprobada', 'publicada', 'reemplazada', 'archivada')
     AND (
       OLD.fuente_comercial_id IS DISTINCT FROM NEW.fuente_comercial_id
       OR OLD.fuente_nombre IS DISTINCT FROM NEW.fuente_nombre
       OR OLD.fuente_sha256 IS DISTINCT FROM NEW.fuente_sha256
       OR OLD.extraccion_original IS DISTINCT FROM NEW.extraccion_original
       OR OLD.registros_normalizados IS DISTINCT FROM NEW.registros_normalizados
       OR OLD.candidatos_publicos IS DISTINCT FROM NEW.candidatos_publicos
       OR OLD.modulos_generados IS DISTINCT FROM NEW.modulos_generados
       OR OLD.contenido_excluido IS DISTINCT FROM NEW.contenido_excluido
       OR OLD.auditoria IS DISTINCT FROM NEW.auditoria
       OR OLD.duplicados IS DISTINCT FROM NEW.duplicados
       OR OLD.validacion IS DISTINCT FROM NEW.validacion
       OR OLD.diferencias IS DISTINCT FROM NEW.diferencias
     ) THEN
    RAISE EXCEPTION 'la base informativa aprobada queda congelada y no permite cambios comerciales'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bases_informativas_bloquear_aprobada
  ON public.bases_informativas_publicaciones;

CREATE TRIGGER trg_bases_informativas_bloquear_aprobada
  BEFORE UPDATE ON public.bases_informativas_publicaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bases_informativas_bloquear_aprobada();

CREATE OR REPLACE FUNCTION public.publicar_base_informativa(
  p_publicacion_id UUID,
  p_usuario TEXT
)
RETURNS public.bases_informativas_publicaciones
LANGUAGE plpgsql
AS $$
DECLARE
  v_publicacion public.bases_informativas_publicaciones%ROWTYPE;
  v_modulos JSONB;
  v_modulo JSONB;
  v_pagina TEXT;
  v_seccion_key TEXT;
  v_secciones_generadas TEXT[];
BEGIN
  SELECT *
    INTO v_publicacion
    FROM public.bases_informativas_publicaciones
   WHERE id = p_publicacion_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'base informativa no encontrada: %', p_publicacion_id
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bases_informativas_publicaciones:' || v_publicacion.categoria));

  IF v_publicacion.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'solo una base informativa aprobada puede publicarse; estado actual: %', v_publicacion.estado
      USING ERRCODE = 'P0001';
  END IF;

  v_pagina := CASE v_publicacion.categoria
    WHEN 'fijo' THEN 'fijos'
    WHEN 'claro_tv' THEN 'claro_tv'
    WHEN 'movil' THEN 'moviles'
    WHEN 'inalambrico' THEN 'inalambrico'
    WHEN 'servicios' THEN 'servicios'
    WHEN 'cloud' THEN 'cloud'
  END;

  v_modulos := v_publicacion.modulos_generados;

  IF jsonb_typeof(v_modulos) <> 'array' THEN
    RAISE EXCEPTION 'modulos_generados debe ser un arreglo JSON'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT NULLIF(value->>'seccion_key', '')), ARRAY[]::TEXT[])
    INTO v_secciones_generadas
    FROM jsonb_array_elements(v_modulos)
   WHERE NULLIF(value->>'seccion_key', '') IS NOT NULL;

  UPDATE public.bases_informativas_publicaciones
     SET estado = 'reemplazada',
         reemplazada_en = now()
   WHERE categoria = v_publicacion.categoria
     AND estado = 'publicada'
     AND id <> v_publicacion.id;

  UPDATE public.planes_modulos
     SET activo = false,
         updated_by = p_usuario
   WHERE pagina = v_pagina
     AND activo = true
     AND NOT (seccion_key = ANY(v_secciones_generadas));

  FOR v_modulo IN SELECT value FROM jsonb_array_elements(v_modulos)
  LOOP
    IF COALESCE(NULLIF(v_modulo->>'pagina', ''), v_pagina) <> v_pagina THEN
      RAISE EXCEPTION 'modulo % pertenece a pagina %, no a %',
        v_modulo->>'seccion_key',
        v_modulo->>'pagina',
        v_pagina
        USING ERRCODE = '22023';
    END IF;

    v_seccion_key := NULLIF(v_modulo->>'seccion_key', '');

    IF v_seccion_key IS NULL THEN
      RAISE EXCEPTION 'modulo candidato sin seccion_key: %', v_modulo
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.planes_modulos (
      pagina,
      seccion_key,
      titulo,
      subtitulo,
      descripcion,
      orden,
      activo,
      tipo,
      contenido,
      vigencia_desde,
      vigencia_hasta,
      boletin_ref,
      updated_by
    )
    VALUES (
      v_pagina,
      v_seccion_key,
      COALESCE(NULLIF(v_modulo->>'titulo', ''), v_seccion_key),
      NULLIF(v_modulo->>'subtitulo', ''),
      NULLIF(v_modulo->>'descripcion', ''),
      COALESCE((v_modulo->>'orden')::integer, 0),
      true,
      COALESCE(NULLIF(v_modulo->>'tipo', ''), 'tabla'),
      COALESCE(v_modulo->'contenido', '{}'::jsonb),
      NULLIF(v_modulo->>'vigencia_desde', '')::date,
      NULLIF(v_modulo->>'vigencia_hasta', '')::date,
      v_publicacion.fuente_nombre,
      p_usuario
    )
    ON CONFLICT (pagina, seccion_key) DO UPDATE
      SET titulo = EXCLUDED.titulo,
          subtitulo = EXCLUDED.subtitulo,
          descripcion = EXCLUDED.descripcion,
          orden = EXCLUDED.orden,
          activo = true,
          tipo = EXCLUDED.tipo,
          contenido = EXCLUDED.contenido,
          vigencia_desde = EXCLUDED.vigencia_desde,
          vigencia_hasta = EXCLUDED.vigencia_hasta,
          boletin_ref = EXCLUDED.boletin_ref,
          updated_by = EXCLUDED.updated_by;
  END LOOP;

  UPDATE public.bases_informativas_publicaciones
     SET estado = 'publicada',
         publicada_por = p_usuario,
         publicada_en = now()
   WHERE id = v_publicacion.id
   RETURNING * INTO v_publicacion;

  RETURN v_publicacion;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT, UPDATE ON public.bases_informativas_publicaciones TO crm_user;
    GRANT USAGE, SELECT ON SEQUENCE public.bases_informativas_publicaciones_numero_seq TO crm_user;
    GRANT EXECUTE ON FUNCTION public.publicar_base_informativa(UUID, TEXT) TO crm_user;
  END IF;
END
$$;
