#!/usr/bin/env python3
"""
parse_planes_fijos_pdf.py  v1
Extrae el LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS (planes fijos) y lo convierte
al formato de `contenido` de planes_modulos (página: fijos).

Uso:    python3 parse_planes_fijos_pdf.py <ruta_pdf>
Salida: JSON por stdout:
{
  "tipo": "planes_fijos",
  "rev": "03.31.2026",
  "version_doc": 15,
  "modulos": {
     "<seccion>": { "titulo": "...", "filas": [ {codigo, descripcion, alfa_code,
                     tecnologia, precio, ...extras}, ... ] }
  },
  "no_publicados": { ... }   # equipos TV, verticales, contratos (sin módulo en portal)
}

Las claves de fila codigo/descripcion/alfa_code/tecnologia/precio coinciden con lo
que renderiza el frontend (index.html). Los campos extra (minuto_adicional,
instalacion, activacion, penalidad) se conservan para uso futuro; el frontend los ignora.
"""

import sys
import json
import re

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber no instalado. Correr: pip install pdfplumber"}))
    sys.exit(1)


# ── Secciones del portal (página fijos) ──────────────────────────────────────
SECCIONES = {
    "telefonia_medida":    "Telefonía Medida",
    "telefonia_ilimitada": "Telefonía Ilimitada",
    "2play":               "2Play — Internet + Voz",
    "television":          "Televisión",
    "complementos":        "Complementos y Valores Agregados",
}

# Códigos que NO se publican en el portal (equipos TV, verticales, contratos)
CODIGOS_NO_PUBLICADOS = {
    "40942H", "80105H", "40941H", "NPVR250", "80184H",
    "2633", "2635", "7240", "7241", "3254", "3255",
    "9925", "9926", "9927", "9938", "3337",
}

MONEY = r"\$?-?\d{1,4}(?:,\d{3})?\.\d{2}"
TECNOS = ["COBRE/VRAD/GPON", "VRAD/GPON", "COBRE/VRAD", "GPON", "COBRE", "VRAD"]


def parse_precio(tok):
    """'$19.99'→19.99 · '$0.00'→0 · 'GRATIS'→0 · '-8%'/'OTC'→string · None si no aplica."""
    if tok is None:
        return None
    t = str(tok).strip().upper()
    if t in ("GRATIS", "FREE"):
        return 0
    if t in ("OTC", "-"):
        return t if t == "OTC" else None
    if t.endswith("%"):
        return t
    t = t.replace("$", "").replace(",", "")
    try:
        v = float(t)
        return 0 if v == 0 else v
    except ValueError:
        return None


def clasificar(codigo, descripcion):
    """Asigna sección del portal según contenido de la fila (robusto al orden de extracción)."""
    d = descripcion.upper()
    c = codigo.upper()

    if c in CODIGOS_NO_PUBLICADOS:
        return None  # no publicado
    if "VERT" in d and "PACK" not in d:
        return None
    if "CONTRATO DE 1" in d or "CONTRATO DE 2" in d or "NO CONTRATO" in d:
        return None
    if "STB" in d or "DONGLE" in d or "CONTROL REMOTO" in d or "DVR" in d or "BEACON" in d:
        return None

    if re.search(r"\bMED\b", d) or "MEDIDO" in d:
        return "telefonia_medida"
    if c.startswith(("PY2", "IP2")) or "CLAROTV" in d:
        return "television"
    if c in ("REAKNG", "IPLYB") or "PLAYBOY" in d or "REALITY KING" in d:
        return "television"
    if "2PLAY" in d or "2 PLAY" in d:
        return "2play"
    if re.search(r"(PRUS|PR/US)\s+ILIM\s*\+", d) or re.search(r"\+\s*(PRUS|PR/US)\s+ILIM", d):
        return "2play"
    if re.search(r"\+\s*\d+\s*(M|MB|GB)", d):
        return "2play"
    if "TELE ENTRY" in d:
        return "complementos"
    if "REMOTE CALL" in d or "RCF" in d:
        return "complementos"
    if "PQT" in d:
        return "telefonia_ilimitada"
    if "ILIM" in d and ("PR" in d or "LD US" in d or "US" in d):
        return "telefonia_ilimitada"
    # Valores agregados y todo lo demás
    return "complementos"


# Fila de datos: CODIGO  DESCRIPCION  $PRECIO  [ALFA]  TECNOLOGIA  resto...
# Código: 2-8 alfanuméricos CON al menos un dígito (A862, 7200, PY2ULE, IP2BASC2,
# C474, 40942H, NPVR250) o códigos especiales solo-letras (REAKNG, IPLYB).
ROW_RE = re.compile(
    r"^(?P<codigo>(?=[A-Z0-9]*\d)[A-Z0-9]{2,8}|REAKNG|IPLYB)\s+"
    r"(?P<desc>.+?)\s+"
    r"(?P<precio>" + MONEY + r"|GRATIS|-8%|\(\$0\.08\)|OTC)\s*"
    r"(?P<resto>.*)$"
)
ALFA_RE = re.compile(r"^(?P<alfa>[A-Z0-9][A-Z0-9\-]{4,11})\b\s*(?P<resto>.*)$")


def parse_fila(linea):
    m = ROW_RE.match(linea.strip())
    if not m:
        return None
    codigo = m.group("codigo").strip()
    desc = re.sub(r"\s{2,}", " ", m.group("desc")).strip()
    precio = parse_precio(m.group("precio"))
    resto = m.group("resto").strip()

    # Alfa code (puede no existir: filas '-')
    alfa = None
    am = ALFA_RE.match(resto)
    if am and not any(am.group("alfa").startswith(t.split("/")[0]) for t in ("COBRE", "GPON", "VRAD")):
        alfa = am.group("alfa")
        resto = am.group("resto").strip()
    elif resto.startswith("- "):
        resto = resto[2:].strip()

    # Tecnología
    tecnologia = None
    for t in TECNOS:
        if resto.startswith(t):
            tecnologia = t
            resto = resto[len(t):].strip()
            break

    # Resto: minuto adicional + montos instalación/activación + penalidad.
    # En el PDF la columna "Minuto Adicional" va justo antes de Instalación:
    #   minuto, inst 0/12/24, act 0/12/24, penalidad.
    extras = {}
    tokens = re.findall(MONEY + r"|ILIM[^\s]*|PR\s*-\s*ILIM|US\s*-\s*\$?\d*\.?\d*|-", resto)
    charge_tokens = [t for t in tokens if re.fullmatch(MONEY, t) or t == "-"]

    if "ILIM" in resto:
        extras["minuto_adicional"] = "ILIM"
        if charge_tokens and charge_tokens[0] == "-":
            charge_tokens = charge_tokens[1:]
    elif charge_tokens and re.fullmatch(MONEY, charge_tokens[0]):
        first_money = parse_precio(charge_tokens[0])
        if isinstance(first_money, (int, float)) and first_money <= 1:
            extras["minuto_adicional"] = first_money
            charge_tokens = charge_tokens[1:]
    elif charge_tokens and charge_tokens[0] == "-":
        extras["minuto_adicional"] = None
        charge_tokens = charge_tokens[1:]

    charges = [parse_precio(t) if t != "-" else None for t in charge_tokens]
    if len(charges) >= 7:
        extras["instalacion"] = {"0m": charges[0], "12m": charges[1], "24m": charges[2]}
        extras["activacion"] = {"0m": charges[3], "12m": charges[4], "24m": charges[5]}
        extras["penalidad"] = charges[6]
    elif len(charges) >= 4:
        extras["instalacion"] = {"0m": charges[0], "12m": charges[1], "24m": charges[2]}
        extras["penalidad"] = charges[-1]
    elif charges:
        extras["penalidad"] = charges[-1]

    if precio is None:
        return None

    fila = {
        "codigo": codigo,
        "descripcion": desc,
        "alfa_code": alfa or "-",
        "tecnologia": tecnologia or "",
        "precio": precio,
    }
    fila.update(extras)
    return fila


SKIP_KW = [
    "CÓDIGO", "CODIGO", "ALFA CODE", "TECNOLOG", "MINUTO", "INSTALACIÓN", "INSTALACION",
    "ACTIVACIÓN", "ACTIVACION", "PENALIDAD", "MESES", "LISTADO PLANES", "REV.",
    "PRORRATEADO", "UPGRADE", "STRUT", "PRODUCTO TV", "INCLUYE",
]


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: parse_planes_fijos_pdf.py <ruta_pdf>"}))
        sys.exit(1)

    rev = None
    version_doc = None
    modulos = {k: {"titulo": v, "filas": []} for k, v in SECCIONES.items()}
    no_publicados = []
    vistos = set()

    try:
        with pdfplumber.open(sys.argv[1]) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                for raw in text.splitlines():
                    linea = raw.strip()
                    if not linea or len(linea) < 8:
                        continue
                    if rev is None:
                        mrev = re.search(r"REV\.?\s*(\d{2}\.\d{2}\.\d{4})", linea)
                        if mrev:
                            rev = mrev.group(1)
                    up = linea.upper()
                    # Saltar encabezados/leyendas — pero NUNCA una línea que parsea como fila
                    # de datos (las filas Clarotv+ contienen "PRORRATEADO" en la penalidad).
                    if any(kw in up for kw in SKIP_KW) and not ROW_RE.match(linea):
                        continue

                    fila = parse_fila(linea)
                    if not fila:
                        continue
                    clave = (fila["codigo"], fila["alfa_code"], fila["precio"])
                    if clave in vistos:
                        continue
                    vistos.add(clave)

                    seccion = clasificar(fila["codigo"], fila["descripcion"])
                    if seccion is None:
                        no_publicados.append(fila)
                    else:
                        modulos[seccion]["filas"].append(fila)
    except Exception as e:
        print(json.dumps({"error": f"Error al procesar PDF: {e}"}))
        sys.exit(1)

    # Versión del documento desde el nombre de archivo: ...(15)-260330.pdf
    mv = re.search(r"\((\d{1,3})\)", sys.argv[1])
    if mv:
        version_doc = int(mv.group(1))

    total = sum(len(m["filas"]) for m in modulos.values())
    out = {
        "tipo": "planes_fijos",
        "rev": rev,
        "version_doc": version_doc,
        "total_filas": total,
        "modulos": modulos,
        "no_publicados": no_publicados,
    }
    if total == 0:
        out["error"] = "No se extrajo ninguna fila — el documento no parece un Listado de Planes Fijos."
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
