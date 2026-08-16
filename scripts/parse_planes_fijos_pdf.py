#!/usr/bin/env python3
"""
parse_planes_fijos_pdf.py
Extrae el LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS y separa su contenido
multiseccion por encabezados comprobados.

Uso:    python3 parse_planes_fijos_pdf.py <ruta_pdf>
Salida: JSON por stdout:
{
  "tipo": "planes_fijos",
  "rev": "03.31.2026",
  "version_doc": 15,
  "modulos": {
     "<seccion>": { "titulo": "...", "filas": [ {codigo, descripcion, alfa_code,
                     tecnologia, precio, pagina, encabezado_origen,
                     texto_original, ...extras}, ... ] }
  }
}
"""

import sys
import json
import re
import unicodedata

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber no instalado. Correr: pip install pdfplumber"}))
    sys.exit(1)


SECCIONES = {
    "fijo_telefonia": "Fijo - Telefonía",
    "fijo_internet_2play": "Fijo - Internet y 2Play",
    "fijo_valores_agregados_vendibles": "Fijo - Valores agregados vendibles",
    "claro_tv_planes": "Claro TV - Planes",
    "claro_tv_servicios_complementos": "Claro TV - Servicios y complementos",
    "claro_tv_equipos": "Claro TV - Equipos y decodificadores",
    "internet_equipos_ofertas": "Internet - Equipos / Ofertas",
    "referencia_interna": "Referencia interna",
    "contenido_temporal_excluido": "Contenido comercial temporal excluido",
    "terminos_contrato": "Términos de contrato",
    "revision_manual": "Revisión manual",
}

CATEGORIAS_CANDIDATAS_PORTAL = [
    "fijo_telefonia",
    "fijo_internet_2play",
    "fijo_valores_agregados_vendibles",
    "claro_tv_planes",
    "claro_tv_servicios_complementos",
]

SECTION_MARKERS = [
    ("fijo_telefonia", "Código Planes Medidos - Telefonía"),
    ("fijo_telefonia", "Código Planes Ilimitado PR - Telefonía"),
    ("fijo_telefonia", "Código Planes Tele Entry Service Ilimitado - Telefonía"),
    ("fijo_telefonia", "Código Planes Remote Call Forward PR Ilimitado - Telefonía"),
    ("fijo_telefonia", "Código Planes Remote Call Forward US Ilimitado - Telefonía"),
    ("fijo_telefonia", "Código Planes PQT Ilimitado PR/US - Telefonía"),
    ("fijo_internet_2play", "Código Planes Ilimitado PR/US + Internet - 2 PLAY"),
    ("fijo_internet_2play", "Código Lineas Adicionales para Bundles (Bajo los Planes 2Play Ilimitado PR/US)"),
    ("claro_tv_planes", "Código Planes Televisión - 1 PLAY"),
    ("claro_tv_servicios_complementos", "Código Complementos Televisión - 1 PLAY"),
    ("claro_tv_equipos", "Código / Item Equipos / Decodificadores (STB) Clarotv+ - Televisión"),
    ("internet_equipos_ofertas", "Item Code Equipos / Ofertas Internet"),
    ("fijo_valores_agregados_vendibles", "Código Valores Agregados - Telefonía"),
    ("referencia_interna", "Código Códigos de Emisión de Órdenes - Telefonía"),
    ("terminos_contrato", "Código OSADIA Términos de Contrato - Telefonía"),
]

REQUIRED_SECTIONS = [
    "fijo_telefonia",
    "fijo_internet_2play",
    "claro_tv_planes",
    "claro_tv_equipos",
    "internet_equipos_ofertas",
    "fijo_valores_agregados_vendibles",
    "terminos_contrato",
]

MONEY = r"\$?-?\d{1,4}(?:,\d{3})?\.\d{2}"
TECNOS = ["COBRE/VRAD/GPON", "VRAD/GPON", "COBRE/VRAD", "GPON", "COBRE", "VRAD"]
REFERENCIA_INTERNA_CODIGOS = {
    "2633", "2635", "7240", "7241", "7244", "9063", "7268",
    "9925", "9926", "9927", "9938", "3337",
}
PRUEBAS_FALLIDAS_AJENAS_PREEXISTENTES = [
    "backend/test/client-profile-line-tabs-contract.test.js",
    "backend/test/clients-search-ui-contract.test.js",
    "backend/test/portal-ofertas-auth-launch.test.js",
]


def normalizar(texto):
    limpio = unicodedata.normalize("NFKD", texto or "")
    limpio = "".join(ch for ch in limpio if not unicodedata.combining(ch))
    limpio = re.sub(r"\s+", " ", limpio.upper()).strip()
    return limpio


MARKERS_NORMALIZADOS = [(seccion, encabezado, normalizar(encabezado)) for seccion, encabezado in SECTION_MARKERS]


def detectar_encabezado(linea):
    normalizada = normalizar(linea)
    for seccion, encabezado, patron in MARKERS_NORMALIZADOS:
        if patron in normalizada:
            return seccion, encabezado
    return None


def parse_precio(tok):
    """'$19.99'→19.99 · '$0.00'→0 · 'GRATIS'→0 · '-8%'/'OTC'→string · None si no aplica."""
    if tok is None:
        return None
    t = str(tok).strip().upper()
    if t in ("GRATIS", "FREE"):
        return 0
    if t == "($0.08)":
        return "-8%"
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


def motivo_temporal(fila):
    texto = normalizar(f"{fila.get('descripcion', '')} {fila.get('texto_original', '')} {fila.get('precio', '')}")
    precio = fila.get("precio")
    motivos = []

    if "PROMO" in texto:
        motivos.append("promoción")
    if "GRATIS" in texto or " FREE " in f" {texto} ":
        motivos.append("línea gratis")
    if "AFFINITY" in texto:
        motivos.append("descuento Affinity")
    if "DOBLE VELOCIDAD" in texto or "PROX." in texto or "PROXIMA VELOCIDAD" in texto or "CONVERGENCIA" in texto:
        motivos.append("doble/próxima velocidad por convergencia")
    if "DESCUENTO" in texto or " DESC" in texto or (isinstance(precio, str) and precio.endswith("%")):
        motivos.append("descuento temporal")

    return "; ".join(dict.fromkeys(motivos))


def clasificar(fila, seccion_actual):
    """Clasifica solo por la sección activa del documento y exclusiones explícitas."""
    if not seccion_actual:
        fila["motivo_revision"] = "registro sin encabezado de origen seguro"
        return "revision_manual"

    if seccion_actual == "terminos_contrato":
        return seccion_actual

    motivo = motivo_temporal(fila)
    if motivo:
        fila["motivo_exclusion"] = motivo
        fila["seccion_documental"] = seccion_actual
        return "contenido_temporal_excluido"

    codigo = fila.get("codigo", "").upper()
    descripcion = normalizar(fila.get("descripcion", ""))

    if codigo in ("REAKNG", "IPLYB", "NPVR250"):
        return "claro_tv_servicios_complementos"
    if "STB" in descripcion or "DONGLE" in descripcion or "CONTROL REMOTO" in descripcion:
        return "claro_tv_equipos"
    if codigo in REFERENCIA_INTERNA_CODIGOS:
        return "referencia_interna"

    if seccion_actual not in SECCIONES:
        fila["motivo_revision"] = f"sección no reconocida: {seccion_actual}"
        return "revision_manual"

    return seccion_actual


def llave_auditoria(fila):
    partes = [
        str(fila.get("pagina", "")),
        fila.get("categoria", ""),
        fila.get("encabezado_origen", ""),
        fila.get("codigo", ""),
        fila.get("descripcion", ""),
        fila.get("texto_original", ""),
    ]
    return "||".join(partes)


def preparar_salida_normalizada(filas_auditadas):
    modulos = {k: {"titulo": v, "filas": []} for k, v in SECCIONES.items()}
    grupos = {}
    duplicados = []

    for fila in filas_auditadas:
        llave = llave_auditoria(fila)
        fila["llave_normalizada"] = llave
        grupos.setdefault(llave, []).append(fila)

    for llave, filas in grupos.items():
        if len(filas) > 1:
            duplicados.append({
                "llave_normalizada": llave,
                "categoria": filas[0].get("categoria"),
                "encabezado_origen": filas[0].get("encabezado_origen"),
                "codigo": filas[0].get("codigo"),
                "descripcion": filas[0].get("descripcion"),
                "ocurrencias": [
                    {
                        "fila_auditoria": f.get("fila_auditoria"),
                        "pagina": f.get("pagina"),
                        "texto_original": f.get("texto_original"),
                    }
                    for f in filas
                ],
            })
        normalizada = dict(filas[0])
        modulos[normalizada["categoria"]]["filas"].append(normalizada)

    return modulos, duplicados


# Fila de datos: CODIGO  DESCRIPCION  $PRECIO  [ALFA]  TECNOLOGIA  resto...
# Código: 2-8 alfanuméricos CON al menos un dígito (A862, 7200, PY2ULE, IP2BASC2,
# C474, 40942H, NPVR250) o códigos especiales solo-letras (REAKNG, IPLYB).
ROW_RE = re.compile(
    r"^(?P<codigo>(?=[A-Z0-9]*\d)[A-Z0-9]{2,8}|REAKNG|IPLYB)\s+"
    r"(?P<desc>.+?)\s+"
    r"(?P<precio>" + MONEY + r"|GRATIS|-8%|\(\$0\.08\)|OTC)\s*"
    r"(?P<resto>.*)$"
)
TERM_ROW_RE = re.compile(
    r"^(?P<codigo>EN BLANCO|(?=[A-Z0-9]*\d)[A-Z0-9]{2,8})\s+"
    r"(?P<desc>.+?)\s+"
    r"(?P<descuento>\d{1,3}%\s+Desc)\s+"
    r"(?P<resto>.*)$",
    re.IGNORECASE,
)
ALFA_RE = re.compile(r"^(?P<alfa>[A-Z0-9][A-Z0-9\-]{4,11})\b\s*(?P<resto>.*)$")


def parse_fila(linea, pagina=None, encabezado_origen=None):
    m = ROW_RE.match(linea.strip())
    if not m:
        tm = TERM_ROW_RE.match(linea.strip())
        if not tm:
            return None
        resto = tm.group("resto").strip()
        alfa = None
        am = ALFA_RE.match(resto)
        if am:
            alfa = am.group("alfa")
            resto = am.group("resto").strip()
        tecnologia = None
        for t in TECNOS:
            if resto.startswith(t):
                tecnologia = t
                break
        return {
            "codigo": tm.group("codigo").strip(),
            "descripcion": re.sub(r"\s{2,}", " ", tm.group("desc")).strip(),
            "alfa_code": alfa or "-",
            "tecnologia": tecnologia or "",
            "precio": None,
            "descuento": tm.group("descuento").strip(),
            "pagina": pagina,
            "encabezado_origen": encabezado_origen,
            "texto_original": linea.strip(),
        }
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
        "pagina": pagina,
        "encabezado_origen": encabezado_origen,
        "texto_original": linea.strip(),
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
    filas_auditadas = []
    seccion_actual = None
    encabezado_actual = None
    secciones_detectadas = set()
    errores = []

    try:
        with pdfplumber.open(sys.argv[1]) as pdf:
            for page_index, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                for raw in text.splitlines():
                    linea = raw.strip()
                    if not linea or len(linea) < 8:
                        continue
                    if rev is None:
                        mrev = re.search(r"REV\.?\s*(\d{2}\.\d{2}\.\d{4})", linea)
                        if mrev:
                            rev = mrev.group(1)
                    encabezado = detectar_encabezado(linea)
                    if encabezado:
                        seccion_actual, encabezado_actual = encabezado
                        secciones_detectadas.add(seccion_actual)
                        continue

                    up = linea.upper()
                    # Saltar encabezados/leyendas — pero NUNCA una línea que parsea como fila
                    # de datos (las filas Clarotv+ contienen "PRORRATEADO" en la penalidad).
                    if any(kw in up for kw in SKIP_KW) and not ROW_RE.match(linea):
                        continue

                    fila = parse_fila(linea, page_index, encabezado_actual)
                    if not fila:
                        continue

                    seccion = clasificar(fila, seccion_actual)
                    fila["categoria"] = seccion
                    fila["fila_auditoria"] = len(filas_auditadas) + 1
                    filas_auditadas.append(fila)
    except Exception as e:
        print(json.dumps({"error": f"Error al procesar PDF: {e}"}))
        sys.exit(1)

    faltantes = [seccion for seccion in REQUIRED_SECTIONS if seccion not in secciones_detectadas]
    if faltantes:
        errores.append({
            "codigo": "encabezados_obligatorios_faltantes",
            "secciones": faltantes,
        })

    # Versión del documento desde el nombre de archivo: ...(15)-260330.pdf
    mv = re.search(r"\((\d{1,3})\)", sys.argv[1])
    if mv:
        version_doc = int(mv.group(1))

    modulos, duplicados_exactos = preparar_salida_normalizada(filas_auditadas)
    filas_candidatas_portal = [
        fila
        for categoria in CATEGORIAS_CANDIDATAS_PORTAL
        for fila in modulos[categoria]["filas"]
    ]
    total_normalizado = sum(len(m["filas"]) for m in modulos.values())
    out = {
        "tipo": "planes_fijos_multiseccion",
        "rev": rev,
        "version_doc": version_doc,
        "total_filas": len(filas_auditadas),
        "total_registros_extraidos": len(filas_auditadas),
        "registros_normalizados_total": total_normalizado,
        "categorias_candidatas_portal": CATEGORIAS_CANDIDATAS_PORTAL,
        "secciones_detectadas": list(dict.fromkeys(
            seccion for seccion, _encabezado in SECTION_MARKERS if seccion in secciones_detectadas
        )),
        "errores": errores,
        "auditoria_original": {
            "total_filas": len(filas_auditadas),
            "llaves_unicas": total_normalizado,
            "duplicados_exactos_total": sum(len(d["ocurrencias"]) - 1 for d in duplicados_exactos),
            "duplicados_exactos": duplicados_exactos,
            "filas": filas_auditadas,
        },
        "modulos": modulos,
        "salida_candidata_publicacion": {
            "categorias": CATEGORIAS_CANDIDATAS_PORTAL,
            "total_filas": len(filas_candidatas_portal),
            "filas": filas_candidatas_portal,
        },
        "pruebas_fallidas_ajenas_preexistentes": PRUEBAS_FALLIDAS_AJENAS_PREEXISTENTES,
    }
    if len(filas_auditadas) == 0:
        out["error"] = "No se extrajo ninguna fila — el documento no parece un Listado de Planes Fijos."
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
