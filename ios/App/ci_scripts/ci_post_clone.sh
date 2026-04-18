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
  if ! npm ci --legacy-peer-deps; then
    echo "⚠️ package-lock.json is out of sync with package.json in CI; falling back to npm install"
    npm install --legacy-peer-deps
  fi
else
  echo "⚠️ package-lock.json missing, falling back to npm install"
  npm install --legacy-peer-deps
fi

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

if ! command -v pod &>/dev/null; then
  echo "📥 CocoaPods not found – installing via Homebrew..."
  brew install cocoapods || sudo gem install cocoapods
fi

echo "📦 Installing CocoaPods dependencies (required for Capacitor module resolution)..."
cd "$ROOT_DIR/ios/App"
pod install --repo-update

echo "🧹 Removing broken MetalToolchain Swift search paths from generated Pods configs..."
python3 - <<'PY'
from pathlib import Path

root = Path(".")
invalid = '$(TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)'

for path in list(root.glob('Pods/Target Support Files/**/*.xcconfig')) + [root / 'Pods/Pods.xcodeproj/project.pbxproj']:
    if not path.exists() or not path.is_file():
        continue
    content = path.read_text()
    if invalid not in content:
        continue
    updated = content.replace(f' {invalid}', '').replace(f'"{invalid}"', '')
    updated = updated.replace(invalid + ' ', '').replace(invalid, '')
    if updated != content:
        path.write_text(updated)
        print(f'patched {path}')
PY

# Verify Pods were installed correctly
if [[ ! -d "Pods" ]]; then
  echo "❌ Pods directory was not created — CocoaPods install failed!"
  exit 1
fi

if [[ ! -f "Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig" ]]; then
  echo "❌ Pods xcconfig missing — Capacitor module will not resolve!"
  exit 1
fi

echo "✅ Pods installed successfully"
ls Pods/ | head -10
cd "$ROOT_DIR"

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