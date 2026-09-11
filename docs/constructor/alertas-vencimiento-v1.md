# Alertas de vencimiento de documentos v1

## Necesidad

El portal del vendedor se informa desde lo publicado. Cada publicacion nace de un documento oficial con fecha de fin. Si el boletin nuevo no se sube a tiempo, el portal sigue mostrando la ultima version marcada como vencida. El admin necesita saber con anticipacion que documento esta por vencer para buscar el reemplazo y subirlo.

## Regla

- Se evalua el documento mas reciente de cada familia en `public.fuentes_comerciales` (`DISTINCT ON (familia)` por `creado_en`).
- Estados: `vencida` (fecha fin pasada), `por_vencer` (faltan entre 0 y `dias_alerta` dias, 30 por defecto), `vigente`, `sin_fecha_fin`.
- Subir el documento siguiente de la misma familia limpia la alerta sola: no hay estado manual que cerrar.
- No se inventan fechas: si el documento no tiene `vigencia_hasta`, se informa como `sin_fecha_fin` y se pide cargar la vigencia al subir.

## Implementacion local

- Servicio puro: `backend/src/services/vigenciaAlertas.js` (`buildVigenciaAlertas`, `estadoVigencia`).
- Ruta con sesion: `GET /api/fuentes-comerciales/alertas-vencimiento?dias=30`. Solo lectura.
- Admin Ofertas (`frontend/app.html`):
  - Panel "Alertas de vencimiento" arriba del Centro de Cargas con familia, documento, fecha fin, estado y accion (`Subir documento nuevo` / `Buscar documento nuevo`).
  - La cola "Requiere atencion" ahora incluye los modulos por vencer con el texto `Vence en N dias`, ademas de los vencidos.
  - Badge rojo con el conteo en el menu "Admin Ofertas" (`ofRefreshNavAlertas`), actualizado al iniciar sesion y al volver al modulo.
- Pruebas: `backend/test/vigencia-alertas.test.js`, `backend/test/fuentes-comerciales-ui-contract.test.js`.

## Pendiente

- Aviso por correo o notificacion externa: requiere decidir destinatarios y frecuencia; no se implemento.
- Umbral configurable por familia (hoy 30 dias global, parametro `dias`).
