# Precios de planes y SOC

## Fuente y prioridad

La renta mensual de un suscriptor se resuelve en este orden:

1. Precio positivo ingresado manualmente.
2. Tango V2 usando el codigo normalizado para consulta.
3. Catalogo historico `public.plan_rate_catalog`, cargado desde `plan_rates.CSV`.

El catalogo es respaldo para planes antiguos. No reemplaza la renta vigente que
devuelve Tango V2 ni modifica automaticamente una renta positiva ya guardada.

## Codigo comercial

- `plan` conserva el SOC visible/original recibido en el archivo.
- `price_code` puede ser una version normalizada para Tango. Ejemplo: `A8842`
  se consulta en Tango como `A884`, porque el sufijo `2` expresa contrato de
  dos anos.
- Para el catalogo se intenta primero el SOC original (`A8842`) y despues el
  codigo normalizado (`A884`). Esto evita perder la tarifa especifica cuando
  existe una fila exacta por contrato.
- Los SOC moviles como `BREDP1`, `BREDP2`, etc. se usan exactos; no se les
  elimina el sufijo porque representa la estructura comercial por lineas.

## Renta cero o vacia

Una renta `0` o vacia significa que no hay precio util disponible. No se guarda
como `$0.00`, no reemplaza una renta existente y no se muestra como monto
comercial.

## Importador masivo

El importador no consulta Tango por miles de filas. Si el archivo no trae una
renta positiva y el suscriptor actual tampoco tiene una renta positiva, consulta
el catalogo local por SOC. Si no existe coincidencia positiva, deja el precio
sin valor.

Para ejecutar una carga historica de precios ya existentes se requiere una
simulacion previa. La carga del catalogo no actualiza `public.subscribers`.
La aplicacion historica controlada exige una cantidad aprobada: `node
backend/scripts/apply-plan-rate-backfill.mjs --apply --expect 9`.

## Operacion y reversa

- Migracion: `backend/migrations/2026-07-24-plan-rate-catalog.sql`.
- Carga: `node backend/scripts/import-plan-rates.mjs <archivo> [--dry-run]`.
- Cobertura sin escribir suscriptores:
  `node backend/scripts/preview-plan-rate-coverage.mjs`.
- El catalogo se puede recargar desde el mismo CSV; cada SOC se actualiza de
  forma idempotente y conserva el archivo de origen.
