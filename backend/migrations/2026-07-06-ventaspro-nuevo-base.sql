CREATE SCHEMA IF NOT EXISTS ventaspro_nuevo;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category_id UUID REFERENCES ventaspro_nuevo.categories(id) ON DELETE SET NULL,
  kind VARCHAR(60),
  income_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.product_step_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES ventaspro_nuevo.products(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (product_id, step_order)
);

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.goals (
  id BIGSERIAL PRIMARY KEY,
  scope VARCHAR(40) NOT NULL,
  salesperson VARCHAR(160),
  product_key VARCHAR(80) NOT NULL,
  month DATE NOT NULL,
  target_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS goals_unique_salesperson
  ON ventaspro_nuevo.goals (scope, salesperson, product_key, month)
  WHERE salesperson IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS goals_unique_business
  ON ventaspro_nuevo.goals (scope, product_key, month)
  WHERE salesperson IS NULL;

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tango_venta_id TEXT UNIQUE,
  client_id UUID,
  ban_number TEXT,
  phone TEXT,
  product_key VARCHAR(80),
  ventatipo_nombre TEXT,
  monthly_value NUMERIC(12,2),
  company_commission NUMERIC(12,2),
  vendor_commission NUMERIC(12,2),
  vendor_name TEXT,
  sale_date DATE,
  review_reason TEXT,
  raw_payload JSONB,
  synced BOOLEAN NOT NULL DEFAULT false,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP,
  paid_by TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.comparativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  name TEXT,
  current_total NUMERIC(12,2),
  offer_total NUMERIC(12,2),
  lines JSONB,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventaspro_nuevo.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_name TEXT,
  type TEXT,
  detail TEXT,
  entity TEXT,
  ip_address TEXT,
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO ventaspro_nuevo.categories (name, description, sort_order)
VALUES
  ('Móvil', 'Líneas móviles nuevas y renovaciones', 10),
  ('Fijo', 'Internet, telefonía fija y paquetes', 20),
  ('TV', 'Claro TV y entretenimiento', 30),
  ('Cloud / MPLS', 'Servicios empresariales adicionales', 40)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

WITH cats AS (
  SELECT id, name FROM ventaspro_nuevo.categories
),
seed_products(key, name, category_name, kind, income_value, sort_order) AS (
  VALUES
    ('movil_new', 'Móvil nueva', 'Móvil', 'movil', 59.99, 10),
    ('movil_ren', 'Móvil renovación', 'Móvil', 'movil', 59.99, 20),
    ('fijo_new', 'Fijo nuevo', 'Fijo', 'fijo', 174.99, 30),
    ('fijo_ren', 'Fijo renovación', 'Fijo', 'fijo', 174.99, 40),
    ('claro_tv', 'Claro TV', 'TV', 'tv', 49.99, 50),
    ('cloud', 'Cloud', 'Cloud / MPLS', 'cloud', 39.99, 60),
    ('mpls', 'MPLS', 'Cloud / MPLS', 'mpls', 199.99, 70)
)
INSERT INTO ventaspro_nuevo.products (key, name, category_id, kind, income_value, sort_order)
SELECT sp.key, sp.name, cats.id, sp.kind, sp.income_value, sp.sort_order
FROM seed_products sp
JOIN cats ON cats.name = sp.category_name
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    category_id = EXCLUDED.category_id,
    kind = EXCLUDED.kind,
    income_value = EXCLUDED.income_value,
    sort_order = EXCLUDED.sort_order,
    active = true;

WITH steps(product_key, step_order, name) AS (
  VALUES
    ('movil_new', 1, 'Contactar cliente'),
    ('movil_new', 2, 'Validar necesidad'),
    ('movil_new', 3, 'Preparar propuesta'),
    ('movil_new', 4, 'Enviar propuesta'),
    ('movil_new', 5, 'Cerrar seguimiento'),
    ('movil_ren', 1, 'Contactar cliente'),
    ('movil_ren', 2, 'Validar renovación'),
    ('movil_ren', 3, 'Preparar propuesta'),
    ('movil_ren', 4, 'Enviar propuesta'),
    ('movil_ren', 5, 'Cerrar seguimiento'),
    ('fijo_new', 1, 'Contactar cliente'),
    ('fijo_new', 2, 'Validar dirección y tecnología'),
    ('fijo_new', 3, 'Preparar propuesta'),
    ('fijo_new', 4, 'Enviar propuesta'),
    ('fijo_new', 5, 'Cerrar seguimiento'),
    ('fijo_ren', 1, 'Contactar cliente'),
    ('fijo_ren', 2, 'Validar servicio actual'),
    ('fijo_ren', 3, 'Preparar propuesta'),
    ('fijo_ren', 4, 'Enviar propuesta'),
    ('fijo_ren', 5, 'Cerrar seguimiento'),
    ('claro_tv', 1, 'Contactar cliente'),
    ('claro_tv', 2, 'Validar paquete TV'),
    ('claro_tv', 3, 'Preparar propuesta'),
    ('claro_tv', 4, 'Cerrar seguimiento'),
    ('cloud', 1, 'Contactar cliente'),
    ('cloud', 2, 'Validar servicio'),
    ('cloud', 3, 'Preparar propuesta'),
    ('cloud', 4, 'Cerrar seguimiento'),
    ('mpls', 1, 'Contactar cliente'),
    ('mpls', 2, 'Validar necesidad técnica'),
    ('mpls', 3, 'Preparar propuesta'),
    ('mpls', 4, 'Cerrar seguimiento')
)
INSERT INTO ventaspro_nuevo.product_step_templates (product_id, step_order, name)
SELECT p.id, s.step_order, s.name
FROM steps s
JOIN ventaspro_nuevo.products p ON p.key = s.product_key
ON CONFLICT (product_id, step_order) DO UPDATE
SET name = EXCLUDED.name,
    active = true;
