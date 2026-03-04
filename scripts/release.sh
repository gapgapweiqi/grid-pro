#!/bin/bash
set -e

# ============================================
# Grid Pro Release Script
# Build, sign, upload to R2, and register in D1
# Usage: ./scripts/release.sh <version> [target]
# Example: ./scripts/release.sh 0.2.0 macos
# ============================================

VERSION="${1:?Usage: ./scripts/release.sh <version> [macos|all]}"
TARGET="${2:-macos}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"
WORKER_DIR="$ROOT_DIR/worker"
KEY_PATH="$HOME/.tauri/grid-pro.key"

echo "🚀 Grid Pro Release v$VERSION ($TARGET)"
echo "========================================="

if [ ! -f "$KEY_PATH" ]; then
  echo "❌ Signing key not found at $KEY_PATH"
  exit 1
fi

export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"

# --- Build macOS ---
if [ "$TARGET" = "macos" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "📦 Building macOS (aarch64)..."
  cd "$APP_DIR"
  npx tauri build --target aarch64-apple-darwin

  BUNDLE_DIR="$APP_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle"
  TAR_GZ="$BUNDLE_DIR/macos/Grid Pro.app.tar.gz"
  TAR_SIG="$BUNDLE_DIR/macos/Grid Pro.app.tar.gz.sig"
  DMG="$BUNDLE_DIR/dmg/Grid Pro_${VERSION}_aarch64.dmg"

  if [ ! -f "$TAR_GZ" ] || [ ! -f "$TAR_SIG" ]; then
    echo "❌ Build artifacts not found. Check build output."
    exit 1
  fi

  echo "✅ macOS aarch64 build complete"
  echo "   .app.tar.gz: $(du -h "$TAR_GZ" | cut -f1)"
  echo "   .dmg:        $(du -h "$DMG" | cut -f1)"

  # --- Upload to R2 ---
  echo ""
  echo "☁️  Uploading to R2..."
  cd "$WORKER_DIR"

  npx wrangler r2 object put "gridpro-images/downloads/Grid-Pro_${VERSION}_aarch64.app.tar.gz" \
    --file="$TAR_GZ" --content-type="application/gzip" --remote

  npx wrangler r2 object put "gridpro-images/downloads/Grid-Pro_${VERSION}_aarch64.dmg" \
    --file="$DMG" --content-type="application/octet-stream" --remote

  echo "✅ Uploaded to R2"

  # --- Read signature ---
  SIG=$(cat "$TAR_SIG")

  # --- Insert D1 release record ---
  echo ""
  echo "📝 Creating release record in D1..."
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

  npx wrangler d1 execute gridpro-db --remote --command \
    "DELETE FROM app_releases WHERE target='darwin-aarch64' AND version='$VERSION';"

  npx wrangler d1 execute gridpro-db --remote --command \
    "INSERT INTO app_releases (id, version, target, download_url, signature, notes, pub_date, is_active, created_at) VALUES ('$ID', '$VERSION', 'darwin-aarch64', 'https://api.grid-doc.com/api/downloads/Grid-Pro_${VERSION}_aarch64.app.tar.gz', '$SIG', 'Release v$VERSION', '$NOW', 1, '$NOW');"

  echo "✅ Release record created (darwin-aarch64)"
fi

# --- Verify ---
echo ""
echo "🔍 Verifying update endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://api.grid-doc.com/api/tauri-update/darwin/aarch64/0.0.1")
if [ "$RESPONSE" = "200" ]; then
  echo "✅ Update endpoint returns 200 (update available)"
else
  echo "⚠️  Update endpoint returned $RESPONSE"
fi

echo ""
echo "========================================="
echo "🎉 Release v$VERSION complete!"
echo ""
echo "Download URLs:"
echo "  macOS: https://api.grid-doc.com/api/downloads/Grid-Pro_${VERSION}_aarch64.dmg"
echo "  Update: https://api.grid-doc.com/api/downloads/Grid-Pro_${VERSION}_aarch64.app.tar.gz"
echo ""
echo "Admin page: https://app.grid-doc.com/admin/releases"
