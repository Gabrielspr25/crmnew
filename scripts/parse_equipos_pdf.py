#!/usr/bin/env python3
"""
parse_equipos_pdf.py  v2
Extrae la tabla de precios de equipos del boletín Inalámbrico/Claro Hogar.
Uso:   python3 parse_equipos_pdf.py <ruta_pdf>
Salida: JSON estructurado por stdout (compatible con contenido de planes_modulos)

Cambios v2:
  - Detección de sección desde texto de página (no solo dentro de filas de tabla)
  - Fallback por extract_words() para páginas con texto espaciado (12-15)
  - sections_map acumula equipos a través de varias páginas de la misma sección
"""

import sys
import json
import re
from collections import defaultdict

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber no instalado. Correr: pip install pdfplumber"}))
    sys.exit(1)


# ── Columnas ──────────────────────────────────────────────────────────────────
MAIN_COLS = [
    "item_code", "material_sap", "modelo",
    "precio_regular",
    "fin_12", "fin_24", "fin_30", "fin_36",
    "cle_09", "cle_14", "cle_19", "cle_29",
    "cle_39", "cle_49", "cle_59", "cle_69",
]
FIOF_COLS = ["item_code", "material_sap", "modelo", "precio_regular",
             "fin_12", "fin_24", "fin_30", "fin_36"]
FIGU_COLS = ["item_code", "material_sap", "modelo", "precio_regular",
             "fin_24", "fin_36"]

SECTION_KEYWORDS = {
    "claro_oficina":    ["modems claro oficina", "claro oficina"],
    "internet_on_the_go": ["mifi", "internet on the go", "internet onthe go", "on the go"],
    "iot_telemetria": ["iot/internet of things", "iot / internet of things", "internet of things"],
}

SKIP_HEADER_KW = [
    "item code", "material sap", "modelo", "dealer",
    "fiup12", "fiof12", "figu24", "cle09", "precio",
    "renta mensual", "r e n t a",
]


# ── Helpers ───────────────────────────────────────────────────────────────────
def parse_price(val):
    if val is None:
        return None
    s = str(val).strip().replace("$", "").replace(",", "").replace(" ", "")
    if not s or s == "-":
        return None
    try:
        f = float(s)
        return None if f == 0.0 else f
    except ValueError:
        return None


def row_to_equipo(cells, col_names):
    equipo = {}
    for i, col in enumerate(col_names):
        val = cells[i] if i < len(cells) else None
        if col in ("item_code", "material_sap", "modelo"):
            equipo[col] = str(val).strip() if val else None
        else:
            equipo[col] = parse_price(val)
    return equipo


def is_section_header(text, keywords):
    t = (text or "").lower()
    return any(kw in t for kw in keywords)


def is_price_row(cells):
    """True si la primera celda parece un Item Code (ej. '33578H' o '31670H')."""
    if not cells:
        return False
    first = str(cells[0] or "").strip()
    return bool(re.match(r"^\d{4,6}[A-Z]?$", first))


def detect_section_from_text(raw_text):
    """Devuelve la section_key si el texto de la página contiene un header de sección."""
    t = raw_text.lower()
    # Claro Oficina tiene prioridad si aparece junto a "modem"
    for kw in SECTION_KEYWORDS["claro_oficina"]:
        if kw in t:
            return "claro_oficina"
    for kw in SECTION_KEYWORDS["internet_on_the_go"]:
        if kw in t:
            return "internet_on_the_go"
    return None


def detect_document_sections(raw_texts):
    """Detecta las secciones comerciales del boletín, sin inventar contenido."""
    joined = "\n".join(raw_texts).lower()
    detected = []
    for key in ["internet_on_the_go", "claro_oficina", "iot_telemetria"]:
        if any(keyword in joined for keyword in SECTION_KEYWORDS[key]):
            detected.append(key)
    return detected


def normalize_spaced(text):
    """Convierte 'R e n t a   M e n s u a l' → 'Renta Mensual'."""
    # Palabras de 1 char separadas por 1 espacio → juntar, luego normalizar dobles espacios
    result = re.sub(r'(?<=[A-Za-z\d]) (?=[A-Za-z\d])', '', text)
    return re.sub(r' {2,}', ' ', result).strip()


def words_to_rows(words, y_tolerance=3):
    """
    Agrupa palabras de pdfplumber por línea (posición Y).
    Devuelve lista de listas de strings, ordenadas por X dentro de cada línea.
    """
    if not words:
        return []
    by_line = defaultdict(list)
    for w in words:
        y_key = round(w["top"] / y_tolerance) * y_tolerance
        by_line[y_key].append(w)
    rows = []
    for y_key in sorted(by_line):
        line_words = sorted(by_line[y_key], key=lambda w: w["x0"])
        rows.append([w["text"] for w in line_words])
    return rows


def parse_words_page(page, col_names):
    """
    Para páginas donde extract_tables() falla (texto espaciado).
    Usa extract_words() + agrupación por Y para reconstruir filas.
    """
    words = page.extract_words(x_tolerance=5, y_tolerance=3)
    rows = words_to_rows(words, y_tolerance=4)
    equipos = []
    notas_buffer = []

    for row_words in rows:
        if not row_words:
            continue
        row_text = " ".join(row_words)

        # Saltar encabezados
        if any(kw in row_text.lower() for kw in SKIP_HEADER_KW):
            continue

        # ¿Primera "celda" (palabra) es un item_code?
        if re.match(r"^\d{4,6}[A-Z]?$", row_words[0]):
            nota = notas_buffer[-1] if notas_buffer else None
            notas_buffer = []
            eq = row_to_equipo(row_words, col_names)
            if nota:
                eq["nota"] = nota
            equipos.append(eq)
        else:
            notas_buffer.append(row_text)

    return equipos


# ── Lógica principal ──────────────────────────────────────────────────────────
def extract_tables(pdf_path):
    result = {
        "secciones": [],
        "secciones_detectadas": [],
        "financiamiento_of": [],
        "financiamiento_gu": [],
        "ofertas_especiales": [],
    }

    # Acumular equipos por sección a través de páginas
    sections_map = {
        "claro_oficina":      {"key": "claro_oficina",      "titulo": "Modems Claro Oficina",        "equipos": []},
        "internet_on_the_go": {"key": "internet_on_the_go", "titulo": "MiFi's Internet On The Go",   "equipos": []},
    }

    current_section_key = None
    in_fiof = False
    in_figu = False

    with pdfplumber.open(pdf_path) as pdf:
        all_texts = []
        for page_num, page in enumerate(pdf.pages):
            raw_text = page.extract_text() or ""
            all_texts.append(raw_text)
            raw_lower = raw_text.lower()

            # ── Ofertas especiales ────────────────────────────────────────────
            if "oferta" in raw_lower and "especial" in raw_lower:
                oe = parse_ofertas_especiales(raw_text)
                if oe:
                    result["ofertas_especiales"] = oe

            # ── Detectar sección desde texto de página ────────────────────────
            detected = detect_section_from_text(raw_text)
            if detected:
                current_section_key = detected
                in_fiof = False
                in_figu = False

            # ── Detectar FIOF / FIGU desde texto de página ────────────────────
            if "fiof" in raw_lower and not in_fiof:
                in_fiof = True
                in_figu = False
                # No reseteamos current_section_key: las tablas FIOF pertenecen a la sección activa
            if "figu" in raw_lower and not in_figu:
                in_figu = True
                in_fiof = False

            # ── Procesar tablas extraíbles ────────────────────────────────────
            tables = page.extract_tables()
            has_useful_table = False

            for table in tables:
                if not table:
                    continue
                notas_buffer = []

                for row in table:
                    if not row or all(c is None or str(c).strip() == "" for c in row):
                        continue
                    row_text = " ".join(str(c or "") for c in row).strip()

                    # Detectar sección dentro de tabla (fallback)
                    if is_section_header(row_text, SECTION_KEYWORDS["claro_oficina"]):
                        current_section_key = "claro_oficina"
                        in_fiof = in_figu = False
                        continue
                    if is_section_header(row_text, SECTION_KEYWORDS["internet_on_the_go"]):
                        current_section_key = "internet_on_the_go"
                        in_fiof = in_figu = False
                        continue

                    # Detectar FIOF/FIGU dentro de tabla
                    if "fiof" in row_text.lower() and not is_price_row(row):
                        in_fiof = True; in_figu = False; continue
                    if "figu" in row_text.lower() and not is_price_row(row):
                        in_figu = True; in_fiof = False; continue

                    # Saltar encabezados de columna
                    if any(kw in row_text.lower() for kw in SKIP_HEADER_KW):
                        continue

                    if not is_price_row(row):
                        notas_buffer.append(row_text)
                        continue

                    has_useful_table = True
                    nota = notas_buffer[-1] if notas_buffer else None
                    notas_buffer = []

                    if in_figu:
                        eq = row_to_equipo(row, FIGU_COLS)
                        if nota: eq["nota"] = nota
                        result["financiamiento_gu"].append(eq)
                    elif in_fiof:
                        eq = row_to_equipo(row, FIOF_COLS)
                        if nota: eq["nota"] = nota
                        result["financiamiento_of"].append(eq)
                    elif current_section_key:
                        eq = row_to_equipo(row, MAIN_COLS)
                        sections_map[current_section_key]["equipos"].append(eq)

            # ── Fallback: páginas con texto espaciado (sin tablas útiles) ─────
            if not has_useful_table and current_section_key and not in_fiof and not in_figu:
                text_equipos = parse_words_page(page, MAIN_COLS)
                if text_equipos:
                    sections_map[current_section_key]["equipos"].extend(text_equipos)

        result["secciones_detectadas"] = detect_document_sections(all_texts)

    # ── Armar resultado final en orden ────────────────────────────────────────
    for key in ["claro_oficina", "internet_on_the_go"]:
        sec = sections_map[key]
        if sec["equipos"]:
            result["secciones"].append(sec)

    return result


# ── Ofertas especiales ────────────────────────────────────────────────────────
def parse_ofertas_especiales(text):
    ofertas = []
    lines = text.split("\n")
    current = None

    for line in lines:
        line = line.strip()
        m = re.match(r"^(\d)\.\s+(.+)", line)
        if m:
            if current:
                ofertas.append(current)
            current = {"num": m.group(1), "modelo": m.group(2).strip(), "detalles": []}
            continue
        m2 = re.match(r"^[a-d]\)\s+(.+)", line)
        if m2 and current:
            current["detalles"].append(m2.group(1).strip())

    if current:
        ofertas.append(current)

    return ofertas


# ── Entrypoint ────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: python3 parse_equipos_pdf.py <ruta_pdf>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    try:
        data = extract_tables(pdf_path)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except FileNotFoundError:
        print(json.dumps({"error": f"Archivo no encontrado: {pdf_path}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
