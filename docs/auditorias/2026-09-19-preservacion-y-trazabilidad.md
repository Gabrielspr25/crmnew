# Preservacion y trazabilidad - 2026-09-19

## Alcance

Etapa de preservacion del repositorio `newcrm`. No se hicieron despliegues,
pushes, merges, migraciones, publicaciones comerciales ni cambios de
funcionalidad. La evidencia de produccion se obtuvo por SSH en modo de solo
lectura y por hashes de archivos; no se leyeron datos de clientes ni secretos.

## Recuperacion

- Copia recuperable: `C:\Users\Gabriel\.codex\backups\newcrm-preservacion-20260919-093003`.
- Contiene bundle Git verificado, parches binarios de cambios versionados,
  copia de 43 fuentes/documentos tecnicos no versionados permitidos, manifiesto
  y sumas SHA-256.
- Se excluyeron secretos, archivos `.env`, uploads, capturas, temporales y el
  documento personal detectado en la raiz.

## D1-D8

Estas etiquetas se crean en esta auditoria para concentrar decisiones que
estaban dispersas; no reinterpretan ni reabren una decision comercial previa.

| Decision | Estado | Alternativas y recomendacion | Impacto | Evidencia | Decision previa de Gabriel |
| --- | --- | --- | --- | --- | --- |
| D1. Preservar el estado de trabajo antes de consolidar | Cerrada | Alternativas: operar sobre el arbol sucio o conservar copia recuperable. Recomendacion aplicada: bundle, parches y manifiesto antes de crear rama. | Permite recuperar el estado previo sin usar `reset` ni alterar produccion. | Backup verificado por `git bundle verify`; `SHA256SUMS.txt` en la copia. | Autorizacion de esta etapa. |
| D2. Consolidar solo codigo, pruebas y documentacion tecnica | Cerrada | Alternativas: incluir todo el arbol o excluir material no versionable. Recomendacion aplicada: excluir secretos, datos personales, uploads, temporales y capturas. | Los commits quedan auditables y no incorporan material sensible o descartable. | `manifest.json` de la copia y lista de excluidos de Git. | Autorizacion de esta etapa. |
| D3. Correspondencia con produccion por hash, no por commit | Cerrada | Alternativas: etiquetar por la rama local o exigir correspondencia comprobada. Recomendacion aplicada: no crear etiqueta mientras no haya equivalencia integral. | Evita presentar un commit local como codigo productivo sin evidencia. | `/opt/crmp-nuevo` no contiene repositorio Git; hashes coinciden para `frontend/app.html`, `backend/src/server.js` y `prospectosApifyService.js`; difieren `fuentesComercialesRoutes.js` y `projectPlanService.js`. | Autorizacion de esta etapa exige etiqueta solo si representa fielmente el servidor. |
| D4. TV v10 con ocho equipos omitidos | Pendiente de decision comercial | Alternativas: publicar v10 y retirar el modulo activo, o mantenerla sin publicar. Recomendacion: mantener v10 pendiente y comparar las ocho filas contra la fuente oficial antes de un nuevo borrador. | Publicarla desactivaria `claro_tv_equipos`; no se interpretan las diferencias como bajas. | `docs/constructor/revision-tv-ocho-diferencias-2026-09-17.md`, secciones Dictamen y ocho filas. | Decision previa: no autorizar las ocho bajas; instruccion actual de mantener v10 pendiente. |
| D5. Affinity GPON desde 100 Mbps | Cerrada comercialmente; pendiente de trazabilidad | Alternativas: aplicar 50 Mbps por una menciones conflictiva, o conservar desde 100 Mbps. Recomendacion: conservar desde 100 Mbps y registrar la aclaracion en el futuro borrador, sin publicar desde esta auditoria. | Excluye el plan GPON de 50 Mbps del descuento; evita que el parser resuelva la contradiccion por inferencia. | `docs/constructor/affinity-modulo-v1.md`, resolucion del 2026-09-07; Plan Maestro conserva la aclaracion. | Gabriel, 2026-09-07. |
| D6. Separar REDPLUS de BREDP1 | Cerrada comercialmente | Alternativas: fusionar por similitud de nombre o conservar identidades distintas. Recomendacion aplicada: `REDPLUS $60` no equivale ni reemplaza `BREDP1 $65`; escenarios multilínea siguen bloqueados por fuente ambigua. | No se altera precio, elegibilidad ni motor de Business RED Plus por inferencia. | `docs/motor-ofertas/auditoria-identidad-redplus-y-precedencia-fuentes-2026-08-31.md`, conclusion y recomendaciones. | Gabriel, 2026-09-17; PM-021 retirado. |
| D7. Migracion local del 2026-09-15 | Pendiente tecnica | Alternativas: aplicar la migracion, descartarla o conservarla para revision. Recomendacion: conservarla en el commit y no ejecutarla hasta una autorizacion separada con backup y plan de retorno. | Produccion no contiene ese archivo en su inventario de migraciones; no se cambia esquema. | Inventario SSH de `backend/migrations`; archivo local `2026-09-15-notes-soft-delete.sql`. | Autorizacion actual prohíbe migraciones. |
| D8. Markdown restaurado | Pendiente de resolucion documental | Alternativas: declarar equivalencia sin prueba, restaurar uno de los lados o conservar ambos como evidencia. Recomendacion: conservar ambas copias y no sobrescribir ninguna hasta identificar la version que se pretendia restaurar. | Evita perder cambios del Plan Maestro por una restauracion no comprobada. | SHA-256 actual `BD7912...B6E1` y evidencia previa `.tmp-stage-portal-solution` `A0F29...DF6D`; `Compare-Object` confirma diferencias de contenido. | No se encontro una decision previa que indique cual version debe prevalecer. |

## Inventario de produccion, solo lectura

- Servidor: `ventaspro-server`, ruta `/opt/crmp-nuevo`.
- No hay `.git` utilizable en esa ruta; no es posible obtener una rama o SHA de
  produccion desde el servidor.
- Esquema `crm_pro`: existen `prospectos`, `asana_tasks` y
  `subscriber_history`; no existe `affinity_benefits_versions`.
- El servidor contiene migraciones hasta `2026-09-10-subscriber-phone-per-ban.sql`.
  La existencia de un archivo no demuestra por si sola la aplicacion de cada
  migracion porque no hay tabla de control de migraciones detectada.

## Diferencias pendientes

1. `backend/src/routes/fuentesComercialesRoutes.js` y
   `backend/src/services/projectPlanService.js` no coinciden por hash con sus
   copias productivas.
2. La migracion local `2026-09-15-notes-soft-delete.sql` no esta en el
   inventario del servidor y no fue ejecutada.
3. El Markdown del Plan Maestro y la copia previa conservada no son iguales;
   falta identificar el origen correcto antes de una restauracion.
4. TV v10 sigue sin publicar por la omision tecnica de ocho equipos.
5. La prueba dirigida de Asana conserva como contrato el rotulo `Eliminadas`,
   pero `frontend/app.html` consolidado no lo contiene. La prueba de notas de
   cliente pasa desde `backend/`; la discrepancia de Asana queda pendiente de
   una decision funcional separada, sin ajustar codigo en esta etapa.

## Verificacion local

- `git diff --check HEAD`: sin errores de espacio en cambios versionados.
- Pruebas dirigidas: 62 de 63 subpruebas pasaron cuando se ejecutaron en el
  lote de preservacion; la unica falla funcional fue el contrato de Asana
  descrito arriba. La primera invocacion de `client-notes-contract` desde la
  raiz no es un fallo del producto: ese archivo calcula rutas relativas para
  ejecutarse desde `backend/`, donde paso.

## Siguiente accion de cierre

Revisar D8 para decidir la fuente correcta del Markdown y, en una autorizacion
separada, preparar la matriz comercial de TV v10 con sus ocho equipos. Solo
despues de esa decision conviene evaluar publicacion comercial o una migracion.
