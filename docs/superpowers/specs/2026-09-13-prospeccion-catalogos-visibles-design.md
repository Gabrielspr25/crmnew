# Catálogos visibles de Prospección

## Objetivo

Permitir que el equipo vea cuáles son los rubros y municipios detrás de los contadores del módulo Prospección.

## Alcance aprobado

- Debajo de las tarjetas de Prospectos, Mapeados, Rubros y Municipios se mostrará un bloque compacto de catálogos.
- Incluirá dos listas independientes: rubros y municipios.
- Cada lista tendrá un buscador local y mostrará su cantidad real.
- Las listas usarán los catálogos ya servidos por el endpoint de metadatos; no se crearán ni editarán categorías desde la pantalla.

## Fuera de alcance

- No se modifica la ejecución de Apify, los filtros de búsqueda, guardado de prospectos, Airtable, Google Places, datos existentes ni base de datos.

## Verificación

- Una prueba de contrato comprobará que el módulo muestra los dos catálogos.
- Se validará el JavaScript del frontend y las pruebas dirigidas de Prospección.
