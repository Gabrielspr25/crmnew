# Informe de Incidencias Tecnicas y Operativas

**Fecha:** 17 de septiembre de 2026  
**Sistema:** Claro PYMES CRM `newcrm`  
**Alcance:** Constructor, Admin Ofertas/Centro de Cargas, fuentes oficiales, Portal web, Motor Comercial y documentacion operativa.

## 1. Proposito

Documentar de forma enumerada las fallas de metodo, documentacion, implementacion, validacion y despliegue ocurridas durante el trabajo sobre Constructor y Centro de Cargas. Este informe no reemplaza una auditoria independiente de codigo, base de datos y produccion; registra las incidencias observadas durante la operacion.

## 2. Resumen de causa raiz

La causa principal fue no establecer ni usar un control unico y obligatorio para cada cambio:

`fuente oficial -> archivo/hash -> analisis -> comparacion -> borrador -> revision -> publicacion -> consumidor -> prueba productiva`

Se trataron etapas parciales como si confirmaran el resultado completo. Un archivo guardado, una prueba local, una pantalla renderizada o una ruta disponible no prueban una publicacion comercial ni sus consumidores.

## 3. Errores de documentacion y gobierno

### 3.1 Falta de un Plan Maestro operativo unico

No se mantuvo un documento unico que obligara a registrar por cambio:

1. modulo origen;
2. fuente oficial y version;
3. archivo original, hash y vigencia;
4. ambiente exacto: local o produccion;
5. superficie exacta: CRM/Admin Ofertas, Portal, Motor o Constructor;
6. estado de analisis;
7. estado de publicacion;
8. consumidores impactados;
9. excepciones comerciales protegidas;
10. pruebas realizadas y evidencia posterior;
11. siguiente paso, bloqueo y responsable.

**Consecuencia:** la informacion quedo repartida entre conversaciones, archivos de documentacion, pruebas locales, interfaces y datos de produccion. No existia una fuente unica para decidir el estado real de un modulo.

### 3.2 Plan Maestro con estados contradictorios

El Plan Maestro se uso como seguimiento de tareas, no como contrato de evidencia. Contenia estados locales, historicos y productivos que podian coexistir sin una regla de reconciliacion.

Caso observado:

1. Affinity figuraba como terminado en documentacion.
2. Produccion no tenia una version publicada comprobada.
3. El archivo oficial estaba archivado.
4. El servidor no tenia disponible el lector PDF requerido para analizarlo.
5. Admin Ofertas mostraba `Al dia`.

**Consecuencia:** la documentacion permitia cinco afirmaciones incompatibles sobre el mismo modulo.

### 3.3 Documentacion historica, local y productiva mezclada

No se exigio que cada documento indicara claramente si describia:

1. una decision historica;
2. una implementacion local;
3. una prueba tecnica;
4. una publicacion productiva;
5. una validacion comercial.

**Consecuencia:** resultados locales o heredados se comunicaron como si describieran el estado operativo actual.

### 3.4 Falta de matriz de dependencias

No se documento de forma completa el recorrido:

`documento -> modulo origen -> publicacion -> Portal/Motor/Constructor/Comparativa`

**Consecuencia:** no se evaluo sistematicamente que otro modulo podia degradarse al corregir una pantalla o cambiar un estado.

### 3.5 Falta de registro de excepciones comerciales

No se protegieron como datos obligatorios las excepciones ya aprobadas o conocidas, entre ellas:

1. Inalambrico/IoT publicado;
2. Lista de Precios publicada con una excepcion unica;
3. boletines y reglas de Ofertas en trabajo;
4. beneficios originados en Fijo, Movil o IoT;
5. separacion entre archivo archivado y version comercial vigente.

**Consecuencia:** una matriz generica nueva degrado visualmente modulos ya trabajados a pendientes o en validacion.

### 3.6 Falta de definicion contractual de estados

No se impuso una definicion tecnica unica para los estados visibles:

1. `Falta fuente`: no existe archivo oficial archivado.
2. `Fuente sin analizar`: existe archivo, sin preview exitoso.
3. `Fuente sin publicar`: existe fuente o analisis, sin version vigente.
4. `Requiere revision`: hay borrador, contradiccion, cambio o vigencia pendiente.
5. `Bloqueado`: falta dependencia, formato, permiso o evidencia.
6. `Al dia`: fuente navegable, analisis exitoso, version vigente y consumidor validado.

**Consecuencia:** `Al dia` se uso como estado predeterminado por ausencia de informacion, en vez de ser una conclusion probada.

### 3.7 Falta de criterio de aceptacion verificable

Las tareas se cerraban con terminos genericos como `listo`, `terminado`, `verificado` o `publicado`, sin especificar pantalla, ambiente, documento, resultado y consumidor.

**Consecuencia:** no era posible saber que probar ni detectar que una confirmacion correspondia a otra superficie.

## 4. Errores en Admin Ofertas y Centro de Cargas

### 4.1 Estado `Al dia` incorrecto

La cola `Todo al dia` permitia presentar modulos como correctos aunque faltara fuente, analisis, publicacion, vigencia o evidencia de consumidor.

**Consecuencia:** el usuario no podia distinguir que documento debia cargar, analizar, revisar o publicar.

### 4.2 No se auditaron todos los modulos antes de cambiar la cola

Se intento corregir Affinity sin establecer primero una linea base de todos los modulos:

1. Fijo;
2. Claro TV;
3. Planes Moviles;
4. Inalambrico/IoT;
5. Lista de Precios;
6. Servicios;
7. Directorio de Fijo;
8. Beneficios;
9. Affinity;
10. Ofertas Vigentes.

**Consecuencia:** la correccion de un modulo genero una reclasificacion incorrecta de otros.

### 4.3 Tarjetas de `Tareas y reglas Admin` con datos escritos a mano

Las nueve tarjetas fueron implementadas inicialmente con estados fijos como pendiente, revision o listo, y con `Ultima revision: sin registrar`.

**Consecuencia:** la pantalla aparentaba control administrativo, pero no representaba el trabajo real ni la produccion.

### 4.4 Matriz generica desplegada sin preservar estado comercial

La sustitucion de tarjetas estaticas por una matriz operativa no preservo inicialmente todos los estados conocidos y excepciones ya acordadas.

**Consecuencia:** Inalambrico/IoT y Lista de Precios aparecieron como pendientes o en validacion, aunque tenian trabajo previo que debia conservarse y distinguirse.

### 4.5 Flujo de carga incompleto por categoria

No se verifico de punta a punta que cada categoria mostrara siempre:

1. carga de documento;
2. analisis;
3. resultado de comparacion;
4. borrador;
5. revision;
6. aprobacion;
7. publicacion;
8. documento original;
9. historial.

**Consecuencia:** algunas entradas abrían bibliotecas, detalles o modales de consulta sin acciones operativas de carga y analisis.

### 4.6 Confusion entre documento y detalle comercial

Se abrieron modales con informacion comercial cuando el requerimiento era abrir el archivo fuente original asociado al beneficio o a la publicacion.

**Consecuencia:** no se podia verificar la trazabilidad documental desde la interfaz.

### 4.7 Publicacion compuesta tratada como documento unico

Ofertas Vigentes contiene varias fuentes de Fijo, Movil, beneficios, promociones y financiamiento. Inicialmente se presento como si tuviera un solo documento.

**Consecuencia:** se oculto la composicion real de la publicacion y se dificulto identificar que boletin alimentaba cada dato.

### 4.8 Fuente referida sin indicador visible de archivo enlazado

Beneficios podia mostrar nombre de boletin, pagina o fuente comercial sin diferenciar claramente entre:

1. archivo original disponible;
2. referencia sin archivo navegable;
3. documento pendiente;
4. multiples fuentes.

**Consecuencia:** el usuario no podia saber si la fuente era verificable ni cual documento abrir.

## 5. Errores especificos de Affinity

### 5.1 Archivo archivado confundido con publicacion

El PDF oficial fue guardado, pero eso no significaba que existiera una version vigente publicada.

**Consecuencia:** Affinity aparecio `Al dia` sin tener una publicacion comprobada.

### 5.2 Dependencia PDF ausente en produccion

El servidor de produccion no tenia instalado el lector PDF requerido para el analisis real.

**Consecuencia:** el archivo podia guardarse, pero el sistema no podia procesarlo correctamente ni crear una vista previa confiable.

### 5.3 Falta de preflight tecnico antes de habilitar el flujo

No se verificaron antes de operar:

1. dependencia Python;
2. lector PDF;
3. acceso al archivo archivado;
4. parser real;
5. preview;
6. borrador;
7. publicacion;
8. consumidor del Portal.

**Consecuencia:** el usuario encontro el bloqueo durante una prueba operativa, en vez de que se detectara antes del uso.

### 5.4 Mensajeria generica de error

Un error de analisis podia atribuirse visualmente a una familia incorrecta, por ejemplo Fijo/Claro TV, aun estando en Affinity.

**Consecuencia:** el mensaje no orientaba al usuario hacia la causa ni el siguiente paso correctos.

## 6. Errores en Constructor y Portal

### 6.1 Confusion de superficies

Se confundieron repetidamente:

1. CRM PYMES;
2. Admin Ofertas;
3. Portal web;
4. Constructor local;
5. Constructor heredado;
6. produccion.

**Consecuencia:** se comunicaron resultados correctos en una superficie que no correspondian a la que el usuario estaba observando.

### 6.2 Constructor heredado no aislado desde el inicio

No se realizo primero un inventario completo de rutas, menus, pestañas, reglas y dependencias heredadas antes de retirar o reconstruir experiencias.

**Consecuencia:** coexistieron navegacion antigua, modelos visuales heredados y expectativas del Constructor nuevo.

### 6.3 Constructor nuevo avanzado sin contrato de entrada cerrado

El Constructor nuevo necesitaba definir antes de construir:

1. entrada desde cliente CRM;
2. recuperacion de propuesta existente;
3. guardado como nueva propuesta;
4. construccion manual;
5. consulta conversacional;
6. generacion de comparativa;
7. fuentes y reglas autorizadas;
8. consumo de datos publicados.

**Consecuencia:** se discutieron pantallas y rutas sin tener cerrado el contrato funcional y comercial que debia gobernarlas.

### 6.4 Reglas comerciales y fuentes no separadas suficientemente

No se mantuvo siempre una separacion rigurosa entre:

1. documento oficial;
2. extraccion o parser;
3. regla normalizada;
4. regla publicada;
5. regla consumida por Motor;
6. regla presentada por Portal o Constructor.

**Consecuencia:** una referencia o un resultado local podia parecer una regla comercial vigente.

## 7. Errores de validacion y despliegue

### 7.1 Pruebas locales comunicadas como productivas

Se comunicaron correcciones locales como disponibles para prueba antes de desplegarlas y verificarlas en CRM PYMES.

**Consecuencia:** el usuario actualizo pantallas productivas y siguio viendo el comportamiento anterior.

### 7.2 No hubo regresion completa antes de despliegue

No se ejecuto una regresion funcional por modulo antes de desplegar cambios de estado.

**Consecuencia:** una correccion enfocada en Affinity modifico la lectura operativa de otros modulos.

### 7.3 No se verifico caché y archivo servido antes de comunicar entrega

El frontend estatico requiere confirmar que el navegador cargo el archivo nuevo y que el servidor esta sirviendo la version esperada.

**Consecuencia:** hubo discrepancia temporal entre codigo corregido y pantalla visible.

### 7.4 Despliegue sin corte de evidencia por modulo

El despliegue no se organizo inicialmente como una lista de aceptacion por modulo y consumidor.

**Consecuencia:** no existia una prueba final que demostrara que cada modulo seguia conservando su comportamiento aprobado.

### 7.5 No se implemento rollback operativo antes de cambios visuales de estado

No se definio una restauracion especifica de la matriz anterior, de estados conocidos y de excepciones antes de cambiar el control administrativo.

**Consecuencia:** si una nueva clasificacion era incorrecta, no existia una restauracion funcional inmediatamente verificable por modulo.

## 8. Errores de comunicacion y orientacion operativa

### 8.1 Confirmaciones antes de evidencia

Se uso lenguaje de entrega antes de tener prueba en la pantalla y ambiente solicitados.

**Consecuencia:** se indujo al usuario a realizar pruebas que no podian pasar.

### 8.2 Falta de orientacion paso a paso con el estado real

No se entrego de forma consistente una instruccion operativa concreta: donde entrar, que boton usar, que documento seleccionar, que resultado esperar y que hacer ante bloqueo.

**Consecuencia:** el usuario tuvo que descubrir el flujo por prueba y error.

### 8.3 Repeticion de preguntas y explicaciones en vez de verificacion previa

Se pidieron o repitieron aclaraciones que debian resolverse leyendo la documentacion, la interfaz y el estado real antes de responder.

**Consecuencia:** aumento de tiempo operativo y perdida de confianza.

### 8.4 No se distinguio con suficiente rigor entre aprobacion de alcance y autorizacion de produccion

Una conversacion sobre diseno, diagnostico o correccion local no equivale por si sola a que la version productiva este validada.

**Consecuencia:** se confundieron avances de implementacion con resultados operativos entregados.

## 9. Trabajo que debio realizarse antes de cualquier cambio

1. Crear inventario de los diez modulos de Admin Ofertas.
2. Registrar fuente, hash, vigencia y archivo navegable por modulo.
3. Registrar version publicada y consumidor por modulo.
4. Registrar excepciones comerciales y estados ya aprobados.
5. Construir matriz de impacto entre CRM, Portal, Motor y Constructor.
6. Separar local, produccion, documentacion historica y evidencia comercial.
7. Verificar dependencias del servidor antes de habilitar carga y analisis.
8. Probar una fuente real por tipo de archivo y modulo.
9. Probar documento original, borrador, aprobacion y publicacion.
10. Probar cada consumidor despues de publicar.
11. Ejecutar regresion de todos los modulos afectados.
12. Validar visualmente con el usuario antes de declarar entrega.

## 10. Consecuencias operativas

1. Perdida de tiempo en pruebas de pantallas y ambientes equivocados.
2. Estados de modulo incorrectos o no confiables.
3. Dificultad para saber que documento faltaba o estaba realmente publicado.
4. Riesgo de usar precios, beneficios o reglas sin fuente vigente comprobada.
5. Riesgo de degradar visualmente modulos ya publicados.
6. Dificultad para identificar consumidores afectados por una publicacion.
7. Confusion sobre donde cargar un boletin y que modulo debe procesarlo.
8. Riesgo de reutilizar logica heredada del Constructor sin validacion comercial actual.
9. Deterioro de la trazabilidad del sistema comercial.
10. Deterioro de la confianza en los estados visibles y en la entrega de cambios.

## 11. Controles obligatorios recomendados

### 11.1 Ficha obligatoria de cambio

Ningun cambio debe iniciar sin registrar:

1. necesidad comercial;
2. modulo origen;
3. fuente oficial;
4. estado actual confirmado;
5. excepciones que deben preservarse;
6. datos, APIs y pantallas impactadas;
7. ambientes afectados;
8. plan de prueba;
9. criterio de aceptacion;
10. plan de rollback.

### 11.2 Regla de estado

No se puede usar `Listo`, `Publicado`, `Terminado` o `Al dia` sin evidencia de:

1. fuente oficial navegable;
2. analisis exitoso;
3. version vigente publicada;
4. vigencia conocida o excepcion documentada;
5. consumidor validado;
6. ambiente identificado;
7. prueba posterior al despliegue.

### 11.3 Regla de despliegue

Todo despliegue debe incluir:

1. respaldo;
2. preflight de dependencias;
3. pruebas dirigidas;
4. prueba real del documento;
5. prueba de interfaz;
6. prueba de consumidor;
7. regresion de modulos relacionados;
8. evidencia de produccion;
9. confirmacion explicita de resultado y pendientes.

## 12. Conclusion

La falla fue principalmente de gobierno tecnico, documentacion operativa, validacion y comunicacion de evidencia. No se protegio el sistema mediante una cadena verificable de fuente, analisis, publicacion, impacto y prueba productiva. Sin un Plan Maestro operativo unico y obligatorio, los mismos errores pueden repetirse aunque se corrija una pantalla puntual.
