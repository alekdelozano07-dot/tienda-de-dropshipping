# Fase 6 — Publicar (subir los cambios a Shopify)

Regla central de la skill: **toda tanda de cambios termina con una subida
automática, sin que el usuario la pida.** Si no subes, el usuario mira su
tienda, no ve nada nuevo y concluye que "no ha funcionado".

## El comando

```
shopify theme push --store NOMBRE.myshopify.com --path <carpeta> --theme <ID>
```

- Usa SIEMPRE el `--theme <ID>` del tema de trabajo (el que creaste en la fase
  2 con `--unpublished`). El ID sale en `shopify theme list --store ...` o en
  la salida del primer push. Guárdalo en `ESTADO.md` para no volver a
  preguntarlo.
- Sin `--theme`, el CLI pregunta interactivamente a qué tema subir — evítalo,
  los menús interactivos se llevan mal con la automatización y con el usuario.
- Para acelerar iteraciones puedes subir solo lo tocado:
  `--only sections/mt-hero.liquid --only assets/mt-styles.css` (repite el flag
  por archivo). Ante la duda, sube todo.
- NUNCA uses `--allow-live` para subir directamente al tema publicado mientras
  iteráis, salvo que el tema de trabajo YA sea el publicado (tienda lanzada) y
  el usuario quiera los cambios en vivo.

## Leer el resultado (no des nada por hecho)

El push puede terminar "con errores" y aun así subir parte. Trata cualquier
bloque `error` de la salida como bloqueante:

1. Lee el archivo y el mensaje (suelen venir claros:
   `sections/mt-footer.liquid - Invalid schema: ...`).
2. Corrige el archivo.
3. Vuelve a subir.
4. Repite hasta push limpio.
5. Solo entonces informa al usuario.

Errores de validación frecuentes y su causa (detalle en la fase 4, sección de
trampas):

| Mensaje (aprox.) | Causa | Arreglo |
|---|---|---|
| `default debe ser una cadena o ruta de fuente de datos` en un setting url | `"default"` en un `"type": "url"` | Quitar el default del schema |
| `Invalid schema: ... JSON` | Coma final, comillas, comentario en el JSON | Reescribir el schema con JSON válido |
| `range` inválido | (max−min)/step > 101 | Ajustar step |
| `Section type 'xxx' does not exist` en un template | `type` del JSON no coincide con el nombre de archivo | Igualar nombres |
| `liquid syntax error` | Tag sin cerrar, filtro inexistente | Revisar el Liquid indicado |

## Previsualizar

Tras cada push limpio, da al usuario el enlace de previsualización del tema de
trabajo:

```
https://NOMBRE.myshopify.com/?preview_theme_id=<ID>
```

(También sirve el botón "Vista previa" junto al tema en el panel.) Mensaje
tipo:

> "✅ Cambios subidos. Míralos aquí: <enlace>. Si la página te pide una
> contraseña, es la protección de tiendas nuevas — está en tu panel: Tienda
> online → Preferencias. Dime qué te parece y seguimos afinando."

Alternativa para sesiones largas de diseño: `shopify theme dev --store ...`
levanta una vista en `http://127.0.0.1:9292` que se refresca sola con cada
cambio de archivo. Útil mientras iteras mucho; pero recuerda que dev NO
publica nada: al terminar la sesión de dev, haz el push normal igualmente.

## Auto-revisión tras cada subida (no entregues sin mirar)

Tú ejecutas TODOS los comandos (push, list, dev...) — nunca le pidas al
usuario que "tire un comando". Y tras cada push limpio, revisa tú mismo el
resultado desplegado antes de enseñarlo. Escalera de auto-revisión, de mejor
a peor:

1. **Si tienes herramientas de navegador** (captura de pantalla / abrir
   páginas): abre la URL de previsualización, captura la portada completa y
   la página de producto, y revísalas como diseñador: ¿franjas raras?,
   ¿textos cortados?, ¿imágenes sin cargar?, ¿se parece al brief? Corrige lo
   que veas y vuelve a subir.
2. **Sin navegador, con la tienda protegida por contraseña**: levanta
   `shopify theme dev --store ... --theme <ID>` en segundo plano — sirve la
   web en `http://127.0.0.1:9292` SIN pedir la contraseña de la tienda
   (usa tu sesión del CLI). Descarga ese HTML (curl/Invoke-WebRequest o tu
   herramienta de lectura de páginas) y comprueba: que responden 200 la home
   y `/products/<handle>`, que aparecen tus secciones (busca `mt-`), que no
   hay errores Liquid en el HTML (busca "Liquid error"), y que los assets
   (`mt-styles.css`, `mt-scripts.js`, imágenes) responden 200. Cierra el
   proceso dev al terminar.
3. **Último recurso**: pide al usuario una captura ("ábreme este enlace y
   mándame una foto de cómo se ve") — solo si 1 y 2 fallaron.

La contraseña de la tienda, si hiciera falta para la URL pública, pídesela
por chat ("está en tu panel: Tienda online → Preferencias, el cuadro de
contraseña — pégamela aquí") — nunca le digas que configure nada él.

## Antes de previsualizar: asigna la plantilla de producto

En cuanto el primer push limpio incluya `templates/product.mt.json`, asigna esa
plantilla al producto con la Admin API (no esperes a publicar):
`shopify store execute ... actualizar-producto.graphql` con
`templateSuffix: "mt"` (ver `references/09-admin-api.md`, apartado 4, y la fase
5). Así el enlace de previsualización del producto ya muestra TU diseño. Es la
diferencia clave con la v1: la página de producto queda lista de primeras, sin
pedirle clics al usuario.

## Publicar en vivo (solo con OK explícito)

Cuando el usuario confirme que quiere ese diseño como SU web pública:

```
shopify theme publish --store NOMBRE.myshopify.com --theme <ID>
```

o desde el panel (Tienda online → Temas → ⋯ → Publicar). Pide confirmación
explícita antes ("¿La publico como tu web definitiva? Tu tema actual queda
guardado y se puede volver atrás."). Después de publicar, recuerda que el
tema de trabajo y el publicado son ahora el mismo: los push siguientes
necesitarán `--allow-live` (avisa al usuario de que sus cambios serán
visibles al instante).

## Después de cada publicación

1. Actualiza `ESTADO.md`: fecha, hora, qué se cambió, ID del tema.
2. Si quedó algo pendiente del lado del usuario (rellenar políticas, crear el
   producto, quitar la contraseña), recuérdaselo en una lista corta de ✅/⬜.
