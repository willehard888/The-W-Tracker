#!/bin/bash
set -euo pipefail

echo "🔧 Running post-clone setup for iOS build..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

while [[ ! -f "$ROOT_DIR/package.json" && "$ROOT_DIR" != "/" ]]; do
  ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "❌ package.json not found. Aborting."
  exit 1
fi

cd "$ROOT_DIR"

# ── Install Node.js (Xcode Cloud does NOT include it) ──
if ! command -v node &>/dev/null; then
  echo "📥 Node.js not found – installing via Homebrew..."
  brew install node
fi

echo "ℹ️  Node $(node -v) / npm $(npm -v)"

# ── Install npm dependencies ──
echo "📦 Installing npm dependencies..."
if [[ -f package-lock.json ]]; then
  echo "🔒 Using committed package-lock.json for deterministic dependency versions..."
  npm ci --legacy-peer-deps
else
  echo "⚠️ package-lock.json missing, falling back to npm install"
  npm install --legacy-peer-deps
fi

# ── Build web assets ──
echo "🔨 Building web assets..."
npm run build

# ── Sync Capacitor ──
echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

# ── Regenerate Swift package resolution from scratch ──
RESOLVED_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
RESOLVED_FILE="$RESOLVED_DIR/Package.resolved"
SPM_CACHE_DIR="${TMPDIR:-/tmp}/spm-packages"
mkdir -p "$RESOLVED_DIR"

echo "🧹 Clearing stale Swift package resolution state..."
rm -f "$RESOLVED_FILE"
rm -rf "$SPM_CACHE_DIR"

if command -v xcodebuild &>/dev/null; then
  echo "📦 Resolving Swift package graph..."
  RESOLVE_LOG="${TMPDIR:-/tmp}/xcode-package-resolve.log"
  if xcodebuild -resolvePackageDependencies \
    -project "$ROOT_DIR/ios/App/App.xcodeproj" \
    -scheme App \
    -clonedSourcePackagesDirPath "$SPM_CACHE_DIR" \
    > "$RESOLVE_LOG" 2>&1; then
    echo "✅ Swift package graph resolved"
    tail -20 "$RESOLVE_LOG" || true
  else
    echo "❌ Swift package resolution failed"
    tail -80 "$RESOLVE_LOG" || true
    exit 1
  fi
fi

if [[ -f "$RESOLVED_FILE" ]]; then
  echo "✅ Package.resolved regenerated"
else
  echo "⚠️ Package.resolved not generated, but build can continue if Xcode resolves it during archive"
fi

# ── Copy app icon & ensure Contents.json ──
ICON_SRC="$ROOT_DIR/public/app-icon.png"
ICON_DIR="$ROOT_DIR/ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ICON_DIR"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$ICON_DIR/AppIcon-512@2x.png"
  cat > "$ICON_DIR/Contents.json" << 'ICONEOF'
{
  "images" : [
    {
      "filename" : "AppIcon-512@2x.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
ICONEOF
  echo "✅ App icon copied"
else
  echo "⚠️ App icon not found at $ICON_SRC"
fi

echo "✅ post-clone setup complete"
