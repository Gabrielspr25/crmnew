# Admin Ofertas - Modulos base del Portal

Fecha: 2026-08-17

## Decision

Admin Ofertas queda como una sola pantalla administrativa, organizada por los mismos modulos base que existen en el Portal:

- Fijo
- Claro TV
- Planes Moviles
- Inalambrico / IoT
- Lista de Precios
- Servicios
- Directorio de Fijo

No se muestra un modulo llamado `Fuentes comerciales`. La fuente oficial se guarda internamente dentro del flujo de cada modulo.

## Flujo comun

Cada modulo debe seguir el mismo ciclo:

1. Subir documento oficial.
2. Guardar archivo, usuario, hash y vigencia como fuente interna.
3. Analizar el documento.
4. Comparar contra la version vigente.
5. Mostrar altas, bajas y cambios.
6. Publicar una version completa con confirmacion explicita.
7. Mantener historial.

Si una fuente vence y no se sube reemplazo, el Portal sigue usando la ultima version publicada. Debe quedar marcada como vencida o pendiente de reemplazo, pero no se borra ni se oculta automaticamente.

## Alcance por modulo

### Fijo

Catalogo base de planes fijos. No es flujo de ofertas.

El formato visual debe mantenerse estable. Una nueva fuente puede agregar filas, quitar filas o modificar valores.

### Claro TV

Modulo propio. Puede alimentarse del mismo documento que Fijo, pero solo desde su bloque correspondiente.

Regla de extraccion:

- Planes Claro TV se extraen del bloque de planes de television.
- Complementos, equipos y decodificadores de TV quedan separados.
- No mezclar Claro TV con planes Fijos.

### Planes Moviles

Catalogo base de planes moviles. No debe incluir ofertas promocionales.

Business Red Plus 65 no pertenece como oferta dentro de Planes Moviles.

Los documentos BYOP-BAN y multilinea se tratan como documentos de estructura/reglas de planes multilinea, no como ofertas del modulo de planes base.

### Inalambrico / IoT

Catalogo base con el mismo flujo: fuente, analisis, comparacion, publicacion e historial.

### Lista de Precios

Reemplaza el nombre visible `Lista de Equipos`.

Es la lista oficial de precios de equipos. Tiene vigencia propia. Si vence y no hay nueva lista, se sigue publicando la ultima version cargada con alerta de vencimiento.

### Servicios

Por ahora es ajuste manual controlado.

Solo deben quedar publicados:

- Asistencia Legal
- Claro Rescate

Los demas servicios quedan excluidos hasta nueva decision comercial.

### Directorio de Fijo

Misma regla de catalogo base: fuente publicada, vigencia, historial y continuidad de la ultima version publicada si vence sin reemplazo.

## Fuera de alcance por ahora

No tocar en esta fase:

- Oferta Constructor
- Pagina de Ofertas del Portal
- Flujo de ofertas promocionales moviles
- Fijo, TV, Cloud, convergencia o bonos como ofertas

## Regla de interfaz

La pantalla no debe pedir al usuario elegir una familia generica de fuente. El usuario entra al modulo correcto y sube ahi el documento. La clasificacion queda implicita por el modulo seleccionado.
