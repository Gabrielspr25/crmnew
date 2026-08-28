# Estado real de Ofertas Móviles — hallazgo previo a implementación

Fecha del análisis: 2026-08-17.
Origen: `Entrega_Programador_Admin_Ofertas_y_Portal.docx` (documento de traspaso de Gabriel) contrastado contra el código y la base de datos reales de `newcrm`, rama `codex/business-red-admin-upload`.

Este documento es un **hallazgo de auditoría**, no un spec aprobado. Ningún cambio de código o de base de datos se ejecutó todavía; todo lo descrito abajo es lectura del estado actual.

---

## 1. Objetivo del documento de traspaso

Cerrar de punta a punta una sola línea vertical: **Ofertas Móviles**. Flujo esperado por Gabriel:

`subir PDF (términos) + Excel (matriz operativa) de una misma vigencia → archivar (hash/usuario/fecha) → interpretar → preview con diferencias/contradicciones → borrador o pendiente de revisión (la versión anterior sigue activa) → aprobar y publicar de forma explícita → endpoint vigente → constructor arma la mejor combinación por línea`

Reglas de negocio confirmadas incluidas en el documento: matrices de Business Red Plus por posición de línea, Extreme/Supreme/Sin Fronteras comparten motor sin heredar la matriz de Plus, BYOP-BAN (`BREDP1015`) no recibe ofertas salvo autorización expresa, renovación + Update Plus no requiere trade-in (Financiamiento evalúa su propia regla, sin heredar la excepción), límites por BAN, acumulación de elegibilidad de equipos por nivel de plan.

Fuera de alcance hasta cerrar Móvil: Ofertas Fijas completas, Beneficios de Convergencia, Claro TV/Cloud, rediseños visuales amplios.

Incidente puntual reportado: el 2026-08-17 se cargó `Tabla Ofertas Update Plus y Financiamiento 6 al 26 de agosto de 2026- PYMES-rv.xlsx` dos veces — una correctamente como `ofertas_moviles` (activa) y una incorrectamente como `equipos` (mismo hash) — que debe archivarse con nota `error_clasificacion` sin borrarse, sin tocar el registro correcto.

## 2. Discrepancia de stack (a validar, ya resuelta con Gabriel)

El mensaje original mencionaba "React más Vite en frontend". El repo real usa `frontend/app.html` estático servido por Express, sin proceso de build (confirmado en `AGENTS.md`/`CLAUDE.md` y en el código). **Decisión de Gabriel: seguir con HTML+Express actual, sin introducir build de React/Vite.**

## 3. Estado real del código (verificado, no documental)

| Pieza pedida | Estado |
|---|---|
| Subir PDF+Excel como una sola unidad | **No existe.** Se suben como fuentes independientes (`POST /` en `fuentesComercialesRoutes.js`, un archivo por request) y se combinan solo en tiempo de preview vía `fuente_ids: [a, b]`. |
| Archivar con hash/usuario/fecha | **Completo.** Genérico para las 10 familias soportadas (`equipos, fijos, moviles, inalambrico_iot, servicios, cloud_sva, claro_tv, ofertas_moviles, ofertas_fijo, beneficios`), con SHA-256 y `UNIQUE(familia, sha256)` para evitar duplicados. |
| Parser normaliza planes/eventos/equipos/beneficios | **Parcial.** `motorOfertasNormalizer.js` cubre equipos/financiamiento (`normalizeOfferWorkbooks`) y Business Red Plus (`parseBusinessRedPlusWorkbook`). Business Red multilínea usa un parser Python + `businessRedMultilineaPdf.js` aparte. No hay un contrato de datos único para "ofertas móviles". |
| Preview con diferencias/contradicciones | **Completo**, pero fragmentado en 3 endpoints distintos, cada uno con su propio formato de diff (`diffOffers`, `diffBusinessRedPlus`, `diffBusinessRedMultilinea`). |
| Aprobación/publicación con historial | **Parcial.** Existe "Publicar" + `GET /historial`, pero **sin estado de borrador persistido**: el preview vive en un `Map()` en memoria del proceso (TTL 30 min, se pierde si el servidor reinicia) y "Publicar" inserta directo la fila `estado='vigente'`. No replica el patrón borrador→validada→aprobada→publicada que sí tiene Fijo/Claro TV. |
| Endpoint vigente | **Completo.** `GET /api/ofertas-movil/vigente` (alias de `/api/motor-ofertas/vigente`, mismo router montado dos veces) responde con `estado_vigencia` calculado. |
| Constructor consume la versión publicada | **Parcial.** El *constructor interno* (`Planes para web/oferta-const.html`, con sesión CRM) llama `loadPublishedMobileOffers()` → `/api/ofertas-movil/vigente` antes del primer render, con fallback a `ofertas-data.js` si falla. Solo confirmado que usa `version.datos` (subflujo Equipos/Financiamiento); no verificado si también incorpora `resumen.business_red_plus` o los módulos de `planes_modulos` generados por Business Red multilínea. El *portal público* (`Planes para web/ofertas.html`, la vitrina) es **100% hardcodeado** en `ofertas-data.js` (~570 líneas), sin ningún fetch al backend. |
| UI de Admin para operar esto | **Código muerto.** `ofRenderOfertasTienda` en `frontend/app.html` (definida dos veces; la segunda gana y está completa/funcional contra el backend) no se invoca desde ningún lado. `OF_TABS` solo tiene una pestaña ("Fuentes comerciales"). Un test de contrato ya staged (`admin-fuentes-comerciales-only-contract.test.js`) prohíbe explícitamente reintroducir pestañas separadas, siguiendo el diseño del 2026-08-15 (`docs/superpowers/specs/2026-08-15-admin-ofertas-fuentes-unicas-design.md`). |

## 4. Arquitectura real detrás de "Ofertas Móviles": son 3 pipelines, no 1

El documento de traspaso describe la carga como un solo PDF+Excel. El código real implementa **tres subflujos independientes**, todos en `backend/src/routes/motorOfertasRoutes.js`, que actualizan porciones distintas de la misma fila `vigente` de `public.ofertas_movil_versiones` (cada publicación conserva las porciones que no le corresponden):

1. **Equipos/Financiamiento** — 2 Excel (financiamiento + lista de precios) → `POST /preview` → `POST /publicar` → escribe `datos` (ofertas por plan/equipo, forma `portalOfferShape`).
2. **Business Red Plus** — 1 Excel de ofertas móviles + 1 PDF de respaldo → `POST /preview-business-red-plus` → `POST /publicar-business-red-plus` → escribe `resumen.business_red_plus` (matrices de descuento por posición de línea), conserva `datos` de la versión anterior.
3. **Business Red multilínea** (Plus/Extreme/Supreme/Sin Fronteras/BYOP-BAN) — 1 PDF → `POST /preview-business-red-multilinea` → `POST /publicar-business-red-multilinea` → escribe filas directo en `public.planes_modulos` (pagina='moviles'), no en `ofertas_movil_versiones`.

Ningún subflujo persiste un estado "borrador" real en base de datos — el preview es un `Map()` en memoria del proceso Node.

## 5. Hallazgo crítico: migraciones no aplicadas en la BD local

Conexión de solo lectura a la BD configurada (`PGDATABASE=crm_pro`, `search_path="$user",public`, `DB_SCHEMA=ventaspro_nuevo` sin uso efectivo aquí). Resultado:

- **No existen** las tablas `public.fuentes_comerciales`, `public.ofertas_movil_versiones`, `public.bases_informativas_publicaciones`, ni la columna `public.equipos_uploads.fuente_comercial_id`.
- Las migraciones que las crean sí están escritas en `backend/migrations/` (`2026-08-01-fuentes-comerciales.sql` en adelante) pero nunca se ejecutaron contra esta base de datos.
- No existe tabla de tracking de migraciones aplicadas (`schema_migrations` o similar) — se ejecutan manualmente.
- Esto contradice lo que el documento de traspaso da por hecho ("Portal Móvil publicó 48 filas, commit local `a49f4dc`", "el 17 de agosto se cargó la tabla con hash `12239a01`"): esos eventos, si ocurrieron, fue contra otra base de datos o un estado que un reseed revirtió. No hay evidencia en esta BD para confirmarlo o negarlo.
- Sí existen (huérfanas, sin ningún código que las lea o escriba) las tablas del "motor grande" de la migración `2026-07-12-motor-ofertas-versionado.sql` (`motor_ofertas`, `motor_ofertas_versiones`, `motor_ofertas_fuentes`, `motor_ofertas_equipos`, `motor_ofertas_contradicciones`, `motor_ofertas_historial`) — diseño anterior descartado en favor del patrón "Fuentes comerciales".

## 6. Decisiones ya confirmadas con Gabriel

| Pregunta | Decisión |
|---|---|
| Stack frontend | Seguir con HTML+Express actual (sin React/Vite). |
| Migraciones pendientes | Aplicar con backup previo. |
| UI de Admin para Ofertas Móviles | Integrar dentro de "Fuentes comerciales" (sin pestaña aparte), mismo patrón que Fijo/Claro TV. |
| Alcance del portal | Incluir también el portal público (`ofertas.html`) en este hito, no solo el constructor interno. |

## 7. Plan propuesto (fases, pendiente de aprobación final de fase 3 en particular)

1. **Preparación**: backup de `crm_pro` → aplicar en orden las migraciones pendientes → verificar tablas + `node --test` en verde.
2. **Auditar el incidente del 17-ago**: si la fila mal clasificada existe tras migrar, archivarla con `error_clasificacion` sin borrarla; si no existe, documentarlo como pendiente de recarga.
3. **Persistencia real de "borrador"** para los 3 subflujos móviles (reemplaza el `Map()` en memoria por filas en BD con estado explícito) — **modifica contratos de API existentes**, requiere confirmación explícita adicional antes de tocarlo.
4. **Reconectar la UI de Admin**: enganchar `ofRenderOfertasTienda` dentro de "Fuentes comerciales", actualizar el test de contrato si el enganche lo requiere.
5. **Conectar el portal público** `ofertas.html` a `/api/ofertas-movil/vigente` con el mismo patrón de fallback que ya usa `oferta-const.html`.
6. **Validar reglas críticas** contra los casos concretos del documento (Business Red Plus 25% en línea 2, renovación Update Plus sin trade-in, límites por BAN, acumulación por nivel).
7. **Evidencia final**: capturas Admin + constructor + portal, checklist de aceptación.

## 8. Abierto / pendiente de verificar en implementación

- Si `oferta-const.html` incorpora hoy `resumen.business_red_plus` y los módulos de `planes_modulos` (Business Red multilínea), o solo `datos` (Equipos/Financiamiento).
- Si la lógica de renovación-sin-trade-in (Update Plus) y la no herencia hacia Financiamiento ya está codificada en `motorOfertasNormalizer.js` o falta implementarla.
- En qué base de datos ocurrió realmente el incidente del 17-ago (o si fue una carga de prueba/simulada).

---

## 9. ADDENDUM 2026-08-17 — Identificación de entorno (bloqueante, antes de tocar nada)

Gabriel señaló un riesgo crítico: no estaba confirmado si la BD local conectada es la misma donde ocurrieron las cargas del 17 de agosto. Se congela toda acción (sin migraciones, sin cambios de contrato, sin producción, sin publicar, sin tocar el `Map()`) hasta aclarar el entorno. Investigación de solo lectura, sin escribir nada:

### 9.1 Tabla de entornos

| Entorno | Servidor / host | Base | Esquema activo | Tablas nuevas de Ofertas Móviles (`fuentes_comerciales`, `ofertas_movil_versiones`, `bases_informativas_publicaciones`) | Evidencia |
|---|---|---|---|---|---|
| **Local (esta sesión)** | `localhost` / `::1`, PostgreSQL 15.13 compilado con Visual C++ (instancia Windows nativa en esta máquina de desarrollo) | `crm_pro` (usuario `crm_user`) | `search_path="$user",public"` (`DB_SCHEMA=ventaspro_nuevo` en `.env`, pero sin efecto real aquí) | **No existen** | Proceso Postgres iniciado 2026-08-16T14:59 UTC. `audit_log` más reciente: **2026-06-26**. `equipos_uploads`: 2 filas, ambas del **2026-07-18**, subidas por usuario `dev` (no "Gabriel"). `clients`: 3355 filas reales, pero el más reciente creado es del 2026-06-03. No existe el directorio `backend/uploads/fuentes-comerciales/` en este filesystem — nunca se archivó un documento por ese endpoint aquí. |
| **Producción** | Desconocido desde este repo — `DEPLOY.md` (fechado 2026-06-29, desactualizado) solo dice "el servidor", sin host/IP; las credenciales viven en `backend/.env` del servidor, no versionado, no accesible desde esta sesión. | Según `DEPLOY.md`: **misma `crm_pro`** conceptualmente (mismo nombre/rol), pero en una instancia física distinta a la local. | `ventaspro_nuevo` (config) + `public` (datos reales) | **No verificable desde aquí.** No tengo credenciales ni host de producción, y no voy a intentar adivinarlos ni conectarme. | — |
| **Registros del 17-ago** (hash `12239a01…`, cargado por "Gabriel" a las 15:20:10 -04) | — | — | — | **No están en el entorno local.** No existe la tabla, no existe el archivo en disco local, y la última actividad real registrada localmente es de junio/julio. | Descartado por ausencia total de rastro local. |
| **Migraciones `2026-08-01` en adelante en producción** | — | — | — | **Desconocido**, requiere verificación directa en el servidor de producción (por ejemplo `\dt public.fuentes_comerciales` o `SELECT max(creado_en) FROM public.fuentes_comerciales`), que solo puede ejecutar quien tenga acceso a ese servidor. | Pendiente de que Gabriel u ops lo confirme. |

Contraseñas: no se muestran (`PGPASSWORD` nunca se leyó ni se imprimió en ninguna consulta).

### 9.2 Conclusión de la investigación

1. **La BD local NO es producción y no puede tocarla.** `inet_server_addr()` devuelve `::1` (loopback) y la versión de PostgreSQL está compilada para Windows — es una instancia de Postgres corriendo en esta máquina de desarrollo, físicamente separada del servidor de producción descrito en `DEPLOY.md`. Ejecutar algo contra `crm_pro` local no puede afectar producción.
2. **La BD local SÍ contiene datos reales**, pero es una **fotografía congelada de mediados/fines de julio de 2026** (consistente con los backups presentes en `backend/backups/`: `crm_pro-pre-equipos-fuentes-20260718…`, `crm_pro-pre-sales-sync-20260724…`, `crm_pro-pre-delete-asana-blancos-20260724…`). No hay ningún backup posterior a esa fecha. `planes_modulos` está vacío localmente, cuando `DEPLOY.md` indica que en producción ya tiene contenido — otra señal de desincronización.
3. **El incidente del 17 de agosto no ocurrió en este entorno local.** No hay rastro en base de datos ni en filesystem. O bien ocurrió en producción (si esa parte del código ya está desplegada ahí), o en otro entorno/máquina que esta sesión no puede ver.
4. **No puedo confirmar el estado de producción** (si las migraciones ya están aplicadas ahí, o si ahí sí están los registros del 17-ago) porque este repo no contiene credenciales ni host de producción, y no se intentó conectar bajo ninguna circunstancia.

### 9.3 Preguntas para Gabriel (bloqueantes)

- ¿La carga del 17 de agosto (hash `12239a01…`) se hizo directamente en producción, en otra máquina/entorno, o fue un ejemplo ilustrativo del documento de traspaso?
- ¿Alguien con acceso al servidor de producción puede confirmar si las tablas `fuentes_comerciales`, `ofertas_movil_versiones` y `bases_informativas_publicaciones` ya existen ahí?
- ¿Existe un backup más reciente de `crm_pro` (posterior a julio 2026) que se pueda restaurar en una base local separada para pruebas?

### 9.4 Propuesta para preparar una base local segura de pruebas (sin tocar producción ni la actual `crm_pro` local)

No ejecutar todavía — queda para cuando Gabriel confirme el punto anterior. La idea:

1. Alguien con acceso a producción genera un `pg_dump -Fc crm_pro` de solo lectura (el mismo procedimiento ya usado para los backups existentes en `backend/backups/`), lo más reciente posible.
2. Ese dump se restaura en una **base nueva y separada**, por ejemplo `crm_pro_test_20260817`, en el Postgres local — sin sobrescribir ni tocar la `crm_pro` local actual.
3. Se apunta una configuración de entorno aparte (`backend/.env.test` o variables de entorno temporales) a `crm_pro_test_20260817` para todo el trabajo de migración y pruebas de Ofertas Móviles.
4. Solo ahí, con autorización explícita, se aplican las migraciones pendientes y se prueba el flujo completo — la `crm_pro` local actual y la de producción quedan intactas durante todo el proceso.
5. Cuando el flujo esté validado en la base de pruebas, se propone (aparte, con su propio backup y autorización) aplicar las migraciones en producción siguiendo la regla de `DEPLOY.md`: backup → migración autorizada → verificación.

### 9.5 Estado de autorización (confirmado por Gabriel, 2026-08-17)

**Aprobado:**
- HTML + Express actual (sin React/Vite).
- Integrar Ofertas Móviles dentro de "Fuentes comerciales" (sin pestaña aparte).
- Incluir en el alcance tanto el constructor interno como el portal público.

**No autorizado todavía:**
- Aplicar migraciones (en ningún entorno).
- Cambiar contratos de API.
- Tocar producción.
- Publicar ofertas.
- Reemplazar el `Map()` en memoria por persistencia real, hasta presentar el diseño de persistencia y su compatibilidad.

Prioridad actual: confirmar el entorno correcto antes de programar o probar cualquier cosa.
