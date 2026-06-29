-- ============================================================
-- Migración: Lista de Precios de Equipos (Claro Business)
-- Fecha: 2026-06-07
-- Descripción: Tablas para almacenar y versionar la lista de
--              precios de equipos PYMES/CORP (4 tabs del Excel)
-- Ejecutar: psql -U crm_user -d crm_pro -f este_archivo.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. HISTORIAL DE UPLOADS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipos_uploads (
  id              SERIAL PRIMARY KEY,
  nombre_archivo  VARCHAR(255) NOT NULL,
  subido_por      VARCHAR(100),                       -- username del admin
  fecha_subida    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vigencia_inicio DATE,
  vigencia_fin    DATE,
  total_items     INTEGER DEFAULT 0,
  notas           TEXT
);

-- ─────────────────────────────────────────────
-- 2. CATÁLOGO DE EQUIPOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipos_lista (
  id                SERIAL PRIMARY KEY,
  upload_id         INTEGER REFERENCES equipos_uploads(id) ON DELETE SET NULL,
  item_code         VARCHAR(20)  NOT NULL,             -- ej: 33750H
  sap_code          VARCHAR(20),                       -- número SAP
  modelo            VARCHAR(255) NOT NULL,
  marca             VARCHAR(50)  NOT NULL,             -- samsung | apple | motorola | etc.
  categoria         VARCHAR(30)  NOT NULL,             -- celular | modem | tablet | accesorio | pospago
  subcategoria      VARCHAR(100),                      -- ej: Samsung S-Series, Audio Apple
  precio_regular    NUMERIC(10,2),
  fuera_portafolio  BOOLEAN DEFAULT FALSE,             -- tiene * en el Excel
  activo            BOOLEAN DEFAULT TRUE,
  colores           TEXT[],                            -- array de colores agrupados
  codigos_colores   TEXT[],                            -- item codes de los colores (ej: {33750H,33751H,33752H})
  creado_en         TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_equipos_lista_item_code  ON equipos_lista(item_code);
CREATE INDEX IF NOT EXISTS idx_equipos_lista_marca       ON equipos_lista(marca);
CREATE INDEX IF NOT EXISTS idx_equipos_lista_categoria   ON equipos_lista(categoria);
CREATE INDEX IF NOT EXISTS idx_equipos_lista_activo      ON equipos_lista(activo);

-- ─────────────────────────────────────────────
-- 3. MENSUALIDADES (Tab 1: celulares 20/24/30/36m
--                  Tab 2: modems/tablets 12/24/30/36m
--                  Tab 4: accesorios 3/6/12/24m)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipos_mensualidades (
  id         SERIAL PRIMARY KEY,
  equipo_id  INTEGER NOT NULL REFERENCES equipos_lista(id) ON DELETE CASCADE,
  meses      SMALLINT NOT NULL,                        -- 3, 6, 12, 20, 24, 30, 36
  monto      NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equipos_mensualidades_equipo ON equipos_mensualidades(equipo_id);

-- ─────────────────────────────────────────────
-- 4. PRECIOS POSPAGO (Tab 3: precio varía por plan)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipos_pospago (
  id          SERIAL PRIMARY KEY,
  equipo_id   INTEGER NOT NULL REFERENCES equipos_lista(id) ON DELETE CASCADE,
  plan_precio NUMERIC(8,2) NOT NULL,                   -- ej: 9.99, 14.99 … 99.99
  monto       NUMERIC(10,2) NOT NULL                   -- precio del equipo en ese plan (0 = GRATIS)
);

CREATE INDEX IF NOT EXISTS idx_equipos_pospago_equipo ON equipos_pospago(equipo_id);

-- ─────────────────────────────────────────────
-- 5. VISTA CONVENIENTE para el API
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_equipos_vigentes AS
SELECT
  e.*,
  m.mensualidades,
  p.pospago_precios
FROM equipos_lista e
LEFT JOIN LATERAL (
  SELECT json_agg(
    json_build_object('meses', em.meses, 'monto', em.monto)
    ORDER BY em.meses
  ) AS mensualidades
  FROM equipos_mensualidades em
  WHERE em.equipo_id = e.id
) m ON TRUE
LEFT JOIN LATERAL (
  SELECT json_agg(
    json_build_object('plan', ep.plan_precio, 'monto', ep.monto)
    ORDER BY ep.plan_precio
  ) AS pospago_precios
  FROM equipos_pospago ep
  WHERE ep.equipo_id = e.id
) p ON TRUE
WHERE e.activo = TRUE
ORDER BY e.categoria, e.marca, e.modelo;

-- ─────────────────────────────────────────────
-- Listo. Verificar con:
--   \dt equipos_*
--   \dv v_equipos_vigentes
-- ─────────────────────────────────────────────
