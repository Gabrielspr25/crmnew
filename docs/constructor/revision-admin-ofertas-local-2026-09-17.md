# Revision operativa de Admin Ofertas

Fecha: 2026-09-17. Estado: **en validacion local, pendiente de revision visual**.
Continua la auditoria productiva y la revision del panel, sin sustituir sus
cortes historicos. No se desplego, publico, migro ni modifico elegibilidad.
PM-021 permanece retirado: REDPLUS $60 y BREDP1 $65 separados. El Constructor
retirado no se reconstruyo. El lector PDF de Affinity no es un bloqueo actual.

## Ambientes y consultas

- Produccion: auditoria de solo lectura en `ventaspro-server`, `/opt/crmp-nuevo`,
  `crm_pro`. Se reconfirmaron por SELECT Fijo v13, TV v14, Movil v17,
  upload8/477 equipos, Ofertas v2 y `fijo_benefits` v1. No se escribio alli.
- Local: PostgreSQL en `::1`, tambien llamado `crm_pro`; el nombre de BD no
  identifica produccion. Publicaciones locales distintas: Fijo v2, TV v3,
  Movil v1, IoT v6, upload2, Affinity v65 y Ofertas v2.
- El panel y Admin Ofertas locales usan `GET /api/admin-control/modules` con
  SELECT independientes de fuentes, bases, modulos activos, uploads/equipos,
  reglas, ofertas y agregador de beneficios. El Plan aporta contexto, no estados
  comerciales. Se muestra ambiente y fecha de lectura de evidencia.
- Historial: `GET /api/fuentes-comerciales/bases-informativas/historial`.
  Reanudar abre el ID exacto mediante `GET /bases-informativas/:id`; no convierte
  automaticamente cualquier version del historial en el borrador seleccionado.
- Carga: `POST /api/fuentes-comerciales`, siempre `publicacion_modo=borrador`
  desde el formulario base. Analisis: `POST /:id/preview-base`. Guardado:
  `POST /:id/preview-base/borradores`. Revision y aprobacion:
  `POST /bases-informativas/:id/validar` y `/aprobar`. Publicacion existente
  `/publicar` no ejecutada. Estas rutas son relativas a `/api/fuentes-comerciales`.
- El Portal lee `/api/planes-modulos/:pagina`, `/api/equipos-lista`,
  `/api/ofertas-movil/vigente`, `/api/fuentes-comerciales/benefits-vigentes`
  y `/api/fuentes-comerciales/affinity-vigente`, segun dominio. Directorio es
  estatico y Servicios no tiene consumidor API conectado. No se atribuye una
  conexion actual al Constructor futuro.

La etiqueta productiva de Claro TV **Produccion: Pendiente** proviene del Plan
desplegado. El historial comercial y el Portal acreditaron **v14 publicada**;
la etiqueta no exige republicar. Local muestra su propia **v3**, nunca v14
copiada del documento. Falta de borrador de una fuente no anula ninguna de ellas.

## Seis alertas auditadas

Se corrige el calculo local, no filas de estado ni el numero a mano. El badge
cuenta modulos con pendientes o comprobacion sin verificar; no tiene por que
seguir siendo seis. En la instancia local los diez requieren alguna revision
o comprobacion. Las seis originales eran de produccion, no de esta BD local.

| Alerta productiva original | Evidencia y correccion local |
| --- | --- |
| IoT: fuente sin publicar | Agosto esta en cuatro modulos aunque no tenga cabecera de bases. Se conserva esa evidencia; septiembre archivado es otro proceso y agosto esta vencido. |
| Lista de Precios: fuente sin publicar | Se consulta `equipos_uploads` y su catalogo activo, no solo bases. Upload8 tiene 477 equipos productivos; excepcion documental conservada. |
| Servicios | Se declara circuito y destino sin verificar; un placeholder no demuestra inexistencia global de publicaciones. |
| Affinity | Se reconoce `vigente` en su circuito independiente. Local tiene v65; produccion no tenia version independiente en las tablas auditadas. PDF funciona; falta traza de la aclaracion GPON 100 en futuro borrador productivo. |
| Beneficios: falta fuente | Se corrige `benefits`/`beneficios` y se consulta el agregador real; produccion tiene 12 entradas, con origen/vigencia por dominio. |
| Ofertas: fuente sin publicar | Se consulta `ofertas_movil_versiones`: v2 existe pero su fecha productiva termino el 26/08. No se confunde con Motor v1 ni con seleccion local de archivos. |

No se usa `Al dia` por defecto. Vigencia, publicacion y comprobacion del
destino son estados distintos. La lectura de BD no se presenta como una nueva
comprobacion HTTP del consumidor.

## Correcciones comprobadas

1. Ambos paneles muestran **Publicado actualmente** y **Actualizacion pendiente**,
   fuente original, version/estado, fechas y acceso al borrador preciso.
   `Sin borrador seleccionado` no afirma que el documento carezca de borradores
   guardados; `Continuar borrador` recupera la version pendiente identificada.
2. La comparacion usa el snapshot realmente publicado. Antes se volvia a analizar
   el original historico con el parser actual y se podian ocultar eliminaciones.
   El comparador preserva multiplicidades y se bloquea ante identidades ambiguas.
3. La huella del preview vincula fuente, hash, fecha base, snapshot y resultado.
   Guardar desde esta UI envia esa huella; un cambio intermedio devuelve 409 y
   exige analizar de nuevo, sin guardar una comparacion distinta silenciosamente.
4. Fecha de actualizacion de la base y vigencia son independientes. No se deduce
   vigencia del nombre del archivo ni se usa como fecha base del parser.
5. Errores de analisis/409 limpian el preview activo y no habilitan un borrador
   previo. La publicacion anterior sigue consultandose independientemente.
6. Ofertas ya no simula Excel/PDF analizados: el formulario no conecta todavia
   ese analisis conjunto. Guardar seleccion local guarda nombres, no originales
   ni un borrador comercial. Se informa expresamente.
7. Las respuestas asincronas se asocian a generacion, modulo, categoria y fuente.
   Cambiar de pestana durante analisis/guardado/aprobacion no atribuye la respuesta
   al nuevo modulo. La carga limpia seleccion anterior incluso si falla el GET.
   Historial es solo consulta; reanudar requiere el borrador exacto.

## Prueba con documento oficial

Original del repositorio:
`Planes para web/Estructura de planes/planes/LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf`.
SHA-256: `1253afddab051440c06a1eae160d700178182dcc5930a87dcdcd3027da59e236`.
Es un documento oficial historico usado para comprobar el recorrido, no un
boletin comercial nuevo aprobado. Su hash coincide con la referencia de la
publicacion local anterior; la nueva recepcion no implica contenido nuevo.
No se equipara con el PDF homonimo productivo, cuyo hash comienza `771f75`.

La instancia de prueba se limito a loopback, BD local, ese hash, familias
Fijo/TV y validacion/aprobacion de borradores creados en la misma sesion.
Publicar, modificar otros documentos y cualquier otra escritura quedaron
bloqueados por HTTP. No se alteraron permisos de BD ni schema.

| Paso | Resultado real |
| --- | --- |
| Cargar | HTTP 201, fuente `0ffc907a-6a93-4f6b-bd7c-64ccff1f339f`, original archivado; sin publicacion. Carga por API existente porque Chrome impidio `setInputFiles` por permiso de archivos de la extension. La carga con selector nativo queda por comprobar. |
| Analizar | Boton existente en navegador: fecha base 30/03/2026, 81 candidatos Fijo y 9 TV. Vigencia no inferida. |
| Comparar | TV: 0 nuevos, 0 modificados y 8 eliminados frente al snapshot publicado de 17; Fijo: 33 eliminados frente a 114. Antes la reconstruccion del anterior ocultaba esas diferencias. |
| Revisar y guardar | Boton existente: Fijo v9 `ba445ba0-ace8-47dd-a642-2e9d7e84b8f5` y TV v10 `4966e97d-b0c4-4e6f-af3c-6460ab2f1332`. Comparacion persistida; publicaciones y borradores anteriores conservados. |
| Validar revision | TV v10 validada, 2026-09-17T19:36:50.441Z. |
| Aprobar | TV v10 aprobada, 2026-09-17T19:37:17.751Z por Admin Dev. Aprobacion tecnica de prueba, no autorizacion comercial de Gabriel. Fijo v9 sigue borrador. |
| Publicar | **No ejecutado**, bloqueado en el servidor de prueba. TV v3 y Fijo v2 siguen publicadas. No se acredita este paso ni comprobacion de una nueva version en el destino. |

Firmas de conservacion, SELECT antes/despues:

- `planes_modulos`: 18 filas; MD5 `2eeef79fa21ecb53bcd155aa4478e0cb` en ambos cortes.
- Bases publicadas/reemplazadas: 6 filas; MD5
  `4372e2df755bacd9aeedfcc7fc29be05` en ambos cortes.
- Se conservaron los registros de prueba y el historial; no se hizo rollback
  destructivo ni se sustituyeron precios o reglas publicadas.

## Matriz de seguimiento

Las publicaciones productivas son evidencia del corte de auditoria del 17/09,
no resultado de un despliegue de esta implementacion.

| Modulo | Publicacion actual (produccion / local) | Paso pendiente | Bloqueo real | Siguiente accion |
| --- | --- | --- | --- | --- |
| Fijo | v13 / v2 | Local v9 borrador; vigencia por confirmar | Revisar 33 eliminaciones; prueba no autoriza reemplazo | Reabrir v9, revisar diff y fuente antes de validar/aprobar |
| Claro TV | v14 / v3 | Local v10 aprobada sin publicar | Publicacion excluida de esta etapa; 8 eliminaciones requieren decision comercial | Revisar v10 y vigencia; conservar publicada |
| Moviles | v17 / v1 | Vigencia base; ofertas por separado | No se reejecuto escritura de este dominio | Revisar original/base sin trasladar ofertas a planes |
| IoT | Agosto sin cabecera / v6 septiembre | Produccion: analizar septiembre archivado | Agosto vencido; reemplazo no comprobado | Preview/diff de la fuente pendiente en su ambiente |
| Lista de Precios | upload8, 477 equipos / upload2 | Vigencia y flujo propio de Excel | Guardado de preview en UI no equivale a aprobacion persistida | Probar Excel oficial por su flujo existente, sin publicar |
| Servicios | Sin verificar / Sin verificar | Fuente, analisis y consumidor propios | Formulario y pagina sin circuito comercial conectado | Definir conexion especifica; no heredar estado de Fijo |
| Beneficios | 12 entradas / agregado por dominio | Revision por entrada | No es una version unica; trazabilidad/vigencia parcial | Abrir Beneficios y revisar fuente por dominio |
| Affinity | Sin version independiente en circuito auditado / v65 | Borrador productivo y traza GPON | Contradiccion sin resolucion aplicada; no lector PDF | Conservar decision GPON 100 y verificar su registro |
| Ofertas | v2 fin 26/08 / v2 fin 16/09 | Reemplazo y analisis conjunto | Formulario Excel+terminos no conectado; ambas fechas vencidas | Conectar flujo existente con alcance aprobado; no simular analisis |
| Directorio | 85 contactos estaticos / JS disponible | Original, vigencia y aprobacion propios | No existe conexion documental comprobada | Auditar su fuente; no usar version Fijo |

## Limites y siguiente revision

- No se probaron nuevas escrituras de Movil, IoT, equipos, Affinity u Ofertas.
- Guardar varias categorias sigue usando INSERT separados: falta verificar
  atomicidad/idempotencia ante fallo parcial. No hubo fallo parcial en esta prueba.
- La huella es opcional para clientes anteriores. No certifica concurrencia de
  publicacion ni sustituye una transaccion de publicacion.
- Los parsers mantienen validaciones de conteo/formato existentes. Un boletin
  diferente puede necesitar soporte probado; no se relajaron reglas comerciales.
- La revision visual, el selector de archivos de Chrome y un eventual despliegue
  requieren una etapa posterior. La vista de entrega vuelve a solo lectura.
- Capturas: `docs/constructor/capturas/admin-ofertas-2026-09-17/`.
  Las primeras capturas documentan el recorrido en 4174; las finales, la vista
  de revision de solo lectura en 4173.

El Plan Maestro conserva avances, excepciones, tests historicos y decisiones
cerradas. Esta entrega no marca ningun modulo comercial como terminado.

## Validacion final

- **198 pruebas, 198 aprobadas, 0 fallidas**, en 15 archivos focalizados. Incluyen
  el servicio y rutas de evidencia, navegacion, carreras asincronas, error de
  analisis con publicacion conservada, comparacion historica, huella obsoleta,
  politica del servidor de prueba, contratos UI y Plan Maestro. No suite global.
- Ejecutar desde `backend/`: `node --test test/admin-control-service.test.js
  test/admin-control-routes.test.js test/admin-document-preview-policy.test.js
  test/bases-informativas-snapshot-comparison.test.js
  test/bases-informativas-preview-service.test.js
  test/fuentes-comerciales-preview-base-route-contract.test.js
  test/bases-informativas-routes-contract.test.js test/project-plan-contract.test.js
  test/admin-control-navigation.test.js test/admin-ofertas-async-state.test.js
  test/admin-ofertas-operational.test.js test/admin-fuentes-comerciales-only-contract.test.js
  test/fuentes-comerciales-ui-contract.test.js test/affinity-modulo-contract.test.js
  test/tareas-reglas-admin-ui-contract.test.js`.
  El primer intento desde la raiz fallo por rutas relativas de 15 casos del
  contrato antiguo; no se relajaron aserciones. Desde `backend/` todos pasan.
- Script embebido de `frontend/app.html` compilado con `vm.Script`; diff revisado.
- Navegador: Tareas -> Claro TV -> Revisar borrador abre TV v10 aprobada y su
  comparacion guardada de ocho eliminaciones; no vuelve a analizar ni publicar.
- Original: enlace abre nueva pestana PDF, endpoint responde HTTP 200,
  `application/pdf`, 381117 bytes. La inspeccion automatizada de la pestana
  `blob:` esta restringida; no se declara su renderizado visual verificado.
- Capturas escritorio y movil a 390px: detalle y botones sin desbordamiento
  horizontal de pagina (`scrollWidth=375`, `innerWidth=390`).
- Servidor de prueba 4174 cerrado. Entrega en 4173: `read_only=true`,
  `publication_enabled=false`; solo lectura de revision, no carga operativa.
- SELECT final: Fijo v9 `borrador`, TV v10 `aprobada`, ambas sin `publicada_en`;
  Fijo v2, TV v3, Movil v1 e IoT v6 permanecen publicadas. 18 modulos conservados.
