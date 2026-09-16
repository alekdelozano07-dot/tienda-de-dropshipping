# Fase 4 — Construir secciones personalizadas 100% editables

Este es el corazón técnico de la skill. Cada sección que crees debe cumplir un
contrato: **el usuario puede cambiar después cualquier texto, imagen, tamaño,
alineación y espaciado desde el editor visual de Shopify, sin tocar código.**

## Índice

1. Arquitectura de archivos
2. Anatomía de una sección (plantilla canónica)
3. El contrato de editabilidad (checklist por sección)
4. Patrón de estilos por sección (`{% style %}` + schema)
5. La regla de oro del espaciado (ROOT PADDING FIX)
6. Imágenes: image_picker con respaldo en assets
7. Montar la portada: templates/index.json
8. CSS global: tokens de diseño
9. JavaScript: patrones seguros
10. TRAMPAS CONOCIDAS (leer antes de escribir la primera sección)

---

## 1. Arquitectura de archivos

- Un prefijo corto para todo lo tuyo, derivado de la marca (2-4 letras).
  Ejemplos abajo usan `mt-` (mi tienda). Aplica a archivos, clases CSS e IDs.
- `sections/mt-hero.liquid`, `sections/mt-resenas.liquid`, ... — una sección
  por bloque visual de la landing.
- `assets/mt-styles.css` — TODO el CSS propio en un único archivo.
- `assets/mt-scripts.js` — TODO el JS propio en un único archivo (si hay
  interactividad).
- No edites los archivos originales de Dawn (excepto `sections/header.liquid`
  y `sections/footer.liquid`, ver fase 5). No edites `layout/theme.liquid`
  salvo que sea imprescindible; las hojas de estilo se cargan desde cada
  sección (ver plantilla).

## 2. Anatomía de una sección (plantilla canónica)

```liquid
{{ 'mt-styles.css' | asset_url | stylesheet_tag }}

{% style %}
  #shopify-section-{{ section.id }} {
    padding-top: {{ section.settings.padding_top }}px;
    padding-bottom: {{ section.settings.padding_bottom }}px;
  }
  #shopify-section-{{ section.id }} .mt-h2 {
    font-size: {{ section.settings.heading_size }}px;
    text-align: {{ section.settings.text_align }};
  }
  #shopify-section-{{ section.id }} .mt-body {
    font-size: {{ section.settings.body_size }}px;
    text-align: {{ section.settings.text_align }};
  }
{% endstyle %}

<section class="mt-hero mt-section">
  <div class="mt-container">
    <h2 class="mt-h2">{{ section.settings.headline }}</h2>
    <p class="mt-body">{{ section.settings.body | newline_to_br }}</p>
  </div>
</section>

{% schema %}
{
  "name": "MT – Hero",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "headline", "label": "Título", "default": "..." },
    { "type": "textarea", "id": "body", "label": "Texto", "default": "..." },
    { "type": "header", "content": "Tipografía" },
    { "type": "select", "id": "text_align", "label": "Alineación",
      "options": [
        {"value": "left", "label": "Izquierda"},
        {"value": "center", "label": "Centro"},
        {"value": "right", "label": "Derecha"}
      ], "default": "left" },
    { "type": "range", "id": "heading_size", "label": "Tamaño del título (px)",
      "min": 20, "max": 80, "step": 2, "unit": "px", "default": 44 },
    { "type": "range", "id": "body_size", "label": "Tamaño del texto (px)",
      "min": 13, "max": 26, "step": 1, "unit": "px", "default": 17 },
    { "type": "header", "content": "Espaciado" },
    { "type": "range", "id": "padding_top", "label": "Espacio superior (px)",
      "min": 0, "max": 160, "step": 8, "unit": "px", "default": 0 },
    { "type": "range", "id": "padding_bottom", "label": "Espacio inferior (px)",
      "min": 0, "max": 160, "step": 8, "unit": "px", "default": 0 }
  ],
  "presets": [ { "name": "MT – Hero" } ]
}
{% endschema %}
```

Puntos no negociables de la plantilla:
- `presets` con `name`: sin esto la sección NO aparece en el editor para
  añadirla.
- Etiquetas (`label`) y nombres en el idioma del usuario, claros para no
  técnicos ("Espacio superior", no "padding-top").
- `newline_to_br` en TODOS los textarea: el usuario escribirá saltos de línea
  en el editor y espera verlos en la web.
- Agrupa ajustes con `{ "type": "header", "content": "..." }` para que el
  panel del editor sea navegable.

## 3. El contrato de editabilidad (checklist por sección)

Antes de dar una sección por terminada, comprueba que el schema expone:

- [ ] Todos los textos visibles (text/textarea/richtext)
- [ ] Todas las imágenes (image_picker) y vídeos si los hay
- [ ] Tamaño de letra de título y cuerpo (range)
- [ ] Alineación del texto (select izquierda/centro/derecha)
- [ ] Espacio superior e inferior de la sección (range 0-160)
- [ ] Enlaces de los botones (url) y su texto (text)
- [ ] Cualquier parámetro visual decisivo de ESA sección (velocidad de un
  carrusel, separación entre tarjetas, tamaño de los iconos...) — si dudas de
  si exponerlo, exponlo
- [ ] Colores SOLO si la sección lo pide (color de fondo/texto como `color`),
  con los colores de marca como default

## 4. Patrón de estilos por sección

Todo lo que dependa de un ajuste vive en el bloque `{% style %}` con el
selector `#shopify-section-{{ section.id }} ...`. Todo lo estructural
(layout, animaciones, hover...) vive en `mt-styles.css` con clases `mt-*`.
Así dos instancias de la misma sección pueden tener ajustes distintos sin
pisarse, y el CSS global se mantiene limpio.

## 5. La regla de oro del espaciado (ROOT PADDING FIX)

**Todo el relleno vertical de una sección vive EXCLUSIVAMENTE en el div
envoltorio `#shopify-section-...` (controlado por los ajustes padding_top /
padding_bottom). El elemento interno (`<section class="mt-...">`) tiene
relleno vertical CERO.**

Por qué: si el elemento interno trae padding propio en el CSS, el usuario pone
"Espacio superior: 0" en el editor y sigue viendo un hueco que no puede
quitar. Esto pasó de verdad y es muy frustrante de depurar (el hueco parece
venir "de la nada").

Refuerzo en `mt-styles.css` por si algún estilo de Dawn interfiere:

```css
.mt-section { padding-top: 0 !important; padding-bottom: 0 !important; }
```

Corolario: si una sección tiene fondo de color/imagen, el fondo debe pintarse
en el envoltorio o cubrir el 100% del interno — si no, el padding del
envoltorio se ve del color de la página y aparecen "franjas" arriba/abajo.
Para secciones full-bleed con imagen de fondo, pon también el fallback de
fondo del interno en un color similar a la imagen, nunca blanco por defecto.

## 6. Imágenes: image_picker con respaldo en assets

Las imágenes del usuario copiadas a `assets/` son el VALOR POR DEFECTO; el
editor permite sustituirlas. Patrón:

```liquid
{%- if section.settings.imagen != blank -%}
  <img src="{{ section.settings.imagen | image_url: width: 2000 }}"
       alt="{{ section.settings.imagen.alt | escape }}" loading="lazy">
{%- else -%}
  <img src="{{ 'mt-hero-fondo.jpg' | asset_url }}" alt="" loading="lazy">
{%- endif -%}
```

- `image_picker` NO admite `default` en el schema — por eso existe el patrón
  if/else con asset.
- La primera imagen visible de la página: `loading="eager"` y
  `fetchpriority="high"`; el resto `loading="lazy"`.

## 7. Montar la portada: templates/index.json

La portada es `templates/index.json`: declara qué secciones aparecen y con qué
valores. Escríbelo entero con tus secciones en el orden acordado:

```json
{
  "sections": {
    "mt-hero": { "type": "mt-hero", "settings": { "headline": "..." } },
    "mt-beneficios": { "type": "mt-beneficios", "settings": { } }
  },
  "order": ["mt-hero", "mt-beneficios"]
}
```

- `type` = nombre del archivo de la sección sin `.liquid`.
- Los `settings` del JSON SOBREESCRIBEN los defaults del schema. Pon aquí los
  textos reales del usuario y deja los defaults del schema como genéricos
  razonables.
- Todo id que pongas en `order` debe existir en `sections` (y viceversa) o la
  subida falla.
- Valida el JSON mentalmente o con una herramienta antes de subir: una coma
  de más rompe toda la portada.

## 8. CSS global: tokens de diseño

Arranca `mt-styles.css` con variables derivadas del brief y úsalas en todo:

```css
:root {
  --mt-color-fondo: #...;
  --mt-color-texto: #...;
  --mt-color-acento: #...;
  --mt-fuente: 'X', -apple-system, sans-serif;
  --mt-radio: 16px;       /* esquinas */
  --mt-margen: 24px;      /* gutter lateral */
  --mt-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
.mt-section { font-family: var(--mt-fuente); color: var(--mt-color-texto); }
.mt-container { max-width: 1200px; margin: 0 auto; padding: 0 var(--mt-margen); }
```

Responsive: diseña desktop y añade breakpoints a 990px y 540px como mínimo.
Las composiciones de columnas pasan a una columna en móvil; los tamaños de
letra grandes bajan con `clamp()` o en el breakpoint.

Si el brief pide una fuente de Google Fonts, cárgala en el `<head>` vía
`layout/theme.liquid` con `preconnect` — es de los pocos motivos válidos para
tocar ese archivo.

### No te olvides de la "ropa" global del tema

Tus secciones visten la marca, pero las partes NATIVAS de Dawn (carrito,
cajón del carrito, búsqueda, página 404, cuenta de cliente, avisos) siguen
con los colores y fuentes por defecto si no tocas la configuración global.
Edita `config/settings_data.json` (bloque `current`) para alinear:

- **Esquemas de color** (`color_schemes`): pon los colores de marca del brief
  en scheme-1 (fondo, texto, botón, etc.). Las secciones de Dawn los usan.
- **Tipografía** (`type_header_font`, `type_body_font`): elige de la librería
  de fuentes de Shopify la más parecida a la del brief (formato
  `nombre_n4`/`nombre_n7`; si dudas del identificador, busca la fuente en la
  documentación de Shopify Fonts en vez de inventarlo).
- Radios de botones/inputs/tarjetas si Dawn los expone y el brief tiene
  esquinas marcadas.

Así el usuario no se encuentra un carrito "de otra web" al comprar. OJO: si
el usuario ya retocó ajustes desde el editor, haz `pull` de `config/` antes
de tocar este archivo (ver guía de problemas, sección de conflictos).

## 8b. El listón visual: nivel "web hecha con React"

Shopify usa Liquid, no React — pero eso NO limita el resultado visual: todo
lo que un usuario admira en una web moderna de React se consigue igual con
CSS moderno + JS vanilla, que es exactamente lo que usamos. No entregues una
plantilla plana: el objetivo es que el usuario diga "esto parece la web de
una gran marca". Catálogo de recursos (elige según el brief, no los metas
todos):

- **Reveals al hacer scroll**: entrada con `opacity` + `translateY` +
  `scale` escalonadas (stagger) vía IntersectionObserver. Es el mínimo — una
  web sin reveals parece muerta.
- **Micro-interacciones**: hovers con elevación y sombra, botones con
  transición de fondo, tarjetas que se inclinan sutilmente al cursor.
- **Cifras animadas** (count-up al entrar en pantalla).
- **Marquesinas infinitas** (logos, reseñas) con animación CSS de transform.
- **Comparadores antes/después** con deslizador.
- **Escenas sticky**: un visual fijo mientras el texto hace scroll a su lado
  (`position: sticky`), tipo páginas de producto de Apple.
- **Parallax suave** en fondos de hero (transform con scroll, nunca
  `background-attachment: fixed` — va mal en móvil).
- **Transformaciones 3D** (`perspective` + `rotateY`) para producto giratorio
  por pasos.
- **Typewriter / texto que se escribe**, contadores de "x personas viendo
  esto", barras de progreso de stock... si el tono de la marca lo permite.
- **Vídeo de fondo** silenciado y en bucle para heros (ajuste de vídeo en el
  schema).

Reglas para que la locura no se vuelva en contra:
- Rendimiento: anima solo `transform` y `opacity` (van por GPU); jamás
  `width/height/top/left` en bucle. Un solo IntersectionObserver compartido.
- Accesibilidad: envuelve TODO en `@media (prefers-reduced-motion: reduce)`
  desactivando animaciones.
- Móvil: cada efecto debe degradar con elegancia (los sticky/parallax
  complejos pueden simplificarse bajo 990px).
- Cada efecto paramétrico expone sus diales en el schema (velocidad de la
  marquesina, intensidad del parallax...) — contrato de editabilidad.

## 9. JavaScript: patrones seguros

- Un solo archivo `mt-scripts.js`, cargado con `defer` desde las secciones que
  lo necesiten: `<script src="{{ 'mt-scripts.js' | asset_url }}" defer></script>`.
- Estructura: una función `init` por componente (`initCarrusel`,
  `initComparador`...), todas llamadas desde un único listener de
  `DOMContentLoaded`, y cada una empieza comprobando si su elemento existe
  (`if (!el) return;`) — así el mismo archivo sirve para todas las páginas.
- Animaciones de entrada: `IntersectionObserver` que añade una clase
  `.mt-visible` a los elementos `.mt-reveal`. CSS hace el resto. Respeta
  `prefers-reduced-motion`.
- Nada de librerías externas (ni jQuery, ni Swiper): todo vanilla. Un carrusel
  infinito se hace con animación CSS de `transform` y contenido duplicado.

## 10. TRAMPAS CONOCIDAS — léelas antes de escribir la primera sección

Errores reales encontrados construyendo tiendas así. Cada uno costó tiempo:

1. **`"type": "url"` NO admite `"default"`.** La subida falla con «default
   debe ser una cadena o una ruta de acceso de fuente de datos». Los enlaces
   por defecto van en el código con `| default: '#'` al renderizar, o en
   `templates/*.json`, nunca como default del schema.

2. **`box-shadow` cortada dentro de carruseles.** Un carrusel necesita
   recortar horizontalmente su contenido, pero `overflow: hidden` (u
   `overflow-x: hidden`) fuerza el eje vertical a comportarse como `auto` y
   corta las sombras/zoom de las tarjetas al hacer hover. Solución:

   ```css
   .mt-carrusel-wrap { overflow-x: clip; overflow-y: visible; }
   ```

   `clip` recorta sin crear contenedor de scroll, así `visible` en el otro
   eje funciona de verdad. Revisa TODOS los ancestros: basta uno con
   `overflow: hidden` para que se corte igual.

3. **`clip-path` crea contextos de apilamiento.** En un comparador
   antes/después (imagen recortada con `clip-path`), un elemento hermano con
   z-index alto puede quedar tapado igualmente. Solución robusta: dibujar la
   línea/elemento como `::before` del asa que ya está por encima (hereda su
   contexto de apilamiento). En general: si un z-index "no funciona",
   sospecha de un ancestro con `clip-path`, `transform`, `filter` u `opacity`.

4. **Franja blanca entre el header y la primera sección.** Dawn aplica un
   margen inferior al header. Fix en el CSS global:
   `.section-header { margin-bottom: 0 !important; }` (y/o poner a 0 el
   ajuste de margen del header en el editor).

5. **Padding interno no anulable** → ver sección 5 (ROOT PADDING FIX).

6. **Los `range` tienen límite de pasos:** (max − min) / step debe ser ≤ 101,
   o la subida falla. Con min 0, max 160, step 8 vas sobrado; con step 1 y
   max 200 no.

7. **`newline_to_br` olvidado** en textareas: el usuario escribe párrafos en
   el editor y salen pegados en una línea.

8. **JSON del schema inválido** (coma final, comillas sin cerrar): el error
   del CLI dice el archivo pero no siempre la línea. Reescribe el schema con
   cuidado; los comentarios NO existen en JSON.

9. **Texturas/elementos absolutos que se salen**: toda sección con elementos
   `position: absolute` decorativos debe recortarlos (`overflow-x: clip` en
   la sección) o causarán scroll horizontal en móvil.

10. **Sombras/elementos que asoman por el borde inferior de una escena con
    altura fija**: deja colchón (padding-bottom interno + altura suficiente)
    en contenedores con `perspective` o alturas fijas; las sombras de los
    hijos transformados no expanden la caja.

## Flujo de trabajo de la fase

1. Escribe `mt-styles.css` (tokens + base) y `mt-scripts.js` (esqueleto).
2. Crea las secciones de una en una siguiendo la plantilla + checklist.
3. Monta `templates/index.json`.
4. Sube y previsualiza (fase 6) ANTES de enseñar nada: enseña siempre el
   enlace de previsualización real, no descripciones.
5. Itera con el feedback del usuario. Cada tanda de cambios termina con una
   subida automática (fase 6).
6. Registra cada sección creada en `ESTADO.md` (nombre de archivo + qué hace).
