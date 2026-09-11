# Reglas compuestas Ofertas Fijo + Benefits v1

Fecha local: 2026-08-29

## Alcance autorizado

Etapa local del Motor Comercial para unir beneficio principal y terminos vinculados en reglas comerciales compuestas completas.

Limites aplicados:

- No se conecto Constructor.
- No se activo aplicacion automatica.
- No se desplego produccion.
- No se ejecutaron migraciones productivas.
- No se modificaron datos comerciales publicados.
- No se inventaron relaciones comerciales sin evidencia.

## Fuente oficial usada

- `documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`
- Extraccion local: `python scripts\extract_pdf_text.py`
- Paginas extraidas: 35

## Resultado reproducible

Resumen de reglas normalizadas:

- Total: 58
- Beneficios principales: 9
- Terminos: 49
- Confirmadas: 58
- Pendientes: 0
- Contradicciones: 0
- Autoaplicables: 0

Resumen de reglas compuestas:

- Reglas compuestas generadas: 9
- Confirmadas: 9
- Relaciones ambiguas o bloqueadas: 0
- Aplicacion automatica: false en todas

## Reglas compuestas generadas

| Beneficio | Terminos vinculados | Estado | Compatibilidad | Limite detectado | Autoaplica |
| --- | ---: | --- | --- | --- | --- |
| meses_gratis | 10 | confirmado | acumula | no determinado | no |
| pago_penalidad | 14 | confirmado | acumula | 10 lineas | no |
| bono_portabilidad | 5 | confirmado | acumula | no determinado | no |
| doble_velocidad | 5 | confirmado | acumula | no determinado | no |
| doble_data | 7 | confirmado | acumula | no determinado | no |
| descuento_porcentaje | 10 | confirmado | acumula | no determinado | no |
| descuento_accesorios | 2 | confirmado | acumula | no determinado | no |
| bono_streaming | 11 | confirmado | no_acumula | 1 BAN | no |
| descuento_affinity | 1 | confirmado | acumula | no determinado | no |

## Ejemplos reales de reglas compuestas

### 3 meses gratis

- Beneficio: `meses_gratis`
- Terminos vinculados: 10
- Condiciones consolidadas:
  - convergencia requerida;
  - plan minimo detectado cuando el texto oficial expresa renta de plan de $60 en adelante;
  - compatibilidad `acumula`;
  - aplicacion automatica `false`.
- Trazabilidad: beneficio desde la lista de Beneficios Claro Full PYMES, pagina 3; terminos desde secciones oficiales de 3 meses gratis del mismo PDF.

### Bono streaming

- Beneficio: `bono_streaming`
- Terminos vinculados: 11
- Condiciones consolidadas:
  - convergencia requerida;
  - compatibilidad `no_acumula`;
  - limite `{ cantidad: 1, unidad: "BAN" }`;
  - aplicacion automatica `false`.
- Trazabilidad: beneficio desde la lista de Beneficios Claro Full PYMES, pagina 3; terminos desde seccion oficial de Bono Streaming por Convergencia.

### Pago de penalidad

- Beneficio: `pago_penalidad`
- Terminos vinculados: 14
- Condiciones consolidadas:
  - convergencia requerida;
  - compatibilidad `acumula`;
  - limite `{ cantidad: 10, unidad: "lineas" }`;
  - aplicacion automatica `false`.
- Trazabilidad: beneficio desde la lista de Beneficios Claro Full PYMES, pagina 3; terminos desde seccion oficial de pago de penalidad.

## Criterios de vinculacion

La composicion usa evidencia textual de la fuente oficial:

- igualdad de tipo de beneficio detectado en beneficio y termino;
- titulo o cuerpo de termino con senales especificas del beneficio;
- definicion oficial de cliente convergente aplicada solo cuando el beneficio exige convergencia;
- terminos reutilizables vinculados explicitamente cuando el texto oficial los conecta con mas de un producto o beneficio.

Cuando una relacion no tenga evidencia textual suficiente, la regla compuesta queda `requiere_revision` con motivo `sin_terminos_vinculados`. En la reproduccion actual del PDF oficial no quedaron relaciones bloqueadas.

## Pruebas ejecutadas

Comandos y resultados:

- `node --test backend/test/fijo-benefits-normalizer.test.js backend/test/fijo-benefits-preview-contract.test.js`
  - Resultado: 11 pruebas, 11 pass, 0 fail.
- `node --check backend/src/services/fijoBenefitsNormalizer.js`
  - Resultado: ok.
- `node --check backend/src/routes/fuentesComercialesRoutes.js`
  - Resultado: ok.
- `python -m py_compile scripts/extract_pdf_text.py`
  - Resultado: ok.
- `python scripts\extract_pdf_text.py documentos-ofertas\convergencia\2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`
  - Resultado: 35 paginas extraidas.

## Archivos modificados

- `backend/src/services/fijoBenefitsNormalizer.js`
  - Agrega composicion de reglas completas.
  - Vincula beneficios con terminos oficiales.
  - Consolida restricciones, elegibilidad, compatibilidad, limites y trazabilidad.
  - Mantiene `aplicacion_automatica: false`.
  - Corrige `benefits` para exponer solo beneficios principales, no terminos.
- `backend/src/routes/fuentesComercialesRoutes.js`
  - Expone `reglas_compuestas`, `relaciones_ambiguas` y `resumen_compuestas` en preview local.
- `backend/test/fijo-benefits-normalizer.test.js`
  - Agrega pruebas de composicion, vinculacion, bloqueo por falta de evidencia y contrato de beneficios principales.
- `backend/test/fijo-benefits-preview-contract.test.js`
  - Agrega contrato para preview de reglas compuestas sin conectar Constructor.
- `docs/motor-ofertas/reglas-compuestas-fijo-benefits-v1.md`
  - Evidencia local de esta etapa.

## Riesgos pendientes

- La composicion todavia es local y no esta persistida en tablas comerciales.
- Constructor sigue desconectado por decision de alcance.
- La aplicacion automatica sigue deshabilitada hasta una autorizacion posterior.
- Antes de cualquier publicacion o migracion se requiere aprobacion explicita, backup y validacion de contrato de datos.
- Si se incorporan PDFs o boletines adicionales, debe repetirse la composicion y revisar relaciones ambiguas nuevamente.

## Estado para decision

La etapa local queda lista para revision: 9 reglas compuestas confirmadas, 0 ambiguas, 0 contradicciones y 0 autoaplicables.

