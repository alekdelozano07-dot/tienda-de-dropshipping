# Fase 5 — Página de producto, header, footer y páginas legales

Cambio clave de la v2: la página de producto **se entrega hecha Y asignada al
producto**, y el título/descripción del catálogo **se escriben solos** con la
Admin API (`references/09-admin-api.md`). Ya no se le pide al usuario que vaya
al panel a asignar plantillas ni a pegar textos, salvo que falten permisos.

## Página de producto — receta completa (LÉELA ENTERA, es donde más se falla)

Sigue esta receta de principio a fin y pásale el checklist final antes de darla
por terminada.

### Cómo funciona técnicamente (para que no des palos de ciego)

- La página de producto es un **template del tema** (`templates/product*.json`)
  que lista secciones, igual que la portada con `index.json`. Todo lo que
  subimos con `shopify theme push` aplica también aquí.
- Los datos del producto (título, precio, fotos de catálogo, variantes, stock)
  viven en el catálogo de la tienda y llegan al template a través del objeto
  Liquid `product`. **Tú construyes el escaparate; el catálogo pone los datos.**
- La novedad v2: leer y escribir ese catálogo (título, descripción, fotos) y
  **asignar qué template usa el producto** ya NO es manual — se hace con la
  Admin API (`references/09-admin-api.md`).

### Paso 0 — Asegurar el producto

- **Si hay producto** (lo leíste en la fase 1): perfecto, ya tienes su `id`,
  título, descripción e imágenes. Sigue.
- **Si NO hay producto**: construyes igualmente la sección y la plantilla `mt`.
  Cuando el usuario cree su producto (panel → Productos → Añadir), le asignas la
  plantilla y le escribes los textos con la Admin API en ese momento. Deja
  anotado el pendiente en `ESTADO.md`. Solo si el usuario te pide que se lo
  crees tú y te da los datos, puedes crearlo por la Admin API (opcional,
  avanzado; ver nota al final de `09-admin-api.md`).

> No improvises pidiéndole pasos en el panel si la Admin API está disponible:
> el objetivo de la v2 es que el producto quede listo sin clics del usuario.

### Paso 1 — La sección `mt-producto.liquid`

Una sección propia, full editable, con TODOS estos bloques funcionales:

1. **Galería**: imagen principal + miniaturas clicables
   (`product.media`/`product.images`; JS mínimo para intercambiar la
   principal). Usa las fotos del producto del catálogo, no image_pickers — así
   la galería sigue al catálogo. (Las fotos generadas con IA en la fase 3b se
   suben al producto con la Admin API —ver `09-admin-api.md`, apartado 5— y
   entonces aparecen aquí solas.)
2. **Columna de compra**: título (`{{ product.title }}`), precio SIEMPRE
   dinámico (`{{ product.selected_or_first_available_variant.price | money }}`,
   con precio tachado si hay `compare_at_price`), y el formulario:

   ```liquid
   {% form 'product', product %}
     <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">
     <button type="submit" name="add" {% if product.selected_or_first_available_variant.available == false %}disabled{% endif %}>
       {{ section.settings.boton_texto }}
     </button>
   {% endform %}
   ```

3. **Variantes**: si `product.has_only_default_variant` es false, renderiza un
   selector por opción (`product.options_with_values`) y un pequeño JS que, al
   cambiar, localice la variante (`product.variants` serializado a JSON en un
   `<script type="application/json">`), actualice el `input[name=id]`, el precio
   y el estado agotado. Si solo hay variante única, no muestres selector. Prueba
   mentalmente ambos caminos: este if/else es el fallo nº 1.
4. **Confianza**: fila de garantías editable (envío, devoluciones, pago seguro)
   con iconos SVG inline.
5. **Descripción rica editable**: además de `{{ product.description }}` como
   respaldo, campos de schema para intro, cuadrícula de características
   (título+texto), pasos de uso y "qué incluye" (textarea un-ítem-por-línea con
   `split`). Redáctalos tú desde la descripción del producto (la del catálogo
   que leíste, o la del usuario).
6. **Reutiliza secciones narrativas** de la landing (reseñas, FAQ,
   comparador...) añadiéndolas al template del producto.

### Paso 2 — El template

Crea `templates/product.mt.json` (alternativo — más seguro que tocar
`product.json`, porque el producto de ejemplo de Dawn sigue funcionando). El
sufijo de este archivo es **`mt`** (lo que va después de `product.` y antes de
`.json`): es el valor que usarás al asignar la plantilla por la Admin API.

```json
{
  "sections": {
    "principal": { "type": "mt-producto", "settings": {} },
    "resenas":   { "type": "mt-resenas",  "settings": {} }
  },
  "order": ["principal", "resenas"]
}
```

### Paso 3 — Asignar el template al producto (AUTOMÁTICO en la v2)

En la v1 esto eran 3 clics del usuario en el panel y se olvidaba. Ahora lo
haces tú con la Admin API en cuanto el tema esté subido (no hace falta que esté
publicado): asigna `templateSuffix: "mt"` al producto. Procedimiento exacto en
`references/09-admin-api.md`, apartado 4. Resumen:

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/actualizar-producto.graphql \
  --variable-file <proyecto>/.tmp-plantilla.json \
  --allow-mutations --json
```

con `.tmp-plantilla.json`:

```json
{ "product": { "id": "gid://shopify/Product/...", "templateSuffix": "mt" } }
```

- Revisa `userErrors`. Si está vacío, la página de producto ya usa tu diseño.
- Mientras el tema sea de trabajo, previsualiza con `?preview_theme_id=<ID>`.
- **Plan B (sin permisos de escritura)**: solo entonces, dile al usuario en 3
  clics: Panel → Productos → tu producto → "Plantilla de tema" → elige "mt" →
  Guardar. (OJO: el desplegable lista plantillas del tema PUBLICADO; si el
  vuestro aún no está publicado, no verá "mt" — la asignación cuajará al
  publicar.)

### Checklist final de la página de producto

- [ ] El precio viene del producto real (cambia en el catálogo → cambia en la web)
- [ ] "Añadir al carrito" añade de verdad (pruébalo en la previsualización) y
      el carrito de Dawn se abre/actualiza
- [ ] Con variantes: cambiarlas actualiza precio, id y estado agotado
- [ ] Sin variantes: no aparece ningún selector vacío
- [ ] Producto agotado: botón deshabilitado con texto claro
- [ ] La galería funciona con 1 foto y con 8
- [ ] Todos los textos/tamaños/espaciados editables desde el editor
- [ ] Se ve bien en móvil (la columna de compra cae debajo de la galería)
- [ ] **La plantilla `mt` está asignada al producto** (Admin API o, en su
      defecto, indicado al usuario)

## Títulos y descripción del catálogo (AUTOMÁTICO en la v2)

El título y la descripción que viven en el CATÁLOGO (los que salen en el
carrito, en Google y en el buscador interno) no están en los archivos del tema.
En la v1 se los pedíamos pegar; en la v2 los **escribes tú** con la Admin API
a partir de lo que sabes del producto (catálogo leído + entrevista):

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/actualizar-producto.graphql \
  --variable-file <proyecto>/.tmp-textos.json \
  --allow-mutations --json
```

`.tmp-textos.json`:

```json
{
  "product": {
    "id": "gid://shopify/Product/...",
    "title": "Título vendedor",
    "descriptionHtml": "<p>Descripción con beneficios.</p><ul><li>...</li></ul>"
  }
}
```

- Puedes unir esta llamada con la de la plantilla (mismo objeto `product` con
  `title`, `descriptionHtml` y `templateSuffix` a la vez).
- Revisa `userErrors`.
- **Plan B (sin permisos)**: redacta los textos y dáselos listos para pegar
  (3 pasos: Panel → Productos → tu producto → pega arriba el título y en el
  cuadro grande la descripción → Guarda).

Todos los demás copies (landing y página de producto visual) son tuyos vía
secciones y templates — redáctalos siempre tú, con el tono del brief, y deja
cada uno editable (contrato de la fase 4).

## Header (cabecera)

Personaliza `sections/header.liquid` de Dawn con cuidado (es la excepción a "no
tocar Dawn"):

- **Logo por sección**: Dawn solo usa el logo global del tema. Añade al schema
  del header un `image_picker` (id `logo`) y un `range` (id `logo_width`), y en
  el render usa `assign active_logo = section.settings.logo | default: settings.logo`
  en TODAS las ramas donde Dawn pinta el logo (hay más de una según
  `logo_position`).
- Traduce al idioma del usuario cualquier texto visible que añadas.
- El menú de navegación se gestiona desde el panel (Contenido → Menús). Si los
  enlaces salen en inglés o incompletos, dile al usuario en 2 pasos dónde
  editarlos, o crea tú las páginas y dile solo qué marcar.

## Footer (pie de página)

El footer de Dawn (bloques + menús + traducciones) es confuso para no técnicos
y tiende a quedar en inglés. Funciona mejor reescribirlo como sección propia
simple dentro de `sections/footer.liquid`:

- Columna de marca: logo (image_picker + range de ancho), tagline (textarea),
  iconos de redes (`settings.social_*`).
- Columna de navegación: 4-6 pares de ajustes texto+url (`nav_link_N_label` /
  `nav_link_N_url`). RECUERDA: los `url` sin default (trampa nº 1 de la fase 4);
  renderiza con `| default: '#'`.
- Columna "sobre la marca": título + textarea.
- Barra inferior: iconos de pago (`shop.enabled_payment_types`), copyright
  dinámico (`{{ 'now' | date: '%Y' }}`), y los enlaces legales apuntando a
  `/policies/...` (ver abajo).
- Mantén los selectores de país/idioma de Dawn como opcionales (checkbox,
  default false).
- Nada de bloque de newsletter salvo que el usuario lo pida.

## Páginas legales

En la UE (y como buena práctica) la tienda necesita: privacidad, términos,
devoluciones, envíos, cookies y aviso legal.

**Las cuatro primeras son nativas de Shopify**, con URLs automáticas:

- `/policies/privacy-policy`
- `/policies/terms-of-service`
- `/policies/refund-policy`
- `/policies/shipping-policy`

Se rellenan en el panel: Configuración → Políticas (Shopify trae plantillas).
Instrucción para el usuario:

> 1. En tu panel: Configuración (abajo a la izquierda) → Políticas.
> 2. En cada política, pulsa "Crear a partir de plantilla" y revisa tus datos.
> 3. Guarda. Los enlaces del pie de tu web ya apuntan ahí.

**Cookies y aviso legal** no son nativas: redacta tú el contenido base
(adaptado a su negocio: nombre, NIF si te lo da, correo de contacto) y créalas
como páginas (panel → Contenido/Páginas) o dáselo para pegar. Enlázalas desde el
footer cuando existan (mientras tanto `#`).

Avisa siempre: "estos textos legales son una base, no asesoría legal — revísalos
o pásalos a tu gestor antes de lanzar en serio."

## Favicon y detalles de marca del navegador

No lo dejes para el final: el favicon hace que la pestaña "parezca una empresa
de verdad".

- **Método robusto (100% por nuestra cuenta):** genera/usa un cuadrado del logo
  o monograma (si hace falta, créalo con la fase 3b en `1024x1024`, fondo del
  color de marca), guárdalo como `assets/mt-favicon.png` (≤512×512) y añádelo en
  el `<head>` de `layout/theme.liquid`, ANTES del favicon condicional de Dawn:

  ```liquid
  <link rel="icon" type="image/png" href="{{ 'mt-favicon.png' | asset_url }}">
  ```

- **Título y descripción de la pestaña/Google**: el título de la home sale del
  nombre de la tienda + eslogan. Si el brief trae eslogan, redáctaselos tú y
  dile dónde pegarlos (Panel → Tienda online → Preferencias) en 2 pasos.

## Otras páginas

- **Contacto**: Dawn trae `contact-form`; crea la página en el panel con la
  plantilla de contacto, o una sección propia si el diseño lo pide.
- **Sobre nosotros**: sección(es) propias + página con template alternativo
  `templates/page.sobre.json`, mismo patrón que producto.

## Cierre de la fase

Actualiza `ESTADO.md` (páginas creadas, plantilla de producto asignada,
título/descripción escritos, qué falta del lado del panel) y pasa a la fase 6
para publicar todo.
