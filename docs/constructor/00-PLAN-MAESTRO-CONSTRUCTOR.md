# Plan Maestro - Constructor Comercial

> Fuente unica estructurada: `docs/constructor/plan-maestro-constructor.json`.
> Este documento se genera desde JSON; no mantenerlo como segunda verdad manual.

- Estado general: en_validacion
- Fase: Admin Ofertas probado localmente hasta aprobacion TV sin publicar; panel Admin en revision visual
- Entorno: local
- Ultima actualizacion: 2026-09-17
- Avance visual: 55%
- Produccion: PARCIAL

El porcentaje de avance es solo una referencia visual del progreso. No representa calidad tecnica ni autorizacion para produccion.

## Control Operativo Obligatorio

Seguimiento documental de construccion y validacion. production_status no equivale a estado de publicacion comercial. El panel local consulta evidencia comercial independiente del Plan; la version productiva anterior sigue pendiente de una correccion autorizada. Consultar publication_audit y revision-panel-admin-local-2026-09-17.md.

1. Identificar superficie exacta: CRM PYMES/Admin Ofertas, Portal web, Motor Comercial o Constructor.
2. Separar evidencia local de evidencia de produccion.
3. Confirmar fuente oficial archivada, analisis real, estado de publicacion y consumidores impactados.
4. Probar en la superficie afectada despues del despliegue antes de declarar el cambio listo.
5. Sin evidencia completa, usar pendiente, en validacion o bloqueado; nunca Al dia ni terminado.
6. Ausencia de comprobacion no significa ausencia de publicacion. Separar documento, analisis, borrador, aprobacion, publicacion, vigencia y consumidor.
7. Decision de Gabriel 2026-09-17: PM-021 retirado por confusion. REDPLUS $60 y BREDP1 $65 son identidades separadas; no relacionar ni fusionar. Ficha original conservada en retired_items.
8. Avances, pruebas y done anteriores son evidencia historica en su fecha y ambiente, no certificacion del runtime actual. El Constructor retirado no se reconstruye en esta etapa.
9. Auditoria inicial: docs/constructor/auditoria-centro-cargas-produccion-2026-09-17.md. Posteriormente se consulto tambien la base local para revisar el panel; no confundir sus versiones con produccion.
10. Panel Admin: implementacion local de solo lectura de evidencia. Publicacion existente, nueva fuente, borrador y comprobacion del destino se separan. Revision visual de Gabriel y despliegue pendientes; no se reactiva el Constructor.
11. Revision operativa posterior: docs/constructor/revision-admin-ofertas-local-2026-09-17.md. Prueba documental acotada en BD local: fuente archivada, Fijo v9 borrador y TV v10 aprobada tecnicamente, sin publicar. TV v3/Fijo v2 locales conservadas; no confundir con TV v14/Fijo v13 productivas. No despliegue.

### Modulos Administrativos

| Modulo | Estado | Local | Produccion | Ultima revision | Evidencia | Impacto a verificar | Proximo paso |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planes Fijos | En validacion | Terminado | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: Base v13 publicada el 2026-08-20: 81 filas en cuatro modulos. Original y hash verificados; extraccion y candidatos persistidos; validada/aprobada/publicada con fechas. Versiones anteriores conservadas. Fuente pendiente_confirmacion, fechas de vigencia nulas; fecha base 2026-03-30 no es vencimiento. | CRM PYMES/Admin Ofertas, Portal web: Planes Fijos, Claro TV cuando el documento contiene su bloque | Conservar v13; revisar vigencia documental y fuente seleccionada sin republicar. |
| Claro TV | En validacion | En validacion | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: v14 publicada el 2026-08-20 13:14:16-04: 6 planes y 3 complementos; fuente fija d0c88196-e9d8-48f7-aa3d-7250b4459c63 y SHA verificados. Carga, validacion, aprobacion y publicacion registradas; borradores anteriores no anulan v14. Fuente vinculada pendiente_confirmacion y fechas nulas. Base 2026-03-30 no equivale a vigencia. | CRM PYMES/Admin Ofertas, Portal web: Claro TV | Conservar v14; separar seguimiento de publicacion y confirmar vigencia. No republicar para corregir una tarjeta. |
| Planes Moviles | En validacion | Terminado | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: Catalogo base v17 publicado el 2026-09-09: 48 candidatos, tres modulos. Fuente/hash verificados, validacion sin errores, aprobacion/publicacion registradas; v15/v16 reemplazadas. Base 2026-06-19; fuente pendiente_confirmacion, fechas nulas. Las ofertas v2 son otro circuito con fecha fin 2026-08-26. | CRM PYMES/Admin Ofertas, Portal web: Planes Moviles, Constructor futuro | Confirmar vigencia base y revisar por separado ofertas v2; no confundir catalogo con promociones. |
| Inalambrico / IoT | En validacion | Terminado | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: Cuatro modulos productivos de agosto, actualizados 2026-08-15. Fuentes agosto/septiembre archivadas y hashes verificados. Septiembre no esta aplicado al destino; no hay borrador persistido en bases. Su publicacion previa documentada es local. Publicado agosto: 2026-08-01 a 2026-08-31, vencido al corte. Fuente agosto sigue etiquetada vigente; septiembre tiene fechas nulas. | CRM PYMES/Admin Ofertas, Portal web: Inalambrico / IoT | Revisar analisis/diff de septiembre y aprobacion para un reemplazo futuro autorizado; conservar evidencia de agosto. |
| Lista de Equipos/Precios | En validacion | En validacion | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: equipos_uploads id8 publicada; Excel septiembre-octubre fuente 6d032a8e-1452-4164-851c-1403ed06caaa, SHA verificado; 477 items. publicado_en null no desmiente catalogo publicado; no inferir aprobador/fecha ausentes. Fuente vigente; upload pendiente_confirmacion y fechas nulas. Se conserva excepcion unica de revision, sin generalizarla ni deducir fechas del nombre. | CRM PYMES/Admin Ofertas, Portal web: Lista de Equipos, Motor Comercial cuando exista fuente aprobada | Mantener catalogo y excepcion unica; reconciliar seguimiento/metadatos sin republicar. |
| Servicios | En validacion | En validacion | Pendiente | 2026-09-17 | Produccion auditada 2026-09-17: Sin fuentes familia servicios ni bases categoria servicios ni modulos activos de Servicios en las tablas auditadas. Valores agregados publicados de Fijo son otro alcance. No evaluable para version de Servicios en este circuito. | CRM PYMES/Admin Ofertas, Portal web: Servicios | Definir fuente y circuito real de Servicios antes de implementarlo; mantener alcance documental. |
| Beneficios | En validacion | En validacion | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: fijo_benefits v1 vigente aprobada/publicada el 2026-08-30 con nueve reglas; catalogo agrega ofertas_moviles y devuelve 12 entradas. Fuente Claro Full archivada con hash verificado; Affinity historico sigue publicado en Fijo. API informa vigencia por entrada; Claro Full desde 2026-07-23 sin fin. Doce entradas no equivalen a doce aprobaciones ni a cierre documental completo. | CRM PYMES/Admin Ofertas, Portal web: Beneficios, Convergencia cuando corresponda | Reconciliar fuentes por dominio y cada beneficio; conservar Affinity historico hasta publicacion independiente autorizada. |
| Affinity | Bloqueado | En validacion | Bloqueado | 2026-09-17 | Produccion auditada 2026-09-17: PDF archivado/hash verificado. Extraccion diagnostica pura con python3 y .venv-parser: 8 paginas, 12808 caracteres. Sin versiones affinity_benefits persistidas; no se creo preview HTTP ni borrador. Fuente pendiente_confirmacion y fechas nulas. Se conserva aclaracion historica de Gabriel del 2026-09-07 sobre GPON 100, sin aplicarla aqui. | CRM PYMES/Admin Ofertas, Portal web: Affinity | Comprobar y registrar la aclaracion historica en el futuro borrador; revisar/aprobar antes de publicar con autorizacion. No reinstalar un lector funcional. |
| Ofertas | En validacion | En validacion | En validacion | 2026-09-17 | Produccion auditada 2026-09-17: ofertas_movil_versiones v2 vigente publicada el 2026-08-07; v1 reemplazada. motor_ofertas_versiones v1 movil_equipos es otro circuito. Fuentes archivadas/hash verificados; retirar pantallas no borro versiones. v2 fecha 2026-08-06 a 2026-08-26: vencida al corte aunque API estado_vigencia=vigente. | CRM PYMES/Admin Ofertas, Motor Comercial, Portal web, Constructor futuro | Revisar calculo de vigencia y reemplazo por dominio; conservar historial, sin promover Motor ni reconstruir Constructor. |

## Resumen

- Terminados: 1
- En validacion: 22
- Pendientes: 0
- Bloqueados: 3
- Bloqueados seguridad: 0

## Items

| ID | Area | Estado | Local | Produccion | Pruebas | Proximo paso |
| --- | --- | --- | --- | --- | --- | --- |
| PM-001 | Arquitectura Constructor | En validacion | Terminado | En validacion | 15/15 Validacion integral tres modos con Fijo y Convergencia. | Conservar contrato historico; revalidarlo cuando se autorice el Constructor nuevo. Interfaz anterior retirada segun PM-027. |
| PM-002 | CRM -> Constructor | En validacion | Terminado | En validacion | 33/33 Contratos del portal y configuracion compartida validan modo oscuro/dia con paleta SS Group, cache busting y flujo del Constructor. | Esperar definicion del Constructor nuevo; no reactivar accesos durante esta auditoria. |
| PM-003 | Construccion Manual | En validacion | Terminado | Pendiente | 15/15 Contrato comun validado localmente. | Comparar Manual vs Motor con los mismos datos aprobados. |
| PM-004 | Consulta Inteligente | En validacion | Terminado | Pendiente | 51/51 constructor-intelligent-consultation y oferta-const-portal cubren intencion, presupuesto, BYOP, ambiguedad, familias Business RED, mezclas de equipos con simbolo x/×, tabla unica por linea, envio a Comparativa, limpieza de escenario entre turnos y bloqueo por desincronizacion visible/runtime. | Probar consultas reales con vendedor y revisar salidas ambiguas. |
| PM-005 | Motor Comercial | En validacion | Terminado | Pendiente | 86/86 Bateria relacionada de Motor, Consulta, Portal y simulacion local aprobada. | Cerrar matriz de equivalencia Motor vs flujo anterior. |
| PM-006 | Business RED Plus | En validacion | Terminado | Pendiente | 131/131 Regresion amplia local reportada en correccion controlada. | Mantener Business RED Plus en modo sombra hasta cerrar validacion integral. |
| PM-007 | BYOP | En validacion | Terminado | Pendiente | 1/1 business-red-plus-eligibility cubre BYOP sin promocion de equipo. | Incluir BYOP en matriz maestra de equivalencia. |
| PM-008 | Equipos / Ofertas | En validacion | En validacion | Pendiente | 21/21 motor-commercial-candidates cubre candidatos, alternativas, fuente ambigua, equipo sin precio oficial, resolutor por fuente vigente y caso mixto Extreme con iPhone 17 + CG890. | Resolver publicacion/trazabilidad de fuente vigente antes de cerrar totales reales del caso mixto. |
| PM-009 | Inalambrico / IoT | En validacion | Terminado | En validacion | 69/69 Bateria dirigida final local reportada para Inalambrico / IoT. | Conservar septiembre local; produccion sirve agosto vencido. Revisar diff/aprobacion de septiembre antes de reemplazo autorizado. |
| PM-010 | Fijo | En validacion | Terminado | En validacion | 15/15 Validacion integral local cubre movil + fijo. | Conservar Fijo v13 productivo y revisar vigencia pendiente_confirmacion; API y Portal verificados con 81 registros. |
| PM-011 | Convergencia | En validacion | Terminado | Pendiente | 15/15 Casos A-F de validacion integral local. | Probar clientes reales convergentes y no convergentes desde CRM. |
| PM-012 | Servicios / Beneficios | En validacion | En validacion | En validacion | 15/15 Contrato del Centro de Cargas, navegación carga/consulta y visualización local de Beneficios. | Separar Servicios sin circuito conectado de Beneficios publicado (12 entradas); revisar trazabilidad por dominio. |
| PM-013 | Lista de Precios | En validacion | En validacion | En validacion | 3/3 Preview de Lista de Precios septiembre validado por contrato local. | Mantener upload id8 y 477 equipos publicados; revisar falso Fuente sin publicar y trazabilidad sin republicar. |
| PM-014 | Versionado de Fuentes | En validacion | En validacion | En validacion | 25/25 Contrato Admin Ofertas Centro de Cargas, lectura read-only de publicaciones vigentes, documento por publicacion/SHA y Plan Maestro. | Conservar 29 originales y hashes verificados; reconciliar historiales por dominio y vigencias pendientes sin reemplazos automaticos. |
| PM-015 | Catalogo Canonico | En validacion | Terminado | Pendiente | 6/6 Preview Lista de Precios y catalogo canonico local. | Usar catalogo canonico local para validacion; no persistir en DB sin autorizacion de migracion. |
| PM-016 | Agente Comercial | Bloqueado | En validacion | Pendiente | 62/62 constructor-intelligent-consultation, oferta-const-portal y Plan Maestro cubren intencion, alternativas, sesion local persistente, sustitucion de escenario viejo, sincronizacion visible contra commercialScenario y respuesta comercial sin datos tecnicos por defecto. | Solicitar autorizacion de migracion si se quiere historial durable por cliente/BAN; mantener agente local en memoria mientras tanto. |
| PM-017 | Totales / Cotizacion | En validacion | En validacion | Pendiente | 21/21 motor-commercial-candidates cubre totales agregados y bloqueo por falta de fuente vigente. | Publicar o corregir trazabilidad de las fuentes oficiales vigentes antes de repetir la cotizacion. |
| PM-018 | Validacion Integral | En validacion | Terminado | Pendiente | 5/5 validacion-maestra-constructor-local cubre 14 casos. | Revisar localmente las pantallas abiertas y decidir si se autoriza prueba controlada o migraciones pendientes. |
| PM-019 | Promocion del Motor | Bloqueado | Bloqueado | Pendiente | 41/41 Pendiente. | No promover; esperar decision posterior tras prueba controlada. |
| PM-020 | Produccion | Terminado | Terminado | Terminado | 704/704 Suite completa en verde, incluidas las pruebas de configuracion del portal y apertura del Constructor. | Tratar pendientes de Affinity/IoT en sus modulos; esta etapa no autoriza despliegue. |
| PM-022 | Comparativas | En validacion | Terminado | Pendiente | 34/34 constructor-intelligent-consultation cubre envio manual a Comparativa, payload y bloqueo por mismatch. | Probar desde un cliente CRM real y revisar la comparativa generada. |
| PM-023 | Comparativas | En validacion | Terminado | Pendiente | 13/13 comparativa-propuesta-guardado-contract cubre emojis, vista lado a lado, guardado HTML+PDF, HTML autocontenido, guardado en el CRM y el Excel con diseño Claro con respaldo plano; comparativa-fecha-vencimiento ejecuta compEndDate en zona -4 con las tres formas en que llega la fecha; client-profile-line-tabs-contract sigue en 9/9. | Abrir la comparativa de un cliente real, guardar propuesta y confirmar que queda en Comparativas guardadas. |
| PM-024 | Centro de Cargas | En validacion | En validacion | En validacion | 4/4 vigencia-alertas.test.js y contrato UI de Centro de Cargas. | Revisar capturas y Admin Ofertas en http://127.0.0.1:4173/#/ofertas/claro_tv. TV v10 aprobada es prueba local, no publicacion; mantener TV v3 local y v14 productiva. |
| PM-025 | Affinity | Bloqueado | En validacion | Bloqueado | 18/18 affinity-benefits-normalizer (13 casos contra el PDF real, incluida la aclaracion de contradicciones), affinity-modulo-contract, catalogo publico y persistencia de borrador. | Comprobar y registrar la aclaracion historica en el futuro borrador; revisar/aprobar antes de publicar con autorizacion. No reinstalar un lector funcional. |
| PM-026 | Administracion del Constructor | En validacion | En validacion | En validacion | 10/10 Contrato UI de Tareas y reglas Admin, contrato de Lista de Precios, diff --check, validacion de scripts embebidos y verificacion publica del HTML desplegado. | Revisar visualmente http://127.0.0.1:4173/#/tareas-reglas-admin y el informe local. No desplegar ni republicar Claro TV para corregir seguimiento. |
| PM-027 | Retiro de interfaz heredada | En validacion | Terminado | En validacion | 4/4 4 pruebas dirigidas y verificacion publica confirman que el CRM no expone el acceso y que las dos rutas heredadas responden 404. | Retiro comprobado en produccion (ambas rutas 404); mantener pendiente la definicion aprobada del Constructor nuevo, fuera de esta etapa. |

## Bloqueos Visibles

- **Equipos / Ofertas** (En validacion): El resolutor funciona, pero la DB local no tiene fuente vigente para cerrar precio de iPhone 17 o CG890 al 2026-09-05.
- **Agente Comercial** (Bloqueado): Persistencia durable requiere nuevas tablas constructor_agent_sessions/turns; no existe estructura reusable sin mezclar ventas/comparativas/audit_log.
- **Totales / Cotizacion** (En validacion): No se puede cerrar total real del caso mixto porque falta fuente vigente exacta para iPhone 17/CG890 al 2026-09-05.
- **Promocion del Motor** (Bloqueado): No se puede promover Motor como fuente principal mientras existan bloqueos esperados y decisiones/migraciones pendientes.
- **Affinity** (Bloqueado): Normalizacion sin resoluciones: dos reglas, una requiere revision por GPON 50/100, publicable=false. Lector PDF ausente no se reproduce actualmente.

## Regla Operativa

Toda tarea relacionada con Constructor, Motor Comercial, Fuentes, Servicios/Beneficios o Agente Comercial debe actualizar `docs/constructor/plan-maestro-constructor.json` y regenerar este MD antes de declararse terminada.
