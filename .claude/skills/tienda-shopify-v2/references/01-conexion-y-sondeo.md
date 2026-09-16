# Fase 1 — Conexión rápida + sondeo del producto

Objetivo: con SOLO el enlace de la tienda, dejar dos cosas listas —
(1) sesión iniciada para el tema y para los datos de la tienda, y
(2) saber si hay producto y, si lo hay, tenerlo leído y sus fotos descargadas.
Todo esto SIN pedirle al usuario más que el enlace y un clic de login.

## El único mensaje de arranque (mensaje 1)

Pide solo el enlace. Nada de fotos, ni de estilo, ni de claves todavía:

> "¡Vamos a montar tu tienda! Para empezar solo necesito **una cosa**: la
> dirección de tu tienda de Shopify. Si tienes abierto tu panel de Shopify,
> copia lo que aparece en la barra del navegador (algo como
> `admin.shopify.com/store/NOMBRE`) y pégamelo aquí. Con eso me conecto, miro
> lo que ya tienes y te preparo una propuesta — tú puedes irte a hacer otra
> cosa mientras."

### ¿Y si no tiene tienda todavía?

Es lo ÚNICO que no puedes hacer tú (requiere registrarse con su correo y elegir
plan). Si dice que no la tiene:

> 1. Entra en shopify.com y pulsa "Empezar prueba gratis".
> 2. Sigue los pasos con tu correo. Cuando te pregunte qué vas a vender,
>    responde cualquier cosa — se cambia luego.
> 3. Cuando veas el panel (menú con "Pedidos", "Productos"...), pégame la
>    dirección de la barra del navegador.

No necesita configurar nada más del panel para que empecemos.

## Normalizar el dominio

Necesitas el dominio interno `NOMBRE.myshopify.com`. De
`admin.shopify.com/store/cebgq0-sc` el dominio es `cebgq0-sc.myshopify.com`.
Acepta cualquier formato (con https, sin él, solo el nombre) y normalízalo tú.
Guárdalo en `ESTADO.md`.

## Dos sesiones, un mismo estilo de login

En la v2 abrimos DOS sesiones (cada una es un clic de navegador). Encadénalas
para no molestar dos veces si puedes, pero ambas usan el mismo patrón sencillo.
Avisa ANTES:

> "Ahora voy a conectar con tu tienda. Se abrirá tu navegador una o dos veces
> para que des permiso: 1) inicia sesión con tu cuenta de Shopify, 2) pulsa el
> botón de autorizar/conectar, 3) vuelve aquí. Yo espero todo lo que haga
> falta."

### Sesión A — tema (para construir y subir el diseño)

El login del tema se dispara con el primer comando que habla con la tienda:

```
shopify theme list --store NOMBRE.myshopify.com
```

- Ejecútalo con timeout generoso (3-5 min) o en segundo plano: se queda
  esperando mientras el usuario hace el login. No lo mates a los 30 s.
- Si el navegador no se abre solo, la salida trae la URL — pásasela.
- Éxito = imprime la tabla de temas (te servirá luego para el ID del tema).

### Sesión B — datos de la tienda (para leer y escribir el producto)

Es la novedad de la v2. Autoriza el acceso a los datos del producto con los
permisos que la skill necesita (lee `references/09-admin-api.md` para el porqué
de cada permiso):

```
shopify store auth --store NOMBRE.myshopify.com --scopes read_products,write_products,read_files,write_files
```

- Mismo tipo de login de navegador (un clic). Guarda un token para el resto de
  la sesión.
- Si el usuario no es el dueño de la tienda o rechaza algún permiso, podrás
  seguir igualmente: la skill cae a los planes B (leer por otras vías y pedir
  que pegue título/descripción). Pero intenta SIEMPRE esta sesión primero: es
  lo que hace que todo salga automático.

## Sondeo del producto (lo que define el mensaje 2)

Con la sesión B lista, comprueba si hay producto. Usa la consulta incluida
(detalle completo en `references/09-admin-api.md`):

```
shopify store execute --store NOMBRE.myshopify.com \
  --query-file <ruta-skill>/scripts/gql/leer-producto.graphql \
  --variables '{"n": 5}' --json
```

Interpreta el resultado:

### Caso A — HAY producto

1. Elige el producto principal (el más reciente/activo; si hay varios y dudas,
   lo aclaras en el mensaje 2 sin abrir un mensaje extra).
2. Guarda en `ESTADO.md`: `id` (`gid://shopify/Product/...`), `handle`, título
   y descripción.
3. **Descarga TODAS sus imágenes** a `<proyecto>/fotos-producto/` con
   `scripts/descargar-imagenes.mjs` (ver `09-admin-api.md`).
4. **Míralas de verdad** (léelas como imágenes) y lee la descripción: necesitas
   entender qué es el producto, su material, su tono y la calidad de las fotos.
5. Con eso, prepara la PROPUESTA DE ESTILO del mensaje 2 (fase 3, rama A).

> Nota: el proyecto quizá aún no exista (la fase 2 lo crea). Si necesitas una
> carpeta para las fotos antes de la fase 2, créala ya en la ruta segura
> prevista (`C:\tiendas\<nombre>\fotos-producto` / `~/tiendas/...`).

### Caso B — NO hay producto

No pasa nada: la tienda está vacía de catálogo. No fuerces nada. El mensaje 2
irá por la rama "no hay producto" de la fase 3 (le pides una descripción libre
de cómo quiere la tienda; el producto lo añadirá él más tarde).

## Errores comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Store not found" o 404 | Dominio mal escrito | Revisa el nombre; pide que pegue la URL completa del panel y extráelo tú |
| El login del tema funciona pero falla con permisos | Cuenta que no es dueña/staff | `shopify auth logout` y login con la cuenta correcta |
| `store auth` no existe | Shopify CLI antiguo (<3.93) | Actualiza: `npm install -g @shopify/cli@latest` (fase 0) y reintenta |
| `store execute` responde "no autorizado"/401 | Token caducado (online, ~24 h) o falta scope | Repite `shopify store auth ...`; los scopes ya dados se conservan |
| El usuario rechaza los permisos de datos | No quiere/ no es dueño | Sigue solo con la sesión del tema; usa planes B (pegar manual) |
| "This store requires a password" al ver la web | Protección de tienda nueva (no es error) | La contraseña está en el panel: Tienda online → Preferencias |
| Errores de red al autenticar | Proxy/VPN/antivirus | Que apague la VPN un momento; reintenta |

## Cierre de la fase

1. Confirma: la tabla de temas sale (sesión A) y la consulta de producto
   responde sin error (sesión B).
2. Mensaje al usuario: "✅ Conectado con tu tienda." (Si leíste un producto,
   NO sueltes aún la propuesta: eso es el mensaje 2 tras crear el proyecto.)
3. Apunta en `ESTADO.md`: dominio, fecha de login OK, si hay producto y sus
   datos.
4. Pasa a `references/02-proyecto-tema.md` (crear el proyecto) y luego a
   `references/03-brief-en-un-mensaje.md` (el mensaje 2).
