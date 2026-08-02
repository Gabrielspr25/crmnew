# Fuente unica de datos comerciales en Admin - Diseno de fase

Fecha: 2026-08-01
Estado: borrador para revision de Gabriel. No implementado.

## Objetivo operativo

Crear una primera fase ordenada para que el CRM y el portal de ofertas dejen de
depender de precios, reglas, servicios y ofertas escritos a mano en HTML o
JavaScript. El orden aprobado por Gabriel es:

1. Fuente unica de datos comerciales en el Admin.
2. Conectar equipos y planes a esa fuente.
3. Migrar ofertas, servicios y Claro TV.
4. Reemplazar el constructor despues, cuando la fuente unica ya gobierne los
   datos.

Esta fase es de diseno. No modifica logica, datos, base de datos ni produccion.

## Estado actual verificado

El sistema activo es `newcrm`.

- Backend: `backend/src/server.js`, Express ESM, rutas en `backend/src/routes/`.
- Frontend CRM y Admin: `frontend/app.html`.
- Portal local: `Planes para web/`, servido bajo `/constructor`.
- Equipos: `backend/src/routes/equiposRoutes.js`, tablas
  `public.equipos_uploads`, `public.equipos_lista`,
  `public.equipos_mensualidades`, `public.equipos_pospago` y vista
  `public.v_equipos_vigentes`.
- Planes: `backend/src/routes/planesRoutes.js`, tabla
  `public.planes_modulos`.
- Motor versionado: migracion `2026-07-12-motor-ofertas-versionado.sql`
  existe, pero `backend/src/routes/motorOfertasRoutes.js` responde pendiente y
  no esta montado en `server.js`.

Superficies actuales:

| Superficie | Estado actual |
| --- | --- |
| Lista de equipos | Lee `GET /api/equipos-lista`; datos principales vienen del Excel publicado por Admin. |
| Planes fijos | Lee `GET /api/planes-modulos/fijos`, pero conserva fallback estatico `fijos-data.js`. |
| Planes moviles | Lee `GET /api/planes-modulos/moviles`; el Admin no tiene parser Excel movil implementado. |
| Inalambrico / IoT | Lee `GET /api/planes-modulos/inalambrico`; conserva terminos fallback en HTML. |
| Servicios | Datos, vigencias, SOCS, seguros e imagenes estan en arrays HTML/JS. |
| Claro TV | Datos de planes, equipos, activacion y penalidad estan en arrays HTML/JS. |
| Ofertas moviles | `ofertas-data.js` contiene beneficios, price codes, equipos, creditos y reglas. |
| Constructor | Mezcla cliente CRM con datos comerciales estaticos de `ofertas-data.js`, `fijos-data.js` y constantes internas. |

## Decisiones de diseno

### Decision recomendada

Crear un catalogo comercial versionado de lectura publicada, administrado desde
Admin Ofertas, que conviva con las tablas actuales y las vaya absorbiendo por
familia. "Lectura publicada" significa que el portal y el CRM consumen la
version vigente por API; no significa acceso anonimo sin control.

Razon:

- Equipos y planes ya tienen flujos parciales funcionales; no conviene romperlos.
- Servicios, Claro TV y ofertas necesitan historial, fuente, vigencia y
  aprobacion antes de tocar el constructor.
- El constructor debe ser consumidor final, no fuente de reglas.

### Opciones consideradas

| Opcion | Descripcion | Ventaja | Problema |
| --- | --- | --- | --- |
| A. Extender `planes_modulos` para todo | Meter servicios, TV y ofertas en la tabla actual. | Rapido y reutiliza endpoints. | Mezcla catalogo, promociones, servicios, beneficios y equipos en un JSON generico dificil de auditar. |
| B. Completar de inmediato el motor versionado grande | Usar `motor_ofertas_*` para todo desde el inicio. | Modelo robusto. | Demasiado grande para primera fase; arriesga bloquear equipos/planes que ya funcionan. |
| C. Catalogo comercial unificado por dominios | Nueva capa de publicacion comun que referencia o importa lo existente. | Incremental, auditable y permite migrar por superficie. | Requiere definir contratos y mapeos antes de tocar portal. |

Se recomienda la opcion C.

## Arquitectura propuesta

### Capas

1. **Archivo canonico**
   - Carpeta: `documentos-ofertas/`.
   - Guarda originales por familia: fijo, movil, inalambrico-iot, equipos,
     tv, servicios, convergencia y seguros.
   - No se reemplaza ni borra un documento anterior.

2. **Ingestion Admin**
   - Un solo panel por familia comercial.
   - Sube documento, calcula hash, detecta tipo, extrae datos, muestra preview,
     diferencias, advertencias y vigencia.
   - No publica si no hay confirmacion humana.

3. **Publicacion comercial**
   - Version vigente por dominio.
   - Historial append-only.
   - Una publicacion nueva reemplaza la anterior dentro del mismo dominio.
   - La vigencia vencida no desactiva automaticamente; muestra aviso
     `vencida_pendiente_reemplazo`.

4. **API de lectura**
   - Portal y CRM leen solo endpoints de catalogo publicado.
   - Los archivos HTML/JS dejan de ser fuente comercial.

5. **Portal y constructor**
   - Portal migra primero por superficies ya simples.
   - Constructor se reemplaza al final, cuando el catalogo comercial ya cubra
     movil, equipos, fijo, inalambrico, servicios y TV.

### Dominios comerciales

| Dominio | Contenido |
| --- | --- |
| `equipos` | Equipo, item code, SAP, marca, modelo, precio regular, mensualidades, pospago, imagen. |
| `planes_fijos` | Telefonia, internet fijo, 2Play, valores agregados, codigos, tecnologia, cargos. |
| `planes_moviles` | Individual, Business Red, Update Plus, autopay, familias, lineas. |
| `inalambrico_iot` | Internet On The Go, Claro Oficina/FWA, IoT, backup, equipos relacionados. |
| `claro_tv` | Planes TV, premium, STB, dongle, control, DVR, activacion, penalidad. |
| `servicios` | Claro Rescate, Residencia, Advantage, Legal, SOCS, seguros, primas, deducibles. |
| `ofertas_moviles` | Equipo gratis, 50%, creditos, trade-in, bonos, price codes, elegibilidad. |
| `convergencia` | Claro Full, 2Play/3Play, bonos y reglas que combinan familias. |

## Modelo de datos conceptual

La implementacion posterior debe decidir si extiende las tablas ya existentes o
crea tablas nuevas. Para esta fase se disena el contrato comun:

### `commercial_sources`

Responsabilidad: custodiar cada archivo o aprobacion de negocio.

Campos conceptuales:

- `id`
- `family`
- `original_name`
- `safe_file_name`
- `sha256`
- `mime_type`
- `bytes`
- `stored_relative_path`
- `uploaded_by`
- `uploaded_at`
- `document_date`
- `valid_from`
- `valid_to`
- `status`: `archived`, `parsed`, `previewed`, `published`, `rejected`
- `parser_name`
- `parser_version`
- `metadata`

### `commercial_versions`

Responsabilidad: version publicada por dominio.

Campos conceptuales:

- `id`
- `domain`
- `number`
- `status`: `draft`, `pending_review`, `published`, `replaced`, `archived`
- `source_ids`
- `valid_from`
- `valid_to`
- `vigencia_documental`
- `summary`
- `warnings`
- `diff`
- `created_by`
- `published_by`
- fechas de ciclo

Regla: solo una version `published` por dominio.

### `commercial_items`

Responsabilidad: item normalizado vendible o explicable.

Campos conceptuales:

- `version_id`
- `domain`
- `item_key`
- `family`
- `type`: `plan`, `service`, `equipment`, `offer`, `bonus`, `insurance`,
  `condition`, `package`
- `name`
- `code`
- `price_regular`
- `price_offer`
- `monthly`
- `term_months`
- `technology`
- `rules`
- `source_ref`: documento, pagina, hoja, fila
- `payload`

El `payload` conserva la forma completa de cada dominio sin perder campos
especificos.

## Flujo de datos

### Flujo general de publicacion

1. Admin sube documento.
2. Backend guarda temporalmente y calcula hash.
3. Backend archiva original en `documentos-ofertas/` o directorio operativo
   configurado.
4. Parser extrae filas y conserva evidencia: hoja, pagina, fila, texto o imagen.
5. Normalizador transforma a items comerciales.
6. Comparador calcula diferencias contra la version publicada del dominio.
7. Admin revisa:
   - altas;
   - bajas;
   - cambios de precio;
   - cambios de reglas;
   - vigencias;
   - advertencias;
   - contradicciones.
8. Admin publica.
9. Backend reemplaza la version vigente del dominio dentro de una transaccion.
10. Portal lee la nueva version por API.

### Flujo de lectura del portal

1. Portal solicita `GET /api/commercial-catalog/:domain`.
2. Respuesta incluye `domain`, `version`, `vigencia`, `warnings`, `items`.
3. Si no hay version publicada:
   - superficies migradas muestran mensaje claro;
   - durante la migracion se permite fallback solo con banner de aviso.
4. Ninguna superficie migrada lee precios desde arrays HTML/JS.

### Flujo del constructor futuro

1. Constructor carga cliente CRM.
2. Consulta catalogo comercial por dominios necesarios.
3. Evalua elegibilidad con reglas publicadas.
4. Muestra propuesta.

Este flujo no se implementa en esta fase. Solo se prepara la fuente unica.

## Migracion incremental

### Fase 1A - Fuente unica y contratos

Objetivo: crear la base comun sin romper lo existente.

- Definir migracion revisable para `commercial_sources`,
  `commercial_versions` y `commercial_items`.
- Crear rutas de solo Admin para subir, preview, publicar e historial.
- Crear ruta de lectura por dominio, con autenticacion segun la superficie que
  la consuma.
- No cambiar portal todavia.
- No ejecutar migracion sin backup y autorizacion.

### Fase 1B - Conectar equipos sin romper endpoint actual

Objetivo: que equipos sea el primer dominio confirmado.

- Mantener `/api/equipos-lista` como compatibilidad.
- Al publicar lista de equipos, registrar tambien fuente/version/item comercial.
- El portal `equipos.html` puede seguir leyendo `/api/equipos-lista` hasta que
  el nuevo endpoint iguale la salida.
- Pruebas comparan conteos y campos clave entre ambos endpoints.

### Fase 1C - Conectar planes fijos, moviles e inalambrico

Objetivo: mover lectura de plan hacia fuente unica.

- `planes_modulos` se mantiene como compatibilidad.
- Los parsers existentes publican tambien al catalogo comercial.
- `fijos-data.js` queda solo como respaldo temporal con banner visible.
- `movil.html` no debe depender de datos manuales sin fuente publicada.
- `banda-ancha.html` deja de usar TCS hardcodeados cuando existan terminos en
  el catalogo.

### Fase 1D - Migrar Claro TV y servicios

Objetivo: sacar arrays comerciales de HTML/JS.

- Crear importadores simples desde documento o carga manual revisada.
- Claro TV se publica como dominio `claro_tv`.
- Servicios y seguros se publican como dominio `servicios`.
- Las imagenes de servicios se guardan como evidencia, no como fuente unica de
  precio.

### Fase 1E - Migrar ofertas moviles

Objetivo: reemplazar `ofertas-data.js` por version publicada.

- Reutilizar decisiones del spec `2026-07-20-ofertas-movil-versionado-ligero`.
- El Excel de financiamiento crea version de `ofertas_moviles`.
- El static fallback solo queda mientras no haya version publicada.

### Fase 1F - Preparar reemplazo del constructor

Objetivo: no tocar el constructor hasta que los dominios existan.

- Crear contrato de lectura para el constructor.
- Mapear producto actual del cliente a dominios.
- Definir elegibilidad sobre fuente publicada.
- Reemplazar constructor despues, en plan aparte.

## Manejo de errores

| Caso | Comportamiento |
| --- | --- |
| Documento ilegible | No crea version publicable; muestra error de parser. |
| Documento reconocido parcialmente | Crea preview con advertencias; publicar exige confirmacion. |
| Hash repetido | Reutiliza preview o informa que ya existe la version. |
| Vigencia ausente | Preview permite completar fechas; no publica sin decision. |
| Vigencia vencida | Publica con aviso `vencida_pendiente_reemplazo`, no bloquea venta automaticamente. |
| Dos admins publican a la vez | Transaccion y bloqueo por dominio; solo una vigente. |
| API de catalogo sin version | Respuesta `404 sin_version_publicada` con mensaje de usuario. |
| Portal migrado no puede leer API | Muestra error claro; fallback temporal solo si esta permitido para esa superficie. |
| Item sin precio valido | Se publica como no cotizable o queda en advertencias; nunca inventar precio. |

## Pruebas necesarias

### Backend

- Migracion: tablas, estados, indice unico de version publicada por dominio,
  sin deletes destructivos.
- Parser/normalizador por dominio: fixtures pequenos y casos de advertencia.
- API Admin:
  - requiere auth/admin;
  - preview no publica;
  - publicar reemplaza version anterior;
  - historial conserva versiones.
- API lectura:
  - devuelve solo version publicada;
  - incluye vigencia y warnings;
  - 404 claro cuando no hay version.

### Integracion

- Equipos: comparar datos de `v_equipos_vigentes` contra catalogo comercial.
- Planes: comparar `planes_modulos` contra catalogo comercial para fijos,
  moviles e inalambrico.
- Servicios/TV: verificar que no queden precios/codigos principales en arrays
  HTML/JS cuando se migren.

### Frontend/Admin

- Admin muestra estado por dominio.
- Preview lista altas, bajas, cambios y advertencias.
- Boton publicar se bloquea si faltan vigencias requeridas.
- Historial visible por dominio.

### Portal

- Cada superficie migrada pide el endpoint correcto.
- Si usa fallback temporal, muestra banner de datos locales.
- No hay precios principales hardcodeados en la superficie migrada.

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
| --- | --- |
| Mezclar fuentes oficiales con datos manuales | Cada item debe tener `source_ref` o aprobacion de negocio. |
| Romper portal actual | Migrar por superficie con compatibilidad y pruebas de contrato. |
| Sobredisenar antes de publicar algo util | Empezar por contratos y equipos/planes existentes. |
| Constructor usa datos parciales | Constructor queda fuera hasta tener dominios completos. |
| Fallback estatico queda permanente | Cada fallback debe tener ticket de retiro y banner visible. |
| Parser no cubre todo un boletin | Preview muestra advertencias y bloquea publicacion automatica. |

## Decisiones que Gabriel debe revisar

1. **Nivel de control del Admin:** publicar solo con parser automatico, o permitir
   edicion manual revisada cuando un parser no exista todavia.
2. **Fallbacks temporales:** permitir que el portal siga mostrando datos
   estaticos con banner, o bloquear la superficie hasta tener version publicada.
3. **Prioridad de migracion dentro de fase 3:** migrar primero Claro TV o
   Servicios.
4. **Vigencias vencidas:** confirmar que una oferta vencida sigue visible con
   aviso hasta reemplazo, como regla general para todos los dominios.
5. **Ubicacion fisica de archivos:** confirmar si `documentos-ofertas/` sera el
   archivo canonico operativo o si produccion usara un directorio configurado y
   `documentos-ofertas/` quedara como copia de referencia.

## Fuera de alcance

- Ejecutar migraciones.
- Backfill de datos existentes.
- Cambios en HTML/JS del portal.
- Reemplazar el constructor.
- Publicar a produccion.
- Commit.

## Criterio de listo para implementar

Gabriel revisa las cinco decisiones anteriores. Luego se prepara un plan de
implementacion por fases, empezando por migracion revisable, endpoints de
catalogo y conexion de equipos/planes sin retirar los endpoints actuales.

## Auto-revision del spec

- No hay cambios de codigo ni datos incluidos.
- No hay migracion ejecutable en este documento.
- La arquitectura mantiene compatibilidad con `/api/equipos-lista` y
  `/api/planes-modulos`.
- El constructor queda explicitamente fuera hasta que la fuente unica exista.
- Los puntos que requieren decision humana estan listados antes de implementar.
