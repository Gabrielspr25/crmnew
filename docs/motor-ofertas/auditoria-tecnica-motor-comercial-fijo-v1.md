# Auditoria tecnica - Motor Comercial, Fijo y publicacion al Portal

Fecha: 2026-08-29

## Alcance

Esta auditoria revisa el flujo actual de publicacion comercial relacionado con:

- Fijo estructura/base;
- Fijo ofertas/beneficios;
- dependencias compartidas con Movil, Claro TV, Inalambrico/IoT, Lista de Precios, Benefits y Accesorios;
- Portal;
- Constructor.

No incluye implementacion, migraciones, despliegue ni cambios de datos comerciales.

## Conclusion ejecutiva

El CRM ya tiene piezas utiles para construir el Motor Comercial, pero todavia no existe un flujo unico y cerrado para todas las reglas comerciales.

La parte mas aprovechable es el flujo nuevo de:

```text
fuentes_comerciales
-> preview-base
-> bases_informativas_publicaciones
-> validar
-> aprobar
-> publicar
-> planes_modulos
-> Portal
```

El riesgo es que ese flujo convive con rutas anteriores que pueden actualizar `planes_modulos` de forma directa. Ademas, las ofertas, beneficios, cambios oficiales de precio, terminos, accesorios y reglas de elegibilidad todavia no estan normalizados como reglas comerciales completas.

Respuesta clara:

```text
Hoy no es seguro usar el sistema como publicacion automatica general al Portal.
```

Si es parcialmente usable para estructura/base cuando se usa el flujo controlado de fuentes comerciales, preview, borrador, validacion, aprobacion y publicacion.

## Arquitectura actual

### Entrada de fuentes oficiales

Archivo principal:

```text
backend/src/routes/fuentesComercialesRoutes.js
```

Tabla principal:

```text
public.fuentes_comerciales
```

Responsabilidad actual:

- aceptar PDF, XLSX y XLS;
- validar familia;
- archivar fuente;
- calcular SHA-256;
- registrar metadatos;
- asociar vigencia;
- permitir preview y publicacion segun familia.

Familias actuales en codigo:

```text
equipos
fijos
moviles
inalambrico_iot
servicios
cloud_sva
claro_tv
ofertas_moviles
ofertas_fijo
beneficios
```

Observacion:

No existe todavia una familia completa `accesorios` dentro de `fuentes_comerciales`.

### Salida consumida por Portal

Archivo principal:

```text
backend/src/routes/planesRoutes.js
```

Endpoint publico:

```text
GET /api/planes-modulos/:pagina
```

Tabla principal:

```text
public.planes_modulos
```

El Portal consume esta salida para:

- `fijos`;
- `moviles`;
- `claro_tv`;
- `inalambrico`.

Por ahora `planes_modulos` debe mantenerse como contrato publico, pero debe tratarse como salida publicada, no como fuente comercial.

## Recorrido real de Fijo

### Camino controlado actual

```text
1. Admin sube fuente oficial.
2. Se guarda en public.fuentes_comerciales.
3. Se ejecuta preview-base.
4. Se usa scripts/parse_planes_fijos_pdf.py.
5. Se generan previews para fijo y claro_tv.
6. Se guarda borrador en public.bases_informativas_publicaciones.
7. Se valida.
8. Se aprueba.
9. Se publica con public.publicar_base_informativa.
10. Se proyecta a public.planes_modulos.
11. El Portal lee /api/planes-modulos/fijos.
```

Este camino es el mas cercano a la Matriz Comercial v1.

### Camino anterior todavia activo

```text
1. Admin usa /api/planes-modulos/preview.
2. El sistema detecta parser.
3. Se genera preview en memoria.
4. /api/planes-modulos/apply/:previewId actualiza public.planes_modulos directo.
```

Riesgo:

Este camino no pasa por base informativa, estado de confianza, aprobacion versionada ni regla normalizada.

## Parser de Fijo

Archivo:

```text
scripts/parse_planes_fijos_pdf.py
```

Estado:

Reutilizable para estructura/base.

Ya separa secciones como:

- `fijo_telefonia`;
- `fijo_internet_2play`;
- `fijo_valores_agregados_vendibles`;
- `fijo_equipos_accesorios_internet`;
- `claro_tv_planes`;
- `claro_tv_servicios_complementos`;
- `claro_tv_equipos`;
- `internet_equipos_ofertas`;
- `terminos_contrato`;
- `contenido_temporal_excluido`;
- `revision_manual`.

Fortaleza:

Clasifica por encabezados de seccion y no solo por pagina.

Limite:

No convierte ofertas/beneficios en reglas comerciales completas con condiciones, acumulacion, nivel de aplicacion y estado de confianza.

## Base informativa

Archivo:

```text
backend/src/services/basesInformativasPreview.js
```

Tabla:

```text
public.bases_informativas_publicaciones
```

Migration:

```text
backend/migrations/2026-08-16-bases-informativas-publicaciones.sql
```

Estado:

Reutilizable.

Capacidades confirmadas:

- guarda registros normalizados;
- guarda candidatos publicos;
- guarda modulos generados;
- guarda contenido excluido;
- guarda auditoria;
- guarda duplicados;
- guarda validacion;
- guarda diferencias;
- tiene estados `borrador`, `validada`, `aprobada`, `publicada`, `reemplazada`;
- congela campos comerciales despues de aprobacion;
- permite una sola publicacion por categoria;
- publica en transaccion hacia `planes_modulos`.

Limite:

La validacion actual depende de conteos esperados para una version concreta. Eso protege contra errores, pero puede bloquear una fuente oficial futura si cambia el formato o el numero de filas.

## Fijo estructura/base

Estado:

Parcialmente funcional.

Funciona cuando:

- la fuente es PDF reconocida;
- el parser detecta secciones esperadas;
- la vista previa no tiene errores;
- se guarda borrador;
- se valida;
- se aprueba;
- se publica por `publicar_base_informativa`.

Incompleto:

- el flujo actual todavia bloquea base por formato PDF en rutas donde negocio ya permitio PDF o Excel por contenido;
- no hay normalizacion completa tipo `Fuente -> Seccion -> Regla -> Condicion -> Accion -> Prioridad -> Resultado`;
- los cambios de precio se detectan como cambios de campo, pero no como versiones de valor comercial.

## Fijo ofertas/beneficios

Estado:

Incompleto.

Existe familia:

```text
ofertas_fijo
beneficios
```

Pero el flujo de `planes-fijos/preview` todavia usa el parser de planes fijos para fuentes de ofertas/beneficios.

Riesgo:

Una oferta de Fijo puede no transformarse en:

- beneficio;
- condicion;
- elegibilidad;
- nivel de aplicacion;
- acumulacion;
- vigencia;
- regla para Constructor.

Por tanto, no debe considerarse lista para publicacion automatica general.

## Movil

Estado:

Parcial.

Hay dos piezas:

1. Base informativa movil desde PDF de planes.
2. Ofertas moviles versionadas en `public.ofertas_movil_versiones`.

Fortaleza:

Movil ya tiene un flujo versionado para ofertas/equipos y una version vigente.

Limite:

Ese motor esta enfocado en `movil_equipos` y no resuelve todavia el motor comun para Fijo, Claro TV, Inalambrico/IoT, Benefits y Accesorios.

## Claro TV

Estado:

Parcial.

Claro TV se extrae desde el parser multiseccion de Fijo cuando el PDF trae sus bloques.

Funciona para:

- planes Claro TV;
- servicios/complementos.

Incompleto:

- equipos de TV quedan separados;
- ofertas/beneficios de TV no estan modelados como reglas completas;
- aun depende de que el documento de estructura tenga encabezados esperados.

## Inalambrico/IoT

Estado:

Riesgoso.

Hay soporte para detectar:

- Internet On The Go;
- Claro Oficina;
- IoT;
- ofertas especiales de equipos.

Riesgo tecnico confirmado:

El flujo automatico actual actualiza vigencia y referencia, pero conserva contenido:

```text
SET contenido=contenido
```

Eso significa que una fuente nueva puede quedar archivada y marcada, pero no necesariamente reemplazar estructura/ofertas reales publicadas.

Ademas, existe una prueba que documenta esa conducta como esperada actualmente, por lo que hay que cambiar contrato y tests cuando se implemente la correccion.

## Lista de Precios

Estado:

Parcialmente funcional.

Flujo:

- se carga como fuente `equipos`;
- acepta Excel oficial;
- genera preview;
- publica a tablas de equipos.

Tablas:

```text
public.equipos_uploads
public.equipos_lista
public.equipos_mensualidades
public.equipos_pospago
public.v_equipos_vigentes
```

Riesgo:

El importador actual desactiva catalogo vigente antes de reactivar/importar dentro de transaccion. Es aceptable para lista completa oficial, pero no para cambios puntuales de precio informados dentro de un boletin si no se modelan como cambio oficial versionado.

## Benefits

Estado:

Incompleto.

Existe como familia de fuente, pero falta:

- parser propio o clasificador comun;
- normalizacion de beneficios;
- acumulacion;
- incompatibilidades;
- limites por BAN, linea, cliente o evento;
- exposicion controlada al Constructor.

## Accesorios

Estado:

Incompleto.

No existe familia formal `accesorios` en `fuentes_comerciales`.

Hoy puede quedar mezclado con:

- Lista de Precios;
- equipos;
- ofertas;
- contenido temporal;
- accesorios de internet en Fijo.

Debe agregarse como categoria/familia operativa o mapearse explicitamente dentro del motor para evitar que quede sin dueño.

## Constructor

Estado:

Parcial.

El Constructor puede consumir publicaciones actuales, pero todavia no recibe una respuesta unica del tipo:

```text
cliente
BAN
lineas
evento
planes
equipos
condiciones
ofertas vigentes
beneficios compatibles
resultado recomendado
alternativas validas
```

Riesgo:

Si el Portal recibe datos publicados pero sin elegibilidad normalizada, el Constructor puede mostrar informacion correcta visualmente pero no necesariamente calcular la mejor combinacion comercial con seguridad.

## Matriz de estado por modulo

| Modulo | Carga | Parser | Clasificacion | Normalizacion | Preview | Publicacion | Portal | Constructor | Riesgo |
|---|---|---|---|---|---|---|---|---|---|
| Fijo estructura/base | Parcial | Reutilizable | Parcial | Parcial | Parcial | Parcial | Funciona | Parcial | Alto |
| Fijo ofertas/beneficios | Parcial | Incompleto | Incompleto | Incompleto | Parcial | Riesgoso | Parcial | Incompleto | Alto |
| Movil estructura/base | Parcial | Parcial | Parcial | Parcial | Parcial | Parcial | Funciona | Parcial | Alto |
| Movil ofertas/equipos | Parcial | Parcial | Parcial | Parcial | Parcial | Versionado propio | Parcial | Parcial | Medio/alto |
| Claro TV | Parcial | Reutiliza Fijo | Parcial | Parcial | Parcial | Parcial | Funciona | Parcial | Medio/alto |
| Inalambrico/IoT | Parcial | Parcial | Incompleto | Incompleto | Parcial | Riesgoso | Parcial | Incompleto | Alto |
| Lista de Precios | Parcial | Excel equipos | Parcial | Parcial | Parcial | Parcial | Parcial | Parcial | Medio/alto |
| Benefits | Parcial | No completo | Incompleto | Incompleto | Incompleto | Incompleto | Incompleto | Incompleto | Alto |
| Accesorios | Incompleto | Parcial | Incompleto | Incompleto | Incompleto | Incompleto | Parcial | Incompleto | Alto |

## Riesgos prioritarios

1. Dos caminos de publicacion conviven y pueden producir estados distintos.
2. `planes_modulos` es salida del Portal, pero tambien puede editarse como si fuera fuente.
3. Ofertas y beneficios no tienen todavia regla normalizada comun.
4. Cambios oficiales de precio no estan modelados como version de valor.
5. PDF/Excel todavia se usa como restriccion en rutas donde debe mandar el contenido.
6. Inalambrico/IoT puede archivar una fuente sin reemplazar contenido real.
7. Accesorios no tiene familia completa.
8. Benefits no tiene motor de acumulacion/elegibilidad.
9. Constructor todavia no consume un motor comercial unificado.

## Que conservar

- `public.fuentes_comerciales`;
- `public.bases_informativas_publicaciones`;
- `public.planes_modulos` como salida publica compatible;
- parser multiseccion de Fijo;
- pruebas de parser, preview y publicacion base;
- archivo y hash de fuentes oficiales;
- flujo de preview, borrador, validar, aprobar y publicar;
- versionado movil ya existente como referencia para ofertas moviles.

## Que modificar

- Cambiar la clasificacion para depender de secciones detectadas, no de pestana o extension.
- Permitir PDF/Excel cuando la regla comercial lo permita y validar por contenido.
- Sacar el camino viejo de publicacion comercial oficial.
- Agregar reglas normalizadas para ofertas y beneficios.
- Agregar estado de confianza por regla.
- Separar precio base de oferta temporal.
- Versionar cambios oficiales de precio.
- Agregar categoria/familia para Accesorios o su equivalente explicito.
- Corregir Inalambrico/IoT para que una publicacion real reemplace contenido cuando corresponda.

## Que construir

Modelo comun:

```text
Fuente
-> Seccion
-> Regla
-> Condicion
-> Accion
-> Prioridad
-> Resultado
```

Entidades requeridas:

- fuente oficial;
- seccion detectada;
- regla comercial;
- condicion de elegibilidad;
- accion comercial;
- prioridad;
- estado de confianza;
- version;
- publicacion;
- trazabilidad.

## Propuesta minima de correccion

### Fase 1 - Fijo como patron

Cerrar Fijo primero porque ya tiene parser multiseccion y flujo base informativa.

Entregables:

- clasificacion por seccion;
- separacion estructura/oferta/beneficio/precio/terminos/accesorio;
- preview que muestre reglas y no solo filas;
- estado de confianza por regla;
- publicacion controlada a `planes_modulos`;
- bloqueo del camino viejo para publicacion comercial oficial.

### Fase 2 - Precio versionado

Implementar regla:

```text
precio no es identidad
precio es valor versionado
```

Si una fuente dice nuevo precio oficial:

```text
mismo elemento comercial
-> cerrar version anterior
-> crear nuevo valor
-> conservar historial
```

Si una fuente dice descuento, gratis, bono o condicion:

```text
oferta temporal
-> no sobrescribe base
```

### Fase 3 - Ofertas y Benefits

Normalizar ofertas y beneficios con:

- producto afectado;
- condicion;
- vigencia;
- acumulacion;
- incompatibilidad;
- limite por BAN, linea, cliente o evento;
- fuente;
- estado de confianza.

### Fase 4 - Inalambrico/IoT

Corregir publicacion mixta:

- estructura;
- equipos;
- ofertas;
- precios;
- terminos;
- imagenes si vienen del PDF;
- orden de secciones del boletin.

Debe dejar de actualizar solo vigencia cuando el boletin trae contenido nuevo.

### Fase 5 - Constructor

El Constructor debe consumir reglas aprobadas y publicadas, no documentos.

Debe devolver:

- combinaciones validas;
- opcion recomendada;
- alternativas validas;
- reglas bloqueadas;
- motivos de bloqueo;
- fuente de cada beneficio.

## Decision comercial pendiente

No hay una decision comercial bloqueante para seguir auditando.

Si hay decision antes de implementar:

```text
Confirmar si Fijo se cierra primero como patron, o si se adelanta Inalambrico/IoT por urgencia visual.
```

## Estado final de la auditoria

Esta auditoria confirma que:

- el concepto comercial no cambia;
- la arquitectura actual tiene piezas reutilizables;
- el flujo oficial debe ser el de fuentes comerciales y bases informativas;
- los caminos directos deben quedar fuera de la publicacion comercial nueva;
- Fijo debe cerrarse como patron;
- no se debe desplegar ni migrar hasta tener el plan tecnico aprobado.

## Acciones realizadas en esta entrega

- Se leyo la solicitud de Motor Comercial, Publicacion y Portal.
- Se revisaron instrucciones activas del CRM.
- Se revisaron skills/reglas de boletines, convergencia y fuentes comerciales.
- Se inspeccionaron rutas, servicios, migraciones, tests y documentos existentes.
- Se creo este Markdown de auditoria.

No se desplego.
No se ejecutaron migraciones.
No se cambiaron datos comerciales.
No se modifico produccion.
No se tocaron proyectos externos al flujo comercial de `newcrm`.
