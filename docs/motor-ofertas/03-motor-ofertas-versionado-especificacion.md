# Motor versionado de ofertas - Especificacion tecnica para newcrm

Fecha: 2026-07-12

## Objetivo

Convertir el preview de ofertas moviles de `newcrm` en una fuente persistente, versionada, auditable y consultable por una `LineaMovil`.

Esta fase implementara despues, mediante TDD, solo backend y base de datos. No conecta el portal, no modifica la modal, no cambia el Admin Ofertas y no despliega.

La primera version cubre el dominio `movil_equipos`. El modelo deja preparado el campo `dominio` para fijo e Internet On-The-Go sin mezclar sus ciclos de aprobacion.

## Auditoria de newcrm

La especificacion se adapta a la arquitectura comprobada el 2026-07-12:

- repositorio: `C:\Users\Gabriel\Documentos\Programas\newcrm`;
- backend productivo: `backend/src/server.js`;
- Express ESM con rutas en `backend/src/routes/`;
- handlers dentro de rutas, sin carpeta general `controllers/`;
- servicios en `backend/src/services/`;
- PostgreSQL mediante `backend/src/db.js`;
- tablas operativas de ofertas y equipos en `public`;
- pruebas con `node:test` en `backend/test/`;
- frontend estatico en `frontend/app.html`, sin build;
- portal local en `Planes para web/`, servido bajo `/constructor`.

El plan anterior para `VentasProui` no se copia. En particular, se eliminan sus supuestos sobre `server-FINAL.js`, `src/backend/controllers`, `tests/vigia`, Vitest, build React y rutas de archivos de produccion del CRM viejo.

## Regla de repositorios

- `newcrm` es el unico destino de esta implementacion.
- `VentasProui` puede consultarse para entender una funcionalidad heredada, pero no se modifica.
- `ofertas-proui` no se conecta ni se modifica en esta fase.
- `originales/` es archivo historico, no fuente activa de instrucciones.

## Fuentes comerciales

Prioridad obligatoria:

1. Tabla oficial de financiamiento vigente.
2. Boletin oficial aplicable a la regla.
3. Lista oficial de precios vigente.
4. Documento oficial de seguro, cuando corresponda.
5. Aprobacion de negocio archivada y auditable para resolver una interpretacion.
6. JavaScript, HTML, JSON y matrices exploratorias solo como referencias de comparacion.

Fuentes verificadas localmente:

| Tipo | Archivo | SHA-256 |
|---|---|---|
| Tabla de financiamiento | `Tabla Ofertas Financiamiento 4 al 15 de julio de 2026- PYMES.xlsx` | `31872D5CDDE9FE864CC6272DCF705CAA7E89C77AC2F19E4011ED116592E55479` |
| Lista de precios | `Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx` | `F6007C42711F1E7DB65B8148CF05ED25AB8BE86F63F7B7CB2730E337ACF4D31C` |
| Seguro | `Boletin Nuevas Primas y Precios de Claro Proteccion Movil - PYMES, Corporativo y Gobiernos 09302021.pdf` | `74F805724CAC1928CD053A89C804DB3E2F9BCE8A5CB6862F3CE615E981F83305` |

Hojas verificadas de la tabla de financiamiento:

- `Ofertas con desc plan $35-$85`;
- `Ofertas Equipos en Portafolio`;
- `Ofertas Equipos en Li`;
- `Ofertas Planes y Bonos`;
- `Planes de Lista`;
- `PLANES PROMOCIONALES`.

Hojas verificadas de la lista de precios:

- `Ofertas Tablets y Modems`;
- `Finan Equipos Móvil`;
- `Finan Modems- Tablets-Routers`;
- `Planes familiares FAM09A y R`;
- `Planes Fam Otros LOC10A y R`;
- `Precios modems, tablets, HP`;
- `Accesorios`.

Los archivos `docs/motor-ofertas/02*.xlsx` son matrices de investigacion. Sirven como fixtures y comparacion, pero no crean una version vigente por si solos.

## Arquitectura actual que debe coexistir

### Equipos

`backend/src/routes/equiposRoutes.js` mantiene:

- `public.equipos_uploads`;
- `public.equipos_lista`;
- `public.equipos_mensualidades`;
- `public.equipos_pospago`;
- `public.v_equipos_vigentes`;
- `/api/equipos-lista` y sus endpoints de preview/upload.

El motor puede enlazar `equipo_lista_id`, pero debe conservar un snapshot de modelo, SKU, SAP y precio. Una actualizacion posterior de `equipos_lista` no puede cambiar una version historica.

### Planes y Admin Ofertas

`backend/src/routes/planesRoutes.js` mantiene `public.planes_modulos` y `/api/planes-modulos`.

El preview actual usa memoria por 30 minutos y aplica cambios directos a modulos. El motor nuevo no reemplaza ese flujo en esta fase. Sus versiones se persisten en tablas propias y sus endpoints viven bajo `/api/motor-ofertas`.

`frontend/app.html` ya tiene Admin Ofertas. La pestana de ofertas moviles es un placeholder. No se conecta en esta fase.

## Alcance

Incluye para la fase de implementacion posterior:

- migracion SQL revisable y no ejecutada;
- contratos de entrada y salida definidos y validados con Zod;
- normalizacion de fuentes oficiales con hoja, pagina y fila;
- persistencia inmutable de versiones, fuentes, ofertas y combinaciones de equipo;
- contradicciones separadas del estado de version;
- historial append-only de transiciones;
- endpoints `version-vigente`, `preview`, `aprobar` y `elegibles`;
- pruebas con `node:test`;
- documentacion JSON de los endpoints.

No incluye:

- ejecucion de migraciones;
- backfill de datos existentes;
- cambios en `frontend/app.html`;
- cambios en `Planes para web/`;
- cambios en `ofertas-proui`;
- modal de equipos;
- reemplazo de `/api/equipos-lista` o `/api/planes-modulos`;
- importador de fijo o Internet On-The-Go;
- deploy.

## Modelo de datos

Se usara un modelo hibrido:

- columnas relacionales para identidad, estado, busqueda, indices y claves foraneas;
- JSONB para conservar el contrato completo `Oferta` y evidencia no indexada;
- snapshot de equipo y precio dentro de la version;
- referencias opcionales al catalogo actual de `public.equipos_lista`.

Una version es inmutable en su contenido comercial. Resolver una contradiccion que cambia una regla obliga a crear otra version. Aprobar o activar solo cambia el ciclo de vida y registra historial.

## Tres dimensiones de estado

### Estado de version

Solo se permiten:

- `borrador`
- `pendiente_revision`
- `aprobada`
- `vigente`
- `reemplazada`
- `archivada`

No existen `contradiccion` ni `vencida` como estados de version.

Transiciones:

```text
borrador -> pendiente_revision
pendiente_revision -> aprobada
aprobada -> vigente
vigente -> reemplazada
borrador | pendiente_revision | aprobada | reemplazada -> archivada
```

Una activacion solicitada desde `pendiente_revision` registra dos transiciones dentro de una sola transaccion:

```text
pendiente_revision -> aprobada -> vigente
```

No existe el atajo directo `pendiente_revision -> vigente`.

### Estado comercial de Oferta

Vive dentro del contrato `Oferta`:

- `confirmada`
- `confirmada_parcial`
- `pendiente_fuente`
- `pendiente_vigencia`
- `pendiente_negocio`
- `contradiccion`
- `implementacion_referencia`
- `archivada`

### Vigencia documental

Vive en la fuente y en la oferta:

- `vigente`
- `vencida_pendiente_reemplazo`
- `vencida`
- `futura`
- `pendiente_confirmacion`

Una version puede seguir operativamente `vigente` con una fuente `vencida_pendiente_reemplazo`. `/elegibles` debe advertirlo y devolver `aplicacion_automatica: false`.

## Tablas nuevas en schema public

### `public.motor_ofertas_versiones`

Responsabilidad: ciclo operativo de cada snapshot.

Campos:

- `id UUID PRIMARY KEY`;
- `numero BIGSERIAL UNIQUE`;
- `dominio TEXT NOT NULL DEFAULT 'movil_equipos'`;
- `estado TEXT NOT NULL` con `CHECK` de los seis estados;
- `normalizador_version TEXT NOT NULL`;
- `fuentes_manifest_sha256 CHAR(64) NOT NULL`;
- `resumen JSONB NOT NULL DEFAULT '{}'`;
- `reemplaza_version_id UUID NULL`;
- `creada_por`, `aprobada_por`, `activada_por`, `archivada_por`;
- fechas de creacion, aprobacion, activacion, reemplazo y archivo.

Restricciones:

- identidad unica por `dominio + fuentes_manifest_sha256 + normalizador_version`;
- indice unico parcial para una sola version `vigente` por dominio;
- sin endpoints DELETE;
- versiones anteriores no se sobrescriben.

### `public.motor_ofertas_fuentes`

Responsabilidad: fuente exacta archivada.

Campos:

- `id UUID PRIMARY KEY`;
- `version_id`;
- `tipo`: `tabla_financiamiento`, `lista_precios`, `boletin`, `seguro`, `aprobacion_negocio` u `otra`;
- nombre original y nombre seguro archivado;
- ruta relativa al directorio configurado;
- SHA-256, MIME y bytes;
- vigencia desde/hasta y `vigencia_documental`;
- hoja, pagina, fila inicial/final y metadatos JSONB;
- texto extraido opcional.

El directorio se define con `MOTOR_OFERTAS_UPLOAD_DIR`. El valor por defecto local es `backend/uploads/motor-ofertas`. La API nunca acepta una ruta de filesystem enviada por el cliente.

### `public.motor_ofertas`

Responsabilidad: snapshot del contrato `Oferta`.

Campos:

- `id UUID PRIMARY KEY`;
- `version_id`;
- `oferta_key` con unicidad dentro de la version;
- `nombre`;
- `estado_comercial`;
- `vigencia_documental`, `vigencia_desde`, `vigencia_hasta`;
- `tipos_plan TEXT[]`;
- `familias TEXT[]`;
- `eventos TEXT[]`;
- `plazos SMALLINT[]`;
- `plan_monto_minimo`, `plan_monto_maximo`;
- `fuente_principal_id`, `fuente_hoja`, `fuente_fila`;
- `contrato JSONB NOT NULL`.

El valor ambiguo `both` no se persiste. El normalizador expande alcances solo cuando la fuente los define de manera verificable; de lo contrario crea contradiccion.

### `public.motor_ofertas_equipos`

Responsabilidad: combinaciones indexables oferta/equipo/plazo.

Campos:

- `id UUID PRIMARY KEY`;
- `oferta_id`;
- `equipo_lista_id INTEGER NULL REFERENCES public.equipos_lista(id)`;
- identificador estable del snapshot;
- modelo comercial y modelo oficial;
- SKU/SIF, SAP y precio regular;
- plazo, pago mensual, descuento, credito y beneficio;
- fuente exacta de precio y regla;
- coincidencia: `exacta`, `equivalencia_aprobada` o `pendiente`;
- `snapshot JSONB NOT NULL`.

Una coincidencia aproximada nunca confirma un equipo automaticamente.

### `public.motor_ofertas_contradicciones`

Responsabilidad: problemas de datos o fuentes sin contaminar el estado de version.

Campos:

- `id UUID PRIMARY KEY`;
- `version_id` y `oferta_id` opcional;
- `codigo`, `severidad`, `bloqueante`;
- `estado`: `abierta`, `resuelta`, `descartada`;
- detalle y fuentes enfrentadas;
- resolucion JSONB;
- creador, resolutor y fechas.

Una contradiccion bloqueante abierta impide aprobar o activar.

### `public.motor_ofertas_historial`

Responsabilidad: auditoria append-only.

Registra version, estado anterior, estado nuevo, actor, fecha y motivo. No se actualiza ni elimina.

## Fuentes del preview

`POST /api/motor-ofertas/preview` usa `multipart/form-data` con campos de archivos separados:

- `tabla_financiamiento`: Excel requerido;
- `lista_precios`: Excel requerido;
- `boletines`: cero o mas PDF opcionales, maximo 10;
- `seguro`: PDF opcional, maximo 1;
- `dominio`: opcional, por defecto `movil_equipos`;
- `normalizador_version`: requerido.

No se acepta solo `lista_precios_upload_id` porque `public.equipos_uploads` actualmente no garantiza hash y archivo archivado. Una integracion futura puede habilitarlo cuando ese contrato sea auditable.

## Normalizacion

El preview debe:

1. Validar extension, MIME, cantidad y tamano antes de persistir.
2. Calcular SHA-256 de cada fuente.
3. Construir un manifiesto ordenado por `tipo + sha256`.
4. Calcular `fuentes_manifest_sha256`.
5. Detectar e inventariar todas las hojas.
6. Extraer reglas de `Ofertas Equipos en Portafolio` y hojas complementarias.
7. Conservar fila Excel real, celdas fuente y texto original relevante.
8. Cruzar SKU, SAP, modelo y precio con la lista oficial incluida en el mismo preview.
9. Enlazar con `public.equipos_lista` solo por SKU/SIF exacto o equivalencia aprobada.
10. Normalizar eventos a `linea_nueva`, `portabilidad`, `renovacion` y `linea_adicional`.
11. Separar individual de las familias Business RED.
12. Rechazar `both` si la fuente no permite expandirlo de forma exacta.
13. Conservar plazos por combinacion, sin plazo global asumido.
14. Construir y validar cada objeto `Oferta`.
15. Registrar datos incompletos o conflictivos en `motor_ofertas_contradicciones`.

Un error fatal de lectura responde `422 parser_error` y no crea version. Una fuente legible con contradicciones crea la version y la deja en `pendiente_revision`.

## Idempotencia

La identidad del preview es:

```text
dominio + fuentes_manifest_sha256 + normalizador_version
```

Repetirla devuelve la version existente con `reutilizada: true`. Cambiar el normalizador permite reprocesar las mismas fuentes sin borrar la version anterior.

## Contratos API

Todas las rutas se montan desde `backend/src/server.js` bajo `/api/motor-ofertas`.

### `GET /api/motor-ofertas/version-vigente`

Requiere autenticacion. Acepta `?dominio=movil_equipos`.

```json
{
  "ok": true,
  "version": {
    "id": "uuid",
    "numero": 12,
    "dominio": "movil_equipos",
    "estado": "vigente",
    "vigencia_documental": "vigente",
    "resumen": {
      "ofertas": 11,
      "equipos": 45,
      "contradicciones_abiertas": 0
    }
  },
  "fuentes": [
    {
      "tipo": "tabla_financiamiento",
      "archivo": "Tabla Ofertas Financiamiento 4 al 15 de julio de 2026- PYMES.xlsx",
      "sha256": "64-caracteres",
      "vigencia": {
        "desde": "2026-07-04",
        "hasta": "2026-07-15",
        "estado": "vigente"
      }
    }
  ]
}
```

Sin version vigente responde `404` con `codigo: "version_vigente_no_disponible"`.

### `POST /api/motor-ofertas/preview`

Requiere autenticacion y rol `admin` o `supervisor`.

Respuesta:

```json
{
  "ok": true,
  "reutilizada": false,
  "version": {
    "id": "uuid",
    "numero": 13,
    "estado": "pendiente_revision",
    "aprobable": false
  },
  "resumen": {
    "ofertas": 11,
    "equipos": 45,
    "contradicciones_abiertas": 2,
    "contradicciones_bloqueantes": 1
  },
  "contradicciones": [
    {
      "id": "uuid",
      "codigo": "equipo_sin_fuente_precio",
      "bloqueante": true,
      "estado": "abierta"
    }
  ]
}
```

### `POST /api/motor-ofertas/aprobar`

Requiere autenticacion y rol `admin` o `supervisor`.

```json
{
  "version_id": "uuid",
  "activar": true,
  "version_vigente_esperada": "uuid-o-null",
  "resoluciones": [
    {
      "contradiccion_id": "uuid",
      "decision": "resuelta",
      "nota": "Confirmado por negocio",
      "fuente_aprobacion": {
        "tipo": "aprobacion_negocio",
        "referencia": "documento auditable"
      }
    }
  ]
}
```

Reglas:

- `activar: false` ejecuta `pendiente_revision -> aprobada`;
- `activar: true` registra `pendiente_revision -> aprobada -> vigente` dentro de una transaccion;
- la version vigente anterior pasa a `reemplazada`;
- `version_vigente_esperada` protege concurrencia;
- una contradiccion bloqueante abierta responde `409 contradicciones_bloqueantes`;
- una version ya reemplazada o archivada no puede aprobarse.

### `POST /api/motor-ofertas/elegibles`

Requiere autenticacion.

Entrada:

```json
{
  "linea": {
    "id": "linea_005",
    "indice": 5,
    "ban": "123456789",
    "tipo": "multilinea_business_red",
    "familia_business_red": "business_red_plus",
    "plan": {
      "codigo": "BRPLUS",
      "nombre": "Business RED Plus",
      "monto": 60
    },
    "evento": "linea_nueva",
    "convergente": true,
    "trade_in": {
      "estado": "no_requiere",
      "validado": false
    }
  },
  "contexto_ban": {
    "posicion_en_ban": 5,
    "beneficios_usados_por_oferta": {
      "oferta_gratis_35": 4
    }
  }
}
```

Respuesta:

```json
{
  "ok": true,
  "linea_id": "linea_005",
  "version": {
    "id": "uuid",
    "numero": 13,
    "estado": "vigente"
  },
  "equipos": [
    {
      "equipo": {
        "id": "samsung_galaxy_a37_128gb",
        "equipo_lista_id": 120,
        "modelo_oficial": "SAMSUNG GXY A37 128GB",
        "sku_sif": "33979H",
        "sap": "7014074",
        "precio_regular": 349.99
      },
      "oferta": {
        "id": "oferta_gratis_35",
        "nombre": "Equipo gratis"
      },
      "plazos": [
        {
          "meses": 30,
          "pago_mensual": 11.67
        }
      ],
      "beneficio": {
        "tipo": "financiado",
        "motivo": "limite_ban_excedido"
      },
      "aplicacion_automatica": true,
      "validaciones": [
        {
          "codigo": "limite_ban_excedido",
          "estado": "warning"
        }
      ],
      "fuente": {
        "archivo": "archivo.xlsx",
        "hoja": "Ofertas Equipos en Portafolio",
        "fila": 7
      },
      "vigencia": {
        "desde": "2026-07-04",
        "hasta": "2026-07-15",
        "estado": "vigente"
      }
    }
  ],
  "validaciones": []
}
```

Reglas de elegibilidad:

- usa solo la version `vigente` de `movil_equipos`;
- filtra tipo, plan, familia, evento, convergencia, trade-in, vigencia y fuente;
- individual admite de 1 a 10 lineas;
- Business RED admite de 2 a 10 lineas y conserva familia exacta;
- `linea_adicional` no equivale a renovacion;
- el limite BAN afecta el beneficio, no oculta el equipo;
- fuera de limite devuelve financiado solo si la fuente lo permite;
- sin `contexto_ban`, devuelve `limite_ban_pendiente` y bloquea aplicacion automatica;
- una fuente vencida pendiente de reemplazo puede mostrarse con advertencia y aplicacion automatica bloqueada;
- seguro solo aparece con fuente oficial y rango aplicable;
- taxes no se calculan sin fuente exacta.

Una entrada invalida responde `422 contrato_linea_invalido`. Una consulta valida sin equipos responde `200`, `equipos: []` y validacion `sin_equipos_elegibles`.

## Seguridad y errores

- El router aplica `requireAuth` a todas sus rutas.
- Preview y aprobacion aplican ademas `requireAdmin`.
- Multer usa memoria y limites definidos; no acepta rutas del cliente.
- Los nombres archivados se sanitizan.
- Los errores no devuelven rutas absolutas ni contenido sensible.
- La activacion usa transaccion y bloqueo de la version vigente.
- El indice unico parcial impide dos versiones vigentes por dominio.
- No existen endpoints DELETE.

Codigos esperados:

- `400 archivo_requerido`;
- `400 tipo_archivo_invalido`;
- `401 no_autenticado`;
- `403 rol_insuficiente`;
- `404 version_vigente_no_disponible`;
- `409 contradicciones_bloqueantes`;
- `409 version_vigente_cambio`;
- `409 transicion_invalida`;
- `422 parser_error`;
- `422 contrato_oferta_invalido`;
- `422 contrato_linea_invalido`;
- `500 error_interno`.

## Pruebas requeridas

Casos comerciales:

- Individual $35 y $50;
- cada familia Business RED soportada;
- linea nueva;
- portabilidad;
- renovacion con y sin trade-in validado;
- linea adicional;
- limite BAN dentro y fuera;
- fuente vencida pendiente de reemplazo;
- falta `contexto_ban`;
- sin equipo elegible;
- seguro sin fuente y seguro con fuente.

Casos tecnicos:

- migracion permite solo seis estados de version;
- `contradiccion` no aparece en el `CHECK` de version;
- `vencida` no aparece en el `CHECK` de version;
- preview idempotente por manifiesto y normalizador;
- fuente conserva hash, hoja, pagina y fila;
- `both` no se confirma automaticamente;
- coincidencia aproximada no confirma equipo;
- activacion registra dos transiciones cuando parte de `pendiente_revision`;
- aprobacion bloqueante devuelve 409;
- aprobacion concurrente devuelve 409;
- historial es append-only;
- el router usa auth y roles correctos;
- `backend/src/server.js` monta `/api/motor-ofertas`;
- no hay endpoints DELETE.

## Criterios de aceptacion

- La migracion existe y no se ejecuta.
- Las tablas nuevas usan `public` y respetan las tablas actuales de equipos.
- No se pierden versiones anteriores.
- Solo existe una version vigente por dominio.
- Los seis estados son los unicos estados de version.
- Contradicciones y vigencia documental permanecen separadas.
- Los cuatro endpoints cumplen sus contratos.
- `/elegibles` no inventa reglas comerciales.
- Las pruebas dirigidas con `node --test` pasan.
- Los contratos Zod rechazan estructuras ambiguas antes de consultar PostgreSQL.
- Los archivos JS nuevos pasan `node --check`.
- No se modifica frontend, portal, modal ni CRM viejo.
- No se ejecuta migracion, backfill ni deploy.
