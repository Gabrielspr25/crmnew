# Reconciliacion tecnica de solo lectura - 2026-09-19

## Alcance

Comparacion de `/opt/crmp-nuevo` contra `HEAD`
`d9735d7172c3f40b0b7ebc78a1a6ca0c4aa8a93d`. Se uso SSH de solo lectura,
hashes SHA-256 y lectura de codigo. No se ejecuto escritura en servidor, base
de datos, Git remoto, despliegue, migracion ni publicacion comercial.

El inventario completo de 213 rutas, hashes de produccion y hashes de la rama
esta en `docs/auditorias/2026-09-19-inventario-desplegable-hashes.tsv`.
Su SHA-256 es
`fbc04632d4ddbe147c0199f63bce210f97f2938ac0f6778588ff973e083b348a`.

## Correspondencia de archivos

- 153 rutas son identicas por contenido.
- 7 rutas tienen contenido distinto.
- 2 rutas existen solo en `HEAD`: la migracion `2026-09-15-notes-soft-delete.sql`
  y `backend/src/services/adminControlService.js`.
- 51 rutas existen solo en produccion; 46 son historicos o respaldos. Las
  restantes incluyen dos servicios backend y archivos de portal heredados.
- No se crea etiqueta: el alcance completo no es equivalente. En particular,
  siguen diferentes rutas de Admin, Asana, fuentes, preview y portal heredado.

## Diferencias de fuentes y Plan Maestro

| Hallazgo | Evidencia | Correccion propuesta | Dependencia | Criterio de cierre |
| --- | --- | --- | --- | --- |
| `fuentesComercialesRoutes.js` no coincide | Produccion: SHA `076ff7...d4638`, 1700 lineas, mtime 2026-09-17. Rama: SHA `3b621e...728a9`, 1756 lineas. Ningun blob alcanzable de Git coincide exactamente con la copia productiva. | No sobrescribir. Llevar en una etapa separada y probada los controles locales: huella de preview, revalidacion de originales, transaccion, lock asesor e idempotencia. | Pruebas de fallo inyectado contra una BD aislada y revision de la politica de snapshot publicado. | Hash del paquete aprobado coincide en servidor, pruebas de rollback/reintento pasan y se verifica el flujo visible. |
| `projectPlanService.js` no coincide | Produccion: SHA `b10b98...4dc0b`, 195 lineas. Rama: SHA `24c351...da3f3`, 279 lineas. La adicion local proviene del commit `df74344`; la copia productiva tampoco coincide con un blob Git alcanzable. | No sobrescribir. Revisar por separado la validacion y render del `closure_checklist`, que solo existen en la rama. | Decidir si el checklist pertenece al contrato publicado de Admin y comprobar que el JSON validado es el que se sirve. | Prueba de servicio/UI contra el artefacto desplegable, con JSON valido y Markdown generado. |
| Produccion sin Git utilizable | `/opt/crmp-nuevo` no permite `git rev-parse`; el inventario por contenido si es completo dentro del alcance declarado. | Mantener comparacion por hash y conservar el TSV. No inferir un commit productivo. | Un procedimiento futuro que despliegue desde un checkout identificable o manifiesto firmado. | Todas las rutas de alcance y sus exclusiones documentadas coinciden con un commit o release manifest. |
| Markdown actual frente a candidato | Actual: SHA `bd7912...b6e1`, 94 lineas. Copia previa: `a0f29c...df6d`, 63 lineas. Candidato temporal: `ab5d88...1d3b`, 107 lineas. El candidato se genero desde el JSON actual con `renderProjectPlanMarkdown()`. | No reemplazar. Conservar ambos Markdown y el candidato temporal. El candidato contiene todas las lineas del actual y agrega solo el checklist de cierre. | Confirmar el uso deseado del generador en el flujo documental, no la memoria de una persona. | Regeneracion repetible desde el mismo JSON produce el hash candidato y una revision confirma que el checklist debe formar parte del Markdown. |
| Copia previa de Markdown | Frente al candidato: 19 lineas exclusivas de la copia previa y 63 exclusivas del candidato; son estados y seguimiento de fechas anteriores, no un apendice manual independiente identificado. | Conservar como evidencia historica; no restaurar sobre el actual. | Ninguna hasta que se requiera reproducir el estado del 2026-09-16. | La copia queda referenciada por hash y no se pierde al limpiar temporales. |
| Contrato Asana `Eliminadas` | La migracion y `PATCH /asana-real/tasks/:taskId` admiten `cancelada`; `GET /asana-real/agenda` filtra solo `pendiente` y `completada`. La UI tampoco ofrece `cancelada` en el editor. La expectativa se agrego en el mismo commit `5fe2732` que introdujo la UI, sin implementacion de DELETE. | No tocar codigo ni prueba. Separar el requisito valido (historial visible de canceladas, sin tratarlas como activas) de la expectativa no sustentada (eliminacion fisica). | Definicion funcional de retencion: cancelacion visible, archivado o eliminacion. La API actual solo modela cancelacion. | Una especificacion decide la retencion y backend/UI/prueba expresan el mismo estado sin ocultar ni borrar tareas por inferencia. |
| TV v10 y las ocho opciones | El PDF, parser y snapshot v3 contienen las ocho; v10 las deja en `contenido_excluido`. Publicarla desactivaria `claro_tv_equipos`. | Mantener v10 sin publicar y preparar un candidato que incluya el bloque de equipos antes de otra aprobacion. | Revision comercial del alcance completo de TV y fuente/vigencia confirmadas. | Las ocho opciones aparecen como candidatas del modulo correcto y una comparacion no propone bajas sin evidencia expresa. |

## Procedencia comprobable de las dos versiones

Las correcciones de la rama preservada estan atribuidas por `git blame` a
`df74344` (2026-09-19):

1. Fuentes: agrega `preview_fingerprint`, comprueba que los originales no
   cambiaron, devuelve `preview_desactualizado` cuando corresponde y guarda el
   conjunto de categorias dentro de una transaccion con lock e idempotencia.
2. Plan Maestro: valida `closure_checklist` y lo renderiza en Markdown.

Las copias productivas de ambos archivos tienen mtime 2026-09-17, pero no
coinciden con ningun blob de los commits alcanzables. Su procedencia
comprobable es, por tanto, el archivo instalado en servidor y su hash, no un
commit atribuible. Esto bloquea una etiqueta de correspondencia.

## Decisiones comerciales recuperadas

No se encontro una fuente autoritativa que denomine ocho decisiones
comerciales como `D1` a `D8`. Esos identificadores no se reutilizan aqui. La
auditoria original si contiene **ocho registros comerciales de Claro TV**,
numerados 1 a 8, y una unica decision operativa: **no autorizar sus bajas ni
publicar TV v10**. Son opciones distintas; no se deduplican por Item Code.

| Registro original | Opcion documental | Estado comercial |
| --- | --- | --- |
| 1 | `40941H` control remoto, CASH, $6.00 | Abierto dentro de la unica decision TV: no bajar. |
| 2 | `40942H` STB con contrato, CASH, $40.00 | Abierto dentro de la unica decision TV: no bajar. |
| 3 | `40942H` STB sin contrato, NOCONT, $40.00 | Abierto dentro de la unica decision TV: no bajar. |
| 4 | `40942H` STB FINA24, $1.67 por 24 meses | Abierto dentro de la unica decision TV: no bajar. |
| 5 | `40942H` STB FINA12, $3.33 por 12 meses | Abierto dentro de la unica decision TV: no bajar. |
| 6 | `80105H` Dongle 4K, CASH, $30.00 | Abierto dentro de la unica decision TV: no bajar. |
| 7 | `80105H` Dongle 4K FINA24, $1.25 por 24 meses | Abierto dentro de la unica decision TV: no bajar. |
| 8 | `80105H` Dongle 4K FINA12, $2.50 por 12 meses | Abierto dentro de la unica decision TV: no bajar. |

Decisiones previas conservadas, no abiertas de nuevo:

- Affinity GPON aplica desde 100 Mbps; el plan de 50 Mbps queda fuera. Falta
  trazar esa decision en el futuro borrador, no tomarla otra vez.
- `REDPLUS $60` y `BREDP1 $65` son identidades separadas. PM-021 permanece
  retirado; no se fusionan por nombre ni se promueve el Motor a partir de esa
  ambiguedad.

La unica decision comercial abierta que esta auditoria puede demostrar es el
alcance de equipos de Claro TV en un futuro candidato. Las demas diferencias
de esta etapa son tecnicas, de trazabilidad o de vigencia por comprobar.
