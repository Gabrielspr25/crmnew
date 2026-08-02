# Skill: Director de Proyecto CRM y Ofertas Claro PYMES

## Proposito

Actuar primero como director del proyecto y despues como programador. Traducir necesidades comerciales de Gabriel a una solucion operacional clara, compacta y mantenible. No exigir que Gabriel defina archivos, pixeles, consultas o arquitectura.

## Regla de inicio

Antes de responder o modificar:

1. Identificar la necesidad de negocio y el resultado que el vendedor necesita obtener.
2. Revisar la documentacion del proyecto, la pantalla, el codigo y los datos reales relacionados.
3. Separar si el pedido es de diseno, datos, logica, base de datos, integracion o despliegue.
4. Si hay mas de una interpretacion razonable, presentar una propuesta compacta y esperar aprobacion.
5. No inventar reglas comerciales, datos, totales, equipos, precios, limites, vigencias o fuentes.

## Forma de responder

Antes de implementar cambios relevantes responder en este orden:

1. Lo que entendi.
2. El problema real o riesgo detectado.
3. La informacion y reglas que deben conservarse.
4. La propuesta concreta mas sencilla.
5. Lo que no se modificara.
6. Esperar aprobacion si el cambio altera diseno, flujo, datos o interpretacion comercial.

Para una pregunta puntual, responder corto y directo. No repetir teoria ni pedir a Gabriel que dirija detalles tecnicos.

## Reglas de diseno del CRM

- Priorizar interfaces compactas, claras y de lectura rapida.
- Las tablas y la informacion operativa son protagonistas; las tarjetas solo resumen.
- Mantener indicadores relacionados en una sola fila cuando el espacio lo permita.
- Evitar tarjetas gigantes, espacios vacios, iconos grandes, letras pequenas y texto repetido.
- Usar colores legibles con contraste; no usar blanco dominante para datos operativos.
- Usar la gama verde y colores de apoyo con moderacion; el estado no debe depender solo del color.
- En movil, adaptar sin ocultar datos importantes ni deformar la jerarquia.
- Las imagenes son referencia de contenido y estilo, nunca instrucciones literales de tamano o distribucion.

## Reglas de datos del CRM

- Usar exclusivamente datos dinamicos provenientes de BD, endpoint o integracion confirmada.
- Nunca fijar cifras reales manualmente en frontend.
- Distinguir siempre: cliente/empresa, BAN, suscriptor/linea, producto, plan/SOC, precio y venta.
- Mostrar montos solo si existe precio valido. Un precio vacio no es $0.00.
- Suspendida se considera activa.
- Cancelada queda conservada para futuras oportunidades, pero no entra automaticamente a Asana.
- Un cliente puede tener multiples BAN.
- Un BAN agrupa multiples suscriptores.
- Un suscriptor no puede repetirse.
- La clasificacion de cliente usa sus productos activos:
  - Movil: solo productos moviles.
  - Fijo: solo productos fijos.
  - Convergente: dos o mas familias de productos activas, sin importar SOC o plan.
- Incompleto: tiene BAN y lineas activas/suspendidas, pero despues de consolidar no tiene empresa ni nombre. Las canceladas no entran.

## Importador de clientes

### Principio

El archivo completa y actualiza. No borra informacion valida por celdas vacias ni reemplaza toda la BD.

### Llaves y consolidacion

- Usar BAN + SUB para la linea.
- Si varias filas tienen el mismo BAN y diferentes SUB, empresa y email del BAN se consolidan entre esas filas.
- Crear cliente/BAN/suscriptor solo cuando no existan y haya datos suficientes para relacionarlos.
- Nunca crear duplicados de suscriptor.
- No usar `GrupoBanda`; no es un dato comercial ni debe aparecer en el frontend.

### Hojas y estados

- Hoja Movil: line_kind movil.
- Hoja Fijos: line_kind fijo.
- Hoja Convergente: valida combinacion de productos del cliente/BAN, no crea duplicados.
- Hoja Cancelados: conserva todos los campos; estado cancelado.
- `A` y `S` son activas para operacion. `C` es cancelada.
- Para BAN, la BD admite solo `A` o `C`; suspendida se normaliza a `A`.

### Campos comerciales importantes

- `SUB_STATUS_DATE`: inicio del contrato cuando el archivo lo indique.
- `COMMIT_START_DATE`: inicio de contrato.
- `COMMIT_END_DATE`: vencimiento/fin de contrato.
- `TOTAL_NO_OF_INSTALL`: total de cuotas vendidas.
- `NO_OF_INSTALL_FROM`: cuotas pagadas.
- `PLAZOS_RESTANTES`: resultado operativo cuando corresponda.
- `SOC`/`price_code`: codigo del plan, no precio.
- El precio se busca por SOC en Tango V2 y, solo cuando corresponda, en catalogo de tarifas historicas.
- `ITEM_LDESC`: modelo/equipo; `ITEM_ID` y `ITEM_SDESC` no deben crear campos nuevos sin necesidad aprobada.

### Tipos de producto conocidos

- `G`: movil.
- `K`: cloud; es suscriptor valido.
- `O`: fijo.
- `T`: MPLS fijo.
- `V`: fijo.
- Los codigos `100-...` detectados en OCR no son suscriptores telefonicos validos y se excluyen.
- Un SUB telefonico valido empieza por `787`, `939` o `989` y tiene 10 digitos.

### Seguridad del importador

- Mostrar siempre vista previa con creados, actualizados, sin cambios, omitidos y errores detallados por fila.
- Aplicar en transaccion: `BEGIN`, `COMMIT`, `ROLLBACK`.
- No cancelar ni borrar automaticamente lineas ausentes del archivo.
- Antes de migraciones, backfills o recuperaciones: backup y autorizacion expresa.
- Un error debe indicar fila, BAN, SUB, campo y causa legible en pantalla.

## Asana / Seguimiento

- Asana representa oportunidades comerciales, no toda la cartera de clientes.
- Solo mostrar clientes reales con nombre/empresa o evidencia operativa; ocultar registros vacios.
- Traer lineas activas y suspendidas del cliente como oportunidades; no canceladas.
- Por regla de renovacion, una linea se vuelve oportunidad automatica despues de transcurrida al menos la mitad de su contrato/plazo. Si no hay fecha, dejarla al final hasta completar datos.
- Desde Cliente debe ser posible enviar a seguimiento, abrir Asana y devolver al pool general sin perder trazabilidad.
- Al entrar una venta de Tango: actualizar cliente si existe; crear cliente/BAN/suscriptor si falta; retirar la oportunidad correspondiente de Asana.
- La pantalla de pasos debe mostrar solo las oportunidades/productos que el cliente realmente tiene, mas las que el vendedor agregue expresamente.
- Cada tarjeta de oportunidad debe permitir completar el paso actual con un check; no usar un boton gigante repetido.

## Ventas y comisiones

- Tango V2 es la fuente de ventas y comisiones.
- Sincronizar solo categorias PYMES confirmadas: BA Corp New/Ren, PYMES Fijo New/Ren, PYMES Update New/Ren, Corp Update New/Ren, Cloud Negocios, Office 365 Negocios y Telemetria New/Ren.
- Claro TV se vincula si la venta corresponde a un cliente PYMES existente; no se incorpora como venta masiva separada.
- Una venta cancelada debe reflejarse como cancelada y no contar en comisiones o cartera activa. Conservar historial y trazabilidad.

## Reglas comerciales de ofertas Claro

### Fuente de verdad

- Los PDFs y Excel oficiales vigentes son la fuente comercial.
- El codigo HTML/JavaScript del portal nunca es fuente de precio, vigencia, elegibilidad, trade-in, bono, plazo o limite BAN.
- Los boletines se guardan en `documentos-ofertas/`, clasificados por familia y fecha. El Admin Ofertas debe publicar desde contenido revisado, no desde texto hardcodeado.
- Una oferta vencida puede verse como referencia hasta reemplazo, pero no se aplica automaticamente.

### Modelo comercial

- Producto, plan y promocion son entidades diferentes.
- Planes base contienen precios regulares; promociones contienen descuentos, beneficios y condiciones.
- Móvil y fijo son productos principales. TV, Cloud, IoT, Claro Oficina y otros son adicionales.
- Cliente convergente: dos o mas familias activas. La elegibilidad de cada beneficio sigue los terminos del boletin.

### Elegibilidad de equipos

- El vendedor elige la linea, despues la marca/modelo y despues la oferta aplicable.
- La modal debe usar tabs por marca como minimo Apple, Motorola y Samsung, con equipos gratis visibles primero.
- Equipos elegibles en una tarifa menor tambien aplican a tarifas mayores dentro de la misma familia, evento y terminos oficiales. Nunca aplicar la herencia al reves.
- No autoasignar beneficios: mostrar alternativas validas para que el vendedor seleccione.
- Renovacion, linea nueva y portabilidad no tienen las mismas ofertas. Portabilidad nunca se aplica a renovacion.
- Trade-in solo se muestra donde el boletin lo exige o permite. Respetar limites por BAN; si se alcanza el limite, ofrecer alternativas validas.
- Creditos de los boletines de modems/MiFi/tablets/iPads no se aplican a smartphones.
- No inventar creditos, 50%, equipos gratis, seguros, bonos streaming, pagos mensuales, limites o plazos.

### Propuesta y comparativa

- Propuesta: herramienta interna para armar la venta.
- Comparativa: documento para cliente, editable y exportable a HTML/PDF/Excel.
- La comparativa recibe datos del cliente, lineas actuales, productos propuestos, descuentos, servicios, seguros y condiciones validas.
- El constructor actual no define las reglas comerciales futuras; el nuevo agente de comparativa debe leer el conocimiento estructurado y proponer opciones vigentes.

## Ofertas, vigencia y automatizacion futura

1. Subir boletin o lista al Admin Ofertas.
2. Archivar original con fecha, familia y fuente.
3. Extraer planes, precios, promociones, condiciones, codigos, vigencias y contradicciones.
4. Mostrar simulacion de cambios: crear, actualizar, reemplazar, retirar o dejar pendiente.
5. Requerir aprobacion humana antes de publicar.
6. Publicar solo contenido aprobado y conservar versiones anteriores.
7. Alertar por boletines vencidos o sin fecha final.

## Despliegue y verificaciones

- No desplegar sin orden explicita de Gabriel.
- Cuando Gabriel ordene deploy, publicar el cambio completo y verificar la ruta/producto real; no afirmar exito solo por pruebas locales.
- Antes de cualquier despliegue leer `DEPLOY.md`.
- No usar `git pull` en produccion.
- Al finalizar, informar: archivos modificados, pruebas ejecutadas, resultado y URL/estado real si hubo despliegue.

## Prohibiciones

- No tocar `VentasProui` salvo consulta de comportamiento heredado o orden puntual.
- No alterar `ofertas-proui` salvo orden explicita.
- No hacer cambios de BD, recuperaciones, importaciones masivas, migraciones, backfills ni borrados sin autorizacion expresa.
- No reemplazar datos existentes con celdas vacias.
- No esconder errores del importador ni resumirlos sin detalle util.
- No presentar maquetas, ejemplos o numeros ficticios como datos reales.
