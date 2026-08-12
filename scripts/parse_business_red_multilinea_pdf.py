import json
import pathlib
import sys

import pdfplumber


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: parse_business_red_multilinea_pdf.py <pdf>")

    pdf_path = pathlib.Path(sys.argv[1])
    chunks = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, 1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            chunks.append(f"\n--- PAGE {index} ---\n{text}\n")

    payload = json.dumps({"pages": len(chunks), "text": "".join(chunks)}, ensure_ascii=False)
    sys.stdout.buffer.write(payload.encode("utf-8"))


if __name__ == "__main__":
    main()
