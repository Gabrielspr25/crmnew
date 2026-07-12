# Migracion del portal de ofertas a newcrm

Fecha: 2026-06-30

## Decision

`newcrm` queda como la base principal para continuar el trabajo del portal y la CRM.
`VentasProui` queda como fuente vieja de referencia y no debe ser el lugar donde se siga construyendo.

## Carpeta migrada

Origen:

`C:\Users\Gabriel\Documentos\Programas\VentasProui\Planes para web`

Destino:

`C:\Users\Gabriel\Documentos\Programas\newcrm\Planes para web`

## Resultado verificado

- Archivos en origen antes de copiar: 39
- Archivos en destino despues de copiar: 40
- La diferencia es `servicios.html`, creado en `newcrm` para el nuevo tab publico de servicios.
- La carpeta `servicios/` con las imagenes PNG quedo dentro de `newcrm\Planes para web`.

## Paginas principales presentes en newcrm

- `Planes para web/index.html`
- `Planes para web/movil.html`
- `Planes para web/banda-ancha.html`
- `Planes para web/equipos.html`
- `Planes para web/ofertas.html`
- `Planes para web/servicios.html`

## Navegacion verificada

Estas paginas tienen enlace hacia `servicios.html`:

- `index.html`
- `movil.html`
- `banda-ancha.html`
- `equipos.html`
- `ofertas.html`
- `servicios.html`

## Servicios y assets

Las imagenes descargables estan en:

`Planes para web/servicios/`

Tambien existe una copia para uso interno de la CRM en:

`frontend/img/servicios/`

## Pendiente antes de deploy publico

1. Verificar `Planes para web/servicios.html` localmente.
2. Confirmar que el deploy del portal use `newcrm` como fuente.
3. Subir al destino remoto seguro:

`/opt/claro-ofertas/public-ofertas`

4. Verificar en:

`https://ofertas.ss-group.cloud/servicios.html`

