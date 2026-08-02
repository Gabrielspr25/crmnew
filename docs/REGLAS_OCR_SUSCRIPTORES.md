# Reglas OCR de suscriptores por BAN

Fuente: lista `Subscriber List for BAN` de Claro y validación operativa en CRM.

## Clasificación

| Patrón leído | Tratamiento | Resultado en CRM |
|---|---|---|
| `100...` | Código interno del listado, no es suscriptor. | Se ignora; no crea ni actualiza una línea. |
| `989...` | Suscriptor Cloud válido. | Se crea o actualiza en `subscribers` con `line_kind = cloud`. |
| Tipo `K` | Identificador de la línea Cloud en este formato. | Se conserva en `product_type` y se clasifica como `cloud`. |
| Plan `CCPRO` | Código comercial Cloud confirmado. | Se clasifica como `cloud`. |
| Tipo `0` leído por OCR | Confusión visual de la letra `O` en la columna Type. | Se normaliza a `O` y se clasifica como `fijo`. |

## Alcance de Cloud

- Cloud es un suscriptor válido y debe permanecer relacionado con su BAN y cliente.
- Cloud no se mezcla con líneas móviles ni fijas.
- Cloud por sí solo no convierte al cliente en convergente; convergente exige al menos una línea móvil y una fija activas o suspendidas.

## ClasificaciÃ³n para importaciÃ³n de cartera Claro

Fuente: archivo operativo de cartera con columnas `SUB_STATUS`, `SOC` y
`PRODUCT_TYPE`. El `PRODUCT_TYPE` es la fuente de clasificaciÃ³n; no se debe
inferir el producto solamente por la forma del SOC.

| PRODUCT_TYPE | Tipo de lÃ­nea CRM | Regla |
|---|---|---|
| `G` | `movil` | Incluye Business Red y los planes mÃ³viles heredados. |
| `O` | `fijo` | Incluye planes fijos heredados, por ejemplo `A8700`, `A8812` y `C4762`. |
| `T` | `fijo` | MPLS fijo. |
| `V` | `fijo` | Servicio fijo heredado. |
| `K` | `cloud` | Cloud; no se mezcla con mÃ³vil ni fijo. |
| `C` | sin clasificaciÃ³n operativa | En la cartera validada solo aparecen cancelados; se conserva como historial. |

### Estado y convergencia

- `A` es activo.
- `S` es suspendido temporal. El importador lo normaliza y guarda como
  `activo`; no existe una categoria operativa separada de suspendidos.
- `C` es cancelado; se conserva para historial y futuras ventas, pero no entra
  en oportunidades ni en los conteos activos.
- Un BAN es convergente si contiene por lo menos una lÃ­nea mÃ³vil y una fija
  activas.
- Un cliente es convergente si esa combinaciÃ³n existe entre cualquiera de sus
  BAN activos. Solo intervienen `line_kind` y, si falta, `PRODUCT_TYPE`:
  `G` es mÃ³vil y `O`/`T`/`V` son fijo. SOC, plan, precio y tipo de cuenta del
  BAN no intervienen en la clasificaciÃ³n.

### Clientes incompletos y orden operativo

- Un cliente incompleto tiene al menos un BAN con una lÃ­nea activa y no tiene
  ni empresa ni nombre vÃ¡lidos. Se muestra en la pestaÃ±a `Incompletos` y no
  aparece en `Activos` ni en `Seguimiento`.
- La lista operativa de Clientes ordena primero las lÃ­neas ya vencidas, luego
  las prÃ³ximas a vencer y por Ãºltimo las sin fecha. Dentro de cada grupo
  prioriza el mayor valor de oportunidad activa, luego vencimiento, mensualidad
  fija y cantidad de lÃ­neas activas.

### SOC y plazos

- `BREDP1`, `BREDP2`, `BREDP3`, etc. son SOC mÃ³viles: el nÃºmero representa el
  nivel por cantidad de lÃ­neas y nunca se quita como si fuera plazo de contrato.
- En cÃ³digos fijos heredados, el sufijo final `1` o `2` puede representar
  contrato de uno o dos aÃ±os.
- Si una lÃ­nea mÃ³vil llega sin `NO_OF_INSTALL_FROM` ni
  `TOTAL_NO_OF_INSTALL`, se interpreta como 30 meses vendidos, 30 pagos hechos
  y 0 plazos restantes.

### Fechas del importador PS

Estas fechas son distintas y se conservan por separado en `public.subscribers`:

| Columna del archivo | Campo CRM | Significado |
|---|---|---|
| `SUB_STATUS_DATE` | `activation_date` | Fecha de activaciÃ³n de la lÃ­nea. No se ignora. |
| `COMMIT_START_DATE` | `contract_start_date` | Inicio del compromiso o contrato. |
| `COMMIT_END_DATE` | `contract_end_date` | Vencimiento del compromiso o contrato. |

El importador no reemplaza una fecha existente cuando la celda correspondiente
del archivo estÃ¡ vacÃ­a.

## Seguridad OCR

- Solo se aceptan suscriptores con prefijo `787`, `939` o `989`.
- Un prefijo diferente se rechaza; nunca se transforma automaticamente en otro numero.

- El OCR propone datos; el usuario conserva la opción de corregirlos antes de guardar.
- No se corrigen automáticamente dígitos confundidos por OCR, por ejemplo `767` en lugar de `787`.
- El BAN leído debe coincidir con el BAN destino antes de guardar.
