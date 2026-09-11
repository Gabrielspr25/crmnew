# Consulta Inteligente Comercial v1

Fecha: 2026-09-01  
Proyecto: `newcrm`  
Estado: implementacion local, sin despliegue, sin migraciones.

## Objetivo

Convertir `Consultar al asistente` en una entrada funcional para preparar propuestas y alternativas sin crear una segunda logica comercial.

Flujo obligatorio:

```text
Consulta en lenguaje natural
-> CommercialConsultationInterpreter
-> commercialScenario
-> Motor Comercial publicado/vigente
-> commercialDecision
-> alternativas calculadas por Motor
-> explicacion trazable
-> confirmacion del vendedor
-> Cargar al Constructor
-> Enviar a Comparativa existente
```

La consulta interpreta intencion. No decide elegibilidad, precio, descuento, vigencia, limite BAN, equipo promocionado, plazo, compatibilidad ni price code.

## Consulta local

Revision local realizada:

- existe una funcionalidad de `Reporte inteligente` en el CRM, pero es una ruta de reportes de solo lectura;
- no se reutiliza para Constructor porque no es un interprete comercial;
- no se agrego proveedor externo;
- no se escribieron secretos ni API keys;
- no se agrego SDK ni dependencia de OpenAI, Anthropic, Gemini, Azure OpenAI ni APIs LLM de terceros.

Se creo la interfaz `CommercialConsultationInterpreter` dentro del modulo compartido del Constructor. La implementacion actual es deterministica/local, basada en reglas de intencion y desacoplada del Motor Comercial.

No hay configuracion de proveedor externo. Una evolucion futura solo podria complementar el interprete con un modelo local/open source ejecutado en infraestructura propia de `newcrm`; eso no forma parte de esta etapa.

## Interpretacion

La consulta extrae:

- cantidad de lineas solicitadas;
- uso de `todas`, `esas lineas`, `este cliente` y `este BAN` desde contexto CRM;
- cantidades como `10 lineas`, `3 lineas` y `las 4 restantes`;
- evento comercial: renovacion, portabilidad, linea adicional, linea nueva o BYOP;
- equipo principal cuando aparece, por ejemplo `Samsung Galaxy S26`, `Samsung Galaxy A37` o `iPhone 17`;
- familias de plan por lenguaje natural, por ejemplo `Business RED Plus`, `RED Plus`, `Business RED Extreme`, `multilinea Extreme`, `Business RED Supreme` y `Sin Fronteras`, sin identificar familias por precio;
- grupos multiples de equipos en una misma consulta, por ejemplo `4 iPhone 17 y 1 modem 890`;
- alias/modelos parciales cuando son seguros contra el catalogo canonico local, por ejemplo `modem 890` como `Franklin JEXstream CG890 5G`;
- categorias por grupo: `smartphone`, `tablet`, `modem` o `MIFI`;
- preferencia de marca;
- preferencias como `solo Samsung`, `cualquier equipo`, `equipos gratis`, `equipos con 50%` y `mantener mis equipos`;
- presupuesto maximo mensual o presupuesto enfocado en equipos;
- objetivo del vendedor: mantener seleccion, buscar equipos gratis, maximo ahorro, comparar opciones u optimizar costo.

Cuando la frase no alcanza para estructurar una intencion segura, la consulta devuelve una aclaracion puntual. Ejemplo: `Quiero lo mejor para estas lineas` devuelve opciones como menor costo, mayor cantidad de equipos gratis, mantener marca o mejor equipo disponible.

Tambien bloquea antes de evaluar cuando:

- las cantidades de equipos no cuadran con la cantidad de lineas solicitadas y el texto no indica que quedan lineas pendientes;
- el modelo es ambiguo, por ejemplo `iPhone Pro` sin generacion/capacidad suficiente;
- falta confirmar plan o equipo para construir un `commercialScenario` completo.

La interpretacion modifica solo campos permitidos de `commercialScenario` y conserva:

- `source_mode = consultation`;
- cliente y BAN si vienen desde CRM;
- `account_type`;
- lineas completas del BAN;
- lineas seleccionadas;
- servicios fijos;
- convergencia;
- consulta original;
- `equipment_selections` y `selected_equipment` por grupo cuando hay mezcla de equipos;
- `autoaplica = false`.

## Actualizacion entre turnos

El Agente separa el escenario en tres grupos:

- contexto estable: cliente, BAN, `account_type`, convergencia y lineas reales del BAN;
- contexto comercial modificable: cantidad de lineas, evento, plan, presupuesto, objetivo y marca preferida;
- seleccion de equipos: modelos/categorias solicitadas por el vendedor.

El contexto estable se conserva entre turnos. El contexto comercial modificable se reemplaza cuando la nueva consulta trae un valor nuevo.

La seleccion de equipos se conserva solo cuando el vendedor indica continuidad o adicion, por ejemplo `agregame`, `ademas`, `mantén` o `conserva`. Si el nuevo turno cambia a una estrategia general como `Samsung`, `maximo $500`, `mayor ahorro`, `equipos gratis` o `50%`, se limpia la seleccion especifica anterior y el Motor debe proponer candidatos sin arrastrar equipos viejos.

Ejemplo validado:

```text
Turno 1: 5 renovaciones Business RED Extreme con 4 iPhone 17 y 1 modem 890
Turno 2: 10 lineas Samsung, maximo $500, mayor ahorro
```

Resultado:

- 10 lineas;
- evento renovacion conservado si era el escenario vigente;
- preferencia Samsung;
- presupuesto maximo 500;
- objetivo maximo ahorro;
- sin `Franklin JEXstream CG890 5G` heredado;
- sin warning de cantidades de equipos.

La accion `Nueva consulta` limpia intencion comercial, equipos solicitados, presupuesto, objetivo, alternativas y trazas visuales. Conserva el contexto estable del cliente/BAN.

`Preparar opciones` reconstruye el escenario de evaluacion desde `contexto estable + intencion visible actual`. No usa una fusion general contra el `commercialScenario` anterior, porque ese escenario puede contener selecciones comerciales previas del Constructor. Antes de llamar al Motor Comercial se valida que los campos principales visibles coincidan con el escenario preparado: cantidad, marca, equipo, presupuesto y objetivo. Si hay diferencia, se bloquea con `consulta_estado_desincronizado` y no se evalua ninguna oferta.

## Motor primero

`evaluateCommercialConsultation()` bloquea la respuesta cuando no recibe salida del Motor Comercial.

Estados bloqueados:

- `requiere_revision`;
- `FUENTE_AMBIGUA`;
- contradiccion;
- fuente incompleta;
- dato no determinado.

En esos casos la pantalla muestra que la opcion requiere revision comercial y no completa informacion por inferencia.

## Alternativas

Se agrego `findCommercialAlternatives(context, remainingLines, preferences)`.

La funcion no crea reglas ni infiere promociones. Filtra alternativas ya devueltas por el Motor considerando:

- lineas restantes;
- marca preferida;
- objetivo de equipos gratis;
- presupuesto maximo;
- promociones ya utilizadas;
- estado bloqueado o ambiguo.

Si el Motor no devuelve alternativas vigentes suficientes, la consulta queda con `sin_alternativas_vigentes_motor`.

## Resultado visual y Comparativa

La pantalla de Consulta muestra primero una respuesta comercial simple y compacta:

- una sola tabla de cotizacion por linea;
- una fila por cada linea solicitada;
- precio regular, oferta, credito/descuento, equipo/mes neto, plan/mes y total de linea;
- totales debajo de la tabla;
- Benefits confirmados y aplicables debajo de los totales;
- acciones: `Modificar propuesta`, `Ver alternativas`, `Enviar a Comparativa`, `Cargar al Constructor`, `Ver detalles`.

La informacion tecnica queda oculta por defecto y se consulta con `Ver detalles`. En la respuesta principal no se muestran `source_mode`, `commercialScenario`, `autoaplica`, `rule_id`, `confidence`, `publication_id`, JSON, conteos tecnicos del Motor ni fuentes por linea.

Si falta precio vigente de fuente, no se cierra el total. La pantalla muestra una sola advertencia con el equipo afectado y en las celdas correspondientes usa `Falta precio de fuente`.

El Motor incorpora un resolutor local de precio vigente para equipos solicitados:

```text
resolveCurrentEquipmentPrice(equipment, scenarioDate)
```

El resolutor busca primero por `item_code` cuando existe; si no existe, usa identidad canonica/modelo contra publicaciones vigentes. Para smartphones prioriza Lista de Precios; para modem, MIFI y tablet prioriza Inalambrico / IoT cuando esa publicacion contiene el equipo exacto. No usa texto aproximado para sustituir modelos distintos: `CG890` no se resuelve con una fila `RG2100`.

Resultado de auditoria local del 2026-09-05:

- `Franklin JEXstream CG890 5G` existe en `public.v_equipos_vigentes` como `33348H`, precio regular `$299.99`, 30 meses `$10.00`, pero su fuente de upload local tiene vigencia 2026-05-28 a 2026-07-31.
- La publicacion local Inalambrico / IoT septiembre esta vigente, pero las filas localizadas contienen `Franklin JEXstream RG2100 5G` item `33638H`, no `CG890`.
- `iPhone 17` existe en `public.v_equipos_vigentes` en variantes de color 256GB, todas con precio regular `$829.99` y 30 meses `$27.67`, pero la fuente de upload local tambien conserva vigencia 2026-05-28 a 2026-07-31.
- La Lista de Precios septiembre esta inventariada/previsualizada, pero no figura guardada/publicada en `fuentes_comerciales` como fuente vigente.

Por esa razon, para escenario con fecha 2026-09-05 el resultado correcto sigue bloqueado hasta publicar la fuente vigente que cubra esos equipos o hasta corregir la trazabilidad de vigencia de la fuente ya cargada con evidencia oficial.

La consulta `renovacion con 5 iphone 17 multilinea extreme y 3 modem 890 convergente` debe responder como vendedor: 8 renovaciones, Business RED Extreme, 5 iPhone 17, 3 Franklin JEXstream CG890 5G y convergencia confirmada para que el Motor evalúe los Benefits. Si falta un dato indispensable para calcular dinero, se muestra una sola pregunta concreta y no una cotizacion parcial con `1 linea` o `$0.00`.

`Enviar a Comparativa` reutiliza el modulo existente de CRM mediante `POST /api/comparativas`. No crea plantillas nuevas y no recalcula promociones dentro de Comparativa. El payload incluye el `commercialScenario` final y la decision del Motor que produjo la respuesta visible.

Antes de enviar se compara la huella del escenario mostrado contra el escenario actual. Si no coincide, se bloquea con `consulta_comparativa_mismatch`.

Ninguna seleccion se carga automaticamente. El Constructor solo cambia cuando el vendedor pulsa `Cargar al Constructor`.

## Pruebas

Archivo: `backend/test/constructor-intelligent-consultation.test.js`.

Casos cubiertos:

1. 10 renovaciones Samsung S26.
2. 8 renovaciones Samsung A37 con alternativas.
3. Solo Samsung.
4. Maximo $500.
5. CRM usando `todas`.
6. Manual sin cliente.
7. Respuesta comercial para `5 iPhone 17 + 3 modem 890` sin exponer datos tecnicos por defecto.
7. Cliente convergente.
8. Cliente no convergente.
9. `FUENTE_AMBIGUA`.
10. Equipo sin promocion.
11. Maximo BAN agotado.
12. Alternativas encontradas.
13. Alternativas no encontradas.
14. BYOP sin promocion de equipo.
15. `las 4 restantes`.
16. `iPhone 17`.
17. `cualquier equipo`, `50%` y comparar opciones.
18. Lenguaje ambiguo con aclaracion requerida.
19. Mezcla real `5 renovaciones multilinea extreme, 4 iphone 17 y 1 modem 890`.
20. Familias `Extreme`, `Business RED Extreme`, `Supreme` y `Sin Fronteras`.
21. Alias `modem 890`.
22. Cantidades de equipos que cuadran contra lineas.
23. Cantidades que no cuadran y requieren aclaracion.
24. Modelo ambiguo `iPhone Pro`.
25. Mezcla smartphone + modem.
26. Mezcla smartphone + tablet.
27. Consulta con errores/abreviaturas razonables.
28. Vista de intencion estructurada con grupos.
29. Carga de candidatos por grupo sin duplicar reglas.
30. Reemplazo de equipos en sesion local sin borrar selecciones previas.
31. Bloqueo antes de evaluar si no se entiende plan/equipo.
32. Respuesta comercial simple sin `source_mode`, `commercialScenario`, `confidence`, `rule_id` ni `publication_id` visibles por defecto.
33. Payload hacia Comparativa existente sin recalcular promociones.
34. Bloqueo `consulta_comparativa_mismatch` cuando la propuesta mostrada no coincide con el escenario actual.
35. Sustitucion de escenario viejo cuando una consulta nueva cambia a marca/presupuesto/ahorro.
36. Consulta de marca y presupuesto no pide cantidades de equipos si no hay modelo explicito.
37. Ruta de pantalla bloquea desincronizacion entre consulta visible y `commercialScenario` antes de consultar Motor.
38. Respuesta principal muestra una sola tabla comercial por linea sin exponer JSON ni campos tecnicos.
39. Consulta exacta con simbolo `×`: `renovación Business RED Extreme multilínea 5 × iPhone 17 2 × Franklin JEXstream CG890 5G convergente` infiere 7 lineas y dos grupos.
40. Resolutor de precio vigente prioriza Inalambrico / IoT para `Franklin JEXstream CG890 5G` cuando la publicacion contiene ese modelo exacto.
41. Resolutor agrupa `iPhone 17 256GB` por precio/capacidad sin escoger color arbitrario.
42. Escenario mixto de 5 `iPhone 17` y 2 `CG890` devuelve 7 candidatos con precio cuando el catalogo publicado vigente contiene ambos equipos.

Tambien se valida que no se genere respuesta comercial sin pasar primero por Motor Comercial.

## Archivos modificados

- `Planes para web/constructor-publications.js`
- `Planes para web/oferta-const.html`
- `backend/test/constructor-intelligent-consultation.test.js`
- `docs/constructor/consulta-inteligente-comercial-v1.md`
- `docs/constructor/integracion-constructor-comparativa-v1.md`

## Restricciones cumplidas

- No deploy.
- No migraciones.
- No `autoaplica=true`.
- No se quito fallback.
- No se promovio Motor como fuente definitiva.
- No se modifico calculo definitivo.
- No se inventaron reglas.
- No se duplico Fijo.
- No se duplico Convergencia.
- No se convirtio IA/LLM en Motor Comercial.
- No se cambian equipos automaticamente.
- No se crearon plantillas nuevas de Comparativa.
- No se duplico el modulo Comparativas.
- No se recalcularon promociones dentro de Comparativa.
- No se esconden casos `FUENTE_AMBIGUA`.
- No se escribieron secretos.
- No hay proveedor externo ni credenciales futuras documentadas para esta etapa.

## Riesgos pendientes

- Si se necesita mas capacidad de lenguaje, debe evaluarse un modelo local/open source en infraestructura propia, sin servicios pagos por consulta/token.
- La busqueda real de equipos promocionados depende de que el Motor Comercial entregue candidatos por linea y alternativas vigentes.
- La explicacion por linea depende de trazas completas en la respuesta del Motor.
- Sigue pendiente validacion visual con casos reales de CRM antes de cualquier despliegue.
