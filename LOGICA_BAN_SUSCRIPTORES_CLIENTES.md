# Logica BAN, suscriptores y clientes

Este documento resume la logica real encontrada en el codigo local al
2026-06-23.

## Entrada productiva

Produccion usa `server-FINAL.js`. Ese archivo importa las rutas de suscriptores
desde `src/backend/routes/subscriberRoutes.js`.

Endpoints relevantes:

- `GET /api/subscribers`
- `POST /api/subscribers`
- `PUT /api/subscribers/:id`
- `PUT /api/subscribers/:id/cancel`
- `PUT /api/subscribers/:id/reactivate`
- `PUT /api/subscribers/:id/no-renueva-ahora`
- `PUT /api/subscribers/:id/pending-renewal`
- `PUT /api/subscribers/:id/renewal`
- `POST /api/subscribers/extract-image`
- `POST /api/subscribers/paste-sync`

## Paste sync por BAN

Funcion fuente: `pasteSync` en
`src/backend/controllers/subscriberController.js`.

Entrada aceptada:

- `ban_id` o `ban_number`.
- `clipboard_text` o `subscribers`.
- `dry_run`, por defecto `true`.

Validaciones:

- Si no llega `ban_id` ni `ban_number`, responde error.
- Si no llega texto ni filas estructuradas, responde error.
- Busca el BAN en tabla `bans`; si no existe, responde `notFound`.
- La confirmacion real solo escribe si `dry_run=false`, no hay filas invalidas
  y no hay conflictos con otro BAN.
- Las escrituras corren dentro de transaccion con `BEGIN`, `COMMIT` y
  `ROLLBACK` ante error.

## Parseo de subscriber list

Fuente: `parseClipboardSubscribers` en
`src/backend/controllers/subscriberController.js`.

Reglas confirmadas:

- Ignora filas cuyo texto empieza por `100-`.
- Normaliza telefono a formato `NNN-NNN-NNNN`.
- Intenta leer formatos inline o columnas separadas por tabs/espacios.
- Deduplica por telefono dentro del mismo paste y conserva la ultima ocurrencia.
- Marca warning en filas anteriores duplicadas.
- Una fila sin telefono o sin estado normalizado queda invalida.

Estados aceptados por el flujo confirmado:

- `Active`, `Activo` y variantes OCR comunes -> `activo`.
- `Canceled`, `Cancelled`, `Cancelado` -> `cancelado`.
- `Suspended` existe en partes del codigo OCR, pero en `pasteSync` no debe
  asumirse como alta normal; cuando aparece en ramas internas se evita tocar CRM
  o se inserta como activo con warning segun el caso.
- Estados vacios o no reconocidos bloquean la fila como invalida.

## Conflictos por telefono en otro BAN

El flujo compara telefonos normalizados contra `subscribers` de otros BANs:

- Si el telefono existe en otro BAN, incrementa `conflicts_other_ban`.
- En preview la accion queda `conflicto_otro_ban`.
- Con conflictos, `dry_run=false` no escribe cambios.
- Si aun asi salta constraint `subscribers_phone_norm_uniq`, el backend devuelve
  error indicando que hay telefonos en otro BAN.

## Acciones calculadas

Para cada fila valida:

- Si el telefono no existe en el BAN y no hay conflicto: `insertar`.
- Si existe y entra `cancelado`: `cancelar`, salvo que ya estuviera cancelado.
- Si existe cancelado y entra activo: `reactivar`.
- Si existe activo y cambia plan o mensualidad: `actualizar`.
- Si no cambia nada: `sin_cambios`.
- Si el subscriber empieza con `100-`: `ignorada`.
- Si falta telefono o status: `invalida`.

## Escrituras reales

Cuando `dry_run=false` y no hay bloqueos:

- `cancelar` actualiza `subscribers.status = 'cancelado'`.
- `cancelar` pone `cancel_reason = 'Cancelado via pegado masivo'`.
- `reactivar` o `actualizar` pone `status` activo salvo que la fila venga
  cancelada.
- Si se reactiva, limpia `cancel_reason`.
- Inserciones crean `subscribers` con `ban_id`, `phone`, `plan`,
  `monthly_value`, `status`, `cancel_reason`, `created_at` y `updated_at`.

## Precio mensual

Fuente: `resolveMonthlyValue`.

Orden real confirmado:

1. Match exacto en `plans.code` o `plans.alpha_code`.
2. Match similar local usando `LIKE`.
3. Si no encuentra precio local, devuelve `null`.

Nota importante: el fallback a `tipoplan`/BD legacy esta eliminado en el codigo
actual. Esto difiere de reglas anteriores que mencionaban Tango `tipoplan`.

## Clientes activos y cancelados

Fuente: `src/backend/controllers/clientController.js`.

Cliente activo:

- Nombre valido.
- Al menos un BAN activo.
- El BAN activo no tiene suscriptores, o tiene al menos un suscriptor cuyo
  status no este en:
  `cancelado`, `cancelled`, `c`, `inactivo`, `inactive`, `no_renueva_ahora`.
- No esta en seguimiento activo.

Cliente cancelado:

- Nombre valido.
- Tiene al menos un BAN.
- No cumple la relacion activa anterior.

Conteos relevantes:

- `active_ban_count`: BANs con status `a`, `activo` o `active`.
- `cancelled_ban_count`: BANs con status `c`, `cancelado`, `cancelled`,
  `inactivo` o `inactive`.
- `active_subscriber_count`: suscriptores no cancelados/inactivos.
- `subscriber_count`: todos los suscriptores del cliente.

## UI donde se usa

- `/suscriptores-ban`: pantalla para indicar BAN, pegar texto o subir imagen,
  previsualizar y confirmar sync.
- Ficha de cliente en `Clients.tsx`: abre modal de paste-sync por BAN y, tras
  sincronizar, refresca el cliente.
- La UI cambia a subtab de canceladas si el sync marco cancelaciones; cambia a
  activas si reactivo lineas.

## Estadisticas devueltas

`pasteSync` devuelve:

- `total_lines`
- `valid_rows`
- `ignored_100_prefix`
- `invalid_lines`
- `duplicated_in_paste`
- `conflicts_other_ban`
- `inserted`
- `updated`
- `canceled`
- `deleted`
- `unchanged`
- `set_active`
- `set_cancelled`
- `price_not_found`

## Ejemplo minimo de payload

```json
{
  "ban_number": "811686109",
  "clipboard_text": "787-517-8753    N    Active    ISP_EMP1",
  "dry_run": true
}
```

Para escribir:

```json
{
  "ban_number": "811686109",
  "clipboard_text": "787-517-8753    N    Active    ISP_EMP1",
  "dry_run": false
}
```

## Riesgos si se rehace el sistema

- No perder la llave operacional `telefono + BAN` para el flujo de paste-sync.
- No permitir que una linea se mueva silenciosamente a otro BAN.
- No tratar cancelados como activos en conteos de cliente.
- No volver a introducir `tipoplan`/legacy como fuente directa de comisiones o
  precios sin una decision explicita.
- Mantener previsualizacion antes de escritura real.
- Mantener transaccion para cambios masivos.
