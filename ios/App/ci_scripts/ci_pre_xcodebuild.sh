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

  export COCOAPODS_DISABLE_STATS=1

  echo "🌐 Verifying CocoaPods CDN reachability..."
  if ! curl -sf --max-time 15 https://cdn.cocoapods.org/CocoaPods-version.yml > /dev/null; then
    echo "⚠️ CocoaPods CDN unreachable — installing GitHub Specs mirror as fallback"
    pod repo remove trunk 2>&1 || true
    pod repo add trunk https://github.com/CocoaPods/Specs.git 2>&1 || \
      pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>&1 || true
  fi

  pre_pod_install_with_retry() {
    local attempt=1
    local max_attempts=4
    local repo_update_flag=""

    while [[ $attempt -le $max_attempts ]]; do
      echo "📦 pod install attempt $attempt/$max_attempts ${repo_update_flag:-(no repo-update)}..."
      if pod install $repo_update_flag 2>&1; then
        echo "✅ pod install succeeded on attempt $attempt"
        return 0
      fi
      echo "⚠️ pod install attempt $attempt failed"
      repo_update_flag="--repo-update"

      if [[ $attempt -eq 3 ]]; then
        echo "🔀 Swapping trunk repo to GitHub Specs mirror (CDN appears down)..."
        pod repo remove trunk 2>&1 || true
        pod repo add trunk https://github.com/CocoaPods/Specs.git 2>&1 || true
      fi

      local sleep_seconds=$((attempt * 5))
      echo "⏳ Sleeping ${sleep_seconds}s before retry..."
      sleep $sleep_seconds
      attempt=$((attempt + 1))
    done

    echo "🆘 Re-adding trunk CDN repo manually..."
    pod repo remove trunk 2>&1 || true
    pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>&1 || true
    pod install --repo-update 2>&1
  }

  if ! pre_pod_install_with_retry; then
    echo "❌ pod install failed after all retries"
    exit 1
  fi
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
IOS_APP_DIR_FOR_PATCH="$IOS_APP_DIR" python3 - <<'PY'
import os
from pathlib import Path

root = Path(os.environ['IOS_APP_DIR_FOR_PATCH'])
invalid = '$(TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)'

candidates = list(root.glob('Pods/Target Support Files/**/*.xcconfig'))
pbx = root / 'Pods/Pods.xcodeproj/project.pbxproj'
if pbx.exists():
    candidates.append(pbx)

for path in candidates:
    if not path.is_file():
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

# Dump the actual aggregate xcconfig for visibility — invaluable when SwiftCompile
# fails and we don't know what flags Xcode is actually being handed.
APP_RELEASE_CFG="$IOS_APP_DIR/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig"
echo "📄 Pods-App.release.xcconfig contents:"
if [[ -f "$APP_RELEASE_CFG" ]]; then
  cat "$APP_RELEASE_CFG"
else
  echo "  (missing — pod install did not generate it)"
  exit 1
fi

CAP_RELEASE_CFG="$IOS_APP_DIR/Pods/Target Support Files/Capacitor/Capacitor.release.xcconfig"
echo "📄 Capacitor.release.xcconfig (first 50 lines):"
if [[ -f "$CAP_RELEASE_CFG" ]]; then
  head -n 50 "$CAP_RELEASE_CFG"
else
  echo "  (missing)"
fi

# Sanity gate: fail fast if Xcode 26 explicit modules slipped back into any xcconfig.
echo "🔒 Verifying explicit modules are disabled in all generated xcconfigs..."
if grep -RIE 'SWIFT_ENABLE_EXPLICIT_MODULES\s*=\s*YES|CLANG_ENABLE_EXPLICIT_MODULES\s*=\s*YES' \
     "$IOS_APP_DIR/Pods/Target Support Files" 2>/dev/null; then
  echo "❌ Explicit modules still enabled in one or more xcconfigs above."
  exit 1
fi
echo "✅ explicit modules disabled across all Pods xcconfigs"

echo "✅ pre-xcodebuild setup complete"

# Sanity gate: ensure CapacitorCordova ended up dynamic (mh_dylib), not static.
# A residual -force_load .../libCapacitorCordova.a in Pods-App.release.xcconfig
# would mean the linkage swap silently failed.
echo "🔒 Verifying CapacitorCordova linked as dynamic framework..."
APP_RELEASE_CFG="$IOS_APP_DIR/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig"
if [[ -f "$APP_RELEASE_CFG" ]]; then
  if grep -qE '\-force_load[^\n]*libCapacitorCordova\.a' "$APP_RELEASE_CFG"; then
    echo "❌ Pods-App.release.xcconfig still force-loads libCapacitorCordova.a — linkage did NOT switch to dynamic."
    echo "   Expected: CapacitorCordova.framework linked dynamically."
    exit 1
  fi
  echo "✅ Pods-App.release.xcconfig clean of static -force_load for CapacitorCordova"
else
  echo "⚠️  Pods-App.release.xcconfig not found at expected path (skipping linkage check)"
fi

CAPCORDOVA_CFG="$IOS_APP_DIR/Pods/Target Support Files/CapacitorCordova/CapacitorCordova.release.xcconfig"
if [[ -f "$CAPCORDOVA_CFG" ]]; then
  if grep -qE '^MACH_O_TYPE\s*=\s*staticlib' "$CAPCORDOVA_CFG"; then
    echo "❌ CapacitorCordova.release.xcconfig sets MACH_O_TYPE=staticlib — should be mh_dylib."
    exit 1
  fi
  echo "✅ CapacitorCordova MACH_O_TYPE clean (dynamic)"
fi

echo "✅ pre-xcodebuild setup complete"
