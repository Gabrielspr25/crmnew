# Plan Maestro - Constructor Comercial

> Fuente unica estructurada: `docs/constructor/plan-maestro-constructor.json`.
> Este documento se genera desde JSON; no mantenerlo como segunda verdad manual.

- Estado general: en_validacion
- Fase: Plan Maestro local
- Entorno: local
- Ultima actualizacion: 2026-09-09
- Avance visual: 56%
- Produccion: PARCIAL

El porcentaje de avance es solo una referencia visual del progreso. No representa calidad tecnica ni autorizacion para produccion.

## Resumen

- Terminados: 2
- En validacion: 20
- Pendientes: 0
- Bloqueados: 3
- Bloqueados seguridad: 1

## Items

| ID | Area | Estado | Local | Produccion | Pruebas | Proximo paso |
| --- | --- | --- | --- | --- | --- | --- |
| PM-001 | Arquitectura Constructor | En validacion | Terminado | Pendiente | 15/15 Validacion integral tres modos con Fijo y Convergencia. | Mantener el contrato comun como base de validacion maestra. |
| PM-002 | CRM -> Constructor | En validacion | Terminado | Pendiente | 15/15 Cubierto dentro de validacion integral local. | Probar casos CRM reales con BAN unico, varios BANs y seleccion parcial. |
| PM-003 | Construccion Manual | En validacion | Terminado | Pendiente | 15/15 Contrato comun validado localmente. | Comparar Manual vs Motor con los mismos datos aprobados. |
| PM-004 | Consulta Inteligente | En validacion | Terminado | Pendiente | 51/51 constructor-intelligent-consultation y oferta-const-portal cubren intencion, presupuesto, BYOP, ambiguedad, familias Business RED, mezclas de equipos con simbolo x/×, tabla unica por linea, envio a Comparativa, limpieza de escenario entre turnos y bloqueo por desincronizacion visible/runtime. | Probar consultas reales con vendedor y revisar salidas ambiguas. |
| PM-005 | Motor Comercial | En validacion | Terminado | Pendiente | 86/86 Bateria relacionada de Motor, Consulta, Portal y simulacion local aprobada. | Cerrar matriz de equivalencia Motor vs flujo anterior. |
| PM-006 | Business RED Plus | En validacion | Terminado | Pendiente | 131/131 Regresion amplia local reportada en correccion controlada. | Mantener Business RED Plus en modo sombra hasta cerrar validacion integral. |
| PM-007 | BYOP | En validacion | Terminado | Pendiente | 1/1 business-red-plus-eligibility cubre BYOP sin promocion de equipo. | Incluir BYOP en matriz maestra de equivalencia. |
| PM-008 | Equipos / Ofertas | En validacion | En validacion | Pendiente | 21/21 motor-commercial-candidates cubre candidatos, alternativas, fuente ambigua, equipo sin precio oficial, resolutor por fuente vigente y caso mixto Extreme con iPhone 17 + CG890. | Resolver publicacion/trazabilidad de fuente vigente antes de cerrar totales reales del caso mixto. |
| PM-009 | Inalambrico / IoT | En validacion | Terminado | Pendiente | 69/69 Bateria dirigida final local reportada para Inalambrico / IoT. | Cerrar evidencia de comparacion anterior vs nueva cuando se tenga el archivo anterior. |
| PM-010 | Fijo | En validacion | Terminado | Pendiente | 15/15 Validacion integral local cubre movil + fijo. | Actualizar fuentes oficiales fijas y repetir validacion maestra. |
| PM-011 | Convergencia | En validacion | Terminado | Pendiente | 15/15 Casos A-F de validacion integral local. | Probar clientes reales convergentes y no convergentes desde CRM. |
| PM-012 | Servicios / Beneficios | En validacion | En validacion | Pendiente | 15/15 Contrato del Centro de Cargas, navegación carga/consulta y visualización local de Beneficios. | Validar la carga real de un boletín oficial de Beneficios contra parser, archivado de fuente y borrador persistido, sin publicar hasta completar la revisión comercial. |
| PM-013 | Lista de Precios | En validacion | En validacion | Pendiente | 3/3 Preview de Lista de Precios septiembre validado por contrato local. | Guardar/publicar localmente la lista vigente solo con autorizacion especifica del flujo Fuentes Comerciales. |
| PM-014 | Versionado de Fuentes | En validacion | En validacion | Pendiente | 25/25 Contrato Admin Ofertas Centro de Cargas, lectura read-only de publicaciones vigentes, documento por publicacion/SHA y Plan Maestro. | Usar el inventario para ejecutar previews por dominio, sin marcar fuentes no guardadas como publicadas. |
| PM-015 | Catalogo Canonico | En validacion | Terminado | Pendiente | 6/6 Preview Lista de Precios y catalogo canonico local. | Usar catalogo canonico local para validacion; no persistir en DB sin autorizacion de migracion. |
| PM-016 | Agente Comercial | Bloqueado | En validacion | Pendiente | 62/62 constructor-intelligent-consultation, oferta-const-portal y Plan Maestro cubren intencion, alternativas, sesion local persistente, sustitucion de escenario viejo, sincronizacion visible contra commercialScenario y respuesta comercial sin datos tecnicos por defecto. | Solicitar autorizacion de migracion si se quiere historial durable por cliente/BAN; mantener agente local en memoria mientras tanto. |
| PM-017 | Totales / Cotizacion | En validacion | En validacion | Pendiente | 21/21 motor-commercial-candidates cubre totales agregados y bloqueo por falta de fuente vigente. | Publicar o corregir trazabilidad de las fuentes oficiales vigentes antes de repetir la cotizacion. |
| PM-018 | Validacion Integral | En validacion | Terminado | Pendiente | 5/5 validacion-maestra-constructor-local cubre 14 casos. | Revisar localmente las pantallas abiertas y decidir si se autoriza prueba controlada o migraciones pendientes. |
| PM-019 | Promocion del Motor | Bloqueado | Bloqueado | Pendiente | 0/0 Pendiente. | No promover; esperar decision posterior tras prueba controlada. |
| PM-020 | Produccion | Terminado | Terminado | Terminado | 704/704 Suite completa en verde, incluidas las pruebas de configuracion del portal y apertura del Constructor. | Gabriel sube Affinity e Inalambrico septiembre en el Admin de produccion. |
| PM-021 | Identidad Comercial | Bloqueado seguridad | Bloqueado seguridad | Pendiente | 0/0 Bloqueo de seguridad documentado. | Mantener bloqueado hasta evidencia oficial o decision comercial documentada. |
| PM-022 | Comparativas | En validacion | Terminado | Pendiente | 34/34 constructor-intelligent-consultation cubre envio manual a Comparativa, payload y bloqueo por mismatch. | Probar desde un cliente CRM real y revisar la comparativa generada. |
| PM-023 | Comparativas | En validacion | Terminado | Pendiente | 13/13 comparativa-propuesta-guardado-contract cubre emojis, vista lado a lado, guardado HTML+PDF, HTML autocontenido, guardado en el CRM y el Excel con diseño Claro con respaldo plano; comparativa-fecha-vencimiento ejecuta compEndDate en zona -4 con las tres formas en que llega la fecha; client-profile-line-tabs-contract sigue en 9/9. | Abrir la comparativa de un cliente real, guardar propuesta y confirmar que queda en Comparativas guardadas. |
| PM-024 | Centro de Cargas | En validacion | Terminado | Pendiente | 4/4 vigencia-alertas.test.js y contrato UI de Centro de Cargas. | Usar las alertas con las fuentes reales y confirmar el umbral de 30 dias. |
| PM-025 | Affinity | Terminado | Terminado | Pendiente | 18/18 affinity-benefits-normalizer (13 casos contra el PDF real, incluida la aclaracion de contradicciones), affinity-modulo-contract, catalogo publico y persistencia de borrador. | Gabriel revisa el modulo en local; luego se commitea y se evalua produccion. |

## Bloqueos Visibles

- **Equipos / Ofertas** (En validacion): El resolutor funciona, pero la DB local no tiene fuente vigente para cerrar precio de iPhone 17 o CG890 al 2026-09-05.
- **Agente Comercial** (Bloqueado): Persistencia durable requiere nuevas tablas constructor_agent_sessions/turns; no existe estructura reusable sin mezclar ventas/comparativas/audit_log.
- **Totales / Cotizacion** (En validacion): No se puede cerrar total real del caso mixto porque falta fuente vigente exacta para iPhone 17/CG890 al 2026-09-05.
- **Promocion del Motor** (Bloqueado): No se puede promover Motor como fuente principal mientras existan bloqueos esperados y decisiones/migraciones pendientes.
- **Identidad Comercial** (Bloqueado seguridad): REDPLUS $60 vs BREDP1 $65: no existe evidencia oficial suficiente para fusionarlos.

## Regla Operativa

Toda tarea relacionada con Constructor, Motor Comercial, Fuentes, Servicios/Beneficios o Agente Comercial debe actualizar `docs/constructor/plan-maestro-constructor.json` y regenerar este MD antes de declararse terminada.
