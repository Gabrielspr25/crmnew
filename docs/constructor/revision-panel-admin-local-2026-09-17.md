# Revision local de Tareas y reglas Admin

Fecha: 2026-09-17. Estado: **en validacion visual, sin desplegar**.

## Alcance

Se mejora la ruta existente `#/tareas-reglas-admin` del CRM. Se conserva su
navegacion y tema; se reemplazan las tarjetas documentales por una tabla de
diez modulos y un detalle de trazabilidad. No se reconstruye el Constructor.

No se modificaron precios, elegibilidad, publicaciones, tablas ni datos
comerciales. No se ejecutaron migraciones ni despliegues. Los escenarios
sinteticos solo viven en las pruebas, no en la base ni en las capturas.

## Consultas y estados

`GET /api/admin-control/modules` conserva autenticacion y rol admin/supervisor.
Ahora llama a `adminControlService.js`: sus consultas son SELECT y reutiliza
`readBenefitsPortalCatalog` para el agregado de Beneficios. El Plan Maestro
solo aporta contexto de seguimiento, nunca la version comercial publicada.

| Modulo | Evidencia consultada | Consumidor conectado o alcance |
| --- | --- | --- |
| Fijo, Claro TV, Moviles | `bases_informativas_publicaciones`, fuentes por ID/hash y manifiesto, `planes_modulos` activos | API de planes por pagina y Portal correspondiente |
| Inalambrico / IoT | Bases si hay cabecera; contenido y fechas de `planes_modulos` aunque no la haya | Portal Banda Ancha; catalogo de equipos leido por elegibilidad del Motor |
| Lista de Precios | `equipos_uploads`, conteos de `equipos_lista` activos y fuente asociada | Portal Equipos; lector de elegibilidad del Motor |
| Beneficios | Versiones, reglas y fuentes `fijo_benefits`, mas proyecciones de ofertas y agregador existente | Portal Benefits; sin equiparar versiones entre dominios |
| Affinity | Versiones, reglas y fuentes de `affinity_benefits` | Portal Affinity independiente |
| Ofertas | `ofertas_movil_versiones`, fuentes y fechas | Portal Movil y lector existente del Motor |
| Servicios | Fuentes/bases/modulos si existen; pagina estatica identificada como tal | No se afirma un consumidor API inexistente |
| Directorio | HTML y JS propios de esta instancia | Contenido estatico; no hereda version, vigencia ni aprobacion de Fijo |

La lectura de BD se fecha con `checked_at`. **No equivale a comprobar HTTP,
renderizado del Portal, integridad del original ni consistencia del contenido
con el snapshot de publicacion**. Por eso la comprobacion del destino permanece
`Sin verificar`; abrir el destino no registra automaticamente una certificacion.
No se agrego una tabla ni un boton que simule una verificacion persistida.

El entorno no se deduce de `NODE_ENV`. La etiqueta opcional
`ADMIN_CONTROL_ENVIRONMENT_LABEL` identifica explicitamente la instancia;
sin configuracion se presenta `Instancia consultada`.

La nueva fuente, el borrador y la version publicada se mantienen separados.
Si hay una actualizacion, su etapa Publicacion dice Pendiente y aclara que la
anterior permanece publicada. Una fuente recibida no acredita analisis,
revision ni aprobacion. Errores de lectura son `Sin verificar`, no inexistencia.
Los documentos archivados/retirados no se ofrecen como nuevas actualizaciones.

## Flujos y botones

- **Abrir original:** usa el acceso autenticado existente y conserva la fuente
  por ID; no busca un PDF por parecido de nombre.
- **Ver publicacion:** abre el detalle de la base indicada, sin volver a elegir
  la version por un estado documental.
- **Revisar borrador:** abre `#/ofertas/<modulo>` y recupera por GET la fuente,
  el borrador y sus diferencias. Verifica ID, categoria y fuente. Muestra que
  la comparacion es la guardada, no una comparacion recalculada contra lo actual.
- **Revisar fuente/actualizacion/vigencia:** abre el modulo existente y la fuente
  seleccionada cuando ese cargador lo admite. No ejecuta POST de analisis.
- **Abrir destino:** abre una pagina existente del Portal de la misma instancia.
  No apunta al Constructor retirado ni admite URL externa o `javascript:`.
- Si una fuente o borrador desaparece o no coincide, se limpia la revision
  anterior en memoria y sus controles; no queda Publicar habilitado por arrastre.

Ofertas conserva su flujo existente de archivos y borrador local del navegador;
esta entrega no conecta su parser/publicacion pendiente. Beneficios mantiene su
catalogo consolidado. No se crean flujos comerciales paralelos.

## Local y produccion

La revision visual usa datos reales de la **base local**, deliberadamente
distintos de produccion: Fijo v2, Claro TV v3, Moviles v1, IoT v6, upload de
equipos 2 y Affinity v65, entre otros. No son las versiones productivas.

En local se observaron borradores Fijo v7 y TV v8 junto con sus publicaciones.
El Portal TV local abre con cabecera v3 y 17 registros activos, mientras el
snapshot de esa base indica tres candidatos. Es evidencia de que cabecera y
contenido deben comprobarse separadamente; no se corrigieron datos de prueba
ni se certifico concordancia comercial del entorno local.

Se ejecuto tambien el servicio local con un adaptador de SELECT por SSH contra
produccion, sin copiarlo ni instalarlo en el servidor. Cada lectura se envolvio
en `BEGIN READ ONLY`/`ROLLBACK`. Corte exitoso: **2026-09-17 18:37:40 UTC**, sin
fallos SQL. Los originales, API y pantallas publicas ya comprobados constan en
la auditoria anterior; no se presentan como una verificacion nueva del panel.

| Modulo | Publicacion actual en produccion | Paso pendiente | Bloqueo real / evidencia faltante | Siguiente accion |
| --- | --- | --- | --- | --- |
| Fijo | v13, 81 candidatos | Vigencia y fuentes posteriores sin vinculo de publicacion | Metadatos incompletos; no es ausencia de publicacion | Revisar fuente y comparacion del modulo |
| Claro TV | v14, 9 candidatos | Vigencia y clasificacion de fuente posterior | Seguimiento antiguo confundido con publicacion | Conservar v14; revisar fuente, sin republicar por la tarjeta |
| Moviles | Base v17, 48 candidatos | Vigencia base y ofertas separadas | Fechas base sin confirmar; ofertas tienen otro ciclo | Revisar boletin base y BYOP vinculados |
| IoT | Cuatro modulos de agosto, sin cabecera de bases | Analisis/revision de septiembre | Publicacion de agosto vencida; septiembre no aplicada | Revisar fuente de septiembre y diff existente |
| Equipos | Upload 8, 477 activos | Metadatos de vigencia/fecha y destino | Fecha de publicacion nula; no elimina el catalogo | Mantener excepcion unica y revisar original |
| Servicios | Sin verificar en el circuito consultado | Fuente y consumidor efectivo | Pagina estatica no certifica estado comercial | Revisar alcance del modulo antes de conectar publicacion |
| Beneficios | fijo_benefits v1 y proyecciones; 12 entradas | Vigencia/fuentes por dominio | Agregado no acredita aprobacion global | Revisar entradas y originales en Benefits |
| Affinity | Sin version independiente encontrada en el circuito consultado | Analisis persistido, revision, aprobacion y publicacion | Auditoria previa reproduce contradiccion GPON 50/100, no ausencia del lector PDF | Revisar aclaracion y borrador en Affinity, sin aplicar decisiones automaticamente |
| Ofertas | v2 conservada | Reemplazo y vigencia | Fecha fin 26/08 vencida aunque el estado almacenado sea vigente | Revisar fuente y flujo de Ofertas |
| Directorio | Estatico visible segun auditoria previa | Original, vigencia y control propio | No heredar estado de Fijo | Revisar directorio y custodia de su original |

### Aclaracion de Claro TV

El historial lee `bases_informativas_publicaciones` y acredita v14 publicada.
La tarjeta productiva anterior lee `operating_control` del JSON y rotula el
avance del proyecto. `Produccion: pendiente` no revoca esa version. El panel
nuevo no mezcla ambas consultas ni necesita republicar Claro TV.

### Precision corregida de la auditoria

La primera redaccion atribuia `/api/motor-ofertas/version-vigente` a otro
circuito. Se reviso `motorOfertasRoutes.js` local y productivo por SSH:
`/version-vigente` y `/vigente` usan el mismo handler `versionVigente`, con
distinta autenticacion. La tabla `motor_ofertas_versiones` tiene numeracion
propia, pero ese endpoint no la lee. La fila de la auditoria se corrigio,
dejando aqui el antecedente de la precision.

## Validacion

128 pruebas focalizadas pasan, cero fallos. Ejecutar desde `backend/`:

```powershell
node --test test/admin-control-service.test.js test/admin-control-routes.test.js test/admin-control-navigation.test.js test/tareas-reglas-admin-ui-contract.test.js test/affinity-modulo-contract.test.js test/admin-fuentes-comerciales-only-contract.test.js test/fuentes-comerciales-ui-contract.test.js test/fuentes-comerciales-equipos-contract.test.js test/constructor-legado-retirado-contract.test.js test/project-plan-contract.test.js test/project-plan-ui-contract.test.js
```

Cobertura: autenticacion 401/403, diez modulos, fallos parciales de lectura,
publicada + fuente nueva + borrador, fallo de analisis sin invalidar publicada,
fuentes compartidas y manifiestos, vigencias vencidas, navegacion por modulo,
limpieza de estados obsoletos y documentos autenticados. Se corrigieron las dos
pruebas de PM-021; permanece la proteccion de REDPLUS $60 y BREDP1 $65 como
identidades separadas. Tambien se adapto el contrato que exigia al endpoint
leer directamente el Plan.

Se validaron los siete bloques JavaScript embebidos con `vm.Script`, el JSON y
la igualdad exacta entre Markdown generado y JSON. No se corrio toda la suite
del repositorio ni flujos de escritura comercial.

En navegador: panel, detalle TV, original PDF autenticado, modal de publicacion,
borrador/comparacion y destino TV; tambien acceso a Affinity sin analisis
automatico. Los nueve destinos HTML devolvieron 200 en local. Las acciones de
los diez tabs se probaron en VM. No se pulsaron publicar, aprobar, guardar ni
analizar en el navegador.

Responsive comprobado a 390 x 844: documento de 375 px, detalle de 351 px y
cero botones del detalle con desborde de texto. La tabla tiene scroll horizontal
interno; no desborda la pagina. Se restauro el viewport al terminar.

## Revision visual

Vista previa: `http://127.0.0.1:4173/#/tareas-reglas-admin`.
Iniciar con `node scripts/preview-admin-control.mjs` desde la raiz. Solo admite
base local, enlaza a 127.0.0.1, configura PostgreSQL en lectura y bloquea metodos
de escritura HTTP con 405 (excepto sesion dev local). No usar este servidor
de revision como configuracion de produccion.

![Resumen local](capturas/panel-admin-2026-09-17/01-resumen-desktop.png)

![Claro TV local, publicada y borrador separados](capturas/panel-admin-2026-09-17/02-claro-tv-desktop.png)

![Claro TV movil](capturas/panel-admin-2026-09-17/03-claro-tv-movil.png)

Pendientes de esta entrega: revision visual de Gabriel, autorizacion posterior
de despliegue y comprobacion del panel en produccion. Las discrepancias del
Centro de Cargas general y los flujos comerciales incompletos se conservan como
pendientes; esta mejora no los declara resueltos. PM-026 sigue en validacion.
