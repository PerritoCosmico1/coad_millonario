#!/usr/bin/env sh
# Genera los archivos de three.js que usa el sitio. Solo hace falta correrlo
# para actualizar la versión. Requiere Node.
#
#   sh irrumpe/tools/build-three.sh 0.186.1
#
# - vendor/three.min.js       three.js (ESM) minificado en un solo archivo (para la AR).
# - tools/usdz-exporter.js    USDZExporter + fflate (para tools/export-3d.html).
set -e
VERSION="${1:-0.186.1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm install --no-audit --no-fund "three@$VERSION" "esbuild@0.25.10" >/dev/null
echo "export * from 'three';" > three.js
./node_modules/.bin/esbuild three.js --bundle --format=esm --minify --legal-comments=inline \
  --banner:js="/* three.js $VERSION — MIT License — https://threejs.org */" \
  --outfile="$HERE/../vendor/three.min.js"
echo "export { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';" > usdz.js
./node_modules/.bin/esbuild usdz.js --bundle --format=esm --minify --legal-comments=inline --external:three \
  --banner:js="/* USDZExporter de three.js $VERSION (MIT) + fflate (MIT), empaquetado por tools/build-three.sh */" \
  --outfile="$HERE/usdz-exporter.js"
for f in usdz-exporter.js; do
  sed -i.bak 's#from"three"#from"../vendor/three.min.js"#g' "$HERE/$f" && rm -f "$HERE/$f.bak"
done
rm -rf "$TMP"
echo "listo: vendor/three.min.js y tools/usdz-exporter.js (three $VERSION)"
