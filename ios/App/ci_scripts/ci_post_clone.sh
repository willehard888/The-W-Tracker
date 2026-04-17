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

if ! command -v node &>/dev/null; then
  echo "📥 Node.js not found – installing via Homebrew..."
  brew install node
fi

echo "ℹ️  Node $(node -v) / npm $(npm -v)"

echo "📦 Installing npm dependencies..."
if [[ -f package-lock.json ]]; then
  echo "🔒 Using committed package-lock.json for deterministic dependency versions..."
  npm ci --legacy-peer-deps
else
  echo "⚠️ package-lock.json missing, falling back to npm install"
  npm install --legacy-peer-deps
fi

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

if command -v pod &>/dev/null; then
  echo "📦 Installing CocoaPods dependencies..."
  cd "$ROOT_DIR/ios/App"
  pod install --repo-update
  cd "$ROOT_DIR"
else
  echo "⚠️ CocoaPods not found; skipping pod install"
fi

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