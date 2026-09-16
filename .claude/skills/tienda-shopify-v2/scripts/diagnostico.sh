#!/bin/bash
# Diagnóstico del entorno para la skill tienda-shopify-v2 (Mac/Linux)
# Salida pensada para que la lea Claude, no el usuario.
# Uso: bash diagnostico.sh

export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "=== DIAGNOSTICO ENTORNO ($(uname -s)) ==="
sw_vers 2>/dev/null | head -2

check() {
  local name="$1" cmd="$2" args="$3"
  if command -v "$cmd" >/dev/null 2>&1; then
    local ver
    ver=$("$cmd" $args 2>/dev/null | head -1)
    echo "$name: OK - $ver ($(command -v "$cmd"))"
  else
    echo "$name: FALTA"
  fi
}

check "node" "node" "-v"
check "npm" "npm" "-v"
check "shopify-cli" "shopify" "version"
check "brew" "brew" "--version"

# La v2 necesita CLI >= 3.93 para 'store auth'/'store execute' (Admin API).
if command -v shopify >/dev/null 2>&1; then
  verline=$(shopify version 2>/dev/null | head -1)
  ver=$(echo "$verline" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  maj=$(echo "$ver" | cut -d. -f1); min=$(echo "$ver" | cut -d. -f2)
  if [ -n "$maj" ] && { [ "$maj" -gt 3 ] || { [ "$maj" -eq 3 ] && [ "$min" -ge 93 ]; }; }; then
    echo "store-commands: OK (CLI soporta store auth/execute)"
  else
    echo "store-commands: CLI ANTIGUO (<3.93) - actualizar para Admin API: npm install -g @shopify/cli@latest"
  fi
fi

# Sesión de Shopify (heurística)
if [ -d "$HOME/.config/shopify" ] || [ -d "$HOME/Library/Application Support/shopify" ]; then
  echo "sesion-shopify: posible sesion previa (verificar tema con 'shopify theme list --store X')"
else
  echo "sesion-shopify: sin rastro de sesion previa"
fi
echo "sesion-datos-tienda (Admin API): verificar con 'shopify store execute --store X --query \"query{ shop{ name } }\" --json' (si falla, repetir 'shopify store auth ...')"

# Proyectos existentes
if [ -d "$HOME/tiendas" ]; then
  echo "proyectos-en-tiendas: $(ls -1 "$HOME/tiendas" 2>/dev/null | tr '\n' ', ')"
else
  echo "proyectos-en-tiendas: carpeta no existe"
fi

echo "=== FIN DIAGNOSTICO ==="
