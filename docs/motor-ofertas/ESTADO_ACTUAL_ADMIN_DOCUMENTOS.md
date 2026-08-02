# Estado actual del Admin y documentos oficiales

Fecha de verificacion: 2026-07-25.

## Archivo canonico de fuentes oficiales

Los documentos oficiales que Gabriel entrega para construir la base de
conocimiento se conservan en:

`C:\Users\Gabriel\Documentos\Programas\newcrm\documentos-ofertas\`

Estructura actual:

- `fijo\`
- `movil\`
- `inalambrico-iot\`
- `equipos\listas-precios\`

Este archivo es el original inalterado. No se borra ni se sobrescribe cuando
entre una version posterior.

## Que hace hoy el Admin Ofertas

El Admin actual usa `backend/src/routes/planesRoutes.js`. Su directorio de
carga en ejecucion es `PLANES_UPLOAD_DIR`; si no existe esa variable, usa:

`backend/uploads/pdf-planes/`

Al reconocer un documento, el flujo actual es:

1. carga temporal;
2. parser disponible;
3. archivo en `PLANES_UPLOAD_DIR/documentos/`;
4. vista previa en memoria por 30 minutos;
5. aplicacion manual a `public.planes_modulos`;
6. snapshot previo en `PLANES_UPLOAD_DIR/snapshots/`.

## Limite confirmado

El Admin actual **no** es todavia la herramienta completa de actualizacion
comercial. Solo tiene parsers conectados para documentos reconocibles de
planes fijos y equipos/inalambrico. La lista Excel de precios moviles devuelve
explicitamente que su parser no esta implementado. Tampoco normaliza aun, de
forma completa, Claro TV, servicios, beneficios, Cloud/SVA, ofertas fijas ni
ofertas moviles.

Por tanto, actualmente no debe tratarse una carga del Admin como actualizacion
automatica de todo el portal. La fuente comercial canonica es
`documentos-ofertas`; la publicacion se hara despues de extraer, comparar,
validar vigencia y aprobar los cambios.

## Objetivo acordado

La herramienta futura debe seguir este flujo para cualquier familia:

`subir -> archivar original -> extraer datos estructurados -> comparar contra version vigente -> mostrar cambios y conflictos -> aprobar/publicar -> conservar historial y fuente`

El portal y el constructor deben leer los datos publicados, no HTML o
JavaScript hardcodeado ni PDFs directamente en cada consulta.
