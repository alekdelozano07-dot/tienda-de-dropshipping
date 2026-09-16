# 🔌 Admin API — leer y escribir datos de la tienda (núcleo de la v2)

Esta referencia explica CÓMO leemos el producto del usuario y CÓMO escribimos
en su catálogo y le asignamos la página de producto, todo con el Shopify CLI
que ya está instalado. Es lo que diferencia a la v2 de la v1. Léela entera
antes de tocar datos de producto.

> Recordatorio de tono: al usuario NUNCA le digas "Admin API", "GraphQL",
> "mutación" ni "token". Para él esto es "leer tu producto" y "guardar los
> cambios en tu tienda".

## Las dos órdenes que lo hacen posible

El Shopify CLI moderno (≥3.93; comprueba con `shopify version`) trae:

```
shopify store auth    --store NOMBRE.myshopify.com --scopes <permisos>
shopify store execute --store NOMBRE.myshopify.com --query-file <archivo.graphql> [--variables '<json>']
```

- **`store auth`** abre el navegador para que el usuario autorice (igual que el
  login del tema, un clic) y guarda un token de la tienda con los permisos
  pedidos. Es independiente del login del tema: hazlo en la fase 1.
- **`store execute`** ejecuta una consulta o una orden de cambio contra la
  tienda usando ese token guardado.

### Permisos (scopes) que pedimos

En la fase 1 pide de una vez todo lo que la skill necesita:

```
shopify store auth --store NOMBRE.myshopify.com --scopes read_products,write_products,read_files,write_files
```

- `read_products` → leer producto(s), descripción, imágenes, variantes.
- `write_products` → escribir título/descripción y asignar la plantilla.
- `read_files,write_files` → subir fotos generadas con IA al producto.

Desde CLI 3.93.1 los permisos ya concedidos se conservan al re-autorizar, así
que puedes volver a ejecutar `store auth` para añadir permisos sin perder los
anteriores.

### Reglas de uso imprescindibles

1. **Lecturas vs. cambios.** Las consultas (leer) van directas. Los CAMBIOS
   (escribir/asignar/subir) **exigen la bandera `--allow-mutations`**, o el CLI
   los rechaza.
2. **Revisa SIEMPRE `userErrors`.** La orden puede "terminar bien" y aun así no
   haber hecho nada porque el bloque `userErrors` (o `mediaUserErrors`) trae un
   problema. Trátalo como bloqueante: léelo, corrige, reintenta.
3. **Pide la salida en JSON** con `--json` cuando vayas a parsear tú el
   resultado (IDs, URLs de imágenes...).
4. **Token caducado.** El token de `store auth` es de acceso *online* y caduca
   a las ~24 h. Si una llamada responde "no autorizado"/401, vuelve a ejecutar
   `store auth` (un clic del usuario) y reintenta. No es un error tuyo.
5. **Comillas en Windows.** PowerShell 5.1 maquea fatal el JSON en línea. Por
   eso usamos **archivos**: `--query-file scripts/gql/*.graphql` y, para las
   variables largas, `--variable-file <ruta.json>` en vez de `--variables`.
6. **Versión de la API.** `store execute` usa por defecto la última versión
   estable. No la fijes salvo que una orden falle por incompatibilidad (ver
   "Si una orden falla por versión").

## 1) Leer el producto (sondeo de la fase 1)

Archivo: `scripts/gql/leer-producto.graphql` — trae los últimos productos con
todo lo que necesitamos (título, descripción, imágenes, variantes, plantilla).

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/leer-producto.graphql \
  --variables '{"n": 5}' --json
```

Qué hacer con la respuesta:

- **¿Hay producto?** Mira `data.products.nodes`. Vacío → rama "no hay producto"
  de la fase 3. Con elementos → rama "hay producto".
- **Elige el producto principal.** Normalmente el más reciente o el único.
  Si hay varios, quédate con el activo más relevante (o pregúntalo en el
  mensaje 2, sin trocear).
- **Guarda en `ESTADO.md`**: el `id` (formato `gid://shopify/Product/...`),
  el `handle`, el título y la descripción tal cual.
- **Descarga las imágenes** (siguiente apartado).
- **Lee de verdad las imágenes descargadas** (míralas) y la descripción: de
  ahí sale el estilo que propones en el mensaje 2.

## 2) Descargar las imágenes del producto al proyecto

Las URLs que devuelve la consulta son del CDN de Shopify y son públicas (no
tienen la contraseña de la tienda), así que se descargan con una simple
petición. Usa el script incluido, que acepta una lista de URLs:

```
node <ruta-skill>/scripts/descargar-imagenes.mjs \
  --carpeta <proyecto>/fotos-producto \
  --url "https://cdn.shopify.com/.../1.jpg" \
  --url "https://cdn.shopify.com/.../2.jpg"
```

- Guarda las fotos en `<proyecto>/fotos-producto/` (fuera de `assets/`, para no
  subir a Shopify material que quizá no uses tal cual).
- El script numera y conserva la extensión; imprime `OK <ruta>` por cada una.
- Si vas a generar fotos nuevas con IA (fase 3b), estas descargadas son las
  **referencias** que le pasas al generador con `--ref`.

## 3) Escribir título y descripción del catálogo (no se los pidas pegar)

En la v1 le pedíamos al usuario que copiara y pegara el título y la descripción
en el panel. En la v2 los escribes tú. Archivo:
`scripts/gql/actualizar-producto.graphql`.

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/actualizar-producto.graphql \
  --variable-file <proyecto>/.tmp-actualizar.json \
  --allow-mutations --json
```

Contenido de `<proyecto>/.tmp-actualizar.json` (escríbelo tú; bórralo después):

```json
{
  "product": {
    "id": "gid://shopify/Product/1234567890",
    "title": "Título vendedor que has redactado",
    "descriptionHtml": "<p>Descripción con beneficios, en HTML simple.</p><ul><li>...</li></ul>"
  }
}
```

- `descriptionHtml` admite HTML básico (`<p>`, `<ul>`, `<li>`, `<strong>`…),
  que es justo lo que se ve bien en la página de producto.
- Revisa `data.productUpdate.userErrors`: vacío = guardado.
- Si NO tienes permiso de escritura (el usuario no es dueño, o rechazó el
  scope), cae al plan B de la v1: redacta el título/descripción y dáselos
  listos para pegar (3 pasos), como en `references/05-producto-y-paginas.md`.

## 4) Asignar la plantilla de producto AUTOMÁTICAMENTE (fin del problema histórico)

El gran fallo de la v1: construíamos la página de producto pero el usuario
tenía que ir al panel a asignarla, y muchas veces ni se hacía. Aquí se asigna
sola: la misma orden de actualizar acepta `templateSuffix`.

Si tu plantilla de producto es `templates/product.mt.json`, el sufijo es `mt`.
Añade `templateSuffix` al mismo `.json` de actualizar (o haz una llamada
dedicada):

```json
{
  "product": {
    "id": "gid://shopify/Product/1234567890",
    "templateSuffix": "mt"
  }
}
```

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/actualizar-producto.graphql \
  --variable-file <proyecto>/.tmp-plantilla.json \
  --allow-mutations --json
```

Importante sobre el momento de hacerlo:

- Puedes asignar `templateSuffix: "mt"` aunque el tema de trabajo aún no esté
  publicado: el dato queda guardado en el producto y, en cuanto el tema con esa
  plantilla esté activo, la página se sirve con tu diseño.
- Mientras el tema sea de trabajo (no publicado), previsualiza la página con
  `?preview_theme_id=<ID>` (ver fase 6). Tras publicar, la asignación ya está
  hecha: cero clics del usuario.
- Apunta en `ESTADO.md` que la plantilla quedó asignada.

## 5) Subir al producto las fotos generadas con IA (galería)

Para que la galería del producto muestre las fotos buenas (las suyas limpias o
las generadas en la fase 3b), súbelas al producto. Como son archivos locales,
el proceso es de tres pasos (es lo estándar de Shopify para archivos locales):

**Paso A — pedir un destino de subida.** Archivo
`scripts/gql/staged-uploads-create.graphql`:

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/staged-uploads-create.graphql \
  --variable-file <proyecto>/.tmp-staged.json \
  --allow-mutations --json --output-file <proyecto>/.tmp-staged-out.json
```

`<proyecto>/.tmp-staged.json` (una entrada por foto que vayas a subir):

```json
{ "input": [
  { "filename": "mt-producto-1.jpg", "mimeType": "image/jpeg", "httpMethod": "POST", "resource": "IMAGE" }
] }
```

La respuesta trae, por cada foto, un `url`, una lista de `parameters` y un
`resourceUrl`. Guárdalos. (Si una tienda muy antigua rechaza `resource: "IMAGE"`,
reintenta con `"PRODUCT_IMAGE"`.)

**Paso B — subir el archivo al destino.** Esto NO usa Shopify, es una subida
directa al destino que te dieron. Usa el script incluido (maneja el formulario
correctamente, también en Windows):

```
node <ruta-skill>/scripts/subir-foto.mjs \
  --destino <proyecto>/.tmp-staged-out.json \
  --indice 0 \
  --foto <proyecto>/assets/mt-producto-1.jpg
```

Imprime `OK <resourceUrl>` cuando la subida va bien. Ese `resourceUrl` es el
que usas en el paso C (también está en la salida del paso A).

**Paso C — adjuntar la foto al producto.** Archivo
`scripts/gql/producto-crear-media.graphql`:

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/producto-crear-media.graphql \
  --variable-file <proyecto>/.tmp-media.json \
  --allow-mutations --json
```

`<proyecto>/.tmp-media.json`:

```json
{
  "productId": "gid://shopify/Product/1234567890",
  "media": [
    { "originalSource": "<resourceUrl del paso A/B>", "mediaContentType": "IMAGE", "alt": "Descripción de la foto" }
  ]
}
```

- Revisa `data.productCreateMedia.mediaUserErrors`.
- Las imágenes se procesan en segundo plano: pueden tardar unos segundos en
  aparecer en la galería. No es un error.
- Si solo quieres usar las fotos en las SECCIONES narrativas (no en la galería
  del catálogo), no hace falta subirlas al producto: van en `assets/` como
  cualquier otra imagen del diseño (fase 4). Sube al producto solo lo que deba
  salir en la galería oficial del producto.

## Borra los archivos temporales

Los `.tmp-*.json` que crees para las órdenes contienen IDs, no secretos, pero
no aportan nada al proyecto: bórralos al terminar cada operación. La clave de
OpenAI vive en `clave-openai.txt` y nunca se mete en estos archivos.

## Si una orden falla por versión de la API

Las órdenes de cambio de esta skill usan la forma moderna
(`productUpdate(product: ...)`, `productCreate(product: ...)`). Si el CLI se
queja de un argumento desconocido (`Unknown argument "product"` o
`required argument "input"`), la tienda está en una versión antigua de la API:

- Reintenta fijando una versión reciente con `--version` (consulta las
  versiones soportadas con `shopify search "admin api versions"` o
  shopify.dev), **o**
- Usa la forma antigua equivalente con `input:`:
  `mutation($input: ProductInput!){ productUpdate(input:$input){ product{ id } userErrors{ field message } } }`
  y en las variables sustituye la clave `product` por `input`.

## Resumen de archivos GraphQL incluidos

| Archivo | Para qué |
|---|---|
| `scripts/gql/leer-producto.graphql` | Leer los productos (título, descripción, imágenes, variantes, plantilla) |
| `scripts/gql/actualizar-producto.graphql` | Escribir título/descripción y/o asignar `templateSuffix` |
| `scripts/gql/staged-uploads-create.graphql` | Pedir destino para subir fotos locales |
| `scripts/gql/producto-crear-media.graphql` | Adjuntar fotos subidas a la galería del producto |
