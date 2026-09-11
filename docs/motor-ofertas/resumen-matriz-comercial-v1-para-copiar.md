# Resumen para copiar - Matriz Comercial v1

Se cerro la Matriz Comercial v1 para el Portal y el Constructor.

## Que se ajusto

1. Se separo la llave comercial del valor.
   - El precio ya no identifica un plan, equipo u oferta.
   - El precio queda como atributo versionado.
   - Si un plan o equipo cambia de precio, el sistema debe entender que es el mismo elemento con un nuevo valor, no un elemento nuevo.

2. Se agrego estado de confianza de procesamiento.
   - Confirmado.
   - Requiere revision.
   - Contradiccion.
   - Fuente incompleta.
   - Esto es independiente del estado de publicacion como borrador, aprobado, publicado, vencido o reemplazado.

3. Se aclaro la regla de terminos.
   - Los terminos bloquean solo cuando la oferta declara o depende de terminos que no estan disponibles.
   - Si el mismo boletin contiene todos los requisitos necesarios, no se debe exigir un PDF adicional artificial.

4. Se agrego la regla de oro del Constructor.
   - Nunca inferir elegibilidad por ausencia de una restriccion.
   - Si una fuente oficial no confirma evento, tipo de cliente, renovacion, portabilidad, cliente nuevo, convergencia, plazo o limite BAN, el dato queda como no determinado.
   - Una regla con datos no determinados no se aplica automaticamente hasta que otra fuente oficial o una decision comercial la confirme.

## Que contiene la matriz

- Separacion entre estructura/base y ofertas/beneficios.
- Clasificacion por contenido y por seccion, no solo por PDF o Excel.
- Soporte para Fijo, Movil, Claro TV, Inalambrico/IoT, Lista de Precios, Accesorios, Benefits y ofertas combinadas.
- Excepcion de Inalambrico/IoT: puede traer estructura y ofertas en el mismo archivo.
- Reglas para cambios oficiales de precio dentro de boletines.
- Reglas para ofertas temporales sin sobrescribir precios base.
- Niveles de aplicacion: cliente, BAN, linea, plan, equipo, producto y combinacion.
- Llaves comerciales minimas para identificar duplicados, cambios y reemplazos.
- Acciones al detectar cambios: nuevo, modifica, reemplaza, vence o queda historico.
- Reglas de acumulacion: compatible, no compatible, sustituye, acumula, maximo por BAN, linea, cliente o evento.
- Contradicciones bloqueadas por regla especifica, no por documento completo.
- Constructor calculando todas las combinaciones validas y recomendando una sin ocultar alternativas.

## Archivos finales

- Markdown: `C:\Users\Gabriel\Dropbox\Gabriel\matriz-reglas-portal-constructor.md`
- HTML interactivo: `C:\Users\Gabriel\Dropbox\Gabriel\matriz-reglas-portal-constructor.html`

## Siguiente paso recomendado

No seguir agregando mas columnas a la matriz. El siguiente documento debe ser el Modelo del Motor Comercial:

Fuente -> Seccion -> Regla -> Condicion -> Accion -> Prioridad -> Resultado

Ese documento debe definir las tablas, el flujo de carga/publicacion y como el Admin convierte un PDF o Excel oficial en reglas comerciales utilizables por el Portal y el Constructor.
