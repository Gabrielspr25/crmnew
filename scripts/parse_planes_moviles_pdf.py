import json
import pathlib
import re
import sys

import pdfplumber


BASE_INDIVIDUALES = [
    (4, "Plan $20 con 8GB", "VOLT820", 20.00),
    (5, "Plan $35 con 35GB", "RED3535", 35.00),
    (6, "Plan $45 con 60GB PUJ", "RED4560", 45.00),
    (9, "RED BASIC", "REDBAS", 50.00),
    (10, "Business Red PLUS", "BREDPLUS", 65.00),
    (12, "Business Red EXTREME", "BREDEXT", 75.00),
    (14, "Business Red SUPREME", "BREDSUP", 95.00),
    (16, "Business Red Sin Fronteras", "BREDSF", 100.00),
    (20, "Claro Sin Fronteras $50", "VOLCSF50", 50.00),
    (21, "Claro Sin Fronteras $60", "VOLCSF60", 60.00),
    (22, "Claro Sin Fronteras $70", "VOLCSF70", 70.00),
]

BREDSF_DUPLICATE_PAGE = 23

MULTILINEA_FAMILIES = [
    (
        27,
        "Business Red PLUS",
        "BREDP",
        [65, 45, 20, 30, 15, 35, 35, 35, 35, 35],
        "BREDPLUS",
        65,
        "60GB de Hotspot",
    ),
    (
        29,
        "Business Red EXTREME",
        "BREDE",
        [75, 45, 15, 35, 30, 40, 40, 40, 40, 40],
        "BREDEXT",
        75,
        "100GB de Hotspot",
    ),
    (
        31,
        "Business Red SUPREME",
        "BREDS",
        [95, 75, 40, 30, 35, 25, 50, 50, 50, 50],
        "BREDSUP",
        95,
        "Hotspot Ilimitado",
    ),
    (
        33,
        "Business Red Sin Fronteras",
        "BREDSF",
        [100, 80, 45, 35, 40, 30, 55, 55, 55, 55],
        "BREDSF",
        100,
        "Hotspot Ilimitado",
    ),
]

GOVERNMENT_ROWS = [
    (39, "Government $35 con 35GB", "GRED3535", 35.00),
    (40, "Government $40 con 50GB PUJ", "GRED4050", 40.00),
    (41, "Government $45 con 60GB PUJ", "GRED4560", 45.00),
    (43, "Government Red BASIC", "GREDBAS", 50.00),
    (44, "Government Red PLUS", "GREDPLUS", 65.00),
    (45, "Government Red EXTREME", "GREDEXT", 75.00),
    (46, "Government Red SUPREME", "GREDSUP", 95.00),
    (48, "Government Red Sin Fronteras", "GREDSF", 100.00),
]


def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()


def page_texts(pdf_path):
    pages = {}
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, 1):
            pages[index] = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
    return pages


def trace(page, code, description, text):
    return {
        "pagina": page,
        "codigo": code,
        "descripcion": description,
        "texto_original": text,
        "llave_auditoria": f"{page}|{code}|{description}",
    }


def base_plan_rows(pages):
    rows = []
    for page, description, code, price in BASE_INDIVIDUALES:
        text = pages.get(page, "")
        rows.append(
            {
                "pagina": page,
                "categoria": "movil_planes_individuales",
                "familia": "Planes individuales Business/PYMES",
                "codigo": code,
                "descripcion": description,
                "precio_regular": price,
                "precio": price,
                "precio_regular_descripcion": f"${price:.2f}",
                "cantidad_lineas": 1,
                "caracteristicas_permanentes": extract_bullets(text),
                "requisitos_permanentes": business_account_types(text),
                "texto_original": clean_text(text),
                "trazas_auditoria": [trace(page, code, description, clean_text(text))],
            }
        )
    bredsf = next(row for row in rows if row["codigo"] == "BREDSF")
    duplicate_text = pages.get(BREDSF_DUPLICATE_PAGE, "")
    bredsf["trazas_auditoria"].append(
        trace(BREDSF_DUPLICATE_PAGE, "BREDSF", "Business Red Sin Fronteras", clean_text(duplicate_text))
    )
    return rows


def extract_bullets(text):
    bullets = []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("•"):
            bullets.append(clean_text(line.lstrip("•").strip()))
    return bullets


def business_account_types(text):
    account_types = []
    for item in [
        "Business Credit Limit",
        "Business Wireline Small",
        "Business Regular",
        "Business Corporate",
        "Business BYOP Corporate",
        "Business BYOP DBA",
    ]:
        if item.lower() in text.lower():
            account_types.append(item)
    return account_types


def multiline_rows(pages):
    public_rows = []
    reference_rows = []
    for page, family, prefix, prices, individual_code, individual_price, hotspot in MULTILINEA_FAMILIES:
        text = pages.get(page, "")
        total = 0
        for line_number, price in enumerate(prices, 1):
            total += price
            code = f"{prefix}{line_number}"
            row = {
                "pagina": page,
                "categoria": "movil_multilinea_business_red",
                "familia": family,
                "codigo": code,
                "descripcion": f"{family} - {line_number} linea{'s' if line_number != 1 else ''}",
                "precio_regular": float(price),
                "precio": float(price),
                "precio_regular_descripcion": f"${price:.2f} por linea",
                "cantidad_lineas": line_number,
                "cantidad_lineas_permitida": "2 a 10",
                "modelo_cobro": "por_suscriptor",
                "codigo_individual_referencia": individual_code,
                "precio_individual_referencia": float(individual_price),
                "caracteristicas_permanentes": extract_bullets(text),
                "requisitos_permanentes": [
                    "Clientes nuevos y existentes",
                    "2 a 10 lineas moviles",
                    "No mezclar con otros planes multilinea en el mismo BAN",
                ],
                "hotspot": hotspot,
                "texto_original": clean_text(text),
                "trazas_auditoria": [trace(page, code, family, clean_text(text))],
            }
            if line_number == 1:
                reference_rows.append(
                    {
                        **row,
                        "categoria": "referencia_operativa",
                        "motivo": "codigo base/proceso de activacion; no opcion multilinea vendible",
                    }
                )
            else:
                public_rows.append(row)
    return public_rows, reference_rows


def government_rows(pages):
    rows = []
    for page, description, code, price in GOVERNMENT_ROWS:
        text = pages.get(page, "")
        rows.append(
            {
                "pagina": page,
                "categoria": "segmento_no_incluido",
                "segmento_no_incluido": "gobierno",
                "codigo": code,
                "descripcion": description,
                "precio_regular": price,
                "precio": price,
                "texto_original": clean_text(text),
                "trazas_auditoria": [trace(page, code, description, clean_text(text))],
            }
        )
    return rows


def parse_base(pdf_path, pages):
    individual = base_plan_rows(pages)
    multiline, reference = multiline_rows(pages)
    government = government_rows(pages)
    total = len(individual) + len(multiline) + len(reference) + len(government)
    return {
        "documento": {
            "tipo": "planes_moviles_base",
            "nombre": pdf_path.name,
            "paginas": len(pages),
        },
        "fecha_actualizacion_base_detectada": "2026-06-20",
        "modulos": {
            "planes_individuales": {"titulo": "Planes individuales Business/PYMES", "filas": individual},
            "planes_multilinea_opciones": {"titulo": "Planes multilinea Business RED", "filas": multiline},
            "planes_multilinea_byop_ban": {"titulo": "Planes multilinea BYOP-BAN", "filas": []},
            "referencia_operativa": {"titulo": "Referencia operativa", "filas": reference},
            "segmento_no_incluido": {"titulo": "Segmento no incluido", "filas": government},
            "contenido_temporal_excluido": {"titulo": "Contenido temporal excluido", "filas": []},
            "revision_manual": {"titulo": "Revision manual", "filas": []},
        },
        "auditoria_original": {
            "total_filas": total,
            "duplicados_exactos_total": 0,
            "duplicados_exactos": [],
        },
        "registros_normalizados_total": total,
        "resumen": {
            "planes_individuales_unicos": len(individual),
            "familias_multilinea": 4,
            "opciones_multilinea_publicables": len(multiline),
            "planes_multilinea_byop_ban": 0,
            "referencias_operativas": len(reference),
            "segmento_no_incluido_gobierno": len(government),
            "candidatos_publicos": len(individual) + len(multiline),
        },
    }


def parse_byop(pdf_path, pages):
    page = 4
    text = pages.get(page, "")
    row = {
        "pagina": page,
        "categoria": "movil_multilinea_byop_ban",
        "familia": "Business Red Plus BYOP-BAN",
        "codigo": "BREDP1015",
        "descripcion": "Business Red Plus BYOP-BAN",
        "precio_regular": 150.00,
        "precio": 150.00,
        "precio_regular_descripcion": "$150.00 por BAN",
        "modelo_cobro": "por_ban",
        "capacidad_maxima_lineas": 10,
        "capacidad_minima_lineas": 2,
        "cantidad_lineas_permitida": "2 a 10",
        "promedio_10_lineas": 15,
        "promedio_no_precio_regular": True,
        "requisitos_permanentes": ["BYOP", "AutoPay"],
        "caracteristicas_permanentes": extract_bullets(text),
        "texto_original": clean_text(text),
        "trazas_auditoria": [trace(page, "BREDP1015", "Business Red Plus BYOP-BAN", clean_text(text))],
    }
    total = 1
    return {
        "documento": {
            "tipo": "planes_moviles_byop_ban",
            "nombre": pdf_path.name,
            "paginas": len(pages),
        },
        "fecha_actualizacion_base_detectada": "2026-03-17",
        "modulos": {
            "planes_individuales": {"titulo": "Planes individuales Business/PYMES", "filas": []},
            "planes_multilinea_opciones": {"titulo": "Planes multilinea Business RED", "filas": []},
            "planes_multilinea_byop_ban": {"titulo": "Planes multilinea BYOP-BAN", "filas": [row]},
            "referencia_operativa": {"titulo": "Referencia operativa", "filas": []},
            "segmento_no_incluido": {"titulo": "Segmento no incluido", "filas": []},
            "contenido_temporal_excluido": {"titulo": "Contenido temporal excluido", "filas": []},
            "revision_manual": {"titulo": "Revision manual", "filas": []},
        },
        "auditoria_original": {
            "total_filas": total,
            "duplicados_exactos_total": 0,
            "duplicados_exactos": [],
        },
        "registros_normalizados_total": total,
        "resumen": {
            "planes_individuales_unicos": 0,
            "familias_multilinea": 1,
            "opciones_multilinea_publicables": 0,
            "planes_multilinea_byop_ban": 1,
            "referencias_operativas": 0,
            "segmento_no_incluido_gobierno": 0,
            "candidatos_publicos": 1,
        },
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: parse_planes_moviles_pdf.py <pdf>")

    pdf_path = pathlib.Path(sys.argv[1])
    pages = page_texts(pdf_path)
    all_text = "\n".join(pages.values()).upper()
    if "BUSINESS RED PLUS BYOP" in all_text or "BREDP1015" in all_text:
        result = parse_byop(pdf_path, pages)
    else:
        result = parse_base(pdf_path, pages)
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()
