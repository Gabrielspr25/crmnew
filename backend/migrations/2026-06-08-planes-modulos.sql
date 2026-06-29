-- Migration: 2026-06-08-planes-modulos.sql
-- Tablas para páginas de planes dinámicas (Fijos, Móviles, Inalámbrico)

CREATE TABLE IF NOT EXISTS planes_modulos (
  id            SERIAL PRIMARY KEY,
  pagina        VARCHAR(30)   NOT NULL,           -- 'fijos' | 'moviles' | 'inalambrico'
  seccion_key   VARCHAR(80)   NOT NULL,           -- clave única dentro de la página
  titulo        VARCHAR(300)  NOT NULL,
  subtitulo     VARCHAR(300),
  descripcion   TEXT,
  orden         INTEGER       DEFAULT 0,
  activo        BOOLEAN       DEFAULT true,
  tipo          VARCHAR(50)   NOT NULL DEFAULT 'tabla', -- 'tabla' | 'multilinea' | 'inalambrico' | 'iot'
  contenido     JSONB         NOT NULL DEFAULT '{}',
  vigencia_desde DATE,
  vigencia_hasta DATE,
  boletin_ref   VARCHAR(300),
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_by    VARCHAR(100),
  UNIQUE(pagina, seccion_key)
);

CREATE INDEX IF NOT EXISTS idx_planes_modulos_pagina
  ON planes_modulos(pagina, activo, orden);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION fn_set_planes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planes_modulos_updated ON planes_modulos;
CREATE TRIGGER trg_planes_modulos_updated
  BEFORE UPDATE ON planes_modulos
  FOR EACH ROW EXECUTE FUNCTION fn_set_planes_updated_at();

-- GRANTS — usuario de app (ajustar si el user de producción es diferente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON planes_modulos TO crm_user;
    GRANT USAGE, SELECT ON SEQUENCE planes_modulos_id_seq TO crm_user;
  END IF;
END
$$;
