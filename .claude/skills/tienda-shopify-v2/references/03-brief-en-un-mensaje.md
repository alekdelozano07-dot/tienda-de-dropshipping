# Fase 3 — El brief en un solo mensaje (mensaje 2)

Objetivo: reunir TODO lo que falta para diseñar en un único mensaje al usuario,
para que no tenga que estar pendiente. El resultado es un mini-brief escrito en
`ESTADO.md` que guía la construcción. Esta fase tiene dos ramas según el sondeo
de la fase 1.

## Principio: cero sesgo

No tienes un estilo por defecto ni una estructura favorita. Cada tienda nace de
lo que el usuario aporte y/o de su producto. Señales de que estás sesgando:
todas tus tiendas tienen el mismo hero; todas la misma paleta blanco/negro;
todas las mismas 8 secciones en el mismo orden. Varía composición, ritmo,
densidad y tono según el producto y las referencias.

---

## RAMA A — Hay producto (lo leíste en la fase 1)

Aquí ya has leído el producto y descargado sus fotos. No empieces de cero:
**propón**. El mensaje 2 tiene tres partes, todas en el MISMO mensaje:

### 1) Enséñale que lo has entendido

Resume en 2-3 líneas qué has visto, para generar confianza:

> "He mirado tu producto **<título>**. Es <qué es, material/uso clave que
> deduces de la descripción y las fotos>. Tienes <N> fotos; <valoración honesta
> y amable: 'están muy bien' / 'son de proveedor, con textos y medidas encima'>."

### 2) Propón un estilo concreto (no genérico)

Basado en el producto real, propón paleta, tipografía, tono y una estructura de
portada corta y visual. Concreto, no "algo minimalista":

> "Con esto yo te haría una tienda así:
> • Estilo: <p. ej. 'cálido y natural, fondo crema, titulares serif grandes,
>   fotos a sangre con esquinas redondeadas'>.
> • Portada: 1) apertura con tu producto recortado y un claim corto; 2) tres
>   beneficios con iconos; 3) cómo se usa en 3 pasos; 4) reseñas; 5) llamada a
>   comprar. 
> ¿Te encaja o lo quieres distinto (más serio, más colorido, otra cosa)?"

Elige la composición del menú de abajo según el producto; justifica brevemente.

### 3) Pide la clave de imágenes — con su salida de emergencia

En el MISMO mensaje, plantea lo de las fotos según lo que viste:

- **Si las fotos del producto son flojas / de proveedor:**
  > "Para que la web luzca, puedo generar fotos limpias y profesionales de tu
  > producto con inteligencia artificial, a partir de las tuyas. Cuesta unos
  > 2-3 € en créditos y necesitas una clave (te guío en 3 min). **Si prefieres
  > no hacerlo ahora, no pasa nada: dejo los huecos de fotos listos y tú pones
  > las que quieras desde el editor, cuando quieras.** ¿Te creo las fotos o lo
  > dejamos con huecos?"
- **Si las fotos ya son buenas:** no insistas con IA. Úsalas. Menciona la
  opción solo como extra ("si en algún momento quieres una foto que no tienes
  —un primer plano, un ambiente— puedo generarla").

Así, en un solo mensaje del usuario obtienes: ✔ confirmación/ajuste de estilo
y ✔ decisión sobre las fotos (con o sin clave). Si te da la clave, sigue la
fase 3b. Si no, construyes con sus fotos y/o huecos editables.

---

## RAMA B — No hay producto

La tienda no tiene catálogo aún. No puedes proponer sobre un producto concreto,
así que necesitas que el usuario describa su visión. El mensaje 2 le pide una
descripción libre (puede dictarla por voz, a su aire) + la clave de imágenes:

> "Veo que aún no tienes ningún producto subido — sin problema, lo añadirás
> cuando quieras y yo te dejo la página de producto preparada para cuando
> llegue. Para diseñar tu tienda a tu gusto, cuéntame con tus palabras (puedes
> dictarlo): **qué vas a vender y a quién, qué sensación quieres que dé la web
> (lujo, cercanía, natural, tecnología...), tus colores o logo si los tienes, y
> alguna web o marca cuyo estilo te guste.** Cuanto más me cuentes, más a tu
> gusto saldrá.
>
> Y una cosa más, en el mismo mensaje: si quieres, puedo generar imágenes para
> la web con inteligencia artificial (cuesta 2-3 € en créditos y necesito una
> clave que te explico en 3 min). **Si no, no pasa nada: dejo los huecos de
> imágenes listos para que pongas las tuyas desde el editor.**"

Cuando responda, extrae el brief de su texto libre igual que harías con una
entrevista. Si se deja algo importante (idioma, por ejemplo), elige un valor
razonable y sigue; lo ajustará viendo el resultado. **No abras un tercer
mensaje** salvo que falte algo que impida construir.

> Página de producto sin producto: la construyes igualmente (sección y
> plantilla `mt`), y dejas anotado en `ESTADO.md` que, cuando el usuario cree
> el producto, hay que asignarle la plantilla `mt` (lo harás tú con la Admin
> API en cuanto exista; ver `references/05-producto-y-paginas.md`).

---

## Menú de composiciones (para proponer, no para limitar)

Elige y adapta según producto y referencias. NO uses siempre las mismas;
combina e inventa variantes:

**Aperturas (hero):** imagen a sangre con texto superpuesto · producto recortado
flotando a un lado + texto al otro · vídeo de fondo con claim · carrusel con
textos por slide · split 50/50 color/foto · editorial (titular enorme + foto
panorámica).

**Cuerpo:** comparador antes/después · cifras animadas · pasos de uso 1-2-3 ·
grid de beneficios con iconos · bandas alternas imagen/texto · carrusel de
reseñas · galería de usos · FAQ desplegable · tabla comparativa · banda "visto
en" · ingredientes/materiales/especificaciones.

**Cierres:** CTA grande a pantalla · producto + precio + comprar · newsletter
solo si el usuario lo pide.

Para cada sección elegida, decide su variante (texto centrado vs. lateral,
fondo claro vs. oscuro, con/sin animación de entrada).

## Analiza las imágenes y referencias de verdad

De las fotos del producto y de cualquier referencia que pase, extrae decisiones
concretas: paleta exacta, tipografía (serif/sans/display), densidad (aire vs.
compacto), tratamiento de fotos (recortadas, a sangre, polaroid), bordes
(rectos vs. redondeados), sombras (planas vs. elevadas). "Minimalista" no es un
brief; "fondo crema #F6F1EA, titulares serif grandes, fotos a sangre con
esquinas 24px, botones píldora negros" sí.

## Preparar las imágenes (las que uses tal cual)

- Copia las imágenes que vayas a usar a `assets/` con nombres ASCII en
  minúsculas y descriptivos del SLOT, no del contenido: `mt-hero-fondo.jpg`,
  `mt-producto-flotante.png`, `mt-uso-1.jpg`... (en Shopify los assets van
  planos, sin subcarpetas).
- Las fotos del producto descargadas en la fase 1 viven en `fotos-producto/`;
  usa copias en `assets/` solo de las que entren en el diseño.
- Si una imagen pesa >2-3 MB, redimensiona a ~2000px de ancho si tienes
  herramienta; si no, avisa de carga lenta.
- Las imágenes en `assets/` son los valores por defecto de cada sección; el
  usuario podrá sustituirlas desde el editor (patrón image_picker + fallback de
  la fase 4).

## Propuesta y validación (sin alargar)

Si en la rama A ya propusiste y el usuario confirmó, no repreguntes: construye.
Si pidió cambios, intégralos y construye. Una ronda de feedback basta; el resto
se ajusta sobre el resultado real.

## Cierre de la fase

1. Escribe el brief completo en `ESTADO.md` (paleta, tipografía, tono,
   estructura acordada, idioma, decisión sobre fotos IA y producto leído).
2. Si dio clave de imágenes → `references/08-fotos-ia.md` (fase 3b).
3. Si no → directo a `references/04-secciones-personalizadas.md`, dejando los
   huecos de imágenes como image_picker editables.
