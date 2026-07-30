# Prompts efectivos para pedir cambios en newcrm

Este documento sirve para pedir trabajo a Codex sin repetir contexto y con menos vueltas.

Regla base: si estamos en `C:\Users\Gabriel\Documentos\Programas\newcrm`, Codex debe asumir que hablamos del CRM activo.

## Frase clave

Para cambios visibles, usar siempre una de estas frases:

```text
Hazlo hasta produccion para que lo vea en crmp.ss-group.cloud.
```

```text
Solo revisa y dime. No modifiques ni despliegues.
```

```text
Modifica y prueba local, pero no despliegues todavia.
```

## Cuando algo sigue igual en pantalla

```text
En el CRM, [pantalla exacta], [boton o flujo exacto] sigue igual.
Investiga primero si estoy viendo local o produccion, que archivo lo sirve y si hay otro flujo parecido.
Luego dime la causa real antes de cambiar nada.
```

Ejemplo:

```text
En el CRM, Clientes > Comparativas > Excel sigue descargando varias hojas.
Investiga primero si ese boton viene de frontend/app.html o del constructor.
Dime la causa real antes de cambiar nada.
```

## Para hacer el cambio completo

```text
En el CRM, [pantalla exacta], cambia [comportamiento actual] por [resultado esperado].
Revisa el flujo real, cambia el archivo correcto, agrega o ajusta prueba, prueba local y despliega a produccion para que yo lo vea.
No toques base de datos ni backend salvo que sea necesario.
```

Ejemplo:

```text
En el CRM, Clientes > Comparativas > boton Excel, cambia el Excel de varias hojas a un formulario en una sola hoja como la imagen.
Revisa el flujo real, cambia el archivo correcto, agrega prueba, prueba local y despliega a produccion para que yo lo vea.
No toques base de datos ni backend salvo que sea necesario.
```

## Para distinguir CRM principal vs constructor

Usar una de estas dos formas:

```text
En el CRM principal: Clientes > Comparativas > [boton o accion]...
```

```text
En el constructor: Abrir constructor de ofertas > paso Comparativa > [boton o accion]...
```

Ejemplos:

```text
En el CRM principal: Clientes > Comparativas > boton Excel, quiero una sola hoja tipo formulario.
Hazlo hasta produccion.
```

```text
En el constructor: paso Comparativa > Descargar Excel, quiero que salga como formulario comercial.
Hazlo hasta produccion.
```

## Para auditoria sin tocar nada

```text
Audita [pantalla/modulo/flujo] en newcrm.
No modifiques archivos, no ejecutes migraciones, no despliegues.
Dame: archivo principal, endpoints usados, fuente de datos, que funciona, que es placeholder y riesgos.
```

Ejemplo:

```text
Audita Comparativas en newcrm.
No modifiques archivos, no ejecutes migraciones, no despliegues.
Dame: archivo principal, endpoints usados, fuente de datos, que funciona, que es placeholder y riesgos.
```

## Para cambios visuales

```text
En el CRM, [pantalla], quiero mejorar visualmente [parte].
Primero revisa la pantalla completa y proponme el cambio.
No programes hasta que yo apruebe.
```

Ejemplo:

```text
En el CRM, Clientes > ficha del cliente, quiero mejorar las tarjetas de lineas activas y canceladas.
Primero revisa la pantalla completa y proponme el cambio.
No programes hasta que yo apruebe.
```

## Para bug con evidencia

```text
Tengo este bug en el CRM: [descripcion].
Pasos: [paso 1], [paso 2], [paso 3].
Resultado actual: [lo que pasa].
Resultado esperado: [lo que debe pasar].
Investiga causa raiz antes de corregir. Si hace falta cambiar, agrega prueba y verifica.
```

Ejemplo:

```text
Tengo este bug en el CRM: el Excel de comparativa sale en varias hojas.
Pasos: Clientes > abrir cliente > Comparativas > Excel.
Resultado actual: descarga .xlsx con Plan Actual, Oferta y Resumen.
Resultado esperado: descarga una sola hoja tipo formulario.
Investiga causa raiz antes de corregir. Si hace falta cambiar, agrega prueba y verifica.
```

## Para deploy de frontend

```text
Despliega solo el frontend del CRM.
Haz backup remoto de frontend/app.html, sube el app.html local a produccion, no reinicies PM2 salvo que sea necesario, y verifica /api/health y el HTML publico.
```

## Para deploy de backend

```text
Despliega backend del CRM.
Antes dime exactamente que archivos cambian, si requiere migracion, backup o reinicio PM2.
No ejecutes migraciones sin mi autorizacion expresa.
```

## Para ofertas Claro

```text
En newcrm, para ofertas Claro, revisa primero las fuentes oficiales vigentes en docs/motor-ofertas y documentos-ofertas.
No uses HTML ni JS como fuente comercial.
Dime que aplica, que no aplica, contradicciones y propuesta antes de cambiar codigo.
```

## Para que Codex no asuma mal

Usar estas frases cuando aplique:

```text
No inventes datos; si falta fuente, dime que falta.
```

```text
No cambies base de datos.
```

```text
No despliegues todavia.
```

```text
Hazlo hasta produccion.
```

```text
Primero dime si esto pertenece al CRM principal, al constructor o al portal separado.
```

## Prompt corto recomendado

Este es el formato mas util para la mayoria de pedidos:

```text
En el CRM, [pantalla/ruta], [problema].
Quiero [resultado esperado].
Investiga el flujo real, cambia el archivo correcto, prueba y despliega para que lo vea en produccion.
No toques base de datos ni backend salvo que sea necesario.
```

