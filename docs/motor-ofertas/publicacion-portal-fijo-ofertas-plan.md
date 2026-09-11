# Publicacion al Portal: estructura fija, ofertas y plan de correccion

## Estado actual

Hoy el CRM tiene piezas separadas, pero todavia no estan cerradas como un motor comercial completo.

### 1. Fuentes oficiales

El sistema puede guardar documentos oficiales con:

- archivo original,
- familia o modulo,
- tipo de archivo,
- hash,
- usuario,
- fecha de carga,
- vigencia,
- estado.

Esto sirve para trazabilidad, pero no garantiza por si solo que el contenido haya quedado bien publicado.

### 2. Estructura/base de Fijo

La estructura/base de Fijo debe representar los planes fijos publicados en el portal:

- telefonia fija,
- internet,
- 2Play,
- 3Play,
- cargos base,
- velocidades,
- codigos de plan,
- precios regulares.

Esta estructura es la base que el Portal muestra y que el Constructor debe consultar antes de aplicar ofertas.

### 3. Ofertas de Fijo

Las ofertas de Fijo son otra capa distinta. Pueden incluir:

- beneficios de convergencia,
- descuentos,
- meses gratis,
- ofertas de velocidad,
- doble play,
- triple play,
- combinaciones con movil o Claro TV.

Estas ofertas no deben reemplazar la estructura/base, salvo que el boletin diga explicitamente que hay cambio oficial de estructura o precio base.

### 4. Portal

El Portal debe mostrar solo contenido aprobado/publicado.

El Portal no debe mostrar como vigente:

- documentos recien cargados,
- borradores,
- reglas con contradiccion,
- reglas sin vigencia,
- reglas sin fuente oficial suficiente.

### 5. Constructor

El Constructor no debe leer PDFs ni Excels directamente.

Debe consumir reglas normalizadas:

- plan base,
- precio base,
- equipo,
- oferta,
- beneficio,
- condiciones,
- vigencia,
- fuente oficial,
- nivel de aplicacion: cliente, BAN, linea, plan, equipo, producto o combinacion.

## Problema actual

El problema central es que el flujo actual todavia puede confundirse entre:

- estructura/base,
- oferta/beneficio,
- cambio oficial de precio,
- terminos,
- accesorios,
- reglas mixtas.

Eso provoca riesgos como:

- subir una oferta donde deberia ir una estructura,
- procesar un documento por el modulo equivocado,
- bloquear demasiado o bloquear mal,
- conservar contenido anterior aunque se haya cargado un boletin nuevo,
- no distinguir si un cambio de precio es base oficial o promocion temporal,
- no separar reglas confirmadas de reglas que requieren revision.

## Como debe funcionar

## Flujo correcto para estructura de Fijo

1. Se sube fuente oficial.
2. El Admin pregunta el tipo esperado: estructura/base.
3. El sistema analiza el contenido, no solo la extension.
4. Detecta codigos y planes fijos.
5. Divide secciones si corresponde.
6. Compara contra la estructura vigente.
7. Marca cambios:
   - nuevo,
   - modifica,
   - reemplaza,
   - vence,
   - sin cambio.
8. Genera vista previa.
9. Se guarda borrador.
10. Se valida.
11. Se aprueba.
12. Se publica.
13. El Portal consume esa version publicada.
14. El Constructor la usa como base para calcular propuestas.

## Flujo correcto para ofertas de Fijo

1. Se sube fuente oficial.
2. El Admin pregunta el tipo esperado: oferta/beneficio.
3. El sistema analiza por secciones.
4. Detecta:
   - beneficio,
   - producto principal afectado,
   - lineas relacionadas,
   - condicion de convergencia,
   - plan requerido,
   - cliente convergente o no convergente,
   - vigencia,
   - restricciones,
   - terminos,
   - fuente.
5. Genera reglas normalizadas.
6. Compara contra ofertas vigentes.
7. Si hay contradiccion, bloquea solo la regla afectada.
8. Si esta confirmado, permite aprobar/publicar.
9. El Portal muestra la oferta vigente.
10. El Constructor la aplica encima de la estructura base si el cliente cumple condiciones.

## Regla de prioridad

1. La estructura/base define el plan y precio regular.
2. La Lista de Precios define el precio base de equipos.
3. Si un boletin dice explicitamente "nuevo precio" o cambio oficial de precio, actualiza el precio base con historial.
4. Si el boletin habla de descuento, gratis, credito, bono o condicion comercial, es oferta temporal.
5. Una oferta temporal no sobrescribe la base.
6. Si falta fuente, vigencia, termino requerido o elegibilidad, no se aplica automaticamente.
7. Nunca se infiere elegibilidad por ausencia de restriccion.
8. El Constructor calcula todas las combinaciones validas y recomienda una sin ocultar alternativas.

## Que falta corregir

### 1. Clasificacion por seccion

No basta con clasificar todo el archivo como estructura u oferta.

Un mismo documento puede traer:

- estructura,
- oferta,
- cambio oficial de precio,
- terminos,
- accesorios,
- reglas para revision.

El sistema debe separar eso por seccion.

### 2. Modelo de reglas normalizadas

Falta convertir cada seccion en reglas comerciales canonicas:

**Fuente -> Seccion -> Regla -> Condicion -> Accion -> Prioridad -> Resultado**

### 3. Estado de confianza

Cada regla debe tener estado de procesamiento:

- Confirmado.
- Requiere revision.
- Contradiccion.
- Fuente incompleta.

Esto es distinto de borrador, aprobado, publicado o vencido.

### 4. Llaves comerciales correctas

La llave no debe incluir precios.

Ejemplo correcto para Fijo:

`codigo_plan + tipo_servicio + velocidad`

El precio queda como valor versionado.

Asi, si el precio cambia, el sistema entiende que es el mismo plan con nuevo precio, no un plan nuevo.

### 5. Reemplazo con historial

Nunca borrar.

Cuando algo cambia:

- se cierra la version anterior,
- se crea la nueva,
- se conserva fuente,
- se conserva vigencia,
- se conserva historial.

### 6. Ofertas y beneficios acumulables

Cada beneficio debe indicar si:

- acumula,
- sustituye,
- es incompatible,
- tiene maximo por BAN,
- tiene maximo por linea,
- tiene maximo por cliente,
- aplica una sola vez por evento.

## Plan de trabajo

### Fase 1: Auditoria tecnica

Auditar los flujos actuales de:

- Fijo estructura/base,
- Fijo ofertas/beneficios,
- Movil estructura/base,
- Movil ofertas/beneficios,
- Claro TV,
- Inalambrico/IoT,
- Lista de Precios,
- Benefits,
- Accesorios.

Resultado esperado:

- que esta funcionando,
- que esta incompleto,
- que esta mezclado,
- que riesgo tiene,
- que no debe usarse todavia para publicacion automatica.

### Fase 2: Modelo del Motor Comercial

Disenar el modelo:

**Fuente -> Seccion -> Regla -> Condicion -> Accion -> Prioridad -> Resultado**

Definir:

- tablas necesarias,
- llaves comerciales,
- versionado,
- vigencias,
- estados de confianza,
- contradicciones,
- acumulacion de beneficios,
- relacion con Portal,
- relacion con Constructor.

### Fase 3: Admin de carga

Cambiar el Admin para que:

- suba una fuente oficial,
- pregunte tipo esperado,
- analice por seccion,
- muestre que detecto,
- permita corregir clasificacion antes de publicar,
- no publique automaticamente,
- bloquee solo reglas problematicas.

### Fase 4: Publicacion al Portal

El Portal debe consumir solo:

- estructura aprobada,
- ofertas aprobadas,
- precios aprobados,
- beneficios aprobados,
- vigencias activas,
- fuente visible.

### Fase 5: Constructor

El Constructor debe:

- leer plan base,
- leer precio base,
- leer ofertas vigentes,
- evaluar condiciones,
- calcular combinaciones validas,
- recomendar la mejor opcion,
- mostrar alternativas,
- bloquear reglas no determinadas.

## Estado final esperado

El sistema debe dejar de depender de "donde se subio el archivo" y pasar a depender de "que contiene cada seccion oficial".

La meta es que Portal, Admin y Constructor usen una sola verdad comercial:

**fuente oficial trazable + regla normalizada + vigencia + elegibilidad + publicacion aprobada.**
