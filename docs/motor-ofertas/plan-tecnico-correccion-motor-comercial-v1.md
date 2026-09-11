# Plan tecnico de correccion - Motor Comercial v1

Fecha: 2026-08-29

## Objetivo

Convertir la auditoria tecnica en un plan cerrado de correccion para que Admin, Portal y Constructor trabajen con una sola verdad comercial:

```text
Fuente oficial
-> Seccion
-> Regla
-> Condicion
-> Accion
-> Prioridad
-> Resultado
-> Publicacion aprobada
```

Este plan no cambia el concepto comercial. Corrige la ejecucion tecnica para que el concepto se cumpla.

## Limites de esta entrega

Este documento define el plan.

No incluye:

- despliegue a produccion;
- migraciones ejecutadas;
- cambios de datos comerciales;
- reescritura general del CRM;
- modificaciones fuera del proyecto comercial activo `newcrm`;
- modificaciones en `ofertas-proui`;
- reglas comerciales inventadas.

## Principio de implementacion

No se reconstruye todo desde cero.

Se conserva lo que ya sirve:

- `public.fuentes_comerciales`;
- `public.bases_informativas_publicaciones`;
- `public.planes_modulos` como salida publica del Portal;
- parser multiseccion de Fijo;
- flujo de preview, borrador, validar, aprobar y publicar;
- versionado movil existente como referencia;
- trazabilidad de archivo, hash, usuario y vigencia.

La correccion se hara por etapas, empezando por Fijo como patron.

## Fase 1 - Cerrar Fijo como patron

### Objetivo

Que Fijo sea el primer modulo que use el modelo completo:

```text
fuente oficial
-> secciones detectadas
-> reglas normalizadas
-> preview
-> borrador
-> validacion
-> aprobacion
-> publicacion
-> Portal
-> Constructor
```

### Cambios requeridos

1. Mantener el parser multiseccion de Fijo.
2. Separar cada salida en tipo comercial:
   - estructura/base;
   - oferta;
   - beneficio;
   - cambio oficial de precio;
   - terminos;
   - accesorio;
   - revision manual.
3. Dejar de tratar todo el archivo como un solo tipo.
4. Agregar estado de confianza por regla:
   - `confirmado`;
   - `requiere_revision`;
   - `contradiccion`;
   - `fuente_incompleta`.
5. Generar preview por regla, no solo por fila.
6. Publicar solo reglas confirmadas, aprobadas y vigentes.
7. Mantener `planes_modulos` como salida publica compatible.

### Resultado esperado

Fijo queda como patron para los demas modulos.

## Fase 2 - Separar estructura/base de ofertas

### Problema

Hoy una fuente puede entrar por una familia o pestana y el sistema puede tratarla como si todo fuera base o todo fuera oferta.

### Correccion

La seleccion del Admin sera orientativa, no definitiva.

El sistema debe mostrar:

```text
Tipo esperado: oferta/beneficio

Detectado:
- estructura/base: 0
- ofertas: 14
- cambios oficiales de precio: 2
- terminos: 4
- revision manual: 1
```

### Regla

La verdad comercial sale del contenido detectado, no solamente de:

- pestana;
- nombre del archivo;
- PDF;
- Excel;
- familia seleccionada.

## Fase 3 - Modelo minimo de reglas comerciales

### Objetivo

Agregar una representacion minima comun para reglas comerciales.

### Entidad conceptual: regla comercial

Campos minimos:

```text
id
fuente_comercial_id
seccion_origen
tipo_regla
familia
producto
codigo
nombre
llave_comercial
valor
condiciones
accion
prioridad
vigencia_desde
vigencia_hasta
estado_confianza
estado_publicacion
estado_comercial
traza
```

### Tipos de regla

```text
estructura_base
oferta_temporal
beneficio
cambio_precio_oficial
terminos
accesorio
revision_manual
```

### Estados de confianza

```text
confirmado
requiere_revision
contradiccion
fuente_incompleta
```

### Estados de publicacion

```text
borrador
validada
aprobada
publicada
reemplazada
archivada
```

### Estados comerciales

```text
futuro
vigente
vencido
reemplazado
historico
```

## Fase 4 - Llave comercial y precio versionado

### Regla obligatoria

El precio no forma parte de la identidad comercial.

Ejemplo correcto:

```text
codigo_plan + tipo_servicio + velocidad
```

Ejemplo incorrecto:

```text
codigo_plan + tipo_servicio + velocidad + precio
```

### Cambio oficial de precio

Si la fuente dice explicitamente:

- nuevo precio;
- cambio oficial de precio;
- actualizacion de precio regular;

entonces:

```text
1. identificar mismo elemento comercial
2. cerrar valor anterior
3. crear nuevo valor
4. conservar fuente e historial
```

### Oferta temporal

Si la fuente dice:

- descuento;
- gratis;
- bono;
- credito;
- meses gratis;
- financiamiento;
- precio promocional;
- condicion especial;

entonces:

```text
crear oferta/beneficio
no sobrescribir precio base
```

## Fase 5 - Cerrar rutas antiguas del flujo oficial

### Problema

Existen rutas que pueden actualizar `planes_modulos` directamente.

Eso fue util para etapas anteriores, pero no debe ser el camino oficial del Motor Comercial.

### Rutas a sacar del flujo comercial oficial

```text
POST /api/planes-modulos/preview
POST /api/planes-modulos/apply/:previewId
POST /api/fuentes-comerciales/planes-fijos/preview
POST /api/fuentes-comerciales/planes-fijos/publicar
```

### Regla

No se eliminan de inmediato si todavia se usan para soporte o reversa.

Se marcan como flujo legado y se bloquean para publicacion comercial nueva cuando el flujo nuevo este validado.

### Camino oficial

```text
POST /api/fuentes-comerciales
POST /api/fuentes-comerciales/:id/preview-base
POST /api/fuentes-comerciales/:id/preview-base/borradores
POST /api/fuentes-comerciales/bases-informativas/:id/validar
POST /api/fuentes-comerciales/bases-informativas/:id/aprobar
POST /api/fuentes-comerciales/bases-informativas/:id/publicar
```

## Fase 6 - Admin Ofertas

### Objetivo

El Admin debe guiar al usuario sin imponer una clasificacion incorrecta.

### Cambios de interfaz

Al subir fuente, preguntar:

```text
Que esperas cargar?
- estructura/base
- oferta/beneficio
- lista de precios/equipos
- accesorios
- terminos
- mixto
```

Tambien permitir:

```text
Formato:
- PDF
- Excel
```

Pero el formato no define la verdad comercial.

### Preview esperado

La vista previa debe mostrar:

- fuente;
- hash;
- vigencia;
- secciones detectadas;
- reglas confirmadas;
- reglas con revision;
- contradicciones;
- cambios contra publicacion vigente;
- que se publicara;
- que queda excluido;
- que requiere decision comercial.

## Fase 7 - Portal

### Objetivo

El Portal debe seguir estable para vendedores y usuarios.

### Regla

El Portal solo consume informacion:

- confirmada;
- aprobada;
- publicada;
- vigente;
- con fuente oficial.

### Compatibilidad

Por ahora el Portal puede seguir usando:

```text
GET /api/planes-modulos/:pagina
```

Pero esa API debe representar salida publicada, no fuente ni borrador.

## Fase 8 - Constructor

### Objetivo

El Constructor debe dejar de depender de documentos, HTML o reglas sueltas.

### Entrada esperada

```text
cliente
BAN
lineas
productos actuales
evento comercial
planes candidatos
equipos candidatos
```

### Motor debe evaluar

```text
plan base
precio base
ofertas vigentes
beneficios
terminos
convergencia
portabilidad
renovacion
cliente nuevo
limites por BAN
limites por linea
compatibilidad
acumulacion
vigencia
fuente
```

### Salida esperada

```text
opcion recomendada
alternativas validas
reglas aplicadas
reglas bloqueadas
motivo de bloqueo
fuente de cada descuento o beneficio
```

### Regla de oro

Nunca inferir elegibilidad por ausencia de restriccion.

Si una fuente no confirma una condicion necesaria, el dato queda:

```text
no_determinado
```

Y la regla no se aplica automaticamente.

## Fase 9 - Inalambrico/IoT

### Problema confirmado

El flujo actual puede actualizar vigencia y referencia sin reemplazar contenido real:

```text
SET contenido=contenido
```

### Correccion requerida

Inalambrico/IoT debe tratarse como fuente mixta permitida.

Debe separar:

- Internet On The Go;
- Backup;
- Claro Oficina;
- Claro Hogar;
- IoT;
- equipos;
- ofertas especiales;
- precios;
- plazos;
- codigos;
- terminos.

### Formato visual esperado

Cuando aplique, el Portal debe mostrar:

```text
plan
renta
equipo
precio
meses financiados
codigo
condiciones
fuente
```

Debe respetar el orden del boletin y usar imagenes de equipos si vienen del PDF o de fuente oficial.

## Fase 10 - Lista de Precios y Accesorios

### Lista de Precios

Se conserva el flujo de Excel oficial para catalogo completo de equipos.

Pero si un boletin trae cambio oficial de precio puntual, no debe reemplazar toda la lista a ciegas.

Debe crear:

```text
cambio_precio_oficial
```

con fuente, vigencia e historial.

### Accesorios

Debe agregarse una categoria clara para evitar que quede mezclado.

Opcion tecnica:

```text
familia: accesorios
```

Opcion alternativa:

```text
tipo_regla: accesorio
familia fuente: equipos/ofertas
```

La decision se toma al disenar la migracion minima.

## Fase 11 - Benefits

### Objetivo

Benefits debe convertirse en reglas comerciales, no texto suelto.

Debe soportar:

- descuento;
- bono;
- meses gratis;
- convergencia;
- maximo por BAN;
- maximo por linea;
- maximo por cliente;
- maximo por evento;
- acumula;
- no acumula;
- sustituye;
- incompatible.

## Pruebas requeridas primero

Antes de tocar implementacion:

1. Test de Fijo que permite PDF o Excel cuando el contenido es estructura valida.
2. Test que separa estructura/base y oferta dentro de una misma fuente.
3. Test que un cambio oficial de precio no crea plan nuevo.
4. Test que una oferta temporal no sobrescribe precio base.
5. Test que estado `contradiccion` bloquea solo la regla afectada.
6. Test que `fuente_incompleta` no se publica automaticamente.
7. Test que el Portal no ve borradores.
8. Test que `planes_modulos` queda como salida publicada.
9. Test que ruta vieja no es camino oficial de publicacion.
10. Test de Inalambrico/IoT que reemplaza contenido cuando el boletin trae contenido nuevo.
11. Test que Accesorios queda clasificado y no se pierde.
12. Test que Benefits no se duplica en el Constructor.

## Orden de implementacion recomendado

```text
1. Tests de contrato para Fijo.
2. Modelo minimo de regla comercial.
3. Normalizador por seccion para Fijo.
4. Preview por regla.
5. Estados de confianza.
6. Publicacion controlada hacia planes_modulos.
7. Bloqueo/retirada del camino viejo.
8. Precio versionado.
9. Ofertas/Benefits.
10. Inalambrico/IoT.
11. Constructor.
```

## Criterios de aceptacion

La correccion se considera lista cuando:

- Fijo puede procesar fuente oficial por seccion;
- estructura y oferta quedan separadas;
- el precio base queda versionado;
- las ofertas no pisan precio regular;
- cada regla tiene estado de confianza;
- se publica solo lo aprobado;
- el Portal no muestra borradores;
- el Constructor no aplica reglas no determinadas;
- el camino viejo no publica comercialmente por accidente;
- hay tests antes de implementacion;
- no se toca produccion sin aprobacion.

## Riesgos si no se corrige

- publicar una oferta como estructura;
- perder precio base real;
- duplicar beneficios;
- aplicar descuentos no confirmados;
- dejar boletines nuevos sin reemplazar contenido real;
- mostrar Portal actualizado visualmente pero sin reglas seguras para Constructor;
- mezclar versiones viejas y nuevas;
- depender de HTML/JS como fuente comercial.

## Decision pendiente antes de programar

Antes de escribir codigo funcional, confirmar:

```text
Empezamos implementacion por Fijo como patron, y dejamos Inalambrico/IoT como siguiente modulo salvo urgencia comercial.
```

## Estado de esta entrega

Plan tecnico preparado.

## Avance de implementacion local

### Bloque 1 - Reglas normalizadas en preview de base

Estado: iniciado y verificado localmente.

Se agrego el primer bloque funcional para Fijo como patron:

- el preview de base informativa genera `reglas_normalizadas`;
- cada regla tiene `tipo_regla`, `llave_comercial`, `valor`, `condiciones`, `accion`, `prioridad`, `estado_confianza`, `estado_publicacion`, `estado_comercial` y `traza`;
- el precio queda dentro de `valor`, no dentro de la `llave_comercial`;
- el endpoint de preview expone `reglas_normalizadas` para el Admin;
- el borrador conserva las reglas dentro de `auditoria.reglas_normalizadas` sin migracion nueva.

Verificacion local:

```text
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js
node --check backend/src/services/basesInformativasPreview.js
node --check backend/src/routes/fuentesComercialesRoutes.js
```

Resultado:

```text
28 pruebas pasaron.
Sintaxis valida en los archivos JS tocados.
```

### Bloque 2 - Resumen operativo de reglas para Admin

Estado: iniciado y verificado localmente.

Se agrego el resumen operativo del preview para que Admin pueda mostrar que detecto antes de publicar:

- total de reglas normalizadas;
- conteo por `tipo_regla`;
- conteo por `estado_confianza`;
- exposicion del resumen por el endpoint de preview;
- prueba de contrato para evitar que el campo se pierda en la respuesta de Admin.

Para Fijo, el preview actual resume:

```text
total: 81 reglas
estructura_base: 65
beneficio: 15
accesorio: 1
confirmado: 81
```

Este resumen no publica, no aprueba y no cambia datos. Solo prepara la vista de revision previa.

### Bloque 3 - Conservacion de reglas en borrador

Estado: iniciado y verificado localmente.

Se cerro la brecha entre preview y guardado:

- al guardar borrador, la auditoria conserva `reglas_normalizadas`;
- al guardar borrador, la auditoria conserva `resumen_reglas`;
- la prueba valida que Fijo guarda las 81 reglas detectadas;
- la prueba valida el resumen por tipo: 65 estructura base, 15 beneficios y 1 accesorio;
- no se escribe en `planes_modulos` durante el preview;
- no se publica automaticamente.

Verificacion local actual:

```text
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js
node --check backend/src/services/basesInformativasPreview.js
node --check backend/src/routes/fuentesComercialesRoutes.js
```

Resultado:

```text
28 pruebas pasaron.
Sintaxis valida en los archivos JS tocados.
```

### Bloque 4 - Visualizacion del resumen en Admin

Estado: iniciado y verificado localmente.

Se agrego en la vista previa de Admin un resumen compacto de reglas detectadas:

- total de reglas;
- conteo por tipo de regla;
- conteo por estado de confianza;
- se muestra antes de modulos y registros candidatos;
- no cambia los botones ni el flujo de publicar.

Verificacion local:

```text
node -e "extrae y compila los scripts inline de frontend/app.html"
```

Resultado:

```text
6 scripts inline validos.
```

### Bloque 5 - Claro TV en el mismo patron

Estado: iniciado y verificado localmente.

Se agrego cobertura para confirmar que Claro TV queda bajo el mismo patron sin mezclarse con Fijo:

- 9 reglas normalizadas para Claro TV;
- resumen por tipo y confianza;
- llaves comerciales separadas de Fijo;
- familia granular `claro_tv_*` aceptada como parte de Claro TV;
- misma ruta de preview y borrador, sin publicacion automatica.

Verificacion local actual:

```text
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js
node --check backend/src/services/basesInformativasPreview.js
node --check backend/src/routes/fuentesComercialesRoutes.js
node -e "extrae y compila los scripts inline de frontend/app.html"
```

Resultado:

```text
29 pruebas pasaron.
Sintaxis valida en backend y frontend inline.
```

### Bloque 6 - Movil como base separada de ofertas

Estado: iniciado y verificado localmente.

Se agrego cobertura para confirmar que Planes Moviles queda bajo el mismo patron de base informativa:

- 48 reglas normalizadas de base movil;
- 11 planes individuales;
- 36 opciones multilinea Business RED;
- 1 regla BYOP-BAN;
- exclusiones de Gobierno fuera de candidatos y reglas;
- precio fuera de la llave comercial;
- fuentes base y BYOP-BAN conservadas en auditoria.

Este bloque no convierte ofertas temporales en base. Las ofertas moviles siguen siendo un flujo separado de Ofertas Vigentes.

Verificacion local actual:

```text
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js
node --check backend/src/services/basesInformativasPreview.js
node --check backend/src/routes/fuentesComercialesRoutes.js
node -e "extrae y compila los scripts inline de frontend/app.html"
```

Resultado:

```text
29 pruebas pasaron.
Sintaxis valida en backend y frontend inline.
```

### Bloque 7 - Inalambrico/IoT: reemplazo real de contenido extraido

Estado: iniciado y verificado localmente.

Se corrigio el flujo automatico de Inalambrico/IoT:

- antes validaba el boletin, pero ejecutaba `contenido=contenido`;
- ahora construye contenido nuevo por modulo activo de la pagina `inalambrico`;
- proyecta equipos, financiamiento FIOF, financiamiento FIGU y ofertas especiales normalizadas;
- conserva planes existentes cuando el parser no entrega planes estructurados;
- no inventa planes, rentas, codigos ni elegibilidad;
- actualiza vigencia y boletin de referencia junto con el contenido proyectado.
- respeta `publicacion_modo=borrador`, por lo que subir la fuente no publica automaticamente.

Limitacion actual:

```text
El parser actual detecta secciones y normaliza equipos/ofertas especiales, pero no entrega todavia todos los planes de Internet OnTheGo, Claro Oficina e IoT como estructura completa. Por eso el reemplazo conserva esos planes publicados y actualiza solo lo extraido oficialmente.
```

Verificacion local actual:

```text
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js backend/test/inalambrico-agosto-parser-contract.test.js backend/test/inalambrico-vigencia-visible-contract.test.js
node --check backend/src/routes/fuentesComercialesRoutes.js
node -e "extrae y compila los scripts inline de frontend/app.html"
```

Resultado:

```text
39 pruebas pasaron.
Sintaxis valida en backend y frontend inline.
```

### Bloque 8 - Lista de Precios como precio base versionado

Estado: iniciado y verificado localmente.

Se agrego preview normalizado para Lista de Precios:

- el Excel oficial se archiva primero;
- la vista previa no publica ni reemplaza la lista vigente;
- el preview genera `reglas_normalizadas`;
- cada regla usa llave comercial por `item_code + categoria`;
- el precio queda en `valor.precio_regular`, no en la llave;
- accesorios quedan separados como `precio_accesorio`;
- equipos principales quedan como `precio_equipo`;
- el resumen incluye conteo por categoria, tipo de regla y estado de confianza.

Este bloque no cambia la regla de publicacion: la Lista de Precios solo reemplaza la lista publicada cuando se usa el endpoint/boton de publicar.

Verificacion local actual:

```text
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js backend/test/inalambrico-agosto-parser-contract.test.js backend/test/inalambrico-vigencia-visible-contract.test.js backend/test/lista-precios-preview-service.test.js backend/test/fuentes-comerciales-equipos-contract.test.js
node --check backend/src/routes/fuentesComercialesRoutes.js
node --check backend/src/services/basesInformativasPreview.js
node --check backend/src/services/listaPreciosPreview.js
```

Resultado:

```text
47 pruebas pasaron.
Sintaxis valida en backend.
```

### Bloque 9 - Ofertas Moviles como reglas normalizadas

Estado: iniciado y verificado localmente.

Se agrego la capa comun de reglas al parser existente de Ofertas Moviles:

- no cambia el parser comercial ya existente;
- no inventa eventos, equipos, beneficios, plazos ni condiciones;
- cada oferta extraida genera una regla `oferta_temporal`;
- la llave comercial separa familia, oferta, plan, eventos y tipo de linea;
- el precio queda dentro de `valor`, no dentro de la llave;
- el beneficio queda dentro de `valor.beneficio`;
- plan, eventos, familias, trade-in y limite BAN quedan dentro de `condiciones`;
- las contradicciones bloqueantes cambian solo la regla afectada a `estado_confianza=contradiccion`;
- el preview de Admin ahora expone `reglas_normalizadas` y `resumen_reglas`;
- la publicacion sigue separada y explicita.

Alcance real de este bloque:

```text
Aplica a Ofertas Moviles porque ya existe parser para Excel de ofertas y cruce con Lista de Precios.
No declara Benefits ni Ofertas Fijo como completos. Esos quedan pendientes hasta tener parser o fuente oficial procesada con el mismo contrato.
```

Verificacion local actual:

```text
node --test backend/test/motor-ofertas-normalizer.test.js backend/test/moviles-fuentes-publication-contract.test.js
node --check backend/src/services/motorOfertasNormalizer.js
node --check backend/src/routes/motorOfertasRoutes.js
```

Resultado:

```text
15 pruebas pasaron.
Sintaxis valida en backend.
```

### Bloque 10 - Ofertas Fijo + Benefits

Estado: iniciado y verificado localmente.

Se agrego una capa especifica para normalizar Ofertas Fijo y Benefits sin conectar todavia el Constructor:

- las fuentes PDF se extraen como texto auditable antes de generar reglas;
- el extractor solo devuelve texto y paginas, no decide reglas comerciales;
- el normalizador separa ofertas fijas, benefits, terminos y cambios oficiales de precio;
- cada regla conserva fuente, pagina, texto original y hash cuando existe;
- la llave comercial no incluye precios ni montos;
- los montos quedan dentro de `valor.beneficio`;
- convergencia, eventos, plan minimo, contrato, nivel de aplicacion, compatibilidad y limites quedan en `condiciones`;
- si falta una condicion necesaria, la regla queda en `requiere_revision`;
- ninguna regla con dato no determinado queda con aplicacion automatica;
- las reglas en revision se reportan como contradicciones/casos abiertos para el Admin;
- el preview de Ofertas Fijo/Benefits expone `reglas_normalizadas`, `benefits`, `contradicciones` y `resumen_reglas`;
- el preview no conecta Constructor ni publica automaticamente.

Evidencia con fuente oficial local:

```text
Fuente: documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf
Paginas extraidas: 35
Reglas normalizadas: 39
Beneficios detectados: 38
Tipos: 37 beneficio, 2 terminos
Confianza: 11 confirmado, 28 requiere_revision
Aplicacion automatica: bloqueada cuando existen datos no determinados
```

Ejemplos detectados sin inventar reglas:

```text
3 meses gratis movil desde plan $60.
Pago de penalidad fijo hasta $200.
Bono de portabilidad hasta $150.
Doble velocidad.
Doble data.
10% de descuento en accesorios, computadoras y tablets.
Bono streaming $10.
```

Riesgo pendiente:

```text
Las reglas con condiciones incompletas todavia no deben aplicarse automaticamente.
Benefits ya queda como capa transversal inicial, pero requiere revision comercial para cerrar compatibilidades, acumulacion y limites cuando el boletin no lo dice en el mismo bloque.
```

Verificacion local actual:

```text
node --test backend/test/fijo-benefits-normalizer.test.js backend/test/fijo-benefits-preview-contract.test.js
node --check backend/src/services/fijoBenefitsNormalizer.js
node --check backend/src/routes/fuentesComercialesRoutes.js
python -m py_compile scripts/extract_pdf_text.py
python scripts/extract_pdf_text.py documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf
```

Resultado:

```text
4 pruebas nuevas pasaron.
Sintaxis valida en backend y extractor Python.
Extraccion real del PDF oficial 2026 validada.
```

No se desplego.
No se ejecutaron migraciones.
No se cambiaron datos comerciales.
No se modifico produccion.
No se tocaron proyectos externos al flujo comercial de `newcrm`.
