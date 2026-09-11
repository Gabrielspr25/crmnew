# Matriz de reglas para Portal y Constructor

Fecha de trabajo: 2026-08-28

Este documento separa las fuentes comerciales por contenido, no por extension de archivo. El Portal publica contenido aprobado. El Constructor consume datos normalizados para calcular propuestas, comparar beneficios y aplicar elegibilidad.

## Matriz principal

| Area | Que se puede subir | Formatos permitidos | Que debe identificar el sistema | Nivel de aplicacion | Llave comercial minima | Accion al detectar cambio | Acumulacion / prioridad | Donde se guarda / publica | Como lo usa el Constructor | Que no debe hacer |
|---|---|---|---|---|---|---|---|---|---|---|
| Fijo - estructura/base | Listado o estructura oficial de planes fijos: telefonia, internet, 2Play, 3Play, cargos base | PDF o Excel | Codigos de planes fijos, por ejemplo codigos tipo `A...` o numericos validos; precios base; velocidad; cargo mensual; condiciones permanentes | Plan / producto | codigo_plan + tipo_servicio + velocidad | Nuevo, modifica, reemplaza o vence estructura anterior; nunca borrar. El precio base es atributo versionado, no identidad | Base primero; no acumula con otra base vigente contradictoria | Base de Planes Fijos del portal | Lee aqui el plan base y precio normal antes de aplicar beneficios | No tratar ofertas, rebajas o beneficios como estructura base |
| Fijo - ofertas/beneficios | Boletines de ofertas fijas, beneficios de convergencia, ofertas de velocidad, meses gratis, doble play, triple play, combinaciones con movil o Claro TV | PDF o Excel | Producto principal afectado, beneficio, convergencia, elegibilidad, vigencia, restricciones y fuente | Cliente / BAN / linea / plan / combinacion | producto_principal + beneficio + condicion + plan_base + tipo_cliente + vigencia | Crea o modifica regla de oferta; si contradice otra regla vigente bloquea solo esa combinacion | Puede acumular, sustituir o ser incompatible segun terminos oficiales | Modulo de Ofertas Fijo / Benefits | Aplica encima de la estructura base si el cliente cumple condiciones | No reemplazar la estructura de planes salvo que el boletin diga explicitamente cambio de estructura o precio base |
| Claro TV - estructura/base | Listado oficial de planes, paquetes, servicios y cargos Claro TV | PDF o Excel | Planes o paquetes Claro TV reconocibles, precios base, servicios incluidos | Plan / producto | codigo_paquete + servicio | Nuevo, modifica, reemplaza o vence base anterior. El precio base es atributo versionado, no identidad | Base primero; contradiccion bloquea esa base | Base Claro TV del portal | Lee aqui el plan o paquete base | No mezclar promociones como si fueran precio base |
| Claro TV - ofertas/beneficios | Descuentos, combos, promociones o beneficios ligados a Claro TV, aunque crucen con Fijo o Movil | PDF o Excel | Beneficio, requisito, vigencia, combinacion aplicable y fuente | Cliente / BAN / linea / producto / combinacion | producto_principal + beneficio + condicion + paquete + vigencia | Crea o modifica regla de oferta; bloqueo por contradiccion puntual | Acumula o sustituye solo si terminos lo permiten | Ofertas Claro TV / Benefits | Aplica la promocion si coincide con la seleccion del cliente | No reemplazar catalogo base si solo es oferta |
| Movil - estructura/base | Planes moviles base: individuales, multilinea, Business RED, BYOP/BAN si aplica como estructura | PDF o Excel | Codigos moviles, precio base, lineas, familia, condiciones permanentes | Plan / BAN / linea | familia_plan + codigo_plan + cantidad_lineas | Nuevo, modifica, reemplaza o vence estructura anterior. El precio base es atributo versionado, no identidad | Base primero; no mezcla con ofertas temporales | Base Planes Moviles del portal | Lee plan base, cantidad de lineas y cargo regular | No meter Nuevas Ofertas, trade-in o financiamiento como base |
| Movil - ofertas/beneficios | Nuevas ofertas, financiamiento, trade-in, bonos, equipos promocionales, streaming, portabilidad, descuentos, terminos | PDF o Excel; puede requerir ambos | Oferta, equipo, plan minimo, cliente convergente/no convergente, trade-in, plazo, codigo/job/price code, vigencia y fuente | Cliente / BAN / linea / plan / equipo | familia_plan + codigo_plan + evento + equipo + plazo + tipo_cliente + codigo_oferta | Crea o modifica oferta; si falta PDF de terminos queda bloqueada | Calcula todas las combinaciones validas; recomienda una sin ocultar alternativas | Ofertas Moviles | Cruza plan base + equipo + evento + elegibilidad; aplica la mejor oferta vigente valida | No inventar precio ni condicion si no esta en el PDF/Excel oficial |
| Lista de Precios / Equipos | Tabla oficial de equipos, precios, mensualidades, plazos, precios por plan | Excel principalmente; PDF solo si viene como fuente oficial procesable | Item code, modelo, precio regular, plazos, mensualidad, plan minimo, familia de equipo | Equipo / plan | item_code + plazo + plan_minimo | Actualiza precio base con vigente_desde/vigente_hasta y conserva historial. El precio es atributo versionado | Precio regular; no acumula con ofertas | Lista de Precios publicada | Sirve como precio base de equipos; ofertas pueden consultarla | No cambiar precios por una oferta salvo que el boletin diga explicitamente nuevo precio o cambio de precio oficial |
| Cambio oficial de precio dentro de boletin | Seccion de boletin que indique cambio de precio, nuevo precio de equipo o actualizacion oficial de precio | PDF o Excel | Senal explicita de cambio de precio oficial, equipo afectado, precio anterior/nuevo si aparece, vigencia y fuente | Equipo / plan | item_code + plazo + plan_minimo | Cierra precio anterior y crea precio base nuevo con fuente del boletin. El nuevo precio es valor versionado, no identidad | Reemplaza precio base; no es descuento temporal | Actualiza Lista de Precios con trazabilidad | El Constructor usa el nuevo precio como base vigente | No tratarlo como descuento temporal si el boletin dice que el precio cambio |
| Oferta temporal de equipo/precio | Gratis, descuento, credito mensual, financiamiento especial, oferta por job/codigo, precio promocional sujeto a condiciones | PDF o Excel | Condiciones: plan minimo, convergente, plazo, job, codigo, evento, fechas | Cliente / BAN / linea / equipo / plan | equipo + beneficio + plan_minimo + plazo + tipo_cliente + evento + vigencia | Crea o modifica oferta temporal; vence sin alterar base | Acumula, sustituye o excluye segun terminos | Ofertas vigentes | Aplica como beneficio sobre el precio base | No sobrescribir Lista de Precios si no dice nuevo precio oficial |
| Accesorios | Boletines o tablas de accesorios que no reemplazan planes base ni precios de equipos principales | PDF o Excel | Item de accesorio, descuento, cliente elegible, convergencia, vigencia, familia del accesorio y fuente | Producto / accesorio / cliente | item_accesorio + beneficio + condicion + vigencia | Crea oferta o precio oficial de accesorio segun texto de fuente | Solo aplica si la propuesta incluye accesorio elegible | Ofertas/beneficios de accesorios o modulo de accesorios, sin mezclar con estructura base | Puede aplicar un descuento o beneficio de accesorio si la propuesta lo incluye y cumple condiciones | No meter accesorios en Fijo, Movil o Claro TV como estructura; no usarlos para cambiar Lista de Precios salvo que el boletin diga nuevo precio oficial |
| Inalambrico / IoT | Claro Hogar, Claro Oficina, Internet OnTheGo, IoT, modem/tablet, precios, equipos y ofertas especiales | PDF o Excel | Excepcion: una misma fuente puede traer estructura y ofertas juntas. Debe separar planes/base, equipos, precios, ofertas especiales, elegibilidad y codigos | Plan / equipo / producto / cliente / BAN | producto + plan + equipo + precio + beneficio + condicion + vigencia | Divide la fuente por seccion: base, precio, oferta, terminos o revision | Puede contener base y oferta en una fuente; se separa internamente | Base Inalambrico/IoT y Ofertas Inalambrico segun contenido | Lee estructura y ofertas desde la misma fuente separada internamente | No obligar al usuario a escoger solo estructura u oferta |
| Benefits / Convergencia | Beneficios por cliente convergente/no convergente, meses gratis, descuentos cruzados, bonos | PDF o Excel | Beneficio, linea afectada, condicion de convergencia, vigencia y fuente original | Cliente / BAN / combinacion | beneficio + linea_afectada + condicion_convergencia + vigencia | Crea regla de beneficio y marca compatibilidad con otras ofertas | Definir compatible, no compatible, sustituye, acumula, maximo por BAN/linea/cliente | Benefits / Ofertas vigentes | Compara beneficios entre Fijo, Movil, Claro TV e Inalambrico para escoger el aplicable/mejor | No duplicar el beneficio en varias lineas sin fuente y prioridad clara |
| Ofertas combinadas | Ofertas que cruzan Fijo, Movil, Claro TV o Inalambrico | PDF o Excel | Linea/producto principal afectado y lineas relacionadas; condicion que activa la oferta | Cliente / BAN / combinacion | producto_principal + lineas_requeridas + beneficio + condicion + vigencia | Crea regla en la linea principal y relaciona impactos cruzados | Evalua combinacion completa; no duplica beneficios | Modulo de ofertas de la linea principal, con etiquetas de impacto cruzado | Evalua elegibilidad por todas las lineas requeridas | No clasificar por nombre del archivo solamente |
| Terminos y condiciones | PDFs de terminos, restricciones, vigencias, codigos, limites BAN, exclusiones | PDF | Reglas de elegibilidad, limites, excepciones, vencimiento, codigos aplicables | Regla / oferta / cliente / BAN / linea | oferta_id + tipo_termino + limite + vigencia | Completa o bloquea reglas asociadas | Manda sobre beneficios si limita elegibilidad | Adjuntos/auditoria de la oferta | Bloquea o habilita ofertas segun reglas oficiales | No publicar una oferta si faltan terminos necesarios |
| Historial y vigencia | Toda fuente oficial cargada | PDF o Excel | Archivo original, hash, usuario, fecha de carga, vigencia, estado, fuente reemplazada | Fuente / regla / publicacion | fuente_hash + seccion + regla_comercial + vigencia | Nuevo, modifica, reemplaza, vence, archiva; nunca borrar | Mantiene auditoria y permite revertir | Historial de fuentes y publicaciones | Permite comparar version anterior vs nueva | No borrar ni sobrescribir sin trazabilidad |
| Portal | Solo contenido aprobado/publicado | No aplica | Base vigente, ofertas vigentes, vencidas marcadas, fuente visible | Publicacion | pagina + modulo + version + vigencia | Publica solo version aprobada | Muestra vigente y marca vencido | Portal de ofertas | Muestra al vendedor lo vigente y trazable | No mostrar borradores como vigentes |
| Constructor | No recibe documentos; consume datos normalizados | No aplica | Plan base + equipo/precio + oferta + benefit + elegibilidad + vigencia | Cliente / BAN / linea / plan / equipo / combinacion | seleccion_cliente + plan + equipo + evento + tipo_cliente + ofertas_validas | Calcula combinaciones validas y recomendaciones | Recomienda una opcion, pero muestra alternativas validas | Motor del Constructor | Calcula propuesta, carrito, comparativa y mejor beneficio valido | No usar HTML/JS ni datos viejos como fuente comercial |

## Reglas de prioridad

1. La estructura/base define el plan o precio regular.
2. La Lista de Precios define el precio base del equipo.
3. Un boletin puede actualizar la Lista de Precios solo si dice explicitamente que hay nuevo precio o cambio oficial de precio.
4. Una oferta temporal se aplica encima de la base, sin reemplazarla.
5. La vigencia y elegibilidad mandan: si no hay fuente oficial vigente, el Constructor no debe aplicar la regla automaticamente.
6. Si hay contradiccion entre fuentes vigentes, se bloquea la regla afectada y se pide decision comercial; no se bloquea el documento completo si otras reglas estan confirmadas.
7. Inalambrico/IoT es la excepcion: una misma fuente puede traer estructura y ofertas, pero el sistema debe separarlas internamente.

## Reglas de clasificacion por seccion

1. La pregunta inicial al subir una fuente orienta el analisis, pero no decide toda la clasificacion del archivo.
2. El sistema debe dividir cada fuente por secciones comerciales detectadas.
3. Una misma fuente puede producir varios bloques: estructura/base, oferta/beneficio, cambio oficial de precio, lista de precios, accesorios, terminos o revision manual.
4. Inalambrico/IoT es la unica linea donde se espera normalmente un archivo mixto con estructura y ofertas en la misma fuente.
5. En Fijo, Movil y Claro TV, una oferta puede cruzar varias lineas, pero se guarda como oferta de la linea o producto principal afectado y con etiquetas de impacto cruzado.
6. El nombre del archivo ayuda, pero no puede ser la unica prueba de clasificacion.
7. Si el parser no puede identificar contenido suficiente, la fuente queda en revision manual y no se publica automaticamente.

## Estado de confianza de procesamiento

Cada regla o seccion detectada debe tener un estado de confianza independiente del estado de publicacion:

- Confirmado: la regla esta suficientemente respaldada por la fuente oficial.
- Requiere revision: el parser encontro la regla, pero faltan datos o hay ambiguedad.
- Contradiccion: otra fuente vigente dice algo incompatible sobre la misma regla comercial.
- Fuente incompleta: falta una fuente requerida o una parte declarada por el documento.

Esto es distinto de borrador, aprobado, publicado, vencido o reemplazado. Un documento puede generar reglas confirmadas y, al mismo tiempo, dos reglas en revision. No se deben bloquear las reglas confirmadas por errores puntuales de otras secciones.

## Reglas de identidad, reemplazo y vigencia

1. Cada regla normalizada necesita una llave comercial estable para saber si es nueva, duplicada, modificada o reemplazo.
2. Nunca se borra una regla o precio anterior; se cierra con `vigente_hasta`, se marca como reemplazada o queda historica.
3. Un nuevo precio oficial de equipo reemplaza el precio base anterior desde la vigencia indicada por la fuente.
4. Una oferta temporal no reemplaza el precio base: vive encima de la base y vence segun su fuente.
5. Una contradiccion bloquea la regla especifica en conflicto, no todo el documento.
6. Si falta una fuente requerida, vigencia o elegibilidad, el Constructor no aplica la regla automaticamente.
7. Los terminos bloquean solo cuando la oferta declara o depende de terminos que no estan disponibles. Si el mismo boletin contiene todos los requisitos necesarios, no se debe exigir un PDF adicional artificial.

## Reglas de beneficios y acumulacion

Cada beneficio debe declarar su relacion con otros beneficios:

- Compatible.
- No compatible.
- Sustituye.
- Acumula.
- Maximo por BAN.
- Maximo por linea.
- Maximo por cliente.
- Una sola vez por cliente o evento.

El Constructor debe calcular todas las combinaciones validas, marcar una recomendada cuando corresponda y permitir ver alternativas validas. Mejor oferta no significa ocultar las demas.

## Regla de oro del Constructor

Nunca inferir elegibilidad por ausencia de una restriccion.

Si una fuente oficial no confirma evento, tipo de cliente, renovacion, portabilidad, cliente nuevo, convergencia, plazo, limite BAN o cualquier otra condicion, ese dato queda como no determinado. Una regla con datos no determinados no se aplica automaticamente hasta que otra fuente oficial o una decision comercial la confirme.

## Pregunta obligatoria al subir fuentes

Antes de analizar una fuente, el Admin debe preguntar que tipo de documento es:

- Estructura/base.
- Oferta/beneficio.
- Lista de precios/equipos.
- Accesorios.
- Terminos y condiciones.
- Mixto, solo permitido para Inalambrico/IoT salvo decision comercial explicita.

La extension del archivo ayuda a escoger parser, pero no decide la naturaleza comercial del documento. La clasificacion final debe basarse en contenido reconocido y fuente oficial.
