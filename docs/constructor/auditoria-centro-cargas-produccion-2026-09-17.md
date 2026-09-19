# Auditoria de Centro de Cargas y Tareas y reglas Admin

Fecha de corte: 2026-09-17. Repositorio: `newcrm`. Cambio: solo documentacion local.

## Alcance y evidencia

Se accedio a produccion por SSH (`ventaspro-server`, host `vm-gabriel-crm`,
`/opt/crmp-nuevo`) y a los dominios publicos del CRM y Portal. Se consulto
`crm_pro.public` mediante transacciones `BEGIN READ ONLY`/`ROLLBACK` y SELECT
con `default_transaction_read_only=on`. Se comprobaron API y contenido
renderizado en navegador, usando la sesion existente del CRM.

No se ejecutaron cargas, POST de preview, borradores, aprobaciones,
publicaciones, migraciones, backfills, reinicios ni despliegues. El diagnostico
del parser de Affinity leyo su original y normalizo en memoria sin persistir.
No se reejecuto el ciclo comercial de escritura para probarlo.

La base local no se consulto en vivo. Sus avances anteriores se conservan como
evidencia historica con su fecha y ambiente; no se extrapolan a produccion.
Esta auditoria no certifica precios, elegibilidad ni equivalencia del Motor.

Se verificaron 29 fuentes registradas: los 29 originales existen en el servidor
y sus SHA-256 coinciden con `fuentes_comerciales`. Esto comprueba custodia, no
vigencia, aprobacion ni que todas sean consumidas por el Portal.

Los hashes de `adminControlRoutes.js`, `projectPlanService.js` y
`fuentesComercialesRoutes.js` coinciden entre checkout y servidor. El HTML local
es distinto del productivo; las funciones relevantes se leyeron tambien desde
el servidor y se comprobaron las pantallas productivas.

## Decision PM-021

Gabriel descarta PM-021 por confusion: **REDPLUS $60 y BREDP1 $65 son
identidades separadas; no hay que relacionarlas ni fusionarlas**.

La ficha sale de `items` y de los bloqueos activos. Se conserva completa en
`retired_items[].original_record`, junto con autor, fecha y motivo. No se marca
como una implementacion terminada ni se alteran reglas comerciales. La auditoria
de identidad anterior queda como antecedente, no como una tarea de fusion.

## Que Consulta Cada Pantalla

| Pantalla | Consulta o archivo | Significado real |
| --- | --- | --- |
| Tareas y reglas Admin | `GET /api/admin-control/modules` -> `loadProjectPlan()` -> JSON `operating_control.modules` del servidor | Seguimiento escrito en documentacion. `production_status` no consulta tablas comerciales ni comprueba despliegue/publicacion. |
| Historial de bases | `GET /api/fuentes-comerciales/bases-informativas/historial[?categoria=claro_tv]` | SELECT de `public.bases_informativas_publicaciones`, orden categoria/numero DESC, limite 100; conserva fechas de carga, validacion, aprobacion y publicacion. |
| Cola Centro de Cargas | `ofLoadCenterData()` + `ofBuildCenterRows()` en `frontend/app.html` | Combina fuentes, historial de bases y Affinity; busca `estado === 'publicada'`, mapea familias y calcula alertas. No es una consulta universal de publicaciones. |
| Datos Fijo/TV/Moviles/IoT del Portal | `GET /api/planes-modulos/:pagina` | Lee modulos activos en `public.planes_modulos`; agrega ultima cabecera `estado='publicada'` de bases si existe. `publicacion:null` no significa que no haya modulos publicados. |
| Lista de Precios | `GET /api/equipos-lista`, historial `GET /api/equipos-lista/uploads` | Catalogo de equipos y `public.equipos_uploads`; circuito distinto de bases informativas. |
| Beneficios | `GET /api/fuentes-comerciales/benefits-vigentes` | Catalogo agregado desde reglas publicadas y proyecciones por dominio. |
| Affinity independiente | `GET /api/fuentes-comerciales/affinity/historial` y `/affinity-vigente` | Versiones `affinity_benefits` y consumidor publico; no incluye por equivalencia el Affinity historico de Fijo. |
| Ofertas en Moviles | `GET /api/ofertas-movil/vigente` | `public.ofertas_movil_versiones`. `/api/motor-ofertas/version-vigente` usa el mismo handler `versionVigente`, con autenticacion; no es el lector de `motor_ofertas_versiones`. |
| Servicios | `servicios.html` | Placeholder estatico sin consulta API. Su texto no demuestra por si solo ausencia de publicacion. |
| Directorio de Fijo | `directorio-fijo.html` + `directorio-fijo-data.js?v=2026081101` | Contenido estatico visible. El estado que la cola hereda de Fijo no verifica este destino. |

Referencias de implementacion: `backend/src/routes/adminControlRoutes.js`,
`backend/src/services/projectPlanService.js`,
`backend/src/routes/fuentesComercialesRoutes.js` (handler
`createHistorialBasesInformativasHandler`), `backend/src/routes/planesRoutes.js`,
`backend/src/services/motorComercialReglasCompuestasPersistence.js` y
`backend/src/services/benefitsPortalCatalog.js`.

## Claro TV: Version 14 y Tarjeta Pendiente

Se reprodujeron los tres resultados en produccion:

1. Historial: `claro_tv`, version 14, `publicada`, 9 candidatos, base 2026-03-30.
2. Tareas y reglas Admin: `En validacion`, `Produccion: Pendiente`.
3. Portal `claro-tv.html`: `Version 14`, 9 registros, separados en 6 planes y
   3 servicios complementarios.

La fila publicada tiene ID `d1b063bf-1ecb-4467-87e9-30d90041099d`, carga
2026-08-20 13:09:19-04 y validacion/aprobacion/publicacion
2026-08-20 13:14:16-04. Los borradores 2, 4, 6, 8, 10 y 12 son anteriores.
Los dos `planes_modulos.contenido` coinciden por igualdad JSONB con los
`modulos_generados` de v14. La API publica devuelve la misma version.

Su fuente vinculada es la familia **fijos**, ID
`d0c88196-e9d8-48f7-aa3d-7250b4459c63`, SHA-256
`771f75cef8c801831339e922586f6cf4cb2b4e9b62578e27b53c7622d7e7dbe0`.
El documento es `LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf`.
Existe tambien una fuente familia `claro_tv` con nombre semejante y hash
distinto; no debe sustituirse la relacion por coincidencia de nombre.

`publicada` prueba una transicion registrada y aqui tambien su consumo.
No prueba vigencia documental: la fuente vinculada sigue
`pendiente_confirmacion`, con fechas de vigencia nulas. La fecha de
actualizacion de la base no es fecha fin. La tarjeta `Pendiente` es el valor
almacenado en el Plan Maestro desplegado, no una refutacion del historial.

No hace falta republicar Claro TV para corregir esta discrepancia. La presente
revision corrige solo el seguimiento local a `en_validacion`, con evidencia de
la publicacion existente y el pendiente especifico de vigencia. La pantalla
productiva conserva su etiqueta hasta una publicacion documental autorizada.

## Matriz por Etapa

Todas las observaciones de esta tabla corresponden a produccion al corte.
Un analisis persistido demuestra un avance previo; no prueba que el flujo de
carga actual se haya reejecutado satisfactoriamente en esta auditoria.

| Modulo | Documento recibido y analisis | Borrador, aprobacion y publicacion | Version y vigencia | Destino comprobado |
| --- | --- | --- | --- | --- |
| Fijo | Original/hash correctos; extraccion y 81 candidatos persistidos; sin errores, 12 contenidos temporales excluidos | v13 validada/aprobada/publicada el 20/08; v9/v11 reemplazadas; borradores conservados | v13; fuente pendiente_confirmacion, fechas nulas | API 200, cuatro modulos iguales al snapshot; Portal v13, 81 registros |
| Claro TV | Original/hash de fuente fija correctos; 9 candidatos, dos modulos | v14 con fechas de todas las etapas; borradores anteriores conservados | v14; vigencia pendiente_confirmacion | API 200 y Portal v14, 6 planes + 3 complementos |
| Planes Moviles | Original/hash correctos; 48 candidatos, sin errores/advertencias | v17 validada/aprobada/publicada el 09/09; v15/v16 reemplazadas | Base v17, fecha base 19/06; fechas nulas y pendiente_confirmacion | API 200, tres modulos iguales al snapshot; Portal carga base y ofertas separadas |
| Inalambrico/IoT | Agosto y septiembre archivados; hashes correctos; datos de agosto en cuatro modulos | Sin filas categoria inalambrico en bases; no desmiente publicacion directa en planes_modulos. Borrador persistido septiembre no encontrado en bases; preview transitorio no comprobado | Agosto publicado; fin 31/08 vencido. Septiembre archivado sin aplicar al destino | API 200 con modulos y cabecera null; banda-ancha muestra agosto |
| Lista de Precios | Excel septiembre-octubre/hash correctos; upload id8, 477 items | upload id8 `publicada`; publicado_en null, sin inventar fecha/aprobador. Historial anterior conservado | Fuente vigente; upload pendiente_confirmacion y fechas nulas; excepcion unica preservada | API y equipos.html: 477 equipos |
| Servicios | Sin fuente especifica en las tablas consultadas; valores agregados de Fijo son otro alcance | Sin bases categoria servicios ni modulos activos de Servicios en circuito auditado | Sin version comprobada en ese circuito | Pagina estatica Pendiente de publicacion, sin API |
| Beneficios | Claro Full archivado/hash correcto; reglas normalizadas y fuentes por dominio | fijo_benefits v1 aprobada/publicada 30/08, nueve reglas; catalogo agregado no es un solo borrador | v1 mas proyecciones ofertas_moviles; API devuelve vigencias por entrada, no cierre global | API y benefits.html: 12 publicados, autoaplica=false; incluye Affinity historico |
| Affinity independiente | PDF/hash correcto; diagnostico puro extrae 8 paginas; dos reglas, una en revision | Cero versiones affinity_benefits en tabla de versiones; no borrador/aprobacion/publicacion persistidos alli | Fuente pendiente_confirmacion; API publicado=false | affinity.html Sin publicacion vigente; distinto del Affinity de Beneficios |
| Ofertas | Fuentes archivadas/hash correcto, datos normalizados persistidos | ofertas_movil v2 publicada 07/08, v1 reemplazada; motor_ofertas v1 movil_equipos es otra numeracion | v2 estado vigente, fecha fin 26/08 ya vencida; API estado_vigencia=vigente es discrepancia | API publica y movil.html muestran v2 como vigente; retiro de pantallas no borro versiones |
| Directorio de Fijo | Referencia visible al Excel diciembre 2025; no se verifico original/hash de ese archivo en este circuito | Flujo propio de borrador/aprobacion no comprobado; no atribuirle v13 de Fijo | Publicacion estatica visible; vigencia no comprobada | directorio-fijo.html: 85 contactos desde JS propio |

## Bloqueos y Siguiente Accion

| Modulo | Publicacion actual | Paso pendiente | Bloqueo real | Siguiente accion |
| --- | --- | --- | --- | --- |
| Fijo | v13, 81 registros | Confirmar vigencia | Metadatos pendientes; lectura funciona | Revisar fuente vinculada y seguimiento |
| Claro TV | v14, 9 registros | Confirmar vigencia/separar estados | Tarjeta documental desactualizada | Conservar v14, corregir seguimiento en etapa autorizada |
| Moviles | Base v17, 48 candidatos | Separar base de ofertas | Ofertas v2 vencidas rotuladas vigentes | Revisar vigencia de cada circuito |
| IoT | Agosto visible | Revisar septiembre archivado | Reemplazo vigente no aplicado | Analisis/diff y aprobacion posterior |
| Lista de Precios | id8, 477 equipos | Reconciliar metadatos/cola | Cola ignora equipos_uploads | Conservar excepcion y catalogo |
| Servicios | Sin version en circuito consultado | Fuente y flujo conectado | Placeholder sin API | Definir circuito antes de implementar |
| Beneficios | 12 entradas visibles | Trazabilidad por entrada | Mapeo y cola incompletos | Auditar origen por dominio |
| Affinity | Sin version independiente; historico en Beneficios | Borrador con aclaracion trazable | GPON 50/100 sin resolucion aplicada | Recuperar decision historica GPON 100 y revisar |
| Ofertas | v2 y Motor v1 conservados | Revisar vencimiento y reemplazo | Fin 26/08 contradice etiqueta vigente | Auditar calculo y fuente vigente |
| Directorio | 85 contactos visibles | Fuente/aprobacion/vigencia propias | Estado heredado de Fijo no lo verifica | Auditar circuito independiente |

## Discrepancias del Centro y Affinity

La cola productiva mostro seis modulos con atencion: IoT, Lista de Precios,
Servicios, Affinity, Beneficios y Ofertas. Marco Fijo, TV, Moviles y Directorio
como `Al dia`. Son resultados de su algoritmo, no certificaciones de esta
auditoria. Problemas concretos identificados en el codigo desplegado:

- La cola usa historial de bases para Equipos/Ofertas, omitiendo sus versiones
  especificas. Por eso `Fuente sin publicar` puede coexistir con catalogo real.
- `benefits` no se mapea a familia `beneficios`; la cola muestra `Falta fuente`
  aunque la fuente exista y el consumidor tenga 12 beneficios.
- Affinity usa `vigente` como estado publicado de reglas, mientras la cola
  busca `publicada`. Actualmente no hay version independiente; el problema de
  mapeo queda como riesgo concreto del proximo ciclo, no causa de una version
  actual inexistente.
- Directorio reutiliza familia `fijos` y categoria `fijo`, sin verificar su JS.
- `Al dia` no exige analisis exitoso, vigencia documental confirmada ni prueba
  del consumidor. `borradorPosterior` se calcula pero no participa en attention.
- Las alertas eligen la ultima fuente por familia, no la version consumida:
  navegador mostro cero vencidos/cero vigentes y nueve familias sin fecha fin,
  mientras IoT y ofertas publicados conservan fechas de fin pasadas.

Affinity ya no presenta el bloqueo tecnico documentado de lector PDF ausente:
`extract_pdf_text.py` termina con codigo 0, 8 paginas y 12808 caracteres tanto
con `python3` como con `/opt/crmp-nuevo/.venv-parser/bin/python`.
`normalizeAffinityBenefitSources` sin resoluciones devuelve dos reglas,
una confirmada y otra en revision, `publicable=false`, contradiccion
`velocidad_minima_contradictoria` (GPON 50 y 100).

El Plan Maestro conserva la aclaracion de Gabriel del 07/09: GPON desde 100.
La prueba sin resoluciones no invalida esa decision; muestra que aun falta
comprobar su registro en un borrador productivo independiente. No se aplico
ninguna resolucion ni se instalo software. El informe de incidencias previo
queda como antecedente fechado; su afirmacion de dependencia ausente no debe
usarse como diagnostico actual despues de este corte.

## Reconciliacion y Limites

El JSON conserva `done`, pruebas, documentos y excepciones anteriores.
`reconciliation_history` guarda la matriz previa y fichas modificadas antes
de esta revision; `retired_items` conserva PM-021 fuera del conteo activo.
El Markdown se regenera con `node scripts/generate-plan-maestro-constructor-md.mjs`.
El generador no representa campos nuevos de historial: la decision de PM-021
tambien figura en `release_gate`, que si se imprime, y este informe desarrolla
la evidencia referenciada desde la matriz.

No se cierra ningun modulo comercial como terminado. `en_validacion` conserva
la publicacion comprobada y especifica que falta; no ordena republicarla.
La experiencia del Constructor anterior sigue siendo historica y su reemplazo
no se implementa. Las tarjetas productivas no cambian por editar documentos
locales. Una eventual sincronizacion del Plan Maestro requiere otra etapa.

La prueba existente `Plan Maestro mantiene visible el bloqueo REDPLUS vs
BREDP1` exige precisamente el bloqueo que Gabriel retiro. Su expectativa
queda obsoleta: se ejecuta y se informa el resultado, sin modificar el test
porque el alcance autorizado es exclusivamente documental.

## Verificacion Documental

- Validador existente: JSON valido, 26 tareas activas y nueve modulos; Directorio
  queda en superficies adicionales, sin cambiar el contrato del backend.
- Comprobacion dirigida: PM-021 fuera de tareas y bloqueos, decision archivada,
  `done`, pruebas y documentos previos preservados, ningun cierre nuevo.
- Generacion: Markdown identico a `renderProjectPlanMarkdown(loadProjectPlan())`.
- Suite existente de Plan Maestro: 6 pruebas pasan y 2 fallan por expectativas
  obsoletas de PM-021: una exige el bloqueo activo y otra el texto literal
  `REDPLUS $60 vs BREDP1 $65` en el Markdown. La igualdad JSON/Markdown si pasa.
  No se modificaron pruebas ni codigo para ocultar estos fallos.
- `git diff --check` de la documentacion: sin errores de espacios.
- Catalogo productivo: SELECT confirma los 477 equipos activos asociados al
  upload id8. No es solo coincidencia de totales en el Portal.
- Retiro previo comprobado: `oferta-const.html` y `ofertas.html` responden 404;
  no se reconstruyo el Constructor ni se publico documentacion en el servidor.
