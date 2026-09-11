# Modulo Affinity v1 (Centro de Cargas)

## Alcance

Affinity es un modulo propio del Centro de Cargas: subir el PDF oficial del programa, analizarlo, guardar borrador, aprobar, publicar y ver historial. Lo publicado alimenta el portal de Beneficios del vendedor junto a Fijo Benefits y a los equipos especiales.

No se disena un motor nuevo: Affinity reutiliza el normalizador de Benefits (`fijoBenefitsNormalizer`) y el versionado de reglas compuestas (`motorComercialReglasCompuestasPersistence`) con dominio `affinity_benefits`. La tabla `motor_comercial_reglas_versiones` admite el dominio sin migracion.

## Flujo

```text
PDF oficial (familia affinity)
-> archivo + hash + usuario + vigencia (fuentes_comerciales)
-> extract_pdf_text.py
-> normalizeAffinityBenefitSources (bloques que mencionan Affinity + terminos)
-> reglas compuestas (beneficio, producto, condiciones, terminos, confianza)
-> diff contra la version vigente de affinity_benefits
-> borrador / aprobada -> publicar-local -> vigente
-> Portal Benefits (categoria Affinity, autoaplica=false)
```

## Rutas

- `POST /api/fuentes-comerciales` con `familia=affinity` (solo `.pdf`).
- `POST /api/fuentes-comerciales/affinity/preview` `{ fuente_ids: [id] }`.
- `POST /api/fuentes-comerciales/affinity/reglas-compuestas/persistir` `{ preview_id, estado_publicacion }` (`borrador|validada|aprobada`).
- `GET /api/fuentes-comerciales/affinity/reglas-compuestas/:versionId`.
- `POST /api/fuentes-comerciales/affinity/reglas-compuestas/:versionId/publicar-local`.
- `GET /api/fuentes-comerciales/affinity/reglas-compuestas-publicadas/vigente`.
- `GET /api/fuentes-comerciales/affinity/historial`.

## Lectura del boletin oficial (5 de noviembre de 2025)

El parser esta calibrado contra el documento real (`backend/test/fixtures/affinity-boletin-5nov2025.txt`, 8 paginas). El boletin declara **un solo beneficio con dos alcances**:

| Servicio | Beneficio | Codigo | Condiciones leidas |
| --- | --- | --- | --- |
| Movil | 8% sobre la renta mensual | AFFINITY8 | Plan desde $45 (smartphone), $30 (Internet on the Go), $30 (linea familiar); plazos 20/24/30/36 meses; maximo 8 lineas por cliente; clientes nuevos y renovaciones; Update Plus y Financiamiento; no combinable; excluye corporativos, pospago, Claro Libre, prepago y BYOP |
| Fijo | 8% sobre 2Play y 3Play | AFFINITY8 (COPS 7382 y 7382TV) | Plazos 0/12/24 meses; clientes nuevos y renovaciones; Cobre/VRAD desde 10 megas; nivel subscriptor |

Vigencia detectada: **desde 2025-11-05, sin fecha de fin**. El boletin no publica fecha de cierre, asi que la fuente queda como "sin fecha fin" hasta que se cargue una vigencia manual o llegue el reemplazo.

Las paginas 4, 5 y 8 son procedimientos de venta (canal directo e indirecto) y se descartan: no son reglas comerciales.

### Contradiccion detectada en el documento

El boletin declara **dos velocidades minimas distintas para GPON**. El motor recoge las tres menciones con su ubicacion y sentido, sin elegir ninguna:

| Velocidad | Menciones | Donde |
| --- | --- | --- |
| 100 megas | 2 | Pagina 6 (oferta): "planes GPON vigentes en velocidades de 100 megas en adelante" · Pagina 7, punto 12 (exclusion): "no aplica a planes de menos de 100M en GPON" |
| 50 megas | 1 | Pagina 7, punto 1: "en GPON en velocidades de 50 megas en adelante" |

Cobre/VRAD, en cambio, es consistente: 10 megas en las tres menciones.

**Impacto real contra el catalogo Fijo publicado** (`planes_modulos`, pagina `fijos`): los planes GPON vigentes son 30, 50, 100, 150, 200, 300, 350, 450, 500 y 650 MB. La contradiccion afecta a **un solo plan**, el `A880 GPON BUS PRUS ILIM + 50MB ($49.99)`: con minimo 100 megas queda fuera del descuento; con minimo 50 megas lo recibe. El plan de 30MB (`A879`) queda fuera en cualquiera de las dos lecturas.

El motor registra la contradiccion `velocidad_minima_contradictoria`, deja la regla de Fijo en `requiere_revision` y bloquea la aprobacion hasta que el area comercial aclare cual aplica. Movil queda confirmado y no se ve afectado.

### Como se resuelve una contradiccion

La decision es de una persona, no del codigo. En la vista previa aparece un boton por cada valor que el boletin menciona ("Aplica desde 50MB" / "Aplica desde 100MB"); al elegir uno se vuelve a analizar con esa aclaracion y queda guardada dentro de la regla con usuario, fecha y los valores descartados, conservando las menciones originales como evidencia. Solo se acepta un valor que el documento realmente menciona: no se puede inventar una velocidad que el boletin no dice.

**Resuelto el 2026-09-07:** GPON aplica **desde 100 megas en adelante**; el plan `A880 GPON 50MB ($49.99)` queda fuera del descuento. Version 52 publicada como vigente.

## Estados de version

- `borrador`: guarda el trabajo tal cual quedo, incluidas las reglas en revision. Sirve para conservar el analisis mientras se aclara una contradiccion.
- `validada` / `aprobada`: exigen que todas las reglas esten confirmadas.
- `publicar-local`: publica una version aprobada y deja la anterior como `reemplazada`.

## Affinity es la unica fuente del beneficio Affinity

El boletin de Convergencia Claro Full PYMES tambien menciona el descuento Affinity de paso. Esa mencion **ya no se publica** desde `fijo_benefits`: el normalizador de Fijo omite los beneficios cuyo tipo pertenece a un dominio propio (`descuento_affinity`) y deja la advertencia `beneficio_de_dominio_propio_omitido`. Asi el vendedor ve el beneficio una sola vez, con las condiciones completas del boletin dedicado.

La regla anterior (`fijo_benefits|descuento_affinity|fijo`) no se borro: quedo como `reemplazada` con su registro en `motor_comercial_reglas_historial` apuntando a la fuente que la sustituye.

## Que pasa cuando llega un boletin nuevo

1. Se sube el PDF nuevo en Admin Ofertas > Affinity (familia `affinity`). Se archiva con su hash, usuario y vigencia.
2. Se analiza: la vista previa compara contra la version vigente y muestra cuantas reglas son nuevas, cuantas cambian y cuantas vencen.
3. Se guarda borrador, se aprueba y se publica.
4. Al publicar, la version anterior pasa automaticamente a `reemplazada` y la nueva queda `vigente`. El portal del vendedor lee siempre la vigente.

Verificado en local: la version 52 paso a `reemplazada` al publicarse la 65, conservando todo el historial.

## Portal del vendedor

Affinity tiene **pestana propia** (`Planes para web/affinity.html`), porque es un programa con condiciones y terminos extensos que no caben en una fila de la tabla de Beneficios. La pestana esta en todas las paginas del portal.

- `GET /api/fuentes-comerciales/affinity-vigente` (publico, solo lectura): devuelve la version vigente con condiciones legibles, codigos de facturacion, terminos oficiales y la aclaracion registrada si la hubo.
- La pagina no codifica el porcentaje ni el codigo: todo sale de la publicacion. Si no hay version vigente lo dice explicitamente.
- **Affinity no aparece en la tabla de Beneficios**: al tener vista propia, listarlo alli lo duplicaria. `buildBenefitsPortalCatalog` lo excluye a proposito.
- La vista de **Beneficios** paso de tarjetas a **tabla operativa**: una fila por beneficio con categoria, valor, producto, condicion, vigencia y fuente. Las filas se ajustan a su contenido; el nombre del archivo se acota a dos lineas para que no estire la fila. El boton **Detalle** abre una **modal** (se cierra con la X, con Escape o clic fuera) con la condicion completa, la fuente con su pagina y los terminos oficiales.

## Reglas conservadas

- `autoaplica=false` en todas las reglas publicadas.
- Sin beneficios Affinity reconocibles el preview queda con advertencia bloqueante y no se puede aprobar.
- Una regla compuesta sin terminos vinculados queda en `requiere_revision`; no se inventan condiciones.
- La vigencia sale del documento (`Valido del ... al ...`) o de la vigencia cargada al subir; nunca de codigo.
- Publicar reemplaza la version vigente anterior; no se borra historial.

## Pendiente

- Aclarar con el area comercial la velocidad minima real de GPON (100 o 50 megas) y volver a analizar el boletin.
- Cargar una vigencia de fin si el programa la tiene, o esperar el boletin de reemplazo.
- Publicacion productiva sin autorizar.

## Base de datos

`backend/migrations/2026-09-07-fuentes-comerciales-familia-affinity.sql` agrega `affinity` al CHECK de `fuentes_comerciales.familia`. Aplicada en local el 2026-09-07 con backup previo en `backups/fuentes_comerciales_2026-09-07.dump`. La prueba de contrato verifica que la lista `FAMILIAS` del backend y el CHECK de la migracion no se separen.

## Pruebas

- `backend/test/affinity-benefits-normalizer.test.js` (10 casos contra el PDF oficial)
- `backend/test/affinity-modulo-contract.test.js`
- `backend/test/benefits-portal-catalog.test.js` (entrada Affinity en el catalogo publico)
- `backend/test/motor-comercial-reglas-compuestas-persistence.test.js` (borrador conserva reglas en revision)
