# Revision comercial - Ofertas Fijo + Benefits v1

Fecha: 2026-08-29

## Alcance

Revision local del bloque reportado como `28 reglas pendientes` de Ofertas Fijo + Benefits.

Limites mantenidos:

- no se conecto Constructor;
- no se desplego produccion;
- no se ejecutaron migraciones productivas;
- no se modificaron datos comerciales publicados;
- no se uso HTML ni JavaScript como fuente comercial.

## Fuente oficial revisada

```text
documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf
```

Extraccion local:

```text
35 paginas
```

## Diferencia de conteo

La conversacion anterior reporto:

```text
39 reglas normalizadas
11 confirmadas
28 requiere_revision
```

Ese conteo no fue reproducible en el workspace actual. Antes de esta revision, con el codigo local disponible y el PDF oficial 2026, el resultado reproducible fue:

```text
39 reglas normalizadas
22 confirmadas
17 requiere_revision
```

No se inventaron 11 reglas para completar el numero previo. La revision se hizo sobre las reglas pendientes reproducibles y sobre la causa tecnica que las dejaba en revision.

## Correcciones de normalizacion

Se corrigio la normalizacion para:

- heredar el contexto oficial de `Clientes Convergentes` desde la lista principal de Claro Full;
- heredar la regla oficial de acumulacion general: `Todos estos beneficios aplican y pueden ser combinados`;
- respetar la excepcion oficial del beneficio 8, donde el cliente debe escoger una opcion de Bono Streaming;
- clasificar paginas de `Terminos y Condiciones` como `terminos`, no como beneficios nuevos;
- conservar terminos confirmados sin aplicacion automatica;
- detectar `Solo aplica un bono de $10.00 por BAN` como limite de un bono por BAN;
- evitar que `Válido desde el 23 de julio de 2026` se interprete como `plan_minimo=2026`;
- evitar que velocidades como `50M` o `100 megas` se interpreten como precio minimo de plan;
- bloquear la aplicacion automatica en esta etapa.

## Resultado despues de la revision

Resultado reproducible contra el PDF oficial 2026:

```text
58 reglas normalizadas
9 beneficios
49 terminos
58 confirmadas
0 requiere_revision
0 contradicciones detectadas
0 aplicacion_automatica
```

## Reglas pendientes revisadas

| Regla pendiente reproducible | Pagina | Motivo original de revision | Decision | Evidencia |
| --- | --- | --- | --- | --- |
| 3 Meses Gratis Movil | 3 | No heredaba convergencia ni acumulacion | Confirmada, no autoaplicable | Lista de Beneficios Claro Full PYMES para Clientes Convergentes y nota de combinacion |
| 50% de Descuento Internet On-The-Go | 3 | No heredaba convergencia ni acumulacion | Confirmada, no autoaplicable | Beneficio 6 en lista principal Claro Full |
| 10% de Descuento accesorios/computadoras/tablets | 3 | No heredaba convergencia ni acumulacion | Confirmada, no autoaplicable | Beneficio 7 en lista principal Claro Full |
| Aplica a clientes nuevos y existentes convergentes | 5 | Se trataba como beneficio sin tipo claro | Confirmada como termino | Terminos y Condiciones de 3 Meses Gratis |
| Credito a factura de tres meses gratis | 5 | Se trataba como beneficio independiente | Confirmada como termino | Terminos y Condiciones de 3 Meses Gratis |
| Account Types de 3 Meses Gratis | 5 | Se trataba como beneficio sin tipo claro | Confirmada como termino | Business Credit Limit, Business Regular, Business Wireline Small |
| Pago de penalidad por linea fija hasta 10 lineas | 6 | Falta de contexto y limite completo | Confirmada como termino | Terminos y Condiciones Pago de Penalidad Fijo PYMES |
| Clientes no convergentes reciben tarifa regular | 14 | Se trataba como beneficio sin tipo claro | Confirmada como termino/exclusion | Terminos Doble/Proxima Velocidad Internet de Negocios Fijo |
| Cargos de instalacion y activacion por contrato | 14 | Mezclaba descuento con beneficio nuevo | Confirmada como termino | Tabla de cargos segun contrato 24 meses, 12 meses o No Contrato |
| Verificacion de credito IOTG | 20 | Se trataba como beneficio sin tipo claro | Confirmada como termino | Internet On-The-Go Terms |
| PUJ / doble data / limite de red | 20 | Texto mixto de uso y oferta | Confirmada como termino, no autoaplicable | Internet On-The-Go Terms |
| Boosters IOTG | 20 | Texto mixto con renovacion/financiamiento | Confirmada como termino, no autoaplicable | Internet On-The-Go Terms |
| Account Types Bono Streaming | 30 | Se trataba como beneficio sin tipo claro | Confirmada como termino | Terminos Bono Streaming $10 por Convergencia |
| Duracion 12 meses Bono Streaming | 30 | No se vinculaba bien al beneficio | Confirmada como termino | Termino 3 de Bono Streaming |
| Solicitud dentro de 30 dias Bono Streaming | 30 | No se vinculaba bien al beneficio | Confirmada como termino | Termino 8 de Bono Streaming |
| Escoger entre bono movil o fijo | 30 | No capturaba incompatibilidad | Confirmada como termino `no_acumula` | Termino 9 de Bono Streaming |
| Solo un bono de $10 por BAN | 30 | No capturaba limite por BAN | Confirmada como termino con limite `1 BAN` | Termino 10 de Bono Streaming |

## Reglas que continuan bloqueadas

No quedaron reglas en `requiere_revision` con el PDF 2026 y el normalizador corregido.

Sin embargo, todas las reglas permanecen con:

```text
aplicacion_automatica = false
```

Motivo: esta etapa no autoriza conectar Constructor ni aplicar beneficios automaticamente. La siguiente etapa debe relacionar beneficios principales con sus terminos completos antes de permitir calculo automatico de elegibilidad.

## Contradicciones

No se detectaron contradicciones internas en esta revision.

## Riesgos pendientes

- El normalizador ya identifica beneficios y terminos, pero todavia no consolida una regla final compuesta que una beneficio principal + todos sus terminos aplicables.
- Las condiciones de velocidad minima deben modelarse en un campo propio; no deben caer en `plan_minimo`.
- Account Types, tecnologias, plazos, canales y requisitos documentales deben quedar estructurados antes de habilitar Constructor.
- El PDF 2026 confirma beneficios vigentes desde el 23 de julio de 2026, pero esto no equivale a publicacion productiva.

## Pruebas requeridas

Ejecutar:

```text
node --test backend/test/fijo-benefits-normalizer.test.js
node --test backend/test/fijo-benefits-preview-contract.test.js
node --check backend/src/services/fijoBenefitsNormalizer.js
node --check backend/src/routes/fuentesComercialesRoutes.js
python -m py_compile scripts/extract_pdf_text.py
python scripts/extract_pdf_text.py documentos-ofertas/convergencia/2026-07-25--Boletin-Beneficios-Convergencia-Claro-Full-PYMES-23JUL2026-260713.pdf
```

## Decision para director

El bloque Ofertas Fijo + Benefits queda mejor normalizado localmente para revision.

No se debe avanzar todavia a:

```text
Motor Comercial -> Constructor
```

Siguiente decision recomendada: autorizar una etapa local para consolidar `beneficio principal + terminos vinculados` en reglas compuestas antes de cualquier conexion del Constructor.
