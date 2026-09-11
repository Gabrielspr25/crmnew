# Resumen para director - Plan tecnico de correccion Motor Comercial v1

## Estado

La primera auditoria ya esta cerrada y el plan tecnico de correccion ya esta preparado.

No se esta cambiando el concepto comercial. Se esta corrigiendo la forma en que el sistema lo ejecuta.

## Problema principal

El CRM ya tiene piezas utiles, pero todavia conviven dos caminos:

1. Un flujo nuevo y controlado:

```text
fuente oficial
-> preview
-> borrador
-> validacion
-> aprobacion
-> publicacion
-> Portal
```

2. Un flujo anterior que puede actualizar modulos del Portal de forma directa.

Ese doble camino crea riesgo de mezclar estructura, ofertas, beneficios, terminos y cambios de precio.

## Que se mantiene

Se conserva:

- fuente oficial como base comercial;
- archivo original, hash, usuario, vigencia e historial;
- preview antes de publicar;
- aprobacion antes de llegar al Portal;
- Portal consumiendo solo informacion publicada;
- Constructor usando informacion publicada, no PDFs ni Excels directamente.

## Que se corrige

La correccion consiste en que el sistema deje de decidir por:

- la pestana donde se subio el archivo;
- el nombre del archivo;
- si es PDF o Excel;
- el modulo elegido manualmente.

Y pase a decidir por:

```text
que contiene cada seccion oficial del documento
```

Un mismo documento puede traer:

- estructura/base;
- oferta;
- beneficio;
- cambio oficial de precio;
- terminos;
- accesorios;
- reglas para revision.

Cada seccion debe convertirse en una regla comercial separada.

## Cambio mas importante

Fijo sera el patron tecnico inicial.

Motivo:

- ya tiene parser multiseccion;
- ya tiene flujo de fuente, preview, borrador, validar, aprobar y publicar;
- ya alimenta el Portal actual;
- permite corregir el modelo sin reconstruir todo el CRM.

## Regla de precio

El precio no identifica un plan, equipo u oferta.

La identidad debe ser la llave comercial.

Ejemplo:

```text
codigo_plan + tipo_servicio + velocidad
```

El precio es un valor versionado.

Si cambia el precio, el sistema debe entender:

```text
mismo plan + nuevo valor de precio
```

No debe crear un plan nuevo.

## Regla de ofertas

Una oferta temporal no debe modificar el precio base.

Si el boletin habla de:

- descuento;
- gratis;
- credito;
- bono;
- meses gratis;
- financiamiento;
- precio promocional;

se guarda como oferta o beneficio.

Solo si el boletin dice explicitamente nuevo precio o cambio oficial de precio, se actualiza el precio base con historial.

## Constructor

El Constructor no debe inferir elegibilidad.

Si una fuente no confirma una condicion, el dato queda como:

```text
no determinado
```

Y no se aplica automaticamente.

Esto protege reglas como:

- cliente nuevo;
- renovacion;
- portabilidad;
- convergencia;
- limite por BAN;
- plazo;
- plan minimo;
- acumulacion de beneficios.

## Riesgo actual

La conclusion tecnica es:

```text
No es seguro usar el flujo actual como publicacion automatica general.
```

Si es parcialmente usable para estructura/base cuando pasa por:

```text
fuente oficial
-> preview
-> borrador
-> validacion
-> aprobacion
-> publicacion controlada
```

No esta listo aun para publicar automaticamente:

- ofertas fijas;
- beneficios;
- cambios oficiales de precio;
- reglas mixtas;
- terminos;
- accesorios;
- elegibilidad del Constructor.

## Plan de trabajo

1. Cerrar Fijo como patron.
2. Separar estructura, ofertas, beneficios, terminos, accesorios y cambios de precio.
3. Agregar reglas normalizadas.
4. Agregar estado de confianza por regla.
5. Versionar precio base.
6. Mantener compatibilidad con el Portal actual.
7. Sacar rutas viejas del flujo oficial de publicacion.
8. Extender el patron a Movil, Claro TV, Inalambrico/IoT, Lista de Precios, Benefits y Accesorios.
9. Hacer que el Constructor consuma reglas aprobadas y publicadas.

## Limites claros

En esta etapa:

- no se despliega a produccion;
- no se ejecutan migraciones;
- no se cambian datos comerciales;
- no se inventan reglas;
- no se modifica nada fuera del proyecto comercial activo `newcrm`;
- no se modifica `ofertas-proui`;
- no se reconstruye todo desde cero.

## Decision antes de programar

La decision recomendada es:

```text
Empezar implementacion por Fijo como patron.
```

Inalambrico/IoT queda como siguiente modulo, salvo que exista urgencia comercial para adelantarlo.

## Resultado esperado

Admin, Portal y Constructor deben trabajar sobre una sola verdad comercial:

```text
fuente oficial
+ seccion detectada
+ regla normalizada
+ vigencia
+ elegibilidad
+ estado de confianza
+ aprobacion
+ publicacion vigente
```

Ese es el cambio necesario para que el sistema deje de depender de interpretaciones manuales y pueda actualizar boletines con seguridad.
