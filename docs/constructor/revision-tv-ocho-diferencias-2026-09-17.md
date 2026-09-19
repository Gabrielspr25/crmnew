# Revision de las ocho diferencias de Claro TV - 2026-09-17

## Dictamen

**NO AUTORIZAR LAS OCHO BAJAS. NO PUBLICAR v10 en su estado examinado.**

Las ocho opciones siguen escritas en la pagina 2 del PDF oficial. El parser existente extrae las ocho; el snapshot publicado v3 conserva las ocho y v10 tambien las conserva, pero dentro de `contenido_excluido`, fuera de sus modulos candidatos. No se encontro una baja comercial expresa que justifique retirarlas.

El archivo recibido, el original del repositorio y la referencia documental de v3 tienen el mismo SHA-256. No hay una nueva revision documental que explique estas ocho eliminaciones. El cambio observado es de seleccion tecnica de contenido, no una retirada demostrada por el documento.

La funcion de publicacion instalada en la BD local desactiva las secciones activas ausentes de los modulos candidatos. Publicar v10 tal como esta desactivaria `claro_tv_equipos`, hoy activo con ocho filas. No borraria fisicamente su historial, pero retiraria ese modulo del catalogo activo.

## Alcance y metodo

- Lecturas limitadas al repositorio `newcrm` y a PostgreSQL local: `crm_pro`, servidor `::1`, puerto 5432. Conexion mediante `backend/src/db.js`, `BEGIN READ ONLY`, verificacion de `transaction_read_only = on` y cierre con `ROLLBACK`.
- Snapshot de evidencia: `2026-09-17T19:58:26.962Z`. Inventario adicional de PDF: `2026-09-17T20:01:45.924Z`. Los estados descritos corresponden a esas lecturas locales, no a produccion.
- Lectura de `AGENTS.md`, `CLAUDE.md` y `docs/constructor/revision-admin-ofertas-local-2026-09-17.md`.
- Extraccion del PDF archivado con `scripts/extract_pdf_text.py` y `scripts/parse_planes_fijos_pdf.py`, sin modificar los scripts. Revision visual de la pagina 2 renderizada con Poppler.
- Autoridad comercial: el PDF. El codigo y la definicion SQL se examinaron exclusivamente para explicar el comportamiento tecnico y su riesgo.
- Sin navegador, upload, escrituras BD, publicaciones ni acceso a produccion. Solo este informe y evidencia en `docs/constructor/capturas/cierre-admin-2026-09-17/`. No se modificaron frontend, backend, parser ni Plan Maestro.

## Documento y custodia

Documento: `LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf`, 3 paginas, 381117 bytes.

Original disponible: `Planes para web/Estructura de planes/planes/LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf`.

Original archivado de la recepcion examinada: `backend/uploads/fuentes-comerciales/claro_tv/2026-09-17/1253afddab05-LISTADO_ESTRUCTURA_PLANES_PYMESNEGOCIOS_TODOS_2026_15_260330.pdf`.

SHA-256 coincidente del original, archivo recibido, fuente nueva y snapshot v3:

```text
1253afddab051440c06a1eae160d700178182dcc5930a87dcdcd3027da59e236
```

La pagina 1 dice `LISTADO PLANES ESTRUCTURA DE NEGOCIOS VIGENTE DESDE Q3 2024 al 2026` y `REV. 03.31.2026`. El nombre termina en `260330`, pero no sustituye la revision visible. El parser devuelve `rev = 03.31.2026`, `version_doc = null` y ningun error de extraccion. Esto no certifica por si solo vigencia comercial actual.

| Dato | Publicada local v3 | Recepcion/local v10 |
| --- | --- | --- |
| ID de version | `60265e2d-bf75-47b3-a7f2-b4da19501aa7` | `4966e97d-b0c4-4e6f-af3c-6460ab2f1332` |
| Estado observado | `publicada` | `aprobada`, no `borrador` |
| Fuente enlazada | `fuente_comercial_id = null`; nombre y hash historicos guardados | `0ffc907a-6a93-4f6b-bd7c-64ccff1f339f` |
| Fuente anterior/nueva | `LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS 2026` | Nombre completo del PDF indicado arriba |
| Hash documental | `1253af...` completo arriba | Identico |
| Fecha base almacenada | `2026-03-31` | `2026-03-30` |
| Publicada en | `2026-08-30T17:49:53.392Z` | `null` |
| Aprobada por/en | `codex-local`, `2026-08-30T17:49:53.388Z` | `dev`, `2026-09-17T19:37:17.751Z` |
| Snapshot de modulos | 6 planes + 3 complementos + 8 equipos = 17 filas | 6 planes + 3 complementos = 9 filas |
| `candidatos_publicos` | 3 entradas historicas; no representan las 17 filas publicadas | 9 entradas |
| `contenido_excluido` | 0 entradas | 40 entradas, entre ellas las ocho examinadas |

La fuente nueva esta `activa`, pero con `vigencia_documental = pendiente_confirmacion` y fechas de vigencia nulas. Su estado y la aprobacion tecnica de v10 no autorizan bajas comerciales. No se atribuye a v3 un enlace de fuente que no tiene: su trazabilidad aqui es el nombre y SHA-256 del snapshot.

## Las ocho filas

Todas pertenecen a `claro_tv_equipos`, pagina 2, bloque **Equipos / Decodificadores (STB) Clarotv+ - Television / Internet**, anterior al bloque Equipos / Ofertas Internet. Los valores SIF y precios siguientes se cotejaron con el PDF visible, no se dedujeron del codigo.

La causa indicada en cada fila es comprobada: aparece una vez en la extraccion, una vez en el snapshot v3 y una vez en los excluidos de v10, pero cero veces en sus candidatos. Los numeros de fila de auditoria son referencias del extractor, no numeros impresos en el PDF.

| N | Item Code / registro documental | SIF / SAP | Precio y modalidad visibles en PDF | Pagina / fila de auditoria | Causa de la diferencia | Conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `40941H` - 2do CONTROL REMOTO EN ADELANTE (REEMPLAZO) | CASH / 7008624 | $6.00 | 2 / 85 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 2 | `40942H` - STB FULL PRICE CLIENTES CON CONTRATO | CASH / 7008557 | $40.00 | 2 / 77 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 3 | `40942H` - STB FULL PRICE CLIENTES SIN CONTRATO | NOCONT / 7008557 | $40.00 | 2 / 78 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 4 | `40942H` - STB FINANCIADO 24 MESES CLIENTES CON CONTRATO | FINA24 / 7008557 | $40.00; mensual financiado $1.67 a 24 meses | 2 / 79 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 5 | `40942H` - STB FINANCIADO 12 MESES CLIENTES CON CONTRATO | FINA12 / 7008557 | $40.00; mensual financiado $3.33 a 12 meses | 2 / 80 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 6 | `80105H` - DONGLE 4K - FULL PRICE CLIENTES CON/SIN CONTRATO | CASH / 7009940 | $30.00 | 2 / 81 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 7 | `80105H` - DONGLE 4K - FINANCIADO 24M CLIENTES C/CONTRATO | FINA24 / 7009940 | $30.00; mensual financiado $1.25 a 24 meses | 2 / 82 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |
| 8 | `80105H` - DONGLE 4K - FINANCIADO 12M CLIENTES C/CONTRATO | FINA12 / 7009940 | $30.00; mensual financiado $2.50 a 12 meses | 2 / 83 | Extraido; excluido de candidatos y modulos v10 | No autorizar baja |

Son ocho opciones distintas sobre tres Item Codes: cuatro STB, tres Dongle y un control remoto. No deben deduplicarse por Item Code ni equipararse modalidades CASH, NOCONT, FINA12 y FINA24. El cotejo preservo descripcion, pagina, precio y texto original; no invento equivalencias ni sustituyo el snapshot publicado por un reparseo del original.

En las modalidades financiadas, la columna Penalidad dice `Restante de $40.00` para STB y `Restante de $30.00` para Dongle. No se interpreta ese texto como una penalidad fija. En algunas filas CASH, los campos estructurados historicos omiten SIF/tecnologia que si aparecen en el PDF; esta revision no certifica extraccion perfecta de todos los campos ni cambia su interpretacion comercial.

Las filas GRATIS adyacentes no son estas ocho opciones. Tampoco lo es `NPVR250` (Cloud DVR), que permanece entre los complementos. La advertencia de v10 `contenido_temporal_excluido`, total 12, no demuestra temporalidad ni baja de las ocho filas aqui identificadas.

## Causa tecnica y efecto de publicar

1. El parser existente reconoce `claro_tv_equipos` y obtiene sus ocho filas del documento.
2. La seleccion de candidatos del parser y `PREVIEW_DEFINITIONS.claro_tv` en `backend/src/services/basesInformativasPreview.js` no incluyen ese bloque de equipos. La definicion de TV genera planes y complementos.
3. El servicio conoce el bloque en `ARRAY_CATEGORIES`, pero `excludedRows()` lo conserva como contenido excluido; no lo convierte en un modulo candidato de v10.
4. El diff persistido refleja exactamente: 0 nuevos, 8 eliminados, 0 modificados, 9 sin cambios; total anterior 17 y total actual 9. El apartado de modulos identifica `claro_tv_equipos` como eliminado. Cambios de representacion de los otros modulos no prueban cambios comerciales de sus nueve registros.
5. En `planes_modulos` local siguen activos los modulos 7 (`claro_tv_planes`, 6 filas), 8 (`claro_tv_servicios_complementos`, 3) y 9 (`claro_tv_equipos`, 8). Las ocho filas del modulo 9 son exactamente iguales al arreglo de filas de ese modulo en el snapshot v3.
6. La definicion SQL instalada de `public.publicar_base_informativa(uuid,text)`, obtenida mediante `pg_get_functiondef` sin invocarla, exige estado `aprobada` y desactiva los modulos activos cuya `seccion_key` no aparece en `modulos_generados`. v10 ya tiene ese estado y carece de la seccion de equipos.

**Riesgo alto de perdida de contenido activo por omision tecnica.** La comparacion alerta de una eliminacion real del conjunto candidato, pero no proporciona autorizacion comercial para ejecutarla. Conservar v3 como publicada hasta resolver expresamente el alcance completo de TV y revisar de nuevo el conjunto publicable. No se propone ni ejecuta una correccion del parser en esta tarea.

## Inventario adicional para una carga nueva

Se inventariaron PDF dentro del repositorio, incluidos uploads, archivo historico y worktrees contenidos en el directorio, sin buscar fuera de el. Se excluyeron dependencias, entornos virtuales y `.git`. Resultado: 52 rutas, 13 SHA-256 distintos. Cada hash se cotejo contra `public.fuentes_comerciales` local en una transaccion de solo lectura.

- **No se encontro otro PDF de estructura Fijo/TV con hash sin archivar.** Las diez copias de la estructura `1253af...` son identicas y ya tienen la fuente `0ffc907a-6a93-4f6b-bd7c-64ccff1f339f`. Renombrarlas o elegir otra copia no cambia el hash ni evita el duplicado.
- Existe otra estructura de tres paginas bajo `backend/uploads/fuentes-comerciales/fijos/2026-09-06/771f75cef8c8-LISTADO_ESTRUCTURA_PLANES_PYMESNEGOCIOS_TODOS_2026_15_260330.pdf`. SHA-256 `771f75cef8c801831339e922586f6cf4cb2b4e9b62578e27b53c7622d7e7dbe0`, ya archivado en la fuente `bdc8f616-3ea6-45af-8efe-cad6585c1f54`, familia `fijos`. Su extraccion tambien muestra `REV. 03.31.2026`. No es candidato a una carga nueva y no se uso como sustituto del snapshot TV.
- Hay un documento oficial relacionado SIN hash archivado: `documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`, SHA-256 `e50a2fb7f1d40e45acb93ca312b44ed8efd67cf556796c44f529723938c4c9eb`. Sus 35 paginas comienzan con Beneficios de Convergencia PYMES, valido desde el 23 de julio de 2026 (V.16); paginas 2-4 explican combinaciones fijo/movil y elegibilidad. **Es de convergencia, no una nueva estructura de planes Fijo/TV.** No se recomienda reclasificarlo para forzar esta prueba ni se garantiza HTTP 201: falta verificar su flujo especifico y validacion de familia.
- Los otros hashes no archivados corresponden a material movil o inalambrico/IoT; no acreditan una alternativa equivalente para la prueba solicitada.

La repeticion del hash `1253af...` corresponde al caso duplicado, no a una carga nueva 201. No se creo, altero ni subio ningun PDF. El bloqueo del selector Chrome comunicado por el usuario no se intento sortear; esta investigacion no utilizo navegador.

## Consultas de control de solo lectura

Ejecutadas a traves del pool del backend con destino local verificado. Este bloque permite repetir la observacion, no publicar ni modificar datos:

```sql
BEGIN READ ONLY;
SELECT current_database(), host(inet_server_addr()), inet_server_port(),
       current_setting('transaction_read_only');

SELECT id, numero, categoria, estado, fuente_comercial_id, fuente_sha256,
       aprobada_por, aprobada_en, publicada_en, reemplazada_en,
       md5(modulos_generados::text) AS snapshot_modulos_md5
FROM public.bases_informativas_publicaciones
WHERE id IN ('60265e2d-bf75-47b3-a7f2-b4da19501aa7',
             '4966e97d-b0c4-4e6f-af3c-6460ab2f1332')
ORDER BY numero;

SELECT id, pagina, seccion_key, activo,
       jsonb_array_length(contenido->'filas') AS filas,
       md5(contenido::text) AS contenido_md5
FROM public.planes_modulos
WHERE pagina = 'claro_tv'
ORDER BY seccion_key;

SELECT id, familia, sha256, estado, vigencia_documental
FROM public.fuentes_comerciales
WHERE id = '0ffc907a-6a93-4f6b-bd7c-64ccff1f339f';
ROLLBACK;
```

Los MD5 del control son indicadores de cambio de JSON, no hashes de custodia documental; la custodia usa SHA-256. El snapshot adjunto conserva el contenido leido para cotejos posteriores. No se afirma que la BD completa o produccion hayan sido auditadas ni que otros actores no puedan cambiar el ambiente despues de la lectura.

## Evidencia

- [Snapshot local de fuente, versiones y modulos](capturas/cierre-admin-2026-09-17/tv-ocho-diferencias-bd-local.json).
- [Cotejo de las ocho filas y hashes](capturas/cierre-admin-2026-09-17/tv-ocho-diferencias-cotejo.json).
- [Salida del parser existente](capturas/cierre-admin-2026-09-17/tv-ocho-diferencias-parser-oficial.json).
- [Texto extraido de las tres paginas](capturas/cierre-admin-2026-09-17/tv-ocho-diferencias-texto-pdf.json).
- [Pagina 2 renderizada y revisada](capturas/cierre-admin-2026-09-17/tv-ocho-diferencias-pagina-2.png).
- [Definicion local de publicacion, solo consultada, NO ejecutada](capturas/cierre-admin-2026-09-17/tv-publicar-base-informativa-definicion-local.sql).
- [Inventario de PDF y coincidencias de hash en BD local](capturas/cierre-admin-2026-09-17/tv-inventario-pdf-local.json).

## Condicion de cierre

La investigacion de las ocho diferencias queda documentada. **La publicacion sigue sin autorizacion en esta revision.** La ausencia en candidatos no equivale a una baja expresa, y aprobar tecnicamente el borrador no subsana esa falta de fundamento. No se realizaron cambios de precios, datos, reglas, cantidades del parser ni publicaciones.
