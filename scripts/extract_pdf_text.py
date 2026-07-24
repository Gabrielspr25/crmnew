#!/usr/bin/env python3
"""
extract_pdf_text.py  v1

Espejo fiel: extrae el TEXTO de un PDF con pdfplumber y lo devuelve tal cual,
pagina por pagina. NO interpreta montos, no parsea condiciones, no memoriza
nada del boletin. Solo entrega lo que el documento dice.

Uso:    python extract_pdf_text.py <ruta_pdf>
Salida: JSON por stdout:
{
  "ok": true,
  "paginas": [ { "n": 1, "texto": "..." }, ... ],
  "texto_completo": "....",
  "total_paginas": N
}
o { "ok": false, "error": "..." } ante fallo.
"""

import sys
import json


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "falta la ruta del PDF"}))
        return 1

    ruta = sys.argv[1]

    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "pdfplumber no instalado. Correr: pip install -r scripts/requirements.txt"
        }))
        return 1

    try:
        paginas = []
        partes = []
        with pdfplumber.open(ruta) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                # extraccion fiel del texto; sin capas de interpretacion
                texto = page.extract_text(x_tolerance=1.5, y_tolerance=3) or ""
                paginas.append({"n": i, "texto": texto})
                partes.append(texto)
        print(json.dumps({
            "ok": True,
            "paginas": paginas,
            "texto_completo": "\n\n".join(partes),
            "total_paginas": len(paginas),
        }, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001 - queremos reportar cualquier fallo como JSON
        print(json.dumps({"ok": False, "error": "no se pudo leer el PDF: " + str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
