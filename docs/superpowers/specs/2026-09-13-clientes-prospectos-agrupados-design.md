# Prospectos agrupados dentro de Clientes

## Objetivo

Incorporar una pestaña Prospectos en Clientes para trabajar negocios recolectados sin mezclarlos con clientes reales, BAN ni suscriptores.

## Comportamiento

- Clientes conserva sus pestañas Activos, Cancelados, Seguimiento e Incompletos sin cambios.
- Se agrega la pestaña Prospectos, alimentada exclusivamente desde `public.prospectos`.
- La pestaña presenta una fila por empresa agrupada, en vez de una fila por sucursal.
- Cada grupo muestra el nombre de empresa y la cantidad de ubicaciones encontradas.
- Al abrir un grupo se muestran sus sucursales, direcciones, teléfonos y sitio web disponibles.

## Regla de preservación

El agrupamiento es de presentación. No elimina prospectos, no actualiza sus datos de origen y no crea ni modifica filas en `public.clients`, BAN o suscriptores.

## Agrupamiento

- Se utilizará un nombre comercial normalizado de manera conservadora para unir variantes de una misma cadena.
- Si no hay una coincidencia clara, las empresas quedarán separadas para evitar fusionar negocios distintos.
- La primera versión no inferirá una oficina central ni inventará un contacto corporativo; conservará los datos existentes de las sucursales.

## Verificación

- Pruebas de contrato para la pestaña y la ruta de prospectos agrupados.
- Pruebas de agrupamiento para sucursales con el mismo nombre comercial y para nombres distintos.
- Validación de JavaScript del frontend y pruebas dirigidas.
