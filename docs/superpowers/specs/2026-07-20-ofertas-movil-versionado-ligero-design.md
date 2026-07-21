# Ofertas móviles con versionado ligero — Diseño

Fecha: 2026-07-20
Estado: aprobado por Gabriel (conversación del 2026-07-20)

## Problema

Las ofertas móviles del constructor (`Planes para web/oferta-const.html`) viven escritas a mano en `Planes para web/ofertas-data.js`, copiadas de la "Tabla Ofertas Financiamiento 9 al 22 de junio de 2026". Cuando llega un boletín nuevo nadie las actualiza automáticamente, y no existe control de vigencia: hoy se cotiza con datos vencidos sin ningún aviso.

La pestaña "Ofertas" de Admin Ofertas (`frontend/app.html`) es un placeholder vacío reservado justo para este flujo.

## Requisitos acordados

1. Un solo formato de Excel (estilo Tabla de Financiamiento) con equipos, precios y planes que cambian entre versiones.
2. Cada Excel nuevo **reemplaza completo** al anterior. Solo una versión activa a la vez; las anteriores quedan en historial. Nada se borra.
3. Si la vigencia pasó y no se ha subido el reemplazo, las ofertas **siguen activas con aviso** visible ("Boletín vencido el X — esperando reemplazo") en el constructor y en Admin Ofertas.
4. Flujo de subida: **revisar resumen y confirmar** antes de publicar (igual que Planes Fijos).
5. El constructor se usa **solo desde el CRM** con sesión activa, así que puede leer las ofertas en vivo del backend.

## Decisión de enfoque

Versionado ligero conectado (Opción A). Se descartó completar ahora el motor versionado completo (spec `docs/motor-ofertas/03`) por tiempo, y publicar un archivo estático generado por no aportar nada si el constructor siempre corre con backend. El JSONB versionado de esta solución puede migrarse al motor completo más adelante sin rehacer Admin ni constructor.

## 1. Base de datos

Migración nueva: `backend/migrations/2026-07-20-ofertas-movil-versiones.sql`. Se crea el archivo; **no se ejecuta sin backup y autorización expresa** (regla operativa del repo).

Tabla `public.ofertas_movil_versiones`:

- `id UUID PRIMARY KEY`
- `numero BIGSERIAL UNIQUE` — versión secuencial visible (1, 2, 3…)
- `estado TEXT NOT NULL CHECK` en `('borrador','vigente','reemplazada')`
- `vigencia_desde DATE`, `vigencia_hasta DATE`
- `archivo_nombre TEXT NOT NULL`, `archivo_sha256 CHAR(64) NOT NULL`
- `datos JSONB NOT NULL` — arreglo de ofertas en el mismo formato de `OFERTAS_DATA`
- `resumen JSONB NOT NULL DEFAULT '{}'` — conteos y diferencias contra la versión anterior
- `advertencias JSONB NOT NULL DEFAULT '[]'` — lo que el parser no pudo leer con certeza
- `creada_por TEXT NOT NULL`, `creada_en TIMESTAMPTZ`
- `publicada_por TEXT`, `publicada_en TIMESTAMPTZ`, `reemplazada_en TIMESTAMPTZ`

Restricciones:

- Índice único parcial: solo una fila `vigente`.
- Sin DELETE en API. Historial = filas `reemplazada`.
- Idempotencia de subida: si se sube un Excel con el mismo `archivo_sha256` que un borrador existente, se reutiliza ese borrador.

La vigencia documental (vencida o no) **no es un estado**: se calcula comparando `vigencia_hasta` con la fecha actual, siguiendo la regla del repo de que `vencida` no es estado de versión.

## 2. Parser del Excel

Servicio nuevo `backend/src/services/ofertasMovilParser.js` (funciones puras, sin base de datos). Reutiliza lo aprovechable de `motorOfertasNormalizer.js` existente.

- Lee el buffer con SheetJS (`header: 1`, conservando número de fila real).
- Hoja principal: `Ofertas Equipos en Portafolio`; detecta encabezados por texto normalizado, no por posición fija.
- Produce ofertas en el formato exacto de `OFERTAS_DATA`: `id`, `beneficio` (`gratis`/`50pct`/`credito`), `planMin`, `tipo`, `familias`, `titulo`, `plazos`, `tradeinNueva`, `tradeinRenov`, `pricecodes`, `bonoStreaming`, `lineaLimit`, `credito`, `eventos` (cuando aplica), `equipos: [{marca, modelo, precio}]`.
- Extrae la vigencia del nombre del archivo o título ("4 al 15 de julio de 2026"); si no puede, la deja vacía y el admin la escribe en el preview. Las fechas siempre son editables antes de publicar.
- Todo lo que no logre interpretar con certeza (equipo sin precio, texto de plazos no reconocido, oferta sin plan mínimo) se registra como advertencia con hoja y fila; **no se inventa ningún valor**.
- Un archivo ilegible (no es Excel, hoja principal ausente) responde error de parser y no crea borrador.

## 3. API `/api/ofertas-movil`

Ruta nueva `backend/src/routes/ofertasMovilRoutes.js`, montada en `backend/src/server.js`. No toca `/api/equipos-lista`, `/api/planes-modulos` ni `/api/motor-ofertas`.

- `GET /api/ofertas-movil/vigente` — requiere sesión. Devuelve la versión vigente: `numero`, `vigencia`, `estado_vigencia` calculado (`vigente` | `vencida_pendiente_reemplazo`), `datos`, `archivo_nombre`. Sin versión publicada responde `404 sin_version_vigente`.
- `POST /api/ofertas-movil/preview` — admin/supervisor. Multipart con un solo campo `archivo` (.xlsx/.xls, Multer en memoria, límite 20 MB). Parsea, guarda `borrador` y devuelve: resumen (conteos), diferencias contra la vigente (ofertas nuevas/eliminadas, equipos nuevos/eliminados, cambios de precio), advertencias y vigencia detectada.
- `POST /api/ofertas-movil/publicar` — admin/supervisor. Body: `{ version_id, vigencia_desde, vigencia_hasta }`. En una transacción: la vigente actual pasa a `reemplazada` y el borrador a `vigente`. Publicar un borrador con advertencias exige `confirmar_advertencias: true`.
- `GET /api/ofertas-movil/historial` — admin/supervisor. Lista versiones con número, estado, vigencia, archivo y fechas.

Errores esperados: `400 archivo_requerido`, `400 tipo_archivo_invalido`, `401`, `403`, `404 sin_version_vigente`, `409 version_no_publicable` (no es borrador), `422 parser_error`, `422 vigencia_invalida` (desde > hasta o fechas faltantes al publicar).

## 4. Admin Ofertas: pestaña "Ofertas"

En `frontend/app.html`, `ofRenderOfertasTienda()` deja de ser placeholder:

- **Tarjeta de estado** permanente: "Versión N activa · vigencia 4–15 jul · subida por X". Si venció: pill ámbar "⚠ VENCIDA — esperando reemplazo". Si nunca se publicó nada: aviso de que el constructor sigue usando el archivo estático.
- **Dropzone** para el Excel (mismo patrón visual que la pestaña Lista de Equipos).
- **Pantalla de revisión** tras subir: conteos, tabla de ofertas con sus equipos y precios, sección de diferencias contra la versión activa, lista de advertencias del parser, campos editables de vigencia desde/hasta, y botón **Publicar** (deshabilitado hasta tener fechas válidas; con advertencias pide confirmación explícita).
- **Historial** simple debajo: versiones anteriores con fecha y archivo.

## 5. Constructor conectado

En `Planes para web/oferta-const.html`:

- Al iniciar, pide `GET /api/ofertas-movil/vigente` con el token del CRM (mismo mecanismo que ya usa para `/api/clients-real`).
- Si responde, sustituye `window.OFERTAS_DATA` con `datos` **antes** del primer render. La lógica de `ofertas-logic.js` (eventos, trade-in, portabilidad, herencia de planes) no cambia.
- Si `estado_vigencia` es `vencida_pendiente_reemplazo`: banner ámbar fijo "Boletín vencido el {fecha} — ofertas siguen activas esperando reemplazo".
- Si el API falla o no hay versión publicada: usa el `ofertas-data.js` estático como respaldo y muestra banner "Datos locales — pueden estar desactualizados".

## Manejo de errores

- El parser nunca publica en silencio: sin confirmación del admin no hay versión vigente nueva.
- El Excel ilegible no crea nada y el error indica el motivo sin exponer rutas del servidor.
- La publicación es transaccional: nunca quedan dos vigentes ni cero vigentes a mitad de operación.
- El constructor siempre tiene datos: API → respaldo estático, cada uno con su aviso.

## Pruebas (node:test, como todo el repo)

- **Parser**: fixtures Excel generados en memoria con SheetJS. Casos: equipo gratis $35, 50% $50, crédito con trade-in, oferta solo-renovación, equipo sin precio (advertencia), plazos ilegibles (advertencia), archivo sin hoja principal (parser_error), vigencia desde el título.
- **Migración**: contrato del SQL (tabla, CHECK de tres estados, índice único parcial de vigente, sin ON DELETE CASCADE).
- **Rutas**: contrato con repositorio inyectado falso — roles admin en preview/publicar, 404 sin vigente, 409 al publicar algo que no es borrador, transición vigente→reemplazada, idempotencia por sha256, sin DELETE.
- **Constructor**: prueba de contrato sobre el HTML (patrón de `oferta-const-portal.test.js`) — pide `/api/ofertas-movil/vigente`, tiene banner de vencimiento y respaldo estático.

## Fuera de alcance

- Ejecutar la migración o backfill (requiere autorización expresa y backup).
- Tocar el motor versionado (`/api/motor-ofertas`), `/api/equipos-lista` o `/api/planes-modulos`.
- El portal público estático (`ofertas.ss-group.cloud`).
- Parsear boletines PDF; esta fase solo procesa el Excel de formato Tabla de Financiamiento.
- Deploy.
