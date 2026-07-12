-- Formato PS de Claro como formato oficial de subida:
-- columnas que el archivo trae y la BD no tenía dónde guardar.
-- (SUB_STATUS_DATE y UNIT_ESN quedaron fuera a pedido: no se importan.)
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS contract_start_date date;  -- COMMIT_START_DATE: inicio del contrato
ALTER TABLE public.bans ADD COLUMN IF NOT EXISTS credit_class varchar;             -- CREDIT_CLASS: clase de crédito del BAN
