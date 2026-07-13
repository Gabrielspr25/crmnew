# MVP motor de ofertas moviles

## Objetivo

Cerrar un recorrido local demostrable para ofertas moviles:

`2 Excel -> hash/archivo -> normalizacion -> preview -> aprobacion -> version vigente -> elegibles -> modal movil`

Seguro, fijo e Internet On-The-Go quedan fuera. No se hace deploy.

## Limites

- La administracion se integra dentro de `#/ofertas` en `newcrm`.
- No se crea otra pantalla administrativa.
- El motor usa rutas, handlers y servicios propios; no se mezcla con `planesRoutes.js`.
- `ofertas-proui` consume el motor solo desde la modal movil.
- Todos los endpoints exigen token CRM. Preview y aprobacion exigen permiso administrativo.
- La migracion se ejecuta solo contra una base local o de prueba comprobada, con URL sanitizada, snapshot previo y rollback de prueba.

## Entrada e identidad

El preview recibe en una sola peticion multipart:

- `tabla_financiamiento`;
- `lista_precios`.

Cada archivo se valida, archiva y hashea por separado. El manifiesto ordenado de ambos hashes, junto con dominio y version del normalizador, identifica una unica version idempotente.

Si falta un archivo, responde `422` y no persiste nada:

```json
{
  "error": "preview_incompleto",
  "archivos_faltantes": ["tabla_financiamiento", "lista_precios"]
}
```

## Endpoints

### `POST /api/motor-ofertas/preview`

Autenticado y administrativo. Archiva las dos fuentes, normaliza y persiste una version `pendiente_revision`. Devuelve fuentes, resumen, ofertas y contradicciones. Una identidad repetida reutiliza la version existente.

### `POST /api/motor-ofertas/aprobar`

Autenticado y administrativo. Bloquea contradicciones abiertas. Registra `pendiente_revision -> aprobada -> vigente` y reemplaza la vigente anterior dentro de una transaccion.

### `GET /api/motor-ofertas/version-vigente`

Autenticado. Devuelve version, vigencia documental, fuentes y resumen. Sin version responde `404 version_vigente_no_disponible`.

### `POST /api/motor-ofertas/elegibles`

Autenticado. Recibe `LineaMovil` y `contexto_ban`, validados con Zod. Devuelve solo combinaciones confirmadas de equipo y plazo, oferta, beneficio, validaciones, fuente y vigencia. Nunca devuelve el catalogo general.

## Admin Ofertas

Se agrega una seccion dentro del modulo `#/ofertas` existente con:

- selector para cada Excel;
- accion de preview;
- inventario y hash de fuentes;
- resumen de ofertas, equipos y contradicciones;
- contradicciones bloqueantes visibles;
- accion de aprobar deshabilitada cuando corresponda;
- version vigente visible.

## Portal y modal

`portal-auth.js` mantiene el token encapsulado y expone un getter en memoria para llamadas autorizadas. La modal de `oferta-const.html` transforma la linea activa al contrato `LineaMovil`, llama a `/api/motor-ofertas/elegibles` y renderiza exclusivamente la respuesta.

- Sin token: `401`.
- Sin permiso: `403`.
- Sin version vigente o sin elegibles: mensaje claro, sin fallback al catalogo local.
- Oferta vencida o pendiente: advertencia y sin aplicacion automatica.

## Pruebas y cierre

- TDD dirigido para archivo/manifiesto, handlers, rutas, elegibilidad y UI contractual.
- Prueba de integracion local con base aislada y ambos Excel.
- Snapshot y rollback de prueba documentados.
- Prueba visual desktop y movil con capturas.
- No ejecutar deploy.
