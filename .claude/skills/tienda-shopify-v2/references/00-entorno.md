# Fase 0 — Preparar el ordenador del usuario

Objetivo: dejar instalados y funcionando **Node.js (LTS)** y **Shopify CLI**.
Es lo único que se necesita. NO hace falta Git (el tema base se descarga como
ZIP), NO hace falta Python, NO hace falta Ruby.

Supón siempre el peor caso: ordenador recién comprado, sin nada instalado,
usuario sin permisos de administrador claros, antivirus activo.

## Paso 0 — Detectar el sistema operativo

Ya lo sabes por tu entorno (`platform: win32` = Windows; `darwin` = Mac). No le
preguntes al usuario. Usa la rama correspondiente de este documento.

## Paso 1 — Diagnóstico

Ejecuta el script de diagnóstico de la skill (`scripts/diagnostico.ps1` en
Windows, `scripts/diagnostico.sh` en Mac). Si por lo que sea no puedes
ejecutarlo, haz las comprobaciones a mano:

```
node -v        → ¿existe? ¿versión >= 18?
npm -v         → ¿existe?
shopify version → ¿existe?
```

Importante en Windows: ejecuta cada comprobación tolerando el fallo (el
comando no existirá la primera vez y eso NO es un error, es información).
En PowerShell usa `Get-Command node -ErrorAction SilentlyContinue`.

Según el resultado:
- Todo instalado → salta a la fase 1 (conexión).
- Falta algo → continúa por orden: primero Node, luego Shopify CLI.

Mensaje al usuario antes de instalar (adáptalo):
> "Voy a preparar tu ordenador instalando dos programas gratuitos y oficiales:
> uno de base (Node) y el programa oficial de Shopify. Es automático, tarda
> unos minutos y verás texto pasando por la pantalla — es normal. Puede que
> Windows/Mac te pregunte si das permiso: dile que sí."

---

## WINDOWS

### Instalar Node.js — método A: winget (preferido)

winget viene de serie en Windows 10 moderno y Windows 11.

```powershell
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
```

- Si winget pide aceptar términos por primera vez, los flags de arriba ya lo
  resuelven.
- Si aparece un diálogo de Control de cuentas de usuario (UAC), avisa al
  usuario: "Windows te va a preguntar si permites la instalación — pulsa Sí."
- **Tras instalar, el PATH de tu sesión actual NO se actualiza.** Recárgalo:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
node -v
```

Si tras recargar sigue sin encontrarse, prueba la ruta directa
`& "C:\Program Files\nodejs\node.exe" -v` — si esa funciona, el problema es
solo de PATH de la sesión; sigue usando la recarga de PATH en cada comando o
pide al usuario reiniciar Claude Code (última opción).

### Instalar Node.js — método B: si winget no existe o falla

Descarga el instalador MSI oficial y lánzalo en silencio:

```powershell
$nodeUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
Invoke-WebRequest -Uri $nodeUrl -OutFile "$env:TEMP\node-lts.msi"
Start-Process msiexec.exe -ArgumentList "/i `"$env:TEMP\node-lts.msi`" /qn" -Wait
```

Notas:
- Si la versión exacta da 404, consulta https://nodejs.org/dist/index.json y
  usa la última LTS (campo `lts` distinto de false).
- `/qn` instala sin ventanas. Si falla por permisos, reintenta sin `/qn` (el
  usuario verá el asistente: dile "pulsa Siguiente en todo y luego Instalar").
- Recarga el PATH igual que en el método A.

### Instalar Node.js — método C: último recurso manual

Solo si A y B fallan (sin permisos de administrador, antivirus corporativo...).
Instrucciones para el usuario, literales y cortas:

> 1. Abre nodejs.org en tu navegador.
> 2. Pulsa el botón verde grande de descargar (versión LTS).
> 3. Abre el archivo descargado y pulsa Siguiente en todo hasta Instalar.
> 4. Cuando termine, dime "listo".

Después verifica tú con la recarga de PATH.

### Instalar Shopify CLI (Windows)

Con Node ya disponible:

```powershell
npm install -g @shopify/cli@latest
```

Fallbacks:
- **Error EEXIST o de permisos en npm** → `npm install -g @shopify/cli@latest --force`.
- **Errores de red/proxy** → reintenta una vez; si persiste, pregunta al
  usuario si está en una red de empresa (los proxys corporativos bloquean npm)
  y sugiérele red doméstica o compartir datos del móvil un momento.
- **PowerShell bloquea el comando `shopify`** con error de "ejecución de
  scripts deshabilitada" (ExecutionPolicy): ejecuta
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force` y reintenta.
  Explica al usuario: "le he dado permiso a Windows para ejecutar el programa
  de Shopify, es un ajuste estándar y seguro."
- Verificación final: `shopify version` debe imprimir un número (3.x).

### Trampas conocidas de Windows

- **PATH no refrescado** tras cualquier instalación → recarga siempre con la
  línea de `$env:Path` de arriba antes de declarar que algo "no está instalado".
- **OneDrive**: nunca crees el proyecto dentro de Escritorio/Documentos si
  están sincronizados con OneDrive (la ruta contiene "OneDrive"). Usa
  `C:\tiendas\`. Créala con `New-Item -ItemType Directory -Force C:\tiendas`.
- **Antivirus**: si npm o el instalador se quedan colgados >5 min, puede ser el
  antivirus analizando. Cancela, espera, reintenta. No pidas desactivarlo.
- **PowerShell 5.1**: no uses `&&` para encadenar comandos (no existe). Usa
  `;` o comandos separados.

---

## MAC

### Instalar Node.js — método A: instalador oficial PKG

No dependas de Homebrew (la máquina virgen no lo tiene y su instalación pide
contraseña y tarda). El PKG oficial es más directo:

```bash
curl -fsSL -o /tmp/node-lts.pkg "https://nodejs.org/dist/v22.14.0/node-v22.14.0.pkg"
sudo installer -pkg /tmp/node-lts.pkg -target /
```

- `sudo` pedirá la contraseña del Mac. Avisa antes: "El sistema te va a pedir
  tu contraseña del ordenador (la de iniciar sesión en el Mac). Al escribirla
  no se ve nada — es normal, escríbela y pulsa Enter."
- Si Claude Code no puede ejecutar `sudo` interactivo, dale al usuario las dos
  líneas para que las pegue él en la app Terminal, explicado en 3 pasos:
  abrir Terminal (buscarla con la lupa 🔍 arriba a la derecha), pegar, Enter.
- Si la versión da 404, consulta https://nodejs.org/dist/index.json (igual que
  en Windows). Para Macs con chip Apple (M1+) el pkg universal de arriba vale.

### Instalar Node.js — método B: Homebrew (solo si ya está instalado)

```bash
command -v brew && brew install node@22
```

No instales Homebrew tú: si no está, usa el método A.

### Instalar Shopify CLI (Mac)

```bash
npm install -g @shopify/cli@latest
```

- **Error de permisos EACCES en /usr/local** (típico con el Node del PKG):
  NO uses `sudo npm install`. Configura un directorio propio:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
export PATH=~/.npm-global/bin:$PATH
npm install -g @shopify/cli@latest
```

- Verificación: `shopify version`.

### Trampas conocidas de Mac

- Tras tocar `~/.zshrc`, los comandos de TU sesión actual necesitan el
  `export PATH=...` en línea (ya incluido arriba).
- Gatekeeper puede bloquear binarios descargados: si aparece "no se puede
  abrir porque procede de un desarrollador no identificado", el PKG oficial de
  nodejs.org NO da ese problema; si aparece con otra cosa, busca alternativa en
  vez de pedirle al usuario tocar Ajustes de seguridad.

---

## Cierre de la fase

1. Ejecuta de nuevo el diagnóstico: Node ✓, npm ✓, Shopify CLI ✓.
2. Mensaje al usuario: "✅ Tu ordenador ya está listo. Esto era lo más pesado y
   no habrá que repetirlo nunca."
3. Registra en `ESTADO.md` (cuando exista el proyecto) que el entorno está OK
   y las versiones instaladas.
4. Pasa a `references/01-conexion-y-sondeo.md`.
