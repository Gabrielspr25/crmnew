# Documentacion existente - VentasProui

Fecha de consolidacion: 2026-06-23

Esta carpeta es una copia de rescate de la documentacion encontrada en el
checkout actual de `VentasProui`. No mueve, elimina ni modifica los archivos
originales del sistema.

## Estructura

- `originales/`: copia preservando rutas relativas de los archivos `.md`,
  `.txt`, `.pdf`, `.docx` y `.xlsx` encontrados en el repo.
- `MANIFEST_DOCUMENTACION_EXISTENTE.csv`: inventario generado con ruta,
  extension, tamano y fecha de modificacion de cada archivo copiado.
- `INDICE_OPERATIVO.md`: mapa rapido de los documentos y temas principales.
- `FUENTES_DE_VERDAD_CONFIRMADAS.md`: reglas confirmadas del proyecto y rutas
  fuente.
- `LOGICA_BAN_SUSCRIPTORES_CLIENTES.md`: logica real verificada para BAN,
  suscriptores, clientes activos/cancelados y paste-sync.

## Regla base

Produccion usa `server-FINAL.js`, pero este archivo monta rutas modulares. Para
suscriptores, el entrypoint productivo importa `src/backend/routes/subscriberRoutes.js`,
y esa ruta llama `src/backend/controllers/subscriberController.js`.

## Preguntas necesarias

Para empezar no hizo falta preguntarte nada. Asumi:

- Carpeta destino: `DOCUMENTACION_EXISTENTE`.
- Copiar documentacion existente sin borrar originales.
- Documentar la logica confirmada por codigo, no por memoria ni por supuestos.

La unica pregunta que queda para despues es si quieres que esta carpeta se
convierta en paquete externo, por ejemplo un `.zip`, o si la dejamos solo en el
repo.
