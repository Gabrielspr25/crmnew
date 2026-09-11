# Informe ejecutivo - Motor Comercial, Publicacion y Portal

## Objetivo

El objetivo no es cambiar el concepto comercial del CRM.

El objetivo es mejorar como el sistema ejecuta ese concepto para que Admin, Portal y Constructor trabajen con una sola verdad comercial:

```text
Fuente oficial
-> Seccion detectada
-> Regla comercial normalizada
-> Condicion
-> Accion
-> Prioridad
-> Resultado
-> Publicacion aprobada
```

## Resumen ejecutivo

Hoy el sistema tiene partes utiles y reutilizables, pero todavia no esta cerrado como motor comercial unico.

La base actual permite guardar fuentes oficiales, conservar hash, generar vistas previas y publicar contenido al Portal. Sin embargo, todavia existen dos caminos de publicacion:

- un camino nuevo, mas controlado, con fuente oficial, preview, borrador, validacion, aprobacion y publicacion;
- un camino anterior que puede actualizar directamente modulos del Portal.

El riesgo principal no es que todo este mal. El riesgo es que el sistema todavia puede mezclar estructura, ofertas, cambios de precio, beneficios y terminos si no se obliga a clasificar por seccion.

## Que se mantiene del concepto actual

Se mantiene:

- usar solo fuentes oficiales;
- separar estructura/base de ofertas/beneficios;
- conservar archivo original, hash, usuario, vigencia e historial;
- generar vista previa antes de publicar;
- publicar solamente informacion aprobada;
- mostrar en el Portal solo contenido vigente y aprobado;
- hacer que el Constructor use informacion publicada, no documentos originales;
- no inventar reglas comerciales.

## Que se esta mejorando

La mejora es tecnica y operativa.

Antes, el sistema podia depender demasiado de:

- la pestana donde se subio el archivo;
- el nombre del archivo;
- si el archivo era PDF o Excel;
- el modulo seleccionado por el usuario.

La mejora propuesta es que el sistema lea el contenido real y clasifique por seccion.

Un mismo documento puede traer:

- estructura/base;
- ofertas;
- beneficios;
- cambio oficial de precio;
- terminos;
- accesorios;
- reglas que requieren revision.

Por eso, un archivo no debe equivaler automaticamente a un solo tipo comercial.

## Arquitectura actual encontrada

Actualmente el Portal consume informacion desde:

```text
GET /api/planes-modulos/:pagina
```

Ese endpoint entrega los modulos publicados para:

- Fijo;
- Movil;
- Claro TV;
- Inalambrico/IoT.

La tabla principal que alimenta esa salida es:

```text
public.planes_modulos
```

Ademas, existe una arquitectura nueva para fuentes oficiales:

```text
public.fuentes_comerciales
public.bases_informativas_publicaciones
```

Esta arquitectura nueva ya permite:

- registrar la fuente oficial;
- guardar hash;
- generar preview;
- guardar borrador;
- validar;
- aprobar;
- publicar;
- reemplazar una publicacion anterior;
- conservar trazabilidad.

## Flujo correcto esperado

El flujo correcto debe quedar asi:

```text
Admin Ofertas
-> cargar fuente oficial
-> archivar original
-> calcular hash
-> detectar secciones
-> normalizar reglas
-> comparar contra version vigente
-> mostrar preview
-> guardar borrador
-> validar
-> aprobar
-> publicar
-> Portal consume version publicada
-> Constructor calcula reglas vigentes
```

## Flujo actual de Fijo

Para Fijo, hoy existen piezas importantes ya construidas.

El parser de estructura fija puede separar el PDF oficial en secciones como:

- telefonia fija;
- internet fijo;
- 2Play;
- Claro TV;
- valores agregados;
- equipos/accesorios de internet;
- terminos;
- contenido temporal excluido.

Esto es positivo y se debe conservar.

Pero todavia falta cerrar el flujo para que las ofertas y beneficios de Fijo no se traten como si fueran estructura/base.

## Problema principal detectado

El problema principal es que estructura y ofertas todavia no estan completamente separadas como reglas comerciales normalizadas.

Ejemplo:

- una estructura define un plan y su precio regular;
- una oferta aplica descuento, bono, meses gratis o condicion especial;
- un boletin puede avisar un cambio oficial de precio;
- los terminos pueden limitar elegibilidad.

El sistema debe distinguir esos casos.

Si no los distingue, puede pasar que:

- una oferta se publique como estructura;
- un precio promocional reemplace un precio base;
- una condicion no confirmada se aplique automaticamente;
- una contradiccion bloquee todo el documento;
- el Constructor recomiende una combinacion no confirmada.

## Estado actual por modulo

| Modulo | Estado actual | Riesgo |
|---|---|---|
| Fijo estructura/base | Parcialmente funcional | Medio/alto |
| Fijo ofertas/beneficios | Incompleto | Alto |
| Movil estructura/base | Parcialmente funcional | Alto |
| Movil ofertas/equipos | Parcialmente funcional con versionado propio | Medio/alto |
| Claro TV | Parcial, apoyado en parser de Fijo | Medio/alto |
| Inalambrico/IoT | Parcial, requiere separacion interna por seccion | Alto |
| Lista de Precios | Parcialmente funcional | Medio/alto |
| Benefits | Falta normalizacion completa | Alto |
| Accesorios | Falta categoria/flujo completo | Alto |

## Que funciona y se conserva

Se conserva:

- `public.fuentes_comerciales` para registrar fuentes oficiales;
- `public.bases_informativas_publicaciones` para borrador, validacion, aprobacion y publicacion;
- `public.planes_modulos` como salida actual del Portal;
- el parser multiseccion de Fijo;
- las pruebas existentes de parser y preview;
- el endpoint publico que ya consume el Portal;
- la trazabilidad por fuente, hash y usuario.

## Que debe corregirse

Debe corregirse:

- no depender solo de PDF o Excel;
- permitir que la clasificacion dependa del contenido;
- separar estructura, oferta, beneficio, precio oficial, terminos y accesorios;
- agregar estado de confianza por regla;
- no usar precio como identidad comercial;
- versionar cambios de precio;
- bloquear solo la regla con contradiccion, no necesariamente todo el documento;
- evitar que rutas antiguas publiquen sin el ciclo completo;
- asegurar que el Constructor use reglas normalizadas y aprobadas.

## Regla de precio

El precio no debe formar parte de la identidad comercial.

Ejemplo correcto:

```text
codigo_plan + tipo_servicio + velocidad
```

El precio debe ser un valor versionado.

Si cambia el precio, el sistema debe entender:

```text
Es el mismo plan con una nueva version de precio.
```

No debe interpretarlo como un plan nuevo.

## Regla de ofertas

Una oferta temporal no modifica la estructura/base.

Si el boletin habla de:

- descuento;
- gratis;
- credito;
- bono;
- financiamiento;
- meses gratis;
- condicion especial;

eso debe quedar como oferta o beneficio.

Solo si la fuente dice explicitamente nuevo precio, cambio oficial de precio o actualizacion de precio regular, debe actualizarse el precio base con historial.

## Regla de elegibilidad

El Constructor nunca debe inferir elegibilidad por ausencia de una restriccion.

Si una fuente no dice si aplica a:

- cliente nuevo;
- renovacion;
- portabilidad;
- convergencia;
- plazo;
- plan minimo;
- limite por BAN;

el dato debe quedar como:

```text
no determinado
```

Una regla no determinada no debe aplicarse automaticamente.

## Riesgo de publicacion actual

La respuesta clara es:

```text
No es seguro usar el flujo actual como publicacion automatica general.
```

Si es parcialmente usable para estructura/base cuando:

- la fuente es oficial;
- el parser la reconoce;
- el preview no tiene errores;
- se guarda borrador;
- se valida;
- se aprueba;
- se publica por el flujo controlado.

No es seguro todavia para publicacion automatica general de:

- ofertas fijas;
- beneficios;
- cambios oficiales de precio;
- reglas mixtas;
- terminos;
- elegibilidad;
- acumulacion de descuentos;
- reglas del Constructor.

## Propuesta minima de correccion

No se recomienda reconstruir todo desde cero.

La propuesta minima es:

1. Cerrar primero Fijo como patron tecnico.
2. Mantener `planes_modulos` como salida publica del Portal, pero no como fuente comercial.
3. Usar `fuentes_comerciales` y `bases_informativas_publicaciones` como flujo oficial.
4. Agregar clasificacion por seccion.
5. Crear reglas normalizadas desde cada seccion.
6. Agregar estado de confianza por regla.
7. Versionar precio base y cambios oficiales.
8. Separar ofertas temporales de precio regular.
9. Bloquear rutas antiguas para publicacion comercial nueva cuando el flujo nuevo este listo.
10. Extender el mismo patron a Movil, Claro TV, Inalambrico/IoT, Lista de Precios, Benefits y Accesorios.

## Orden recomendado

```text
Fase 1: Auditoria tecnica completa de Fijo
Fase 2: Correccion de Fijo como patron
Fase 3: Modelo comun del Motor Comercial
Fase 4: Adaptacion de Movil, Claro TV e Inalambrico/IoT
Fase 5: Lista de Precios, Benefits y Accesorios
Fase 6: Constructor consumiendo reglas normalizadas
```

## Conclusion

No estamos cambiando el concepto comercial.

Estamos mejorando la arquitectura para que el concepto se cumpla sin depender de interpretaciones manuales, pestanas equivocadas o archivos clasificados por nombre.

El sistema debe pasar de:

```text
archivo subido en un modulo
```

a:

```text
fuente oficial + seccion detectada + regla normalizada + aprobacion + publicacion vigente
```

Ese es el cambio necesario para que Admin, Portal y Constructor trabajen con una sola verdad comercial.

## Estado de esta entrega

Esta entrega es documentacion ejecutiva para revision.

No se desplego.
No se ejecutaron migraciones.
No se cambiaron datos comerciales.
No se modifico produccion.
No se inventaron reglas comerciales.
