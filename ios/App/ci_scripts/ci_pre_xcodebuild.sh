#!/bin/bash
set -euo pipefail

echo "🔧 Running pre-xcodebuild setup..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$IOS_APP_DIR/../.." && pwd)"

echo "ℹ️  ROOT_DIR=$ROOT_DIR"
echo "ℹ️  IOS_APP_DIR=$IOS_APP_DIR"

# Verify Pods directory exists; if not, run pod install again.
if [[ ! -d "$IOS_APP_DIR/Pods" ]]; then
  echo "⚠️ Pods directory missing — running pod install now..."
  cd "$IOS_APP_DIR"

  if ! command -v pod &>/dev/null; then
    echo "📥 CocoaPods not found – installing..."
    brew install cocoapods || sudo gem install cocoapods
  fi

  # Ensure node_modules exists for Capacitor pod paths
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "📦 node_modules missing — installing npm deps..."
    cd "$ROOT_DIR"
    npm ci --legacy-peer-deps || npm install --legacy-peer-deps
    npm run build
    if ! npx cap sync ios; then
      echo "⚠️ Capacitor sync hit a pod install error in CI — continuing with explicit CocoaPods install..."
    fi
    cd "$IOS_APP_DIR"
  fi

  pod install --repo-update
fi

if [[ ! -f "$IOS_APP_DIR/Pods/Local Podspecs/Capacitor.podspec.json" ]]; then
  echo "❌ Capacitor podspec missing after pod install"
  exit 1
fi

if [[ ! -f "$IOS_APP_DIR/Pods/Local Podspecs/CapacitorCordova.podspec.json" ]]; then
  echo "❌ CapacitorCordova podspec missing after pod install"
  exit 1
fi

if [[ ! -d "$IOS_APP_DIR/Pods/Target Support Files/CapacitorCordova" ]]; then
  echo "❌ CapacitorCordova target support files missing after pod install"
  exit 1
fi

echo "✅ Pods directory present at $IOS_APP_DIR/Pods"
ls -la "$IOS_APP_DIR/Pods" | head -20

echo "🧹 Verifying generated Pods configs do not reference missing MetalToolchain paths..."
python3 - <<'PY'
from pathlib import Path

root = Path('/dev-server/ios/App')
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

# Confirm workspace contains Pods reference
if grep -q "Pods.xcodeproj" "$IOS_APP_DIR/App.xcworkspace/contents.xcworkspacedata"; then
  echo "✅ Workspace references Pods.xcodeproj"
else
  echo "❌ Workspace missing Pods.xcodeproj reference!"
  exit 1
fi

echo "✅ pre-xcodebuild setup complete"
