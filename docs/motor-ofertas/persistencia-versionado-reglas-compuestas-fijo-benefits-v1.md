# Persistencia y versionado de reglas compuestas Fijo + Benefits v1

Fecha local: 2026-08-29

## Alcance autorizado

Etapa local para demostrar el flujo:

`Fuente oficial -> regla compuesta -> version persistida -> validacion -> publicacion aprobada`

Limites respetados:

- No se conecto Constructor.
- No se activo aplicacion automatica.
- No se desplego produccion.
- No se ejecuto ninguna migracion productiva.
- No se modificaron datos comerciales publicados.
- No se modificaron proyectos externos al flujo comercial de `newcrm`.
- No se inventaron reglas comerciales.

## Base aceptada

Fuente oficial reproducida:

- `documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`

Resultado reproducido localmente:

- Paginas extraidas: 35
- Reglas normalizadas: 58
- Beneficios principales: 9
- Terminos oficiales: 49
- Reglas compuestas: 9
- Reglas compuestas confirmadas: 9
- Pendientes: 0
- Contradicciones: 0
- Relaciones ambiguas: 0
- Autoaplicables: 0

## Modelo local propuesto

Migracion local creada:

- `backend/migrations/2026-08-29-motor-comercial-reglas-compuestas.sql`

Tablas:

- `public.motor_comercial_reglas_versiones`
  - Version inmutable por dominio, fuente, reglas y normalizador.
  - Estados: `borrador`, `validada`, `aprobada`, `vigente`, `reemplazada`, `archivada`.
  - Guarda `fuentes_manifest_sha256`, `reglas_manifest_sha256`, `version_anterior_id`, resumen y auditoria de actor/fechas.
  - Tiene indice unico parcial para una sola version `vigente` por dominio.
- `public.motor_comercial_reglas_fuentes`
  - Snapshot de fuente oficial por version.
  - Conserva fuente comercial, familia, nombre original, ruta, SHA-256, vigencia, pagina/seccion y metadatos.
- `public.motor_comercial_reglas_compuestas`
  - Snapshot de cada regla compuesta.
  - Conserva identidad comercial estable, beneficio, terminos, condiciones, elegibilidad, compatibilidad, limite, vigencia, estado de confianza, estado de publicacion, fuente, seccion y contrato completo.
  - `autoaplica` queda `false`.
  - La identidad comercial no incluye precio.
- `public.motor_comercial_reglas_terminos`
  - Terminos vinculados como snapshots por regla.
- `public.motor_comercial_reglas_historial`
  - Auditoria append-only de version y reglas.

No se usa `ON DELETE CASCADE`; el historial no se sobrescribe.

## Codigo implementado

Servicio nuevo:

- `backend/src/services/motorComercialReglasCompuestasPersistence.js`

Funciones:

- `stableCompositeRuleKey`
  - Genera identidad estable por dominio, tipo de beneficio y producto.
  - No incluye precio, monto ni plan minimo.
- `diffCompositeRules`
  - Clasifica reglas como `nuevo`, `modifica`, `vence` o `sin_cambio`.
  - La accion `reemplaza` queda disponible para evento/version cuando una version nueva sustituya otra.
- `persistCompositeRulesVersion`
  - Valida que todas las reglas esten confirmadas antes de abrir transaccion.
  - Bloquea reglas no confirmadas.
  - Inserta version, fuentes, reglas, terminos e historial dentro de `BEGIN/COMMIT`.
  - En error ejecuta `ROLLBACK`.
  - Mantiene `autoaplica = false`.
- `readCompositeRulesVersion`
  - Lee version persistida y reconstruye reglas con terminos.

Rutas locales agregadas a `backend/src/routes/fuentesComercialesRoutes.js`:

- `POST /api/fuentes-comerciales/planes-fijos/reglas-compuestas/persistir`
  - Persiste reglas compuestas desde un `preview_id` ya generado.
  - Estado por defecto: `aprobada`.
  - En esta etapa solo acepta `borrador`, `validada` o `aprobada`; no permite marcar una version como `vigente`.
  - No publica al portal.
- `GET /api/fuentes-comerciales/planes-fijos/reglas-compuestas/:versionId`
  - Lee una version persistida.

## Ejemplo real de regla persistible

Desde el PDF oficial:

```json
{
  "identidad_comercial": "fijo_benefits|bono_streaming|fijo",
  "beneficio": {
    "tipo": "bono_streaming",
    "monto": 10
  },
  "terminos_vinculados": 11,
  "compatibilidad": "no_acumula",
  "limite": {
    "cantidad": 1,
    "unidad": "BAN"
  },
  "autoaplica": false,
  "fuente": {
    "id": "claro-full-2026",
    "familia": "beneficios",
    "nombre_original": "2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf"
  },
  "pagina_beneficio": 3
}
```

Nota: el monto se conserva dentro del beneficio, pero no forma parte de la identidad comercial.

## Evidencia de versionado

La version guarda:

- `dominio = fijo_benefits`
- `estado_publicacion = aprobada` por defecto en la ruta local
- `normalizador_version = fijo-benefits-compuestas-v1`
- `fuentes_manifest_sha256`
- `reglas_manifest_sha256`
- `version_anterior_id`
- resumen con totales y bloqueos

Cada regla guarda:

- `identidad_comercial`
- `accion_version`
- `version_anterior_regla_id`
- `contrato_sha256`
- `contrato`
- `estado_confianza`
- `estado_publicacion`

Acciones soportadas:

- `nuevo`
- `modifica`
- `reemplaza`
- `vence`
- `sin_cambio`

## Evidencia de trazabilidad

La persistencia conserva:

- fuente oficial por version;
- SHA-256 de fuente;
- pagina y seccion de origen cuando existen;
- texto original de beneficio y terminos dentro del contrato;
- terminos vinculados como snapshots independientes.

## Evidencia de lectura posterior

`readCompositeRulesVersion` reconstruye:

- version;
- reglas compuestas;
- contrato completo de cada regla;
- terminos vinculados;
- trazabilidad fuente -> regla.

La prueba automatizada valida lectura posterior de una version persistida y confirma que la regla conserva la fuente con SHA-256 y terminos.

## Pruebas ejecutadas

Comandos y resultados:

- `node --test backend/test/fijo-benefits-normalizer.test.js backend/test/fijo-benefits-preview-contract.test.js backend/test/motor-comercial-reglas-compuestas-persistence.test.js`
  - Resultado: 17 pruebas, 17 pass, 0 fail.
- `node --check backend/src/services/fijoBenefitsNormalizer.js`
  - Resultado: ok.
- `node --check backend/src/services/motorComercialReglasCompuestasPersistence.js`
  - Resultado: ok.
- `node --check backend/src/routes/fuentesComercialesRoutes.js`
  - Resultado: ok.
- `python -m py_compile scripts/extract_pdf_text.py`
  - Resultado: ok.
- Extraccion local del PDF oficial con `scripts/extract_pdf_text.py`
  - Resultado: 35 paginas extraidas.

## Archivos modificados

- `backend/migrations/2026-08-29-motor-comercial-reglas-compuestas.sql`
- `backend/src/services/motorComercialReglasCompuestasPersistence.js`
- `backend/src/routes/fuentesComercialesRoutes.js`
- `backend/test/motor-comercial-reglas-compuestas-persistence.test.js`
- `backend/test/fijo-benefits-preview-contract.test.js`
- `docs/motor-ofertas/persistencia-versionado-reglas-compuestas-fijo-benefits-v1.md`

Tambien se conservan los archivos de la etapa anterior de normalizacion/composicion.

## Riesgos pendientes

- La migracion fue creada localmente, pero no fue ejecutada en produccion.
- La ruta de persistencia depende de ejecutar primero el preview local y de que existan las tablas.
- No hay conexion al Constructor.
- No hay aplicacion automatica.
- No se publica al Portal.
- Antes de produccion se requiere backup, ejecucion controlada de migracion, validacion contra base real y autorizacion explicita.

## Estado

La etapa local deja preparado el modelo para persistir reglas compuestas confirmadas, versionarlas, conservar trazabilidad completa, bloquear reglas no confirmadas y leer la version persistida.
