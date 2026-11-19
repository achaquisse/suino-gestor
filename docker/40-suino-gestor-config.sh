#!/bin/sh
set -eu

url="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
key="${SUPABASE_PUBLISHABLE_KEY:-${VITE_SUPABASE_PUBLISHABLE_KEY:-}}"

escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

if [ -z "$url" ] || [ -z "$key" ]; then
  echo "suino-gestor: SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY not set" >&2
fi

cat > /usr/share/nginx/html/config.js <<EOF
window.__SUINO_GESTOR_CONFIG__ = {
  SUPABASE_URL: "$(escape "$url")",
  SUPABASE_PUBLISHABLE_KEY: "$(escape "$key")"
}
EOF
