# Fase 3b — Fotos de producto profesionales con IA (opcional)

Muchos usuarios solo tienen las fotos del proveedor: con textos feos
superpuestos, flechas, medidas, collages, fondos sucios. Esta fase convierte
esas fotos malas en fotos de producto limpias y profesionales (estilo "tienda
de Apple") usando la API de imágenes de OpenAI (**modelo gpt-image-2**), sin
que el usuario tenga que usar ninguna herramienta de diseño.

## Cuándo y cómo ofrecerlo

Durante la entrevista de diseño (fase 3), cuando veas las fotos del usuario:
si son material de proveedor (textos promocionales encima, infografías,
fondos inconsistentes), ofrécelo así:

> "Tus fotos sirven para que yo vea el producto, pero para la web quedarían
> mejor unas fotos limpias y profesionales. Puedo generarlas yo con
> inteligencia artificial a partir de las tuyas. Cuesta unos 2-3 € en
> créditos de OpenAI (una empresa de IA) y necesitarías crearte una cuenta
> ahí — te guío en 3 minutos. ¿Quieres?"

Si dice que no, sigue con sus fotos tal cual. Si dice que sí:

## Alta en OpenAI y clave (guía para el usuario)

Instrucciones cortas, sin la palabra "API" (di "clave"):

> 1. Entra en **platform.openai.com** y crea una cuenta (vale la de Google).
> 2. Dentro, ve a **Settings → Billing** (Facturación) y pulsa "Add to credit
>    balance" para añadir **10 $** de saldo (es el gasto máximo; las fotos nos
>    costarán solo una parte).
> 3. Ve a **API keys** (en el menú) y pulsa "Create new secret key". Dale un
>    nombre cualquiera y pulsa crear.
> 4. Copia la clave que aparece (empieza por `sk-`) y pégamela aquí en el chat.

Si el usuario se pierde, pídele una captura de lo que ve y guíale sobre ella
(la web de OpenAI cambia de vez en cuando; si algo no coincide, búscalo tú en
la documentación actual en vez de insistir con rutas viejas).

### Manejo de la clave

- Guárdala en un archivo `clave-openai.txt` en la **raíz** de la carpeta del
  proyecto (la subida del tema solo envía las carpetas del tema, así que este
  archivo nunca se sube a Shopify). Lee siempre la clave desde ese archivo;
  no la escribas en `ESTADO.md`, ni en ningún archivo dentro de `assets/`,
  `sections/`, etc., ni la imprimas en pantalla.
- Si una llamada devuelve 401, la clave está mal copiada: pide al usuario que
  la pegue de nuevo (puede crear otra, las claves solo se ven una vez).

## El modelo y la API (estado: junio 2026)

- **Modelo: `gpt-image-2`** — el más potente de OpenAI para foto de producto;
  destaca en edición a partir de imágenes de referencia y texto dentro de la
  imagen en varios idiomas (~99% de precisión si alguna foto lleva texto).
- **Endpoints:**
  - Generar desde cero: `POST https://api.openai.com/v1/images/generations`
    (cuerpo JSON).
  - Generar a partir de las fotos del usuario: `POST
    https://api.openai.com/v1/images/edits` (formulario multipart con
    `image[]` repetido por cada foto de referencia). **Este es el que usarás
    casi siempre**: la(s) foto(s) malas van como referencia y el prompt
    describe la foto limpia deseada.
- **Autenticación:** cabecera `Authorization: Bearer <clave>`.
- **Parámetros clave:** `model=gpt-image-2`, `prompt`, `quality`
  (`low`/`medium`/`high`/`auto`), `size` (usa `1024x1024`, `1536x1024`
  apaisada o `1024x1536` vertical; hasta 3840px para heros), `background`
  (solo `auto`/`opaque` — **NO existe fondo transparente en gpt-image-2**),
  `output_format` (`jpeg` para la web; `png` solo si hace falta).
- **Respuesta:** JSON con `data[0].b64_json` (imagen en base64 — hay que
  decodificarla a archivo; el script de abajo lo hace).
- **Límites:** en cuentas nuevas (~Tier 1), unas 5 imágenes por minuto. Si
  recibes 429, espera 30-60 s entre llamadas.
- **Errores típicos:** `401` clave mal; `429` ritmo demasiado alto;
  `insufficient_quota` = sin créditos (que recargue saldo); `400` con mención
  de política de contenido = reformula el prompt.

## Costes (mantén el gasto en ~2-3 $)

Precio aproximado por imagen 1024×1024: **low ≈ 0,006 $ · medium ≈ 0,05 $ ·
high ≈ 0,21 $** (las referencias de entrada añaden ~0,01-0,03 $ por llamada).
Política de gasto de esta skill:

- **Pruebas y variaciones: `low`.** Genera 2-3 variaciones baratas, enseña al
  usuario, y solo la elegida se regenera en calidad buena.
- **Fotos definitivas de secciones: `medium`.** Es el punto dulce; con 30-40
  fotos medium el gasto total ronda los 2 $.
- **`high` SOLO para el hero** (la imagen grande de apertura) o impresión.
- Lleva la cuenta aproximada de lo gastado y dísela al usuario de vez en
  cuando ("llevamos unos 1,20 $ de los 10 $").

## El script incluido: `scripts/generar-foto.mjs`

La skill incluye un script de Node (ya instalado en la fase 0) que encapsula
toda la llamada y la decodificación. Úsalo SIEMPRE en lugar de montar la
petición a mano (multipart + base64 a mano falla mucho, sobre todo en
PowerShell 5.1):

```
node <ruta-skill>/scripts/generar-foto.mjs \
  --clave <proyecto>/clave-openai.txt \
  --prompt "<descripción de la foto deseada>" \
  --salida <proyecto>/assets/mt-producto-1.jpg \
  --ref <proyecto>/fotos-originales/proveedor-1.jpg \
  --ref <proyecto>/fotos-originales/proveedor-2.jpg \
  --calidad medium --tamano 1024x1024
```

- Sin `--ref` usa el endpoint de generación; con uno o más `--ref` usa el de
  edición (pásale SIEMPRE las fotos del usuario como ref para que el producto
  generado sea fiel al real — forma, color, válvulas, costuras, logo).
- El script imprime `OK <ruta>` o `ERROR <detalle legible>`. Ante ERROR,
  consulta la tabla de errores de arriba.
- Copia las fotos originales del usuario a `<proyecto>/fotos-originales/`
  (fuera de `assets/`, para no subir material feo a Shopify).

## Las fotos NO son copias 1:1 de las referencias

Error a evitar: tratar esto como "limpiar las fotos del usuario una a una".
Las referencias solo enseñan al modelo CÓMO ES el producto; la foto generada
puede (y debe) ser lo que cada hueco del diseño necesite:

- **Banner apaisado** para el hero (`--tamano 1536x1024` o más ancho), con el
  producto compuesto a un lado y aire para el texto al otro — indícalo en el
  prompt: *"producto en el tercio derecho, espacio negativo limpio a la
  izquierda para superponer texto"*.
- **Vertical** (`1024x1536`) para columnas y composiciones móviles.
- **Pares antes/después** para secciones de comparador con deslizador:
  genera DOS imágenes con el MISMO encuadre, mismo ángulo y misma luz,
  cambiando solo la variable (con/sin producto, color A/color B, piel
  cansada/descansada...). Truco para que cuadren al superponerse: genera
  primero el "antes"; para el "después", pasa el "antes" recién generado
  como UNA MÁS de las referencias (`--ref antes.jpg --ref producto-1.jpg ...`)
  y pide *"exactamente el mismo encuadre, cámara y luz que la imagen de
  referencia, cambiando únicamente X"*. Revisa el par superpuesto antes de
  darlo por bueno; si no cuadra, regenera el "después" (en `low` hasta que
  cuadre, luego calidad final).
- **Detalles/macro** (válvula, costura, material) para tarjetas de beneficios.
- **Lifestyle** en los contextos reales de uso del brief.
- **Bodegones de set** ("producto + bolsa de transporte + accesorios").

## Referencias multi-ángulo y contexto del producto (mejora el resultado)

- **En cada llamada pasa VARIAS referencias desde ángulos distintos** (frontal,
  lateral, trasera, detalle). Elige tú las 2-4 mejores de las fotos del
  usuario para cada generación: con un solo ángulo el modelo se inventa la
  geometría del resto del producto. Si el usuario solo aportó un ángulo,
  pídele "un par de fotos más girando el producto, valen del móvil".
- **Pide al usuario una descripción del producto con sus palabras** (qué es,
  de qué material, qué tiene de especial, medidas si las sabe) y úsala para
  enriquecer los prompts de fotos Y los copies de la web. Lo que el usuario
  sabe de su producto no siempre se ve en las fotos (p. ej. "la tela es
  impermeable", "cabe en un bolsillo").

## Cómo escribir los prompts (esto decide la calidad)

1. **Describe el producto a partir de lo que VES en las referencias**, no en
   genérico: material, color exacto, forma, detalles (válvula, costuras,
   agujeros, logo). El modelo es fiel a las referencias, pero el prompt debe
   reforzar lo que no puede perderse.
2. **Especifica el fondo con intención, según dónde irá la foto:**
   - Si la foto debe FUNDIRSE con el fondo de la sección (ej. sección con
     fondo blanco y producto "flotando"): pide *"fondo blanco puro uniforme
     (#FFFFFF), sin sombra proyectada, sin viñeteado, sin degradados"* — y usa
     el MISMO color exacto que el CSS de la sección. NUNCA pidas fondo
     transparente (gpt-image-2 no lo soporta y saldrá un damero o un fondo
     inventado).
   - Si la foto va en una tarjeta/marco donde queda bien profundidad: pide
     *"fondo de estudio gris claro con sombra suave y realista bajo el
     producto"* (o el estilo del brief).
3. **Estilo fotográfico:** "fotografía de producto para e-commerce, luz de
   estudio suave, enfoque nítido, sin texto, sin marcas de agua, sin
   personas" (añade personas/contextos solo en fotos lifestyle).
4. **Fotos de contexto (lifestyle):** también puedes generarlas ("persona
   usando el producto en un avión, luz natural..."), pasando las refs del
   producto. Para textos dentro de la imagen, indícalos entre comillas y en
   el idioma de la tienda.
5. **Coherencia de set:** usa el mismo vocabulario de luz/fondo en todas las
   fotos de la tienda para que parezcan de la misma sesión.
6. Escribe los prompts en el idioma que prefieras (el modelo entiende
   cualquiera); lo importante es la precisión.

## Subir las fotos generadas al producto (galería del catálogo) — v2

Si la foto debe aparecer en la **galería oficial del producto** (no solo en una
sección narrativa), súbela al producto con la Admin API. El flujo de tres pasos
(pedir destino → subir archivo → adjuntar al producto) está detallado en
`references/09-admin-api.md`, apartado 5, con el script `scripts/subir-foto.mjs`
y los archivos GraphQL `staged-uploads-create.graphql` y
`producto-crear-media.graphql`. Así la galería de la página de producto muestra
las fotos buenas sin que el usuario tenga que subirlas a mano.

- Sube al producto SOLO lo que deba salir en su galería. Lo decorativo de
  secciones (hero, lifestyle de la landing) va en `assets/` como cualquier
  imagen del diseño.
- Tras subir, las imágenes se procesan en segundo plano: pueden tardar unos
  segundos en verse. No es un error.

## Integración en la web (no cambia nada del contrato)

- Las fotos generadas se guardan en `assets/` con el patrón de nombres de la
  fase 3 y se usan como **valor por defecto** de cada `image_picker` (patrón
  if/else de la fase 4, sección 6). El usuario podrá sustituir cualquiera
  desde el editor de Shopify exactamente igual que antes.
- Tamaños: `1536x1024` o mayor para heros full-bleed; `1024x1024` para
  tarjetas y cuadrículas; vertical `1024x1536` para composiciones de columna.
- Tras integrar, sube y pasa el enlace de previsualización como siempre
  (fase 6).

## Flujo completo recomendado

1. Usuario acepta → alta + clave → `clave-openai.txt`.
2. Lista con el usuario qué fotos hacen falta (hero, 3-6 de secciones, 2-3
   lifestyle...) según la estructura acordada en fase 3.
3. Por cada foto: 2 variaciones en `low` → el usuario elige → regenerar la
   elegida en `medium` (o `high` si es el hero) → guardar en `assets/`.
4. Integrar, subir, previsualizar.
5. Anota en `ESTADO.md`: qué fotos son generadas, con qué prompt (resumido) y
   el gasto aproximado acumulado.
