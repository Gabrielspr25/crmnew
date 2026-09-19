# Centro de Cargas: contrato operativo

## Propósito

El Centro de Cargas debe permitir que una persona comercial identifique, cargue,
analice, revise y publique una fuente oficial sin conocer rutas internas,
familias técnicas ni pantallas ocultas.

Una pantalla que muestra documentos publicados no sustituye el flujo de carga.

## Estado verificable y alcance de un cambio

El estado de un módulo no se deduce por ausencia de error ni por tener un
archivo guardado. Antes de marcar un módulo como `Al día`, `Listo` o
`Terminado`, debe quedar registrada evidencia de cinco datos:

1. superficie exacta afectada: `CRM PYMES/Admin Ofertas`, `Portal web`,
   `Motor Comercial` o `Constructor`;
2. ambiente exacto: local o producción;
3. fuente oficial archivada y archivo original navegable;
4. análisis real, estado de versión y aprobación/publicación correspondiente;
5. prueba posterior en cada consumidor impactado.

Los estados de operación deben distinguir evidencia y alcance:

| Estado | Significado obligatorio |
| --- | --- |
| `Sin verificar` | Falta evidencia o la consulta no pudo completarse; no acredita inexistencia de publicación. |
| `Falta fuente` | Solo cuando se comprueba ausencia en el circuito consultado; no es una afirmación global. |
| `Fuente sin analizar` | Existe archivo, pero todavía no hay preview real exitoso. |
| `Actualización pendiente` | Hay una fuente o borrador sin completar; puede coexistir con una publicación anterior. |
| `Publicado actualmente` | Evidencia de la versión o contenido consumido, independiente del documento seleccionado y de su vigencia. |
| `Requiere revisión` | Hay borrador, contradicción, vencimiento, comparación pendiente o aprobación pendiente. |
| `Bloqueado` | Una dependencia, formato o evidencia impide continuar; se muestra la causa y el siguiente paso. |
| `Al día` | Hay fuente oficial navegable, análisis exitoso, versión publicada vigente y prueba real en los consumidores afectados. |

`Al día` no puede ser un valor predeterminado. Si falta alguna evidencia, se
debe mostrar uno de los estados anteriores. Una prueba local nunca confirma
producción, y una publicación no confirma automáticamente los consumidores.

`Sin borrador seleccionado` describe únicamente la selección actual. No
significa que el módulo nunca se publicó. Un fallo de análisis conserva la
publicación anterior y no debe recuperar otro borrador desde el historial para
habilitar aprobación o publicación. Subir un archivo solo completa recepción.

## Matriz de impacto obligatoria

Todo cambio debe registrarse en el Plan Maestro operativo con su fuente,
módulo origen, superficies y consumidores afectados. Como mínimo se revisan:

- Centro de Cargas en CRM PYMES;
- publicación y documento original;
- Portal web correspondiente;
- Motor Comercial si consume reglas o precios del dominio;
- Constructor cuando vuelva a existir una integración aprobada.

No se publica ni se declara terminado un cambio mientras esa matriz no tenga
ambiente, evidencia y prueba posterior para cada destino aplicable.

## Ciclo obligatorio por categoría

Toda categoría administrable debe exponer, en una entrada alcanzable desde el
Centro de Cargas, estos estados y acciones:

1. `Cargar documento oficial`.
2. `Analizar` el archivo y detectar formato, vigencia y cambios.
3. `Comparar` con el snapshot publicado y `Revisar cambios`, contradicciones y faltantes.
4. `Guardar borrador` con los originales, hash, comparación y resultado de análisis.
5. `Validar revisión` y `Aprobar` la versión explícita, según el circuito existente.
6. `Publicar versión` solo después de aprobación y autorización explícitas.
7. `Comprobar` la versión en el destino y ambiente correspondientes.
8. `Ver documentos` e `Historial` como acciones de consulta separadas.

Si una etapa no está disponible para una familia, la interfaz debe declararla
como bloqueada, indicar la causa y conservar publicada la versión anterior. No
debe presentarla como `Al día` ni ocultar el siguiente paso.

## Regla de navegación

El botón `Abrir` de una fila del Centro de Cargas abre la superficie operativa
de esa categoría, no una biblioteca de solo lectura.

La biblioteca documental es una acción secundaria llamada `Ver documentos`.
En el lienzo operativo, `Abrir documentos` abre la modal correspondiente. La
seleccion lateral carga la categoria en el lienzo y no abre directamente la modal.
Ahí se muestran los documentos realmente enlazados y el estado `Falta documento
oficial` cuando no existe archivo navegable.

## Categorías y origen de carga

| Categoría visible | Documento que se carga | Resultado esperado |
| --- | --- | --- |
| Oferta Fijo | Boletín oficial de fijo, Internet, Claro Full o promociones fijas | Regla de origen fijo y, si corresponde, proyección en Beneficios |
| Ofertas Móviles | Excel oficial de oferta/financiamiento junto al PDF oficial de términos | Reglas móviles y proyección de bonos o beneficios aplicables |
| Beneficios | Solo boletín oficial específico de beneficios o Claro Full | Reglas de beneficios con fuente, sección y vigencia |
| Planes Móviles | PDF del catálogo base de planes vigentes | Catálogo de planes; no reemplaza las ofertas |
| Lista de Precios | Excel oficial de precios de equipos | Catálogo de precios versionado |
| Inalámbrico / IoT | Boletín oficial de equipos, MIFI, módem, tabletas o IoT | Reglas y precios del dominio Inalámbrico / IoT |

### Planes Móviles: conservación de la fuente y exclusión de Gobierno

El boletín oficial de Planes Móviles se carga y archiva completo, exactamente
como fue recibido. No se deben eliminar, editar ni ocultar páginas del archivo
original antes de cargarlo.

Durante el análisis, el sistema debe separar explícitamente:

- planes individuales Business/PYMES;
- planes multilínea Business RED;
- planes BYOP cuando correspondan;
- planes y secciones `Government RED` o del segmento Gobierno.

Los planes de Gobierno no se incorporan al catálogo público de Planes Móviles,
no se muestran en el Portal y no se entregan al Constructor como candidatos.
Se conservan únicamente en la fuente original y en la auditoría del análisis
con la clasificación `segmento_no_incluido: gobierno`.

La exclusión afecta solo la publicación pública. Nunca autoriza modificar el
documento oficial ni perder su archivo, hash, páginas o historial.

Un beneficio encontrado dentro de un boletín de Oferta Fijo, Ofertas Móviles o
Inalámbrico / IoT se carga una sola vez en su dominio de origen. Beneficios lo
proyecta después de la normalización y publicación aprobada; no crea una copia
manual de la regla.

## Beneficios: dos entradas claras

La superficie de Beneficios debe presentar una acción primaria `Cargar boletín`
con dos opciones explícitas:

- `Boletín específico de beneficios / Claro Full`: abre la carga de la familia
  Beneficios.
- `Beneficio dentro de otro boletín`: dirige a Oferta Fijo, Ofertas Móviles o
  Inalámbrico / IoT según el origen elegido.

La pantalla debe indicar que el resultado aparecerá en el catálogo de
Beneficios solo cuando su fuente se haya analizado, revisado y publicado. No se
debe inventar una regla ni tratar un documento archivado como una publicación.

## Garantías de publicación

- Cargar o analizar nunca cambia la versión comercial publicada.
- Una revisión nueva no reemplaza la anterior por sí sola.
- Un parser incompleto, una vigencia ausente o una contradicción bloquean la
  publicación y quedan visibles como tales.
- La publicación debe conservar archivo original, hash, sección, vigencia,
  historial y reglas normalizadas.

## Criterio de validación de interfaz

Para cada categoría se prueba, desde su fila del Centro de Cargas:

1. llegar al formulario de carga;
2. seleccionar el tipo de archivo aceptado;
3. ejecutar análisis;
4. guardar un borrador;
5. ver el bloqueo o los cambios antes de publicar;
6. abrir los documentos ya publicados de forma independiente.

La pantalla principal no puede depender de que la persona infiera una ruta o
una modalidad técnica para completar ese ciclo.
