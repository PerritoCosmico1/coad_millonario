#!/usr/bin/env sh
# Genera vendor/three.min.js: three.js (ESM) minificado en un solo archivo.
# Solo hace falta correrlo para actualizar la versión. Requiere Node.
#
#   sh irrumpe/tools/build-three.sh 0.186.1
set -e
VERSION="${1:-0.186.1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm install --no-audit --no-fund "three@$VERSION" "esbuild@0.25.10" >/dev/null
echo "export * from 'three';" > entry.js
./node_modules/.bin/esbuild entry.js --bundle --format=esm --minify --legal-comments=inline \
  --banner:js="/* three.js $VERSION — MIT License — https://threejs.org */" \
  --outfile="$HERE/../vendor/three.min.js"
rm -rf "$TMP"
echo "listo: vendor/three.min.js (three $VERSION)"
