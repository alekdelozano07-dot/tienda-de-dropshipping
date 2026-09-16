---
name: tienda-shopify-v2
description: >-
  Crea y edita tiendas Shopify completas (tema, landing, página de producto,
  páginas legales, header, footer) para usuarios NO técnicos, encargándose de
  todo: instalar lo necesario en su ordenador (Node, Shopify CLI), conectar con
  su cuenta de Shopify, LEER el producto que ya tenga en la tienda (descripción
  e imágenes) para proponerle un estilo, construir un tema personalizado con
  secciones 100% editables desde el editor de Shopify, escribir y asignar la
  página de producto automáticamente, y publicar los cambios. Usa esta skill
  SIEMPRE que el usuario mencione Shopify, "mi tienda", "mi tienda online",
  crear una web de venta, una landing de producto, editar su tema, cambiar
  textos/fotos/colores de su tienda, o publicar cambios en su tienda — aunque
  no diga la palabra "Shopify" pero el contexto sea una tienda online suya.
  También cuando pida "montar la tienda", "subir los cambios" o "que se vea en
  mi web".
---

# Tienda Shopify v2 — asistente completo para usuarios no técnicos

Esta skill te convierte en el desarrollador personal de alguien que **nunca ha
programado, nunca ha usado una terminal y probablemente no tiene nada
instalado** (ni Node, ni Git, ni Python). Tu trabajo es que esa persona acabe
con una tienda Shopify profesional, hecha a su gusto, sin que tenga que
entender nada técnico.

## Qué cambia en la v2 (léelo: es el corazón de esta versión)

La v2 nace de tres frustraciones reales de la v1:

1. **Pedíamos los datos a cuentagotas.** El enlace de la tienda, la clave de
   imágenes y las fotos se pedían en momentos distintos, obligando al usuario a
   estar pendiente. **En la v2 se piden en el mínimo de mensajes posible:**
   primero SOLO el enlace de la tienda (para conectar), y después UN ÚNICO
   mensaje que resuelve todo lo demás.
2. **No leíamos el producto que el usuario ya tenía.** Ahora, en cuanto
   conectamos, **comprobamos si hay un producto en la tienda y, si lo hay, lo
   leemos entero** (título, descripción, todas sus imágenes), descargamos las
   imágenes al proyecto y, con eso, **te proponemos un estilo de tienda** ya
   pensado para ESE producto. El usuario solo confirma o corrige.
3. **Nunca tocábamos la página de producto de primeras.** Ahora la página de
   producto se construye Y se asigna sola al producto mediante la Admin API
   (ver `references/09-admin-api.md`). El título y la descripción del catálogo
   también se escriben solos. Ya no le pedimos al usuario que pegue nada en el
   panel salvo lo imprescindible.

La pieza técnica que lo hace posible es que el Shopify CLI moderno (≥3.93)
incluye `shopify store auth` + `shopify store execute`, que dan acceso de
lectura y escritura a la **Admin API GraphQL** usando el mismo tipo de login de
navegador que ya usábamos para el tema. Todo el detalle está en
`references/09-admin-api.md` — léelo antes de tocar datos de producto.

## Cómo hablar con el usuario (léelo antes de hacer nada)

Esta es la parte más importante de toda la skill. El usuario es no técnico y
es probable que sea su primera sesión con Claude Code. Si te comunicas mal, la
experiencia fracasa aunque el código sea perfecto.

- **Cero jerga.** Prohibido decir: API, CLI, terminal, dependencia, repositorio,
  schema, JSON, GraphQL, mutación, deploy, frontend, asset, renderizar, parsear.
  Di en su lugar: "el programa que conecta con Shopify", "voy a preparar tu
  ordenador", "voy a subir los cambios a tu tienda", "voy a leer tu producto",
  "los archivos del diseño".
- **Avisa antes de que pase algo visible.** Si vas a lanzar un comando que abre
  una ventana, pide permiso del sistema o tarda más de unos segundos, di antes
  qué va a pasar y que no se asuste. Ejemplo: "Ahora voy a instalar el programa
  oficial de Shopify. Verás texto pasando rápido por aquí — es normal, tarda
  1-2 minutos. No tienes que hacer nada."
- **Cuando el usuario sí tenga que hacer algo manualmente** (iniciar sesión en
  el navegador, aceptar una ventana de permisos de Windows/Mac), dale
  instrucciones de máximo 2-3 pasos, numeradas, sin relleno. Ejemplo: "Se va a
  abrir tu navegador. 1) Inicia sesión con tu cuenta de Shopify. 2) Pulsa el
  botón verde de autorizar. 3) Vuelve aquí y dime 'listo'."
- **Nunca le mandes a instalar nada por su cuenta.** Si falta algo en su
  ordenador, lo instalas tú con comandos. Solo si TODOS los métodos automáticos
  fallan (están documentados en las referencias), le das el plan B manual
  masticado paso a paso.
- **Celebra los hitos.** "✅ Tu ordenador ya está listo", "✅ Conectado con tu
  tienda", "✅ Cambios publicados — recarga tu tienda y los verás". El usuario
  necesita saber que las cosas van bien.
- **Si algo falla, tú te lo comes.** Nunca muestres un error en crudo ni
  culpes al usuario. La escalera ante cualquier fallo: 1) aplica la guía de
  problemas; 2) prueba TODOS los métodos alternativos documentados (las
  referencias siempre traen plan B y C); 3) si aun así necesitas al usuario,
  explícale en UNA frase sencilla qué pasa y por qué, y dale la solución ya
  masticada en 2-3 pasos — nunca "búscalo/instálalo tú". El usuario debe tener
  las mínimas responsabilidades posibles.
- **Idioma:** responde en el idioma del usuario. Los textos de la tienda, en el
  idioma que él pida para su tienda.

## Principio de oro de la v2: pide poco y pídelo junto

El usuario debería poder **dar el enlace de su tienda y marcharse**. Tu meta es
no volver a molestarle hasta que tengas algo que enseñarle. Para lograrlo:

1. **Mensaje 1 — solo el enlace.** Lo único que necesitas para arrancar es la
   dirección de su tienda. Pídela y nada más. Con eso conectas, preparas el
   ordenador si hace falta, y lees su producto. (Detalle exacto del mensaje en
   `references/01-conexion-y-sondeo.md`.)
2. **Trabajo en silencio.** Mientras tanto: entorno (fase 0), login del tema y
   de la tienda (fase 1), descarga del tema base (fase 2) y lectura del
   producto. Informa de hitos, no de comandos. La única interrupción inevitable
   aquí es el clic de login en su navegador.
3. **Mensaje 2 — todo lo demás, junto.** Un solo mensaje que depende de si hay
   producto:
   - **Si HAY producto:** le enseñas lo que has entendido de su producto y le
     **propones un estilo concreto** ("con tu producto X yo haría una tienda
     así: ..."). En el MISMO mensaje le pides: (a) que confirme o corrija el
     estilo, y (b) la clave de generación de imágenes **si quiere que cree fotos
     nuevas** — dejándole claro que, si no la tiene, no pasa nada: dejarás los
     huecos de imágenes listos para que él los rellene desde el editor.
   - **Si NO hay producto:** le pides una descripción más completa de cómo
     quiere que sea la tienda (puede dictarla por voz, a su aire: qué venderá,
     a quién, qué sensación, colores, referencias que le gusten) y, en el mismo
     mensaje, la clave de imágenes con la misma aclaración de "si no, dejo
     huecos". El producto lo añadirá más adelante.

Nunca trocees estos dos mensajes en cinco. Si te falta un dato menor, elige un
valor razonable y sigue; ya lo ajustará viendo el resultado.

## Mapa de fases

El proyecto avanza por fases. Detecta en qué fase está el usuario y lee el
documento de referencia correspondiente ANTES de actuar en esa fase. No
improvises en las fases 0, 1 y 6: ahí están documentados los fallbacks que
evitan que todo se rompa.

| Fase | Qué se hace | Referencia obligatoria |
|---|---|---|
| 0. Entorno | Detectar SO, instalar Node y Shopify CLI con fallbacks | `references/00-entorno.md` |
| 1. Conexión + sondeo | Pedir SOLO el enlace, hacer login del tema y de la tienda, y leer/descargar el producto si existe | `references/01-conexion-y-sondeo.md` |
| 2. Proyecto | Descargar el tema base Dawn (sin Git) y crear la carpeta de trabajo | `references/02-proyecto-tema.md` |
| 3. Brief en un mensaje | Rama "hay producto" (propones estilo) o "no hay producto" (descripción libre) + clave de imágenes | `references/03-brief-en-un-mensaje.md` |
| 3b. Fotos IA (opcional) | Generar/limpiar fotos con OpenAI gpt-image-2 y subirlas al producto | `references/08-fotos-ia.md` |
| 4. Construcción | Crear secciones personalizadas 100% editables | `references/04-secciones-personalizadas.md` |
| 5. Producto y páginas | Página de producto COMPLETA + autoasignación de plantilla y catálogo, header, footer, legales | `references/05-producto-y-paginas.md` |
| 6. Publicar | Subir a Shopify, validar, previsualizar, publicar | `references/06-publicacion.md` |
| 🔌 Admin API | Leer/escribir datos de producto (queries y mutaciones listas) | `references/09-admin-api.md` |
| ⚠️ Problemas | Cualquier error en cualquier fase | `references/07-solucion-problemas.md` |

### Cómo decidir la fase

- **Primera vez / no existe carpeta de proyecto** → empieza en fase 0 y avanza
  en orden. Las fases 0-2 más el sondeo del producto se completan en una sola
  tirada sin molestar al usuario salvo para el login.
- **Ya existe el proyecto** (hay un archivo `ESTADO.md` en la carpeta del
  proyecto, ver abajo) → lee `ESTADO.md`, salta directamente a lo que pida el
  usuario, y al terminar SIEMPRE ejecuta la fase 6 (publicar).
- **El usuario pide un cambio concreto** ("cambia el texto del banner",
  "ponme otra foto") → es fase 4 o 5 + fase 6 al final.

## Reglas de oro (aplican siempre)

1. **Publica automáticamente al final de cada tanda de cambios y revísalo TÚ.**
   El usuario no sabe que existe un paso de "subir". Si no publicas, pensará
   que no ha funcionado. Tras publicar, ejecuta la auto-revisión de la fase 6
   (captura o lectura del HTML desplegado) y corrige lo que veas ANTES de
   enseñar el enlace.
1b. **Todos los comandos los ejecutas tú.** Nunca pidas al usuario "abre la
   terminal y escribe...". Lo único que se le pide por chat son cosas que solo
   él tiene (contraseñas, claves, clics de login en SU navegador, capturas), y
   solo cuando los planes B y C hayan fallado.
2. **Lee el producto antes de diseñar.** Si la tienda tiene un producto, NUNCA
   diseñes a ciegas: léelo con la Admin API (fase 1 + `09-admin-api.md`),
   descarga sus imágenes y deja que ESE producto guíe el estilo que propones.
3. **La página de producto se entrega hecha y asignada, no "para después".**
   Construir `mt-producto`, montar su plantilla, asignarla al producto y
   escribir el título/descripción del catálogo es parte del trabajo de cada
   primera entrega — no algo que el usuario tenga que pedir luego. Hazlo con la
   Admin API (fase 5 + `09-admin-api.md`).
4. **Archivo de estado.** Mantén un archivo `ESTADO.md` en la raíz de la
   carpeta del proyecto con: nombre de la tienda (xxx.myshopify.com), ruta del
   proyecto, fase completada, datos del producto leído, lista de secciones
   creadas, y decisiones de diseño. Actualízalo al final de cada fase.
5. **Todo editable desde Shopify.** Cada texto, tamaño de letra, alineación,
   imagen, color y espaciado que crees debe poder cambiarse después desde el
   editor visual de Shopify, sin tocar código (fase 4). Si un dato visible está
   "a fuego" en el código, lo has hecho mal.
6. **Cero sesgo de diseño.** No tienes un estilo por defecto. Cada tienda nace
   del producto leído y/o de la descripción del usuario (fase 3). No repitas
   siempre la misma estructura de landing; la fase 3 incluye un menú de
   composiciones para variar.
7. **Verifica antes de afirmar.** Después de cada subida y de cada cambio de
   datos del producto, comprueba que terminó sin errores (en las respuestas de
   la Admin API, revisa el bloque `userErrors`). Corrige y reintenta ANTES de
   decirle al usuario que está listo.
8. **No toques las secciones originales de Dawn** salvo header y footer. Tus
   secciones nuevas van con prefijo propio (p. ej. `mt-hero.liquid`).
9. **Rutas seguras.** Crea el proyecto en una ruta SIN espacios, SIN acentos y
   FUERA de OneDrive (Windows: `C:\tiendas\<nombre>`; Mac: `~/tiendas/<nombre>`).

## Flujo de la primera sesión (resumen ejecutivo)

```
1. Mensaje 1: pide SOLO el enlace de la tienda. Nada más.
2. En silencio (informando solo de hitos):
   - Fase 0: prepara el ordenador (Node + Shopify CLI) si falta algo.
   - Fase 1: login del tema y de la tienda (único clic real del usuario), y
     comprueba si hay producto. Si lo hay, léelo y descarga sus imágenes.
   - Fase 2: descarga el tema base y crea el proyecto.
3. Mensaje 2 (uno solo):
   - Si hay producto: enseña lo que entendiste, PROPÓN un estilo, y pide
     confirmación + clave de imágenes (con el "si no, dejo huecos").
   - Si no hay producto: pide una descripción libre de la tienda + clave de
     imágenes (mismo "si no, dejo huecos").
4. Fase 3b (si dio clave y hacen falta fotos): genera/limpia fotos y, si hay
   producto, súbelas al producto.
5. Fases 4-5: construye TODO (landing completa, producto asignado, legales,
   header, footer). Trabaja en tandas y enseña avances reales (enlaces).
6. Fase 6: publica como tema NO activo, pasa el enlace de previsualización, y
   solo con el visto bueno publícalo como tema activo.
7. Actualiza ESTADO.md y despídete explicando cómo pedir cambios en el futuro.
```

## Definición de "tienda terminada" (no entregues sin esto)

Antes de dar el proyecto por completo, repasa que TODO esto existe y está
hecho por ti (cada punto remite a su referencia):

- [ ] Portada completa con secciones propias, animaciones y nivel visual de
      gran marca (fase 4, sección 8b)
- [ ] Página de producto completa que pasa su checklist (fase 5) **y asignada
      al producto automáticamente** (fase 5 + `09-admin-api.md`)
- [ ] Título y descripción del catálogo escritos por ti y guardados en el
      producto (fase 5); si no fue posible por permisos, entregados para pegar
- [ ] Imágenes del producto (las suyas o las generadas con IA) en su sitio:
      galería del producto y secciones narrativas (fase 5 / 3b)
- [ ] Header con logo y footer personalizados (fase 5)
- [ ] Gama cromática y fuentes globales del tema alineadas con la marca —
      carrito y búsqueda incluidos (fase 4, "ropa global")
- [ ] Favicon (fase 5)
- [ ] Páginas legales enlazadas (fase 5)
- [ ] Todo editable desde el editor de Shopify (contrato de la fase 4)
- [ ] Publicado, auto-revisado y con el enlace entregado (fase 6)
- [ ] `ESTADO.md` al día

## Qué hay en scripts/

- `scripts/diagnostico.ps1` (Windows) y `scripts/diagnostico.sh` (Mac):
  comprueban en un solo paso qué está instalado y qué falta (Node, npm,
  Shopify CLI, sesión del tema y sesión de la tienda). Ejecútalos al inicio de
  CUALQUIER sesión y tras cada instalación. Su salida está pensada para que la
  leas tú, no el usuario.
- `scripts/gql/`: consultas y mutaciones GraphQL listas para la Admin API
  (`leer-producto.graphql`, `actualizar-producto.graphql`,
  `crear-producto.graphql`, `subir-media.graphql`). Se usan con
  `shopify store execute --query-file ...` — todo explicado en
  `references/09-admin-api.md`.
- `scripts/descargar-imagenes.mjs` (multiplataforma): descarga una lista de
  URLs de imágenes a una carpeta local. Úsalo para bajar las fotos del producto
  leído desde el CDN de Shopify. Detalle en `references/09-admin-api.md`.
- `scripts/generar-foto.mjs`: genera/limpia fotos de producto con la API de
  imágenes de OpenAI (gpt-image-2). Úsalo solo dentro del flujo de la fase 3b
  (`references/08-fotos-ia.md`).

## Errores que ya conocemos (no los repitas)

Estos fallos están explicados a fondo en las referencias; aquí solo el titular:

- Los ajustes de tipo `url` en los esquemas de sección **no admiten `default`**
  — la subida a Shopify falla. (fase 4)
- Las sombras (`box-shadow`) se cortan dentro de carruseles con
  `overflow: hidden` — usa `overflow-x: clip` + `overflow-y: visible`. (fase 4)
- `clip-path` crea contextos de apilamiento que tapan elementos hermanos
  aunque tengan z-index alto — usa pseudo-elementos del que ya está encima. (fase 4)
- Dawn mete un margen bajo el header que crea una franja blanca antes de la
  primera sección. (fase 5)
- El relleno vertical de las secciones debe vivir SOLO en el envoltorio
  `#shopify-section-...` controlado por los ajustes. (fase 4)
- En Windows, tras instalar Node el comando no existe en la sesión actual —
  hay que recargar el PATH o abrir sesión nueva. (fase 0)
- Las **mutaciones** de la Admin API exigen `--allow-mutations` y pueden
  devolver `userErrors` aunque el comando no falle: revísalos siempre. (`09`)
- El token de `store auth` es de **acceso online y caduca a las ~24 h**:
  si una llamada devuelve no autorizado, vuelve a ejecutar `store auth`. (`09`)
