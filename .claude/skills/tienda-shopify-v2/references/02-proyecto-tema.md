# Fase 2 — Crear el proyecto y descargar el tema base (sin Git)

Objetivo: una carpeta local con una copia del tema **Dawn** (el tema oficial y
gratuito de Shopify) sobre la que construiremos todo lo personalizado.

## Por qué Dawn

- Es el tema de referencia de Shopify: gratuito, rápido, accesible y siempre
  compatible con el editor visual.
- Trae resueltos carrito, búsqueda, colecciones, cuenta de cliente, etc. —
  cosas que NO queremos reconstruir.
- Nuestra estrategia: **no tocamos sus secciones originales** (salvo header y
  footer); añadimos secciones nuevas con prefijo propio y montamos la portada
  y la página de producto con ellas. Así nada de Dawn se rompe y todo lo
  nuestro es independiente.

## Crear la carpeta del proyecto

Ruta sin espacios, sin acentos, fuera de OneDrive:

- Windows: `C:\tiendas\<nombre-corto>` (p. ej. `C:\tiendas\velasluna`)
- Mac: `~/tiendas/<nombre-corto>`

El `<nombre-corto>` derivado del nombre de la tienda, en minúsculas, solo
letras/números/guiones.

## Descargar Dawn — método A: ZIP de GitHub (preferido, sin Git)

Windows (PowerShell):

```powershell
Invoke-WebRequest -Uri "https://github.com/Shopify/dawn/archive/refs/heads/main.zip" -OutFile "$env:TEMP\dawn.zip"
Expand-Archive -Path "$env:TEMP\dawn.zip" -DestinationPath "$env:TEMP\dawn-extract" -Force
Copy-Item "$env:TEMP\dawn-extract\dawn-main\*" -Destination "C:\tiendas\<nombre>" -Recurse -Force
```

Mac:

```bash
curl -fsSL -o /tmp/dawn.zip "https://github.com/Shopify/dawn/archive/refs/heads/main.zip"
unzip -q /tmp/dawn.zip -d /tmp/dawn-extract
cp -R /tmp/dawn-extract/dawn-main/* ~/tiendas/<nombre>/
```

## Descargar Dawn — método B: shopify theme init

Si GitHub está bloqueado o el ZIP falla:

```
shopify theme init <nombre-carpeta>
```

(crea la carpeta con Dawn dentro; muévela/úsala como carpeta del proyecto).
Nota: algunas versiones del CLI usan Git por debajo para `init`; si falla por
no tener Git, vuelve al método A o usa el método C.

## Descargar Dawn — método C: bajar el tema actual de la tienda

Las tiendas nuevas traen un tema basado en Dawn ya instalado. Sirve como base:

```
shopify theme pull --store NOMBRE.myshopify.com --path <carpeta>
```

Elige el tema activo cuando pregunte. (Ojo: puede ser "Horizon" u otro tema
nuevo de Shopify en lugar de Dawn — la estructura de carpetas es la misma y
nuestro enfoque de secciones propias funciona igual.)

## Verificar la descarga

La carpeta debe contener al menos: `assets/`, `config/`, `layout/`,
`locales/`, `sections/`, `snippets/`, `templates/`. Si falta alguna, la
descarga fue incompleta: borra y reintenta con otro método.

## Crear ESTADO.md

Crea ya el archivo de estado en la raíz del proyecto:

```markdown
# Estado del proyecto — <Nombre de la tienda>

- Tienda: <nombre>.myshopify.com
- Carpeta: <ruta>
- Tema base: Dawn (descargado <fecha>)
- Entorno: Node <ver>, Shopify CLI <ver> — OK
- Última publicación: (pendiente)

## Fases completadas
- [x] 0 Entorno
- [x] 1 Conexión
- [x] 2 Proyecto
- [ ] 3 Diseño
- [ ] 4 Construcción
- [ ] 5 Páginas
- [ ] 6 Publicación

## Decisiones de diseño
(se rellena en la fase 3)

## Secciones creadas
(se rellena en la fase 4)
```

## Primera subida (recomendada)

Sube ya el tema tal cual como tema NO publicado con un nombre reconocible.
Esto valida la conexión de extremo a extremo antes de invertir horas en
diseño, y reserva el "hueco" del tema:

```
shopify theme push --store NOMBRE.myshopify.com --unpublished --theme "<Nombre> (Claude)" --path <carpeta>
```

En adelante, todas las subidas van contra ese mismo tema (la fase 6 explica
cómo). Si esta primera subida falla, resuelve con
`references/07-solucion-problemas.md` ANTES de seguir: mejor descubrirlo ahora.

## Cierre de la fase

1. Mensaje: "✅ Ya tengo la base de tu tienda preparada en tu ordenador.
   Ahora viene lo divertido: el diseño."
2. Actualiza `ESTADO.md`.
3. Pasa a `references/03-brief-en-un-mensaje.md`.
