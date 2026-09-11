# Plan Maestro Constructor Design

## Objetivo

Crear dentro de `newcrm` un modulo visual llamado `Plan Maestro` para que Gabriel pueda ver en el CRM el estado real del proyecto Constructor Comercial: que esta terminado, que falta, que esta bloqueado, que vive solo localmente, que esta en produccion, que pruebas respaldan cada avance y cual es el siguiente paso.

El modulo no es una fuente comercial. No activa promociones, no cambia precios, no publica ofertas, no modifica Motor Comercial y no sustituye ningun flujo productivo. Es un tablero ejecutivo y tecnico de seguimiento.

## Fuente Unica

La fuente estructurada de verdad sera:

`docs/constructor/plan-maestro-constructor.json`

El CRM y la documentacion legible consumiran esa misma fuente:

`plan-maestro-constructor.json` -> servicio backend read-only -> `GET /api/project-plan/constructor` -> CRM `#/plan-maestro`

El documento:

`docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md`

se generara desde el JSON mediante un script local. No debe mantenerse como una segunda verdad manual.

## Reglas De Estado

Estados permitidos:

- `terminado`
- `en_validacion`
- `pendiente`
- `bloqueado`
- `bloqueado_seguridad`

El porcentaje de avance es solo una referencia visual del progreso. No representa calidad tecnica, aprobacion comercial, autorizacion para produccion ni permiso para activar el Motor Comercial.

No se debe marcar un item como `terminado` si dentro de su propio alcance existe un bloqueo conocido. Si esta implementado localmente pero falta validacion real, debe quedar como `en_validacion`.

Cada item separara:

- `local_status`
- `production_status`

Nunca se debe usar un solo `terminado` para ocultar que algo aun no esta publicado, no fue validado en produccion o tiene bloqueo pendiente.

## Contrato JSON

El JSON tendra esta forma base:

```json
{
  "project": "Constructor Comercial",
  "updated_at": "2026-09-04",
  "phase": "Plan Maestro local",
  "overall_status": "en_validacion",
  "environment": "local",
  "items": [
    {
      "id": "PM-001",
      "area": "Consulta Inteligente",
      "title": "Consulta Inteligente local v1",
      "status": "en_validacion",
      "local_status": "terminado",
      "production_status": "pendiente",
      "summary": "Interpreta solicitudes comerciales comunes sin proveedor externo.",
      "done": ["Interprete local creado", "Sin SDK externo"],
      "remaining": ["Validacion operativa con fuentes actualizadas"],
      "blocker": null,
      "next_action": "Validar contra escenarios maestros actualizados.",
      "tests": { "passed": 0, "failed": 0, "summary": "Pendiente de consolidar evidencia" },
      "evidence": [],
      "documents": [],
      "files": [],
      "last_change": "Estado inicial cargado desde auditoria documental.",
      "updated_at": "2026-09-04"
    }
  ]
}
```

El servicio validara:

- IDs unicos.
- Estados permitidos.
- `items` como arreglo no vacio.
- separacion entre estado local y produccion.
- campos minimos para que el CRM pueda renderizar sin cambiar codigo al agregar nuevos items.

## Calculo De Progreso

El porcentaje se calculara en backend desde los estados:

- `terminado`: 100
- `en_validacion`: 60
- `pendiente`: 0
- `bloqueado`: 0
- `bloqueado_seguridad`: 0

El backend devolvera conteos y porcentaje calculado. El JSON no almacenara un porcentaje manual.

## API

Crear ruta read-only:

`GET /api/project-plan/constructor`

Requiere autenticacion y perfil administrativo/supervisor usando los permisos existentes. No incluye endpoints `POST`, `PATCH` ni `DELETE` en esta etapa.

Responsabilidad:

- cargar el JSON desde `docs/constructor/plan-maestro-constructor.json`;
- validarlo;
- calcular resumen, conteos y porcentaje;
- devolver la misma estructura consumible por el CRM.

## UI CRM

Crear ruta:

`#/plan-maestro`

Visible en navegacion solo para perfiles no vendedores; el guard existente del vendedor lo mantendra fuera de alcance.

La pantalla tendra:

- cabecera `Plan Maestro - Constructor Comercial`;
- estado general, fase, entorno y ultima actualizacion;
- tarjetas compactas: Terminados, En validacion, Pendientes, Bloqueados y Produccion;
- barra de progreso calculada;
- filtros: Todos, Pendientes, En validacion, Bloqueados, Terminados;
- busqueda por texto;
- tabla principal: Area, Estado, Local, Produccion, Pruebas, Ultima actualizacion, Proximo paso;
- panel de detalle al seleccionar una fila con terminado, falta, evidencia, pruebas, archivos, bloqueo, proximo paso, entorno y fecha.

Los bloqueos deben ser visibles en la tabla y en el detalle. El caso `REDPLUS $60 vs BREDP1 $65` debe aparecer como `bloqueado_seguridad` y no quedar escondido como nota secundaria.

## Estado Inicial

El JSON inicial se poblara auditando la documentacion existente. Debe incluir al menos estas areas:

- Arquitectura Constructor
- CRM -> Constructor
- Construccion Manual
- Consulta Inteligente
- Motor Comercial
- Business RED Plus
- BYOP
- Equipos / Ofertas
- Inalambrico / IoT
- Fijo
- Convergencia
- Servicios / Benefits
- Lista de Precios
- Versionado de Fuentes
- Catalogo Canonico
- Agente Comercial
- Totales / Cotizacion
- Validacion Integral
- Promocion del Motor
- Produccion

Los elementos implementados solo localmente pero sin validacion real quedaran como `en_validacion`. Los bloqueos conocidos no podran marcarse como `terminado`.

## Actualizacion Obligatoria Futura

Agregar una regla dentro de la documentacion del repositorio:

Toda tarea relacionada con Constructor, Motor Comercial, Fuentes, Servicios/Benefits o Agente Comercial debe actualizar `docs/constructor/plan-maestro-constructor.json` y regenerar `docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md` antes de declararse terminada.

No se modificaran instrucciones globales fuera del repositorio.

## Pruebas

Agregar pruebas con `node:test` para:

- API devuelve Plan Maestro.
- estructura JSON valida.
- IDs unicos.
- estados validos.
- porcentaje calculado.
- UI carga `#/plan-maestro`.
- filtros y busqueda existen.
- bloqueos visibles.
- local y produccion se diferencian.
- una nueva tarea puede agregarse sin cambiar codigo UI.
- MD se genera desde JSON.
- ninguna regla comercial depende del Plan Maestro.

## Fuera De Alcance

- Deploy.
- Migraciones.
- Produccion.
- Cambios al Motor Comercial.
- `autoaplica=true`.
- Quitar fallback.
- Modificar reglas comerciales.
- Crear un sistema tipo Asana completo.
- Edicion desde CRM.
- Auditoria multiusuario en base de datos.

## Criterio De Cierre

La etapa queda completa cuando localmente:

- existe `#/plan-maestro`;
- existe `GET /api/project-plan/constructor`;
- el CRM muestra terminado, pendiente, bloqueado, local, produccion, pruebas y proximo paso;
- el MD y el CRM provienen de la misma fuente JSON;
- las pruebas dirigidas pasan;
- no hubo deploy, migraciones, cambios al Motor Comercial ni cambios productivos.
