# 01 - Auditoria de boletines Claro PYMES

Generado: 2026-07-04 16:50:42

## Decision de arquitectura

No se implementan nuevas promociones ni condiciones dentro del constructor hasta validar la matriz maestra. Los planes regulares son catalogo base; promociones, bonos, descuentos, equipos, codigos y vigencias viven como reglas/datos auditables.

## Alcance revisado

Carpeta fuente: `C:\Users\Gabriel\Dropbox\Boletines Vigentes PYMES\20 AL 3 DE JULIO 2026`

Archivos inventariados: **41**. Se excluyo el temporal de Excel `~$...xlsx`.


| Extension | Cantidad |
| --- | ---: |
| `.docx` | 2 |
| `.pdf` | 29 |
| `.png` | 5 |
| `.pptx` | 1 |
| `.txt` | 2 |
| `.xlsx` | 2 |

## Entregables generados

- Matriz Excel: `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\02-matriz-maestra-ofertas.xlsx`
- Extractos de texto: `C:\Users\Gabriel\Documentos\Programas\newcrm\docs\motor-ofertas\extractos`

## Hallazgos iniciales por familia

| Familia detectada | Evidencias/filas candidatas |
| --- | ---: |
| equipos | 594 |
| movil | 292 |
| convergente | 145 |
| fijo | 140 |
| internet fijo | 132 |
| iotg/claro oficina | 73 |
| tv | 39 |
| excel/catalogo-ofertas | 13 |

## Beneficios/promociones detectadas

| Beneficio detectado | Evidencias/filas candidatas |
| --- | ---: |
| equipo gratis | 75 |
| autopay | 71 |
| bono streaming | 61 |
| bono portabilidad | 54 |
| trade-in | 51 |
| descuento tv | 39 |
| 50 porciento | 37 |
| doble/proxima velocidad | 34 |
| 1000 megas | 31 |
| pago penalidad | 17 |
| 600 megas | 15 |
| balance | 8 |
| accesorios 10 | 7 |
| 3 meses gratis | 5 |
| doble data | 4 |

## Inventario de fuentes

| Archivo | Tipo | Paginas/Hojas | Familias | Beneficios | Vigencias detectadas | Observacion |
| --- | --- | --- | --- | --- | --- | --- |
| Boletin Extensión Nuevo Plan Multilinea Business Red Plus-BYOP-BAN-260529.pdf | .pdf | 8 | movil, iotg/claro oficina, convergente, equipos | bono streaming, bono portabilidad, 50 porciento, autopay | Vigencia 1 al 30 de junio de 2026 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADCEOCON CLARO LO TIENES TODO Vigencia: Desde: 1 al 30 de junio de 2026 Ext, vigencia del nuevo plan Business Red Plus BYOP, Vigencia: NOTAS IMPORTANTES DEL NUEVO PLAN: • Aplica sólo a cl |  |
| Boletin INT Go, Claro Oficina y IoT 1al30junio2026- CORP.pdf | .pdf | 21 | movil, fijo, internet fijo, iotg/claro oficina, convergente, equipos | doble data, bono streaming, bono portabilidad, pago penalidad, equipo gratis, trade-in | 30 de junio de 2026 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADEOCON CLARO LO TIENES TODO Not, 1 de julio de 2018 en adelante El cliente puede moverse con su módem dondequiera en PR o U, hasta el tope indicado en cada plan, vigencia acordado en este contrato, 1  |  |
| Boletin Lanzamiento AirPods Max 2 5-01-2026.pdf | .pdf | 8 | movil, fijo, equipos |  | 1 de mayo de 2026 ===== PAGE 2 ===== AirPods Max 2 AirPods Max 2 Sonido de alta fidelidad, 1 de mayo de 2026 ===== PAGE 3 ===== Diseño sobre orejas, hasta el cojín, diseñados para un ajuste y comodidad inigualables, en colores vibrantes, 1 de mayo de 2026 ==== |  |
| Boletin Nuevas Ofertas Update Plus y Financiamiento 20 de junio al 3 de julio de 2026-PYM-Corp.pdf | .pdf | 7 | movil, convergente, equipos | bono streaming, bono portabilidad, balance, equipo gratis, 50 porciento, trade-in | 20 de junio al 3 de julio de 2026 ¡Nuevas Ofertas Update Plus y Financiamiento Con y Sin Tr, 20 de junio al 3 de julio de 2026 Nuevas Ofertas para Financiamiento Con y Sin Trade In Ofe, 20 de junio al 3 de julio de 2026 Ofertas disponibles: 1, 20 de junio al 3 |  |
| Boletin Nuevo Plan Multilinea Business Red Plus-BYOP-BAN-17 marzo de 2026.pdf | .pdf | 7 | movil, iotg/claro oficina, convergente, equipos | bono streaming, bono portabilidad, 50 porciento, autopay | Vigencia desde 17 de marzo de 2026 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADCEOCON CLARO LO TIENES TODO Vigencia: Desde: 17 de marzo de 2026 ¡NUEVO!, Vigencia: NOTAS IMPORTANTES DEL NUEVO PLAN: • Aplica sólo a clientes nuevos con o sin portabilidad, 17 de marz |  |
| Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv.pdf | .pdf | 46 | movil, tv, convergente, equipos | bono streaming, equipo gratis, autopay, descuento tv | Vigencia desde 6 de agosto de 2024 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADCEOCON CLARO LO TIENES TODO Vigencia: Desde: 6 de agosto de 2024 NUEVOS, Vigencia: Planes Multilíneas Business RED Plan BUSINESS RED PLUS Páginas 4 a la 13 Plan BUSINESS RED EXTREME Pá |  |
| BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | .pdf | 12 | movil, fijo, internet fijo, iotg/claro oficina, convergente, equipos | doble/proxima velocidad, 1000 megas, 600 megas, bono streaming, bono portabilidad, pago penalidad, equipo gratis, 50 porciento, trade-in, autopay | Vigencia : Válido del 1 de junio al 31 de jul i o del 2026 (V, Vigencia: CLARO EMPRESAS – BOLETÍN DE OFERTAS / JUNIO-JULIO 2026 ¡Nos complace informarles que extendimos hasta el 31 de julio de 2026 nuestra mejor, 1 de junio al 31 de julio del 2026 ===== PAGE 3 |  |
| Boletin ofertas Accesorios- 11 al 20 de mayo de 2026.pdf | .pdf | 10 | movil, fijo, iotg/claro oficina, convergente, equipos | equipo gratis, accesorios 10 | 20 de mayo de 2026 Canal Directo PYMES Telemercadeo Tienda en Línea Canal Indirecto =====, 20 de mayo de 2026 Oferta de cases Samsung Galaxy A07, A16 o A26 GRATIS ===== PAGE 3 =====, 28 de diciembre de 2025 Fecha: 11 al 20 de mayo de 2026 Al activar un (1) Sam |  |
| Boletin ofertas especiales accesorios-11 al 21 de junio de 2026.pdf | .pdf | 10 | movil, equipos | equipo gratis | 21 de junio de 2026 Canal Directo Tienda en línea PYMESCanal Indirecto Telemercadeo ===== P, 21 de junio de 2026 Oferta con iPhone 17e Fecha: Válido del 11 al 21 de junio de 2026 Ofert, 21 de junio de 2026 Oferta: iPhone 17 (256GB) y iPhone 17 Air (256GB): Al  |  |
| BOLETIN OFERTAS PYMES 2026 - DEL 1 JUN@31 JUL'26-260601.pdf | .pdf | 30 | movil, fijo, internet fijo, tv, iotg/claro oficina, convergente, equipos | 3 meses gratis, doble/proxima velocidad, 1000 megas, 600 megas, doble data, bono streaming, bono portabilidad, pago penalidad, equipo gratis, 50 porciento, descuento tv | Vigencia : Válido del 1 de junio al 31 de juli o de 2026, Vigencia: ¡Boletín Ofertas PyMES – JUNIO Y JULIO 2026! ¡¡¡Buenas noticias, hemos extendido algunas de nuestras ofertas hasta el 31 de julio de 2026!, 1 de junio al 31 de julio de 2026, Vigencia: Las pro |  |
| BOLETIN OFERTAS PYMES 2026 - OFERTA ESPECIAL CLARO VS. LIBERTY BUS. JUN-JUL'26-260528.pdf | .pdf | 12 | movil, fijo, internet fijo, tv, iotg/claro oficina, convergente, equipos | doble/proxima velocidad, 1000 megas, bono portabilidad, pago penalidad, equipo gratis, 50 porciento, descuento tv | Vigencia : Válido hasta el 31 de juli o de 2026, Vigencia: ¡Promociones PyMES 2026 – Oferta especial junio-julio 2026! Liberty Business continúa en redes, página web y medios sociales con sus tres, 31 de julio de 2026, hasta el 31 de julio de 2026 |  |
| Boletin Planes Vigentes Update Plus y Financiamiento 20260619-PYM-CORP.pdf | .pdf | 52 | movil, tv, iotg/claro oficina, equipos | bono streaming, bono portabilidad, pago penalidad, balance, autopay, descuento tv | Vigencia: 20 de junio de 2026 en adelante PLANES VIGENTES UPDATE PLUS FINANCIAMIENTO ===== PAGE 2 ===== DEPARTAMENTO DE MERCADCEOCON CLARO LO TIENES, Vigencia: 20 de junio de 2026 en adelante Planes Vigentes Planes Individuales $20, $35 y $45 Páginas 3- 7 Plan |  |
| BOLETIN_INICIATIVAS_PYMES_-_$0_DEP+AUTOPAY_DE_14NOV@31DIC_2025-251113[1].pdf | .pdf | 6 | fijo, internet fijo, tv, convergente, equipos | bono portabilidad, autopay, descuento tv | 14 de noviembre al 31 de diciembre de 2025 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADEOCON CLARO, Vigencia: Del 14 de noviembre hasta el 31 de diciembre de 2025, 14 de noviembre y hasta el 31 de diciembre de 2025, a las ventas nuevas de los clientes del seg, Vi |  |
| Boletín de Oferta de Accesorio – Samsung Galaxy A37 5G- 15 al 30 de mayo de 2027.pdf | .pdf | 2 | movil, equipos | equipo gratis | 30 de mayo de 2026 Canal Directo / Canal Indirecto / Telemercadeo / Tienda en Línea / Agen, 30 de mayo de 2026Válido del 3 al 7 de abril de 2025 Oferta Samsung Galaxy A37: El cliente, 30 de mayo de 2026 |  |
| Boletín Extensión Oferta Limitada Nuevos Bonos de Portabilidad Móvil hasta $500 PYMES- 260529.pdf | .pdf | 4 | movil, iotg/claro oficina, convergente, equipos | bono portabilidad | Vigencia: 1ro al 30 de junio de 2026 Canal Pymes ¡Extensión! Nuevos Bonos de Portabilidad Móvil PYMES Update Plus/ Financiamiento ===== PAGE 2 =====, Vigencia: Con el propósito de atraer clientes de la competencia hemos decido ofrecer por tiempo limitado unos  |  |
| Boletín Lanzamiento Samsung Galaxy A37  15 de mayo de 2026 en adelante.pdf | .pdf | 6 | movil, equipos |  | 15 de mayo de 2026 en adelante en adelante Disponible en: CANAL PYMES CANAL CORPORATIVO Ga, Vigencia: 15 de mayo de 2026 en adelante Especificaciones: • Pantalla: 6, 15 de mayo de 2026 en adelante Accede a tu agente de IA de dos maneras sencillas Vídeo HDR, 15 |  |
| Boletín Oferta Descuentos Modems, MIFI y Tablets planes multilíneas Update Plus y Financiamiento 10 de abril de 2026.pdf | .pdf | 7 | movil, iotg/claro oficina, convergente, equipos | bono streaming, bono portabilidad, equipo gratis, trade-in | 16 de abril de 2026 Canal Pymes y Corporativo Descuentos Módems, MIFI y Tablets En planes I, Vigencia: Resumen descuentos en los precios de los módems, MIFI y Tablets/iPads por Plan: Se añadieron descuentos a los módems MIFI y Tablets/iPads, 16 de abril de 202 |  |
| COMO SOLICITAR TELEFONICAMENTE LINEA NEW MOVIL.txt | .txt |  | movil |  |  |  |
| Featires oerta.pdf | .pdf | 9 | fijo, internet fijo | 600 megas | 5 de noviembre de 2025 ===== PAGE 2 ===== Con el propósito de ayudar a cumplir con los objetiv, Vigencia: Desde el 5 de noviembre de 2025 ===== PAGE 3 ===== ¿A quiénes aplica esta oferta? Clientes Nuevos de 2 Play (Internet + Telefonía) y 3Play, Vigencia: Desd |  |
| Features.pdf | .pdf | 14 | fijo, tv, equipos | descuento tv | Vigencia: 1 al 31 de julio de 2022 Plan Motivacional Agentes de Venta y Servicio al Cliente Telefónico AMOV / Insight ===== PAGE 2 ===== DEPARTAMENT, Vigencia: Plan Motivacional Básico Empleado ▪ Los Agentes de Venta y Servicio Telefónico que cumplan con su cu |  |
| FIJO\19.99.PNG | .png |  |  |  |  | Imagen: requiere OCR/validacion visual si contiene tabla comercial. |
| FIJO\Boletin Beneficios Convergencia Claro Full PYMES @12.NOV.2025.pdf | .pdf | 30 | movil, fijo, internet fijo, iotg/claro oficina, convergente, equipos | 3 meses gratis, doble/proxima velocidad, 1000 megas, 600 megas, doble data, bono streaming, bono portabilidad, pago penalidad, equipo gratis, 50 porciento, trade-in, accesorios 10 | 12 de noviembre de 2025 Claro Full PYMES ===== PAGE 2 ===== DEPARTAMENTO DE MERCADEOCON CLARO L, Vigencia: Como parte de nuestros innovadores productos y ofertas de avanzada, hemos desarrollado una estructura de beneficios para aquellos clientes, 12 de noviemb |  |
| FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | .pdf | 12 | movil, fijo, internet fijo, iotg/claro oficina, convergente, equipos | doble/proxima velocidad, 1000 megas, 600 megas, bono streaming, bono portabilidad, pago penalidad, equipo gratis, 50 porciento, trade-in, autopay | Vigencia : Válido del 1 al 2 8 de febrer o del 202 6 (V, Vigencia: CLARO EMPRESAS – BOLETÍN DE OFERTAS / FEBRERO 2026 ¡Nos complace informarles que extendimos hasta el 28 de febrero de 2026 nuestra mejor o, 28 de febrero del 2026 ===== PAGE 3 ===== DEPARTAMENT |  |
| FIJO\BOLETIN PLANES NEGOCIOS 23JUN@20SEPT'26-260623.pdf | .pdf | 34 | movil, fijo, internet fijo, tv, iotg/claro oficina, convergente, equipos | doble/proxima velocidad, 1000 megas, 600 megas, equipo gratis, 50 porciento, descuento tv | Vigencia : Del 2 3 de jun i o hasta el 2 0 de septiembre de 2026, Vigencia: Estructura de Precios Actual de Negocios: Seguimos enfocados en nuestra meta: mantenernos a la vanguardia en conectividad confiable y velo, 23 de junio hasta el 20 de septiembre del 20 |  |
| FIJO\cobre-vrad.PNG | .png |  |  |  |  | Imagen: requiere OCR/validacion visual si contiene tabla comercial. |
| FIJO\GPON.PNG | .png |  |  |  |  | Imagen: requiere OCR/validacion visual si contiene tabla comercial. |
| FIJO\LISTADO ESTRUCTURA PLANES PYMESNEGOCIOS TODOS @2026(15)-260330.pdf | .pdf | 3 | movil, fijo, internet fijo, tv, equipos | doble/proxima velocidad, equipo gratis, 50 porciento, descuento tv |  |  |
| FIJO\paquetes en 5 lineas.PNG | .png |  |  |  |  | Imagen: requiere OCR/validacion visual si contiene tabla comercial. |
| guia productos pymes.pdf | .pdf | 18 | movil, fijo, internet fijo, tv, iotg/claro oficina, equipos | trade-in, descuento tv |  |  |
| instructivo renovacion fijas.txt | .txt |  | fijo |  |  |  |
| Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx | .xlsx | Ofertas Tablets y Modems, Finan Equipos Móvil, Finan Modems- Tablets-Routers, Planes familiares FAM09A y R, Planes Fam Otros LOC10A y R, Precios modems, tablets, HP, Accesorios | movil, iotg/claro oficina, equipos |  | 31 de agosto de 2018, 29 de abril al 26 de mayo de 2020, 28 de mayo al 31 de julio de 2026, 29 de abril al 26 de mayo de 2021 |  |
| PLANES\Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv.pdf | .pdf | 46 | movil, tv, convergente, equipos | bono streaming, equipo gratis, autopay, descuento tv | Vigencia desde 6 de agosto de 2024 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADCEOCON CLARO LO TIENES TODO Vigencia: Desde: 6 de agosto de 2024 NUEVOS, Vigencia: Planes Multilíneas Business RED Plan BUSINESS RED PLUS Páginas 4 a la 13 Plan BUSINESS RED EXTREME Pá |  |
| PROCESOS\BOLETIN PLANES NEGOCIOS 25DIC'25@24MAR'26-251222.pdf | .pdf | 33 | movil, fijo, internet fijo, tv, iotg/claro oficina, convergente, equipos | doble/proxima velocidad, 1000 megas, 600 megas, bono streaming, bono portabilidad, pago penalidad, equipo gratis, 50 porciento, descuento tv | Vigencia : Del 25 de diciembre de 2025 hasta el 24 de marzo de 2026, Vigencia: Estructura de Precios Actual de Negocios: Este 2026 seguimos enfocados en nuestra meta: mantenernos a la vanguardia en conectividad confia, 25 de diciembre de 2025 hasta el 24 de ma |  |
| PROCESOS\Enmienda Proceso Manejo de las Cuentas Negocios  Agentes -Móvil.docx | .docx |  |  |  |  | Archivo Office 0 bytes: posible placeholder o archivo corrupto. |
| PROCESOS\Guia.pdf | .pdf | 9 | convergente |  |  |  |
| PROCESOS\Proceso de la cuentas Pymes para Agentes - Fijo 10-14.docx | .docx |  |  |  |  | Documento Office: pendiente de extraccion estructurada en siguiente pasada. |
| PROCESOS\PROCESO MOVIL PYMES DIC 22 2025.pdf | .pdf | 10 |  |  |  | Paginas con poco texto: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] |
| PROCESOS\Pymes Agentes ADIESTRAMIENTO.pptx | .pptx |  |  |  |  | Documento Office: pendiente de extraccion estructurada en siguiente pasada. |
| PROCESOS\unnamed.png | .png |  |  |  |  | Imagen: requiere OCR/validacion visual si contiene tabla comercial. |
| SENSE CONNECT SC421.pdf | .pdf | 5 | movil, fijo, internet fijo, iotg/claro oficina, equipos | bono portabilidad, trade-in | 9 de abril de 2026 ===== PAGE 2 ===== DEPARTAMENTO DE MERCADEOCON CLARO LO TIENES TODO Des, 9 de abril de 2026 Beneficios del Sense Connect SC421 • Alta velocidad para múltiples disp, 9 de abril de 2026 ===== PAGE 4 ===== DEPARTAMENTO DE MERCADEOCON CLARO LO T |  |
| Tabla Ofertas Financiamiento 20 de junio al 3 de julio de 2026- PYMES.xlsx | .xlsx | Ofertas con desc plan $35-$85, Ofertas Equipos en Portafolio, Ofertas Equipos en Li, Ofertas Planes y Bonos, Planes de Lista, PLANES PROMOCIONALES | movil, fijo, tv, iotg/claro oficina, convergente, equipos | bono streaming, bono portabilidad, equipo gratis, 50 porciento, trade-in, descuento tv, accesorios 10 | 20 DE JUNIO AL 3 DE JULIO DE 2026- APLICA A CANAL PYMES, 20 DE JUNIO AL 3 DE JULIO DE 2026, 31 DE OCTUBRE DE 2024- APLICA A CANAL PYMES Y CORPORATIVO, HASTA EL 30 DE JUNIO DE 2026, 31 DE MAYO DE 2023 |  |

## Conflictos y decisiones pendientes

| Tema | Fuente | Pagina/Hoja | Decision requerida |
| --- | --- | --- | --- |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 1 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 2 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 3 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 4 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 5 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 6 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 7 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 8 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 9 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 10 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $154.99 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 10 | Comparar contra 3Play $143.74. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 11 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $143.74 | BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $143.74  1@31 JUN-JUL'2026-260601.pdf | pagina 12 | Comparar contra 3Play $154.99 y boletin de planes negocios. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 1 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 2 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 3 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 4 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 5 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 6 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 7 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 8 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 9 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 10 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 11 | Comparar contra 3Play $143.74. |
| 3Play $154.99 | FIJO\BOLETIN OFERTA PYMES 3PLAY CONVERGENTE $154.99 1@28 FEB'2026-260130.pdf | pagina 12 | Comparar contra 3Play $143.74. |
| Alcance de procesos/guias | PROCESOS y guia productos pymes |  | Definir si entran a matriz comercial o quedan como referencia operacional. |
| Imagenes con tablas | FIJO/*.PNG |  | Aplicar OCR/validacion visual si contienen precios no repetidos en PDF. |
| DOCX 0 bytes | PROCESOS/Enmienda Proceso Manejo de las Cuentas Negocios  Agentes -M?vil.docx |  | Reemplazar o excluir por archivo corrupto/vacio. |

## Reglas confirmadas del sprint

- Oferta vencida no se apaga sola: queda `vencido-pero-vendible` hasta que un boletin nuevo la reemplace.
- Plan regular y oferta/promocion se guardan separados.
- Convergencia se evalua por fijo/TV/Internet/Claro Oficina/FWA + movil/IOTG bajo mismo SS/Tax ID, BAN unido o separado.
- 2Play/3Play/Claro Full son paquetes/reglas convergentes, no simples servicios adicionales.
- ClaroTV+, STB, DVR, Dongle y descuentos TV van como fijo/TV/convergente, no como servicios moviles.

## Siguiente pasada necesaria

Esta primera version deja inventario, extractos, candidatos y conflictos. La siguiente pasada debe convertir cada candidato en filas comerciales normalizadas y resolver con decision humana los conflictos listados, sin programar UI.
