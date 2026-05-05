#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/lambda-build"
ZIP_PATH="$ROOT_DIR/dist/lambda.zip"

rm -rf "$BUILD_DIR" "$ZIP_PATH"
mkdir -p "$BUILD_DIR"
cp "$ROOT_DIR/apps/api/package.json" "$BUILD_DIR/package.json"
cp -R "$ROOT_DIR/apps/api/src" "$BUILD_DIR/src"

npm install --omit=dev --prefix "$BUILD_DIR"

(
  cd "$BUILD_DIR"
  zip -qr "$ZIP_PATH" .
)

echo "Pacote gerado em $ZIP_PATH"
