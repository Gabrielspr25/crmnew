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

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

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
        # "$0.00" escrito en el documento es un precio (equipo o financiamiento gratis), no un dato faltante.
        # Solo la celda vacia o "-" significan que no hay precio.
        return float(s)
    except ValueError:
        return None


def money_tokens(text):
    return [parse_price(token) for token in re.findall(r"\$\s*[\d,]+(?:\.\d+)?", text or "")]


def row_to_equipo(cells, col_names):
    equipo = {}
    for i, col in enumerate(col_names):
        val = cells[i] if i < len(cells) else None
        if col in ("item_code", "material_sap", "modelo"):
            equipo[col] = str(val).strip() if val else None
        else:
            equipo[col] = parse_price(val)
    return equipo


def normalize_model(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    compact = re.sub(r"[^a-z0-9]+", "", text.lower())
    if compact == "senseconnectsc421":
        return "Sense Connect SC421"
    if re.search(r"\brt\s*410\b|\brt410\b", text, re.I):
        return "Franklin RT 410"
    if re.search(r"\bcg\s*890\b|\bcg890\b|jexstream\s*cg890", text, re.I):
        return "Franklin CG890"
    if re.search(r"\brg\s*2100\b|\brg2100\b|jexstream\s*rg\s*2100", text, re.I):
        return "Franklin JEXstream RG2100 5G"
    return text


def normalize_product(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    folded = text.lower().replace("onthego", "on the go")
    if "internet on the go" in folded:
        return "Internet On The Go"
    if "claro oficina" in folded:
        return "Claro Oficina"
    if "claro hogar" in folded:
        return "Claro Hogar"
    return text


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


def parse_main_equipment_lines(text):
    parsed = {"claro_oficina": [], "internet_on_the_go": []}
    current_section = None
    for raw_line in (text or "").split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        lower = line.lower()
        if is_section_header(line, SECTION_KEYWORDS["claro_oficina"]):
            current_section = "claro_oficina"
            continue
        if is_section_header(line, SECTION_KEYWORDS["internet_on_the_go"]):
            current_section = "internet_on_the_go"
            continue
        if not current_section:
            continue
        match = re.match(r"^(\d{4,6}[A-Z]?)\s+(\d+)\s+(.+?)\s+((?:\$\s*[\d,]+(?:\.\d+)?\s*){5,})(.*)$", line)
        if not match:
            continue
        amounts = money_tokens(match.group(4))
        if len(amounts) < 5:
            continue
        extra_note = match.group(5).strip()
        equipo = {
            "item_code": match.group(1),
            "material_sap": match.group(2),
            "modelo": normalize_model(match.group(3)),
            "precio_regular": amounts[0],
            "fin_12": amounts[1],
            "fin_24": amounts[2],
            "fin_30": amounts[3],
            "fin_36": amounts[4],
        }
        for idx, col in enumerate(MAIN_COLS[8:], start=5):
            equipo[col] = amounts[idx] if idx < len(amounts) else None
        if extra_note:
            equipo["nota"] = extra_note
        parsed[current_section].append(equipo)
    return parsed


def parse_financing_line(line, mode):
    match = re.match(r"^(\d{4,6}[A-Z]?)\s+(\d+)\s+(.+?)\s+((?:\$\s*[\d,]+(?:\.\d+)?\s*)+)(.*)$", line.strip())
    if not match:
        return None
    amounts = money_tokens(match.group(4))
    if mode == "fiof" and len(amounts) < 4:
        return None
    if mode == "figu" and len(amounts) < 2:
        return None
    base = {
        "item_code": match.group(1),
        "material_sap": match.group(2),
        "modelo": normalize_model(match.group(3)),
        "precio_regular": amounts[0],
    }
    note = match.group(5).strip()
    if note:
        base["nota"] = note
    if mode == "fiof":
        base.update({"fin_12": amounts[1], "fin_24": amounts[2], "fin_30": amounts[3], "fin_36": amounts[4] if len(amounts) > 4 else None})
    else:
        base.update({"fin_24": amounts[1], "fin_36": amounts[2] if len(amounts) > 2 else None})
    return base


def parse_special_financing_tables(text):
    parsed = {"fiof": [], "figu": []}
    mode = None
    compact_text = re.sub(r"\s+", " ", text or "")
    fiof_note = re.search(r"(\$\s*[\d,]+(?:\.\d+)?)\s+G\s*ratis\s+si\s+el\s+plan", compact_text, re.I)
    figu_note = re.search(r"(\$\s*[\d,]+(?:\.\d+)?)\s+O\s*ferta\s+Convergente", compact_text, re.I)
    for raw_line in (text or "").split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        lower = line.lower()
        compact = re.sub(r"[^a-z0-9]", "", lower)
        if "bfpre" in compact and "fiof" in compact:
            mode = "fiof"
            continue
        if "bfpre" in compact and "figu" in compact:
            mode = "figu"
            continue
        if mode and re.match(r"^\d{4,6}[A-Z]?\s+\d+\s+", line):
            item = parse_financing_line(line, mode)
            if item:
                if (
                    mode == "fiof"
                    and item.get("item_code") == "32788H"
                    and item.get("material_sap") == "7010844"
                    and item.get("precio_regular") == 99.99
                    and fiof_note
                ):
                    item["fin_36"] = parse_price(fiof_note.group(1))
                    item["nota"] = "Gratis si el plan es $30 o mas utilizando este price code"
                if (
                    mode == "figu"
                    and item.get("item_code") == "32788H"
                    and item.get("material_sap") == "7010844"
                    and item.get("precio_regular") == 41.99
                    and figu_note
                ):
                    item["fin_36"] = parse_price(figu_note.group(1))
                    item["nota"] = "Oferta Convergente en planes menores de $30"
                parsed[mode].append(item)
    return parsed


def dedupe_equipment(rows):
    seen = set()
    clean = []
    for item in rows:
        key = (item.get("item_code"), item.get("material_sap"), item.get("modelo"), item.get("precio_regular"), item.get("nota"))
        if key in seen:
            continue
        seen.add(key)
        clean.append(item)
    return clean


def prefer_complete_equipment(rows):
    by_identity = defaultdict(list)
    for item in rows:
        key = (item.get("item_code"), item.get("material_sap"))
        by_identity[key].append(item)

    preferred = []
    for group in by_identity.values():
        complete = [
            item for item in group
            if item.get("precio_regular") is not None
            and len(str(item.get("modelo") or "").split()) > 1
        ]
        if not complete:
            preferred.extend(group)
            continue
        for item in group:
            malformed_same_equipment = (
                item.get("precio_regular") is None
                or len(str(item.get("modelo") or "").split()) <= 1
            )
            if malformed_same_equipment:
                continue
            preferred.append(item)
    return dedupe_equipment(preferred)


def drop_malformed_rows_with_complete_match(sections_map):
    complete_keys = set()
    for section in sections_map.values():
        for item in section.get("equipos") or []:
            if item.get("precio_regular") is not None and len(str(item.get("modelo") or "").split()) > 1:
                complete_keys.add((item.get("item_code"), item.get("material_sap")))
    if not complete_keys:
        return
    for section in sections_map.values():
        clean = []
        for item in section.get("equipos") or []:
            key = (item.get("item_code"), item.get("material_sap"))
            malformed = item.get("precio_regular") is None or len(str(item.get("modelo") or "").split()) <= 1
            if key in complete_keys and malformed:
                continue
            clean.append(item)
        section["equipos"] = clean


# ── Lógica principal ──────────────────────────────────────────────────────────
def extract_tables(pdf_path):
    result = {
        "secciones": [],
        "secciones_detectadas": [],
        "financiamiento_of": [],
        "financiamiento_gu": [],
        "ofertas_especiales": [],
        "ofertas_especiales_normalizadas": [],
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
                    result["ofertas_especiales_normalizadas"] = parse_ofertas_especiales_normalizadas(oe, page_num + 1)

            financing = parse_special_financing_tables(raw_text)
            result["financiamiento_of"].extend(financing["fiof"])
            result["financiamiento_gu"].extend(financing["figu"])
            text_equipment = parse_main_equipment_lines(raw_text)
            for section_key, rows in text_equipment.items():
                sections_map[section_key]["equipos"].extend(rows)

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
                table_text = "\n".join(" ".join(str(c or "") for c in row) for row in table if row)
                table_financing = parse_special_financing_tables(table_text)
                result["financiamiento_of"].extend(table_financing["fiof"])
                result["financiamiento_gu"].extend(table_financing["figu"])

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
        result["financiamiento_of"] = dedupe_equipment(result["financiamiento_of"])
        result["financiamiento_gu"] = dedupe_equipment(result["financiamiento_gu"])

    drop_malformed_rows_with_complete_match(sections_map)

    # ── Armar resultado final en orden ────────────────────────────────────────
    for key in ["claro_oficina", "internet_on_the_go"]:
        sec = sections_map[key]
        if sec["equipos"]:
            sec["equipos"] = prefer_complete_equipment(sec["equipos"])
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


def parse_oferta_detalle(modelo, detalle, pagina_pdf, inherited_product=None):
    text = re.sub(r"\s+", " ", detalle or "").strip()
    product_part = text.split(":", 1)[0] if ":" in text else ""
    producto = normalize_product(product_part) or inherited_product or ""
    amounts = money_tokens(text)
    is_free = bool(re.search(r"\bgratis\b", text, re.I))
    plan_min = None
    plan_exact = None
    min_match = re.search(r"(?:plan|planes)\s+desde\s+\$?\s*(\d+(?:\.\d+)?)", text, re.I)
    exact_match = re.search(r"plan\s+de\s+\$?\s*(\d+(?:\.\d+)?)", text, re.I)
    lower_than_match = re.search(r"planes\s+menores\s+de\s+\$?\s*(\d+(?:\.\d+)?)", text, re.I)
    if min_match:
        plan_min = float(min_match.group(1))
    elif exact_match:
        plan_exact = float(exact_match.group(1))
    plazos = [int(value) for value in re.findall(r"(\d+)\s*(?:o\s*\d+\s*)?plazos", text, re.I)]
    for first, second in re.findall(r"(\d+)\s*o\s*(\d+)\s*plazos", text, re.I):
        plazos.extend([int(first), int(second)])
    plazos = sorted(set(plazos))
    codes = sorted(set(re.findall(r"\b(?:FIOF|FIGU|FIUP)\b", text, re.I)), key=str.upper)
    price = 0 if is_free else (amounts[0] if amounts else None)
    return {
        "equipo": normalize_model(modelo),
        "producto": producto,
        "precio_oferta": price,
        "pago_mensual": amounts[-1] if re.search(r"paga\s+\$", text, re.I) and amounts else None,
        "plazo_meses": plazos,
        "plan_minimo": plan_min,
        "plan_exacto": plan_exact,
        "plan_maximo_exclusivo": float(lower_than_match.group(1)) if lower_than_match else None,
        "convergente": True if re.search(r"\bconvergente\b", text, re.I) else None,
        "codigos": [code.upper() for code in codes],
        "detalle": text,
        "pagina_pdf": pagina_pdf,
    }


def parse_ofertas_especiales_normalizadas(ofertas, pagina_pdf):
    normalized = []
    for oferta in ofertas or []:
        last_product = None
        for detalle in oferta.get("detalles") or []:
            parsed = parse_oferta_detalle(oferta.get("modelo"), detalle, pagina_pdf, last_product)
            if parsed.get("producto"):
                last_product = parsed["producto"]
            normalized.append(parsed)
    return normalized


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
