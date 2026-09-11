#!/usr/bin/env python3
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber no instalado"}))
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: extract_pdf_text.py <ruta_pdf>"}))
        sys.exit(1)

    pages = []
    try:
        with pdfplumber.open(sys.argv[1]) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                pages.append({"page": index, "text": text})
    except Exception as error:
        print(json.dumps({"error": f"Error al extraer PDF: {error}"}))
        sys.exit(1)

    joined = "\n".join(f"===== PAGE {page['page']} =====\n{page['text']}" for page in pages)
    print(json.dumps({"pages": len(pages), "text": joined}, ensure_ascii=False))


if __name__ == "__main__":
    main()
