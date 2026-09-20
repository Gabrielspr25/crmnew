# Registro obligatorio antes de cambiar Admin Ofertas o Portal

## Propósito

Este registro contiene incidentes comprobados del trabajo de Admin Ofertas.
Debe leerse antes de modificar, desplegar o declarar terminado un cambio en
Admin Ofertas, Tareas y reglas Admin o Portal de Ofertas.

## Regla de salida

No se declara una corrección como publicada o verificada hasta comprobar:

1. El artefacto instalado corresponde al cambio revisado.
2. La pantalla publicada muestra el resultado esperado.
3. La fuente, versión y consumidor corresponden al mismo módulo.

Una prueba local o la salud del servicio no reemplazan esa comprobación.

## Incidentes comprobados

| Incidente | Hecho | Prevención |
| --- | --- | --- |
| Directorio mezclado con Fijo | El frontend asociaba `directorio_fijo` con la familia y publicación de Fijo, por eso abría boletines incorrectos. | Tratar Directorio como módulo independiente; nunca heredar fuentes, historial o publicación de Fijo. |
| Comunicación sin prueba publicada | La corrección existía localmente, pero la pantalla de producción seguía igual. | Antes de informar cierre, comparar el archivo instalado y abrir la pantalla afectada. |
| Acciones de Directorio no conectadas | La pantalla mostraba reemplazo y análisis aunque el flujo no acepta Directorio. | No mostrar controles de carga, comparación o publicación hasta que el circuito completo esté implementado y probado. |
| Fuente de Directorio sin custodia | El portal referencia el Excel de Directorio de diciembre de 2025, pero Admin no conserva el original ni su hash. | Cuando exista una versión oficial nueva, archivarla como Directorio con hash y vigencia; nunca como Fijo. |

## Secuencia obligatoria

1. Identificar el módulo y su consumidor real.
2. Confirmar el archivo oficial, hash y vigencia del mismo módulo.
3. Distinguir local, desplegado y publicado.
4. Probar la pantalla que verá el usuario.
5. Comunicar el resultado solo con esa evidencia.
