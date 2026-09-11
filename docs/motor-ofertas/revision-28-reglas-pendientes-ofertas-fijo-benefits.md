# Revision comercial - 28 reglas pendientes de Ofertas Fijo + Benefits

## Alcance autorizado

Revision local de las 28 reglas que habian quedado en `requiere_revision` al analizar el boletin oficial **Boletin Beneficios Convergencia Claro Full PYMES 23JUL2026**, fuente local:

`documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf`

Limites aplicados:

- No se conecto Constructor.
- No se desplego produccion.
- No se ejecutaron migraciones.
- No se modificaron datos comerciales publicados.
- No se inventaron elegibilidades, compatibilidades, acumulaciones, limites ni vigencias.

## Resultado ejecutivo

Las 28 reglas pendientes no eran 28 contradicciones comerciales reales. La revision encontro tres causas tecnicas:

1. La pagina 3 se duplicaba: el resumen de beneficios se leia como lista oficial y tambien como bloques normales de pagina.
2. Varios terminos y condiciones del mismo boletin se estaban normalizando como beneficios nuevos.
3. Algunas condiciones oficiales del resumen de Claro Full no se heredaban hacia cada regla: convergencia requerida, acumulacion general y excepcion del bono de streaming.

Despues de corregir la normalizacion con evidencia del boletin oficial:

- Reglas normalizadas desde el PDF: 58.
- Beneficios principales confirmados: 9.
- Terminos vinculados confirmados: 49.
- Reglas en `requiere_revision`: 0.
- Contradicciones abiertas: 0.
- Fuente incompleta: 0 para este boletin.
- No determinada: 0 para las 28 reglas revisadas.

## Reglas revisadas

| # | Evidencia oficial | Motivo de revision | Decision | Accion de normalizacion |
|---:|---|---|---|---|
| 1 | Pag. 3, beneficio 1: 3 Meses Gratis Movil | No heredaba convergencia desde el encabezado Claro Full | Confirmada | Beneficio `meses_gratis`, convergencia requerida, plan minimo 60 |
| 2 | Pag. 3, beneficio 2: Pago de Penalidad Fijo hasta 200 | No heredaba contexto Claro Full | Confirmada | Beneficio `pago_penalidad`, producto fijo |
| 3 | Pag. 3, beneficio 4: Doble de Velocidad | No heredaba convergencia ni acumulacion | Confirmada | Beneficio `doble_velocidad`, productos fijo/FWA cuando el texto lo indica |
| 4 | Pag. 3, beneficio 5: Doble de Data Internet Inalambrico | Producto afectado incompleto | Confirmada | Beneficio `doble_data`, productos movil e inalambrico/IoT segun texto |
| 5 | Pag. 3, beneficio 6: 50% Internet On-The-Go | No heredaba convergencia | Confirmada | Beneficio `descuento_porcentaje` 50, producto Internet On-The-Go |
| 6 | Pag. 3, beneficio 7: 10% accesorios, computadoras y tablets | Producto salia no determinado | Confirmada | Producto `accesorio`, beneficio `descuento_accesorios` |
| 7 | Pag. 3, beneficio 8: Bono Streaming 10 | Falta excepcion de no acumulacion | Confirmada | Beneficio `bono_streaming`, compatibilidad `no_acumula` |
| 8 | Pag. 3, repeticion beneficio 1 | Duplicado tecnico de lectura | Confirmada como duplicado | Se elimina duplicado de pagina 3 |
| 9 | Pag. 3, repeticion beneficio 6 | Duplicado tecnico de lectura | Confirmada como duplicado | Se elimina duplicado de pagina 3 |
| 10 | Pag. 3, repeticion beneficio 7 | Duplicado tecnico de lectura | Confirmada como duplicado | Se elimina duplicado de pagina 3 |
| 11 | Pag. 4, definicion de cliente convergente | Se trataba como beneficio sin valor | Confirmada como termino | Se vincula como `terminos`, no como beneficio nuevo |
| 12 | Pag. 5, termino 1: clientes nuevos y existentes convergentes | Termino se clasificaba como beneficio | Confirmada como termino | Se vincula a 3 meses gratis |
| 13 | Pag. 5, termino 5: credito en factura | Termino se clasificaba como beneficio | Confirmada como termino | Se vincula a 3 meses gratis |
| 14 | Pag. 5, termino 7: baja de renta anula beneficio | Termino se clasificaba como beneficio | Confirmada como termino | Se vincula como restriccion |
| 15 | Pag. 5, termino 8: cambio de BAN anula beneficio | Termino se clasificaba como beneficio | Confirmada como termino | Se vincula como restriccion |
| 16 | Pag. 5, termino 9: Account Types | Termino salia sin beneficio | Confirmada como termino | Se vincula como requisito de cuenta |
| 17 | Pag. 6, termino 2: maximo 10 lineas | Termino de penalidad se leia como beneficio nuevo | Confirmada como termino | Limite maximo 10 lineas vinculado a penalidad |
| 18 | Pag. 14, termino 6: clientes no convergentes | Termino de tarifas se leia como beneficio | Confirmada como termino | Se vincula como restriccion/condicion |
| 19 | Pag. 14, termino 7: cargos de instalacion y activacion | Termino operativo se leia como descuento suelto | Confirmada como termino | Se vincula como condicion, no beneficio independiente |
| 20 | Pag. 20, termino 3: verificacion de credito | Termino se clasificaba como beneficio | Confirmada como termino | Se vincula como requisito |
| 21 | Pag. 20, termino 5: PUJ | Texto tecnico se leia como beneficio de data | Confirmada como termino | Se vincula como condicion del producto |
| 22 | Pag. 20, termino 6: Boosters | Texto tecnico se leia como beneficio no determinado | Confirmada como termino | Se vincula como condicion, no beneficio |
| 23 | Pag. 30, termino 2: Account Types | Termino salia no determinado | Confirmada como termino | Se vincula como requisito |
| 24 | Pag. 30, termino 3: duracion 12 meses bono streaming | Termino se leia como beneficio nuevo | Confirmada como termino | Se vincula como duracion del bono |
| 25 | Pag. 30, termino 5: Cliente Fijo GPON 100M+ | Termino se leia como beneficio | Confirmada como termino | Se vincula como elegibilidad fija |
| 26 | Pag. 30, termino 8: 30 dias para solicitar | Termino se leia como beneficio | Confirmada como termino | Se vincula como requisito de solicitud |
| 27 | Pag. 30, termino 9: escoger bono movil o fijo | No se detectaba no acumulacion | Confirmada como termino | Compatibilidad `no_acumula` |
| 28 | Pag. 30, termino 10: un bono por BAN | No se detectaba limite por BAN | Confirmada como termino | Limite `{ cantidad: 1, unidad: "BAN" }` |

## Cambios aplicados

Archivo modificado:

- `backend/src/services/fijoBenefitsNormalizer.js`

Cambios:

- Se evita duplicar la pagina 3 cuando existe la lista oficial "Beneficios de Claro Full PYMES para Clientes Convergentes".
- Se hereda la convergencia requerida desde la lista oficial.
- Se hereda la acumulacion general indicada por el boletin.
- Se marca la excepcion del bono de streaming como `no_acumula`.
- Se clasifica la definicion de cliente convergente como terminos.
- Se clasifican terminos operativos como `terminos`, no como beneficios nuevos.
- Se detecta producto `accesorio` para accesorios, computadoras y tablets.
- Se detecta descuento Affinity 8% como beneficio propio.
- Se detecta el limite "solo aplica un bono por BAN".

Pruebas modificadas:

- `backend/test/fijo-benefits-normalizer.test.js`

## Evidencia local

Comando de extraccion real:

```powershell
python scripts/extract_pdf_text.py documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf
```

Resultado de normalizacion sobre el PDF oficial:

```json
{
  "total": 58,
  "por_tipo": {
    "beneficio": 9,
    "terminos": 49
  },
  "por_confianza": {
    "confirmado": 58
  }
}
```

Contradicciones abiertas:

```text
0
```

## Pruebas ejecutadas

Prueba dirigida:

```powershell
node --test backend/test/fijo-benefits-normalizer.test.js backend/test/fijo-benefits-preview-contract.test.js
```

Resultado:

```text
7 pruebas pasaron
0 fallaron
```

Verificacion amplia del bloque comercial:

```powershell
node --test backend/test/bases-informativas-preview-service.test.js backend/test/fuentes-comerciales-preview-base-route-contract.test.js backend/test/inalambrico-agosto-parser-contract.test.js backend/test/inalambrico-vigencia-visible-contract.test.js backend/test/lista-precios-preview-service.test.js backend/test/fuentes-comerciales-equipos-contract.test.js backend/test/motor-ofertas-normalizer.test.js backend/test/moviles-fuentes-publication-contract.test.js backend/test/fijo-benefits-normalizer.test.js backend/test/fijo-benefits-preview-contract.test.js
```

Resultado:

```text
70 pruebas pasaron
0 fallaron
```

Validacion de sintaxis:

```powershell
node --check backend/src/services/fijoBenefitsNormalizer.js
```

Resultado:

```text
OK
```

## Riesgos pendientes

- La revision confirma este boletin oficial de Benefits, no todos los boletines futuros.
- Falta que el Director confirme si el siguiente paso es cerrar Ofertas Fijo con otro boletin oficial o pasar a otra familia comercial.
- Constructor sigue desconectado por limite expreso de esta etapa.
- Produccion no fue tocada.

## Estado

Revision comercial local de las 28 reglas pendientes: cerrada para este boletin.

Queda detenido aqui para decision del Director antes de avanzar a otro bloque.
