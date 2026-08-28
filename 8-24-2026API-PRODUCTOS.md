# API Web-Accesorios-Tango-PR2

Estado: **habilitada y verificada en producción**  
Versión desplegada: **Tango V2 v1.4.1011**  
Fecha de verificación: **24 de agosto de 2026**

## Ambiente y autenticación

- Base URL: `https://tango-pr.com`
- Ambiente: producción; no existe un sandbox separado actualmente.
- Autenticación: `Authorization: Bearer <API_KEY>`
- Llave asignada: `Web-Accesorios-Tango-PR2`
- Permiso: `productos:read`
- Vencimiento: 22 de noviembre de 2026, 11:59 PM AST.
- La llave está en `CREDENCIAL-PRIVADA.txt`. No debe incluirse en Git, logs ni mensajes públicos.
- La llave web no recibe el campo `costo`; ese dato comercial interno requiere el permiso separado `productos:costo`.

## Listar productos y accesorios

`GET https://tango-pr.com/api/external/productos`

Headers:

```http
Authorization: Bearer <API_KEY>
Accept: application/json
```

Parámetros:

| Parámetro | Tipo | Default | Descripción |
|---|---:|---:|---|
| `limit` | entero 1–200 | 50 | Cantidad de resultados. |
| `offset` | entero >= 0 | 0 | Desplazamiento para paginación. |
| `activo` | booleano | true | `false` incluye activos e inactivos. |
| `buscar` | texto | — | Busca por nombre/descripción, barcode, SKU o marca. |
| `departamentoid` | entero | — | Filtra por ID de departamento Tango. |
| `categoria` | texto | — | Coincidencia exacta, sin distinguir mayúsculas. |
| `tipo` | texto | — | Coincidencia exacta con categoría o subcategoría. |
| `marca` | texto | — | Coincidencia exacta, sin distinguir mayúsculas. |
| `tiendaid` | entero | — | Devuelve productos asignados a esa tienda y limita el desglose de inventario. |
| `conStock` | booleano | false | `true` devuelve solo productos cuyo stock más reciente es mayor que cero. |

Ejemplos:

```bash
# Primera página de productos con stock
curl -sS \
  -H "Authorization: Bearer $TANGO_API_KEY" \
  "https://tango-pr.com/api/external/productos?limit=50&offset=0&conStock=true"

# Buscar por SKU, barcode, nombre o marca
curl -sS \
  -H "Authorization: Bearer $TANGO_API_KEY" \
  "https://tango-pr.com/api/external/productos?buscar=ZTGSGA23CLR&limit=20"

# Stock de una tienda específica
curl -sS \
  -H "Authorization: Bearer $TANGO_API_KEY" \
  "https://tango-pr.com/api/external/productos?tiendaid=2&conStock=true&limit=100"
```

Respuesta real abreviada:

```json
{
  "success": true,
  "data": [
    {
      "id": 46255,
      "productoid": 46255,
      "nombre": "ZZEN Tempered Glass Screen Protector for Galaxy A23 - Clear",
      "descripcion": "15 / 15 Plus Two Cameras - Multicolor ZGEN Tempered Glass Screen Protector for Galaxy A23 - Clear",
      "descripcion_detallada": null,
      "categoria": "Screen Protectors",
      "subcategoria": null,
      "tipo": "Screen Protectors",
      "marca": null,
      "modelo": "A23",
      "sku": "ZDK-SCR-ZTGSGA23CLR",
      "barcode": "ZTGSGA23CLR",
      "precio": 14.99,
      "impuestos": {
        "ivu_municipal_pct": 1,
        "ivu_estatal_pct": 10.5,
        "ivu_total_pct": 11.5
      },
      "stock_total": 0,
      "activo": true,
      "imagen_url": null,
      "imagenes": [],
      "compatibilidad": ["A23"],
      "variantes": [
        { "tipo": "dispositivo", "valor": "A23" },
        { "tipo": "color", "valor": "Clear" }
      ],
      "departamento": { "id": 18, "nombre": "Zadikase" },
      "inventario": [
        {
          "productotiendaid": 166997,
          "tiendaid": 2,
          "tienda": "Plaza Dorada",
          "tienda_activa": true,
          "stock": 0,
          "actualizado_en": null
        }
      ]
    }
  ],
  "pagination": { "total": 2, "limit": 1, "offset": 0, "hasMore": true }
}
```

Los campos pueden ser `null` o listas vacías cuando el catálogo original no tiene esa información. `id` y `productoid` representan el mismo identificador estable; se mantiene `productoid` por compatibilidad con consumidores anteriores.

El ejemplo está abreviado. La API conserva algunos nombres históricos por compatibilidad, pero la integración web debe preferir los campos `id`, `nombre`, `descripcion`, `categoria`, `tipo`, `marca`, `modelo`, `sku`, `precio`, `impuestos`, `stock_total`, `inventario`, `imagen_url`, `imagenes`, `compatibilidad` y `activo`.

## Precio e inventario

Precio, IVU, inventario total y desglose por tienda vienen en el mismo endpoint. No se requiere unir respuestas de endpoints separados.

- Identificador común: `id` / `productoid`.
- `precio`: precio de venta actual.
- `impuestos.*`: tasas porcentuales, no importes monetarios.
- `stock_total`: suma del stock más reciente de cada asignación de tienda incluida.
- `inventario[].stock`: stock más reciente en esa tienda.
- `productotiendaid`: identificador de la asignación producto-tienda.
- Si se pasa `tiendaid`, `stock_total` corresponde solo a esa tienda.

## Planes y significado del 403

`GET https://tango-pr.com/api/external/planes` existe, pero requiere `ventas:read`.

La llave de Web-Accesorios-Tango-PR2 tiene mínimo privilegio (`productos:read`), por lo que en `/planes` responde intencionalmente:

```json
{
  "success": false,
  "error": "API key does not have permission: ventas:read"
}
```

Interpretación de errores de autenticación:

| HTTP | Significado |
|---:|---|
| 401 | Header ausente/formato incorrecto, llave inexistente/inactiva o llave vencida. El JSON especifica cuál. |
| 403 | La llave es válida, pero no incluye el permiso solicitado. |
| 404 | Ruta inexistente/no publicada. |
| 400 | Parámetros inválidos o faltantes. |
| 500 | Error interno; conservar hora, URL y cuerpo de respuesta para soporte. |

No existe lista blanca de IP para esta API. Un 403 no significa IP bloqueada.

La llave de esta tienda no debe ampliarse con `ventas:read` únicamente para eliminar el 403 de `/planes`: ese endpoint está fuera del alcance actual de la tienda de accesorios. Si más adelante se requieren planes, debe autorizarse como una integración separada.

## Carrito, órdenes y pagos

Actualmente no existe un contrato de API externa para:

- crear órdenes;
- reservar inventario;
- confirmar ventas;
- procesar pagos;
- cancelar o reversar pagos;
- consultar estado de una orden web.

El endpoint externo `/ventas` es de lectura histórica y no crea ventas. No debe usarse como checkout. Estos endpoints requieren definir primero estados de orden, idempotencia, expiración de reservas, reglas de stock por tienda, proveedor de pago, webhooks, reversos y auditoría.

## Estado de la llave anterior del documento

La llave anterior sigue activa, sin fecha de expiración, y actualmente posee permisos de productos y ventas. Una prueba directa contra `/planes` y `/productos` devolvió HTTP 200. Por eso, un 403 histórico no fue causado por vencimiento, revocación, IP o ambiente; correspondió a otra llave o a una versión anterior de sus permisos.

Esa llave anterior estuvo expuesta en documentación/conversaciones históricas y no debe reutilizarse en Web-Accesorios-Tango-PR2. Debe rotarse aparte después de identificar al consumidor actual, porque tuvo uso reciente.

## Verificación de producción

- `GET /api/external/productos?limit=2&conStock=true`: HTTP 200.
- `GET /api/external/productos?tiendaid=2&conStock=true`: HTTP 200.
- `GET /api/external/productos?buscar=ZTGSGA23CLR`: HTTP 200.
- `GET /api/external/productos?limit=abc`: HTTP 400.
- 58 productos con stock vigente al momento de la verificación.
- Todos los resultados de `conStock=true` fueron comprobados con `stock_total > 0` usando únicamente el registro de stock más reciente por tienda.
- La llave web no devuelve `costo`.
- La integración histórica conserva `costo` mediante el permiso explícito `productos:costo`.
- Health de producción y conexión a base de datos: correctos.
