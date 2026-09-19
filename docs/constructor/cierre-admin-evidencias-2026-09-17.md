# Cierre local de Admin: evidencia

Fecha: 2026-09-17. Registro unico de seguimiento:
`plan-maestro-constructor.json -> closure_checklist`. El Markdown ejecutivo se
genera desde ese JSON; este informe conserva pruebas y decisiones, no otra lista
de estados. Se mantienen los paneles y rutas existentes, sin reconstruccion del
Constructor, despliegue ni publicacion comercial.

## Implementacion prevista

1. Agregar una tabla compacta al panel Tareas y reglas Admin, con lectura del
   checklist del Plan mediante un endpoint Admin de solo lectura. El servicio
   valida ambiente, evidencia y fecha antes de rotular un punto comprobado.
2. Comprobar la carga desde el selector de Chrome contra una instancia loopback
   limitada al hash del PDF oficial Fijo/TV. Nunca sustituir esta prueba por API.
3. Contrastar las ocho diferencias de TV con snapshots y originales; presentar
   los registros y causa sin autorizar bajas por ausencia.
4. Conectar el analisis conjunto de Ofertas a archivo/hash, parsers y preview
   existentes. No convertir extraccion ni advertencias en aprobacion comercial.
5. Reproducir fallo de segunda categoria, corregir atomicidad e idempotencia sin
   migraciones y probar conservacion de publicaciones e historial.
6. Actualizar cada punto del JSON solo con su comprobacion y ambiente reales;
   ejecutar generador, pruebas dirigidas y capturar el checklist.

Pruebas con `node:test`, fixtures y dobles de BD para los fallos; cualquier
prueba de escritura real se limita a borradores/documentos en BD local y deja
las publicaciones anteriores intactas. La prueba productiva queda fuera de
esta autorizacion. No se reabre PM-021 ni se fusionan REDPLUS y BREDP1.

## Selector de Chrome

Primer intento en este cierre: abrir `filechooser` desde el boton Choose File
en Admin Ofertas / Claro TV, Chrome, `http://127.0.0.1:4174`. Seleccion del PDF:
`Planes para web/Estructura de planes/planes/LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf`.

El selector se abre, pero `setFiles` devuelve `Not allowed`. No se selecciono
ni cargo el archivo y no se ejecuto la API como sustituto. Se solicito a Gabriel
habilitar el permiso de acceso a URLs de archivo de la extension. No se cambio
ningun permiso de Chrome automaticamente.
