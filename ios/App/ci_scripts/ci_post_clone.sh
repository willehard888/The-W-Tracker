#!/bin/bash
# NOTE: intentionally NOT using `set -e` at the top — we want to log every
# failure point explicitly so Xcode Cloud surfaces *which* step failed.
set -uo pipefail

echo "🔧 Running post-clone setup for iOS build..."
echo "ℹ️  PWD=$(pwd)"
echo "ℹ️  USER=$(whoami)"
echo "ℹ️  Shell=$BASH_VERSION"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

while [[ ! -f "$ROOT_DIR/package.json" && "$ROOT_DIR" != "/" ]]; do
  ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "❌ package.json not found walking up from $SCRIPT_DIR. Aborting."
  exit 1
fi

echo "ℹ️  ROOT_DIR=$ROOT_DIR"
cd "$ROOT_DIR"

# ---------------------------------------------------------------------------
# Node.js
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null; then
  echo "📥 Node.js not found – installing via Homebrew..."
  if ! brew install node; then
    echo "❌ Failed to install Node.js via Homebrew"
    exit 1
  fi
fi

echo "ℹ️  Node $(node -v) / npm $(npm -v)"

# ---------------------------------------------------------------------------
# npm dependencies — try npm ci, fall back to npm install on ANY failure
# ---------------------------------------------------------------------------
echo "📦 Installing npm dependencies..."
npm_installed=0
if [[ -f package-lock.json ]]; then
  echo "🔒 package-lock.json present, attempting npm ci..."
  if npm ci --legacy-peer-deps --no-audit --no-fund 2>&1; then
    npm_installed=1
  else
    echo "⚠️ npm ci failed (likely lockfile/package.json drift) — falling back to npm install"
  fi
fi

if [[ "$npm_installed" -eq 0 ]]; then
  if ! npm install --legacy-peer-deps --no-audit --no-fund 2>&1; then
    echo "❌ npm install failed"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Web build
# ---------------------------------------------------------------------------
echo "🔨 Building web assets..."
if ! npm run build 2>&1; then
  echo "❌ Web build failed"
  exit 1
fi

# ---------------------------------------------------------------------------
# Capacitor sync — non-fatal: pod install runs explicitly below
# ---------------------------------------------------------------------------
echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios 2>&1 || echo "⚠️ Capacitor sync had warnings — continuing with explicit CocoaPods install..."

# ---------------------------------------------------------------------------
# CocoaPods
# ---------------------------------------------------------------------------
if ! command -v pod &>/dev/null; then
  echo "📥 CocoaPods not found – installing..."
  if ! brew install cocoapods 2>&1; then
    echo "⚠️ Homebrew CocoaPods install failed, trying gem..."
    if ! sudo gem install cocoapods 2>&1; then
      echo "❌ Could not install CocoaPods"
      exit 1
    fi
  fi
fi

echo "ℹ️  CocoaPods $(pod --version)"

echo "🩹 Patching Capacitor podspec module maps for Xcode 26 compatibility..."
python3 - <<'PY'
from pathlib import Path

for path in [
    Path('/Volumes/workspace/repository/node_modules/@capacitor/ios/Capacitor.podspec'),
    Path('/Volumes/workspace/repository/node_modules/@capacitor/ios/CapacitorCordova.podspec'),
]:
    if not path.exists():
        continue
    original = path.read_text()
    patched_lines = [line for line in original.splitlines(True) if 's.module_map =' not in line]
    patched = ''.join(patched_lines)
    if patched != original:
        path.write_text(patched)
        print(f'patched {path.name}')
PY

echo "📦 Installing CocoaPods dependencies (required for Capacitor module resolution)..."
cd "$ROOT_DIR/ios/App"
if ! pod install --repo-update 2>&1; then
  echo "❌ pod install failed"
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify Capacitor pods materialized
# ---------------------------------------------------------------------------
echo "🔎 Verifying Capacitor CocoaPods targets were generated..."
missing=0
for f in \
  "Pods/Local Podspecs/Capacitor.podspec.json" \
  "Pods/Local Podspecs/CapacitorCordova.podspec.json" \
  "Pods/Target Support Files/CapacitorCordova" \
  "Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig"
do
  if [[ ! -e "$f" ]]; then
    echo "❌ Missing: $f"
    missing=1
  fi
done

if [[ "$missing" -eq 1 ]]; then
  echo "❌ CocoaPods did not materialize required Capacitor artifacts"
  ls "Pods/Local Podspecs" 2>/dev/null || echo "(no Local Podspecs dir)"
  exit 1
fi

ls "Pods/Local Podspecs" | grep -E 'Capacitor|Cordova' || true

# ---------------------------------------------------------------------------
# Patch out broken MetalToolchain Swift search paths (Xcode 26 bug)
# ---------------------------------------------------------------------------
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

echo "✅ Pods installed successfully"
ls Pods/ | head -10
cd "$ROOT_DIR"

# ---------------------------------------------------------------------------
# App icon (non-fatal)
# ---------------------------------------------------------------------------
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
  echo "⚠️ App icon not found at $ICON_SRC (non-fatal)"
fi

echo "✅ post-clone setup complete"
exit 0
