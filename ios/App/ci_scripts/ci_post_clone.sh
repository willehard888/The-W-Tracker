#!/bin/bash
# Fail fast on errors so Xcode Cloud surfaces the real failure point instead
# of silently continuing past a broken pod install.
set -euo pipefail

echo "🔧 Running post-clone setup for iOS build..."
echo "ℹ️  PWD=$(pwd)"
echo "ℹ️  USER=$(whoami)"
echo "ℹ️  Shell=$BASH_VERSION"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$SCRIPT_DIR"

while [[ ! -f "$ROOT_DIR/package.json" && "$ROOT_DIR" != "/" ]]; do
  ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "❌ package.json not found walking up from $SCRIPT_DIR. Aborting."
  exit 1
fi

echo "ℹ️  ROOT_DIR=$ROOT_DIR"
echo "ℹ️  IOS_APP_DIR=$IOS_APP_DIR"
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

# ---------------------------------------------------------------------------
# Pre-warm CocoaPods CDN cache — fall back to GitHub Specs mirror if CDN flakes
# ---------------------------------------------------------------------------
echo "🌐 Verifying CocoaPods CDN reachability..."
if ! curl -sf --max-time 15 https://cdn.cocoapods.org/CocoaPods-version.yml > /dev/null; then
  echo "⚠️ CocoaPods CDN unreachable — installing GitHub-based Specs mirror as fallback"
  pod repo remove trunk 2>&1 || true
  if ! pod repo add trunk https://github.com/CocoaPods/Specs.git 2>&1; then
    echo "⚠️ GitHub Specs mirror add failed — re-adding CDN as last resort"
    pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>&1 || true
  fi
else
  echo "✅ CocoaPods CDN reachable"
fi

echo "📦 Installing CocoaPods dependencies (required for Capacitor module resolution)..."
cd "$IOS_APP_DIR"

export COCOAPODS_DISABLE_STATS=1

# Linkage strategy changed (static -> dynamic). Force a clean install so the
# previous Pods cache cannot leak static-framework xcconfigs into this build.
echo "🧹 Removing stale Pods/ and Podfile.lock to honor new linkage strategy..."
rm -rf Pods Podfile.lock

POD_LOG="/tmp/pod-install.log"

pod_install_with_retry() {
  local attempt=1
  local max_attempts=4
  local repo_update_flag=""

  while [[ $attempt -le $max_attempts ]]; do
    echo "📦 pod install attempt $attempt/$max_attempts ${repo_update_flag:-(no repo-update)}..."
    : > "$POD_LOG"
    if pod install $repo_update_flag --verbose 2>&1 | tee "$POD_LOG"; then
      echo "✅ pod install succeeded on attempt $attempt"
      return 0
    fi
    echo "⚠️ pod install attempt $attempt failed — last 80 lines of verbose log:"
    tail -n 80 "$POD_LOG" || true

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

  echo "🆘 Final attempt — re-adding CDN trunk repo..."
  pod repo remove trunk 2>&1 || true
  pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>&1 || true
  : > "$POD_LOG"
  pod install --repo-update --verbose 2>&1 | tee "$POD_LOG"
}

if ! pod_install_with_retry; then
  echo "❌ pod install failed after all retries — last 200 lines of verbose log:"
  tail -n 200 "$POD_LOG" || true
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
# Linkage diagnostics — confirm Capacitor pods are dynamic (mh_dylib)
# ---------------------------------------------------------------------------
echo "🔬 Linkage diagnostics:"
for pod_name in Capacitor CapacitorCordova RevenuecatPurchasesCapacitor; do
  cfg="Pods/Target Support Files/${pod_name}/${pod_name}.release.xcconfig"
  if [[ -f "$cfg" ]]; then
    mach=$(grep -E '^MACH_O_TYPE' "$cfg" | head -1 || echo "MACH_O_TYPE = (default)")
    echo "  • ${pod_name}: ${mach}"
  else
    echo "  • ${pod_name}: xcconfig not found"
  fi
done

# Print which pods are still declared as static_framework in their podspec.
static_specs=$(grep -l 'static_framework' Pods/Local\ Podspecs/*.json 2>/dev/null || true)
if [[ -n "$static_specs" ]]; then
  echo "ℹ️  Pods still declared static_framework in podspec (linkage overridden by post_install):"
  echo "$static_specs"
fi

# ---------------------------------------------------------------------------
# Patch out broken MetalToolchain Swift search paths (Xcode 26 bug)
# ---------------------------------------------------------------------------
echo "🧹 Patching generated Pods configs (MetalToolchain paths + Xcode 26 explicit modules)..."
IOS_APP_DIR_FOR_PATCH="$IOS_APP_DIR" python3 - <<'PY'
import os
import re
from pathlib import Path

root = Path(os.environ['IOS_APP_DIR_FOR_PATCH'])
invalid = '$(TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)'

xcconfigs = list(root.glob('Pods/Target Support Files/**/*.xcconfig'))
pbx = root / 'Pods/Pods.xcodeproj/project.pbxproj'

# Strip invalid MetalToolchain search paths everywhere.
for path in xcconfigs + ([pbx] if pbx.exists() else []):
    if not path.is_file():
        continue
    content = path.read_text()
    if invalid in content:
        updated = content.replace(f' {invalid}', '').replace(f'"{invalid}"', '')
        updated = updated.replace(invalid + ' ', '').replace(invalid, '')
        if updated != content:
            path.write_text(updated)
            print(f'patched (toolchain) {path}')

# Force-disable explicit modules + module-interface verification in every xcconfig,
# and strip any stray -verify-emitted-module-interface flag.
forced_settings = {
    'SWIFT_ENABLE_EXPLICIT_MODULES': 'NO',
    'CLANG_ENABLE_EXPLICIT_MODULES': 'NO',
    'SWIFT_VERIFY_EMITTED_MODULE_INTERFACE': 'NO',
}

for path in xcconfigs:
    if not path.is_file():
        continue
    content = path.read_text()
    original = content

    # Remove any positive -verify-emitted-module-interface (we want the negated form only).
    content = re.sub(r'(?<!-no)-verify-emitted-module-interface', '', content)

    for key, val in forced_settings.items():
        pattern = re.compile(rf'^{re.escape(key)}\s*=.*$', re.MULTILINE)
        if pattern.search(content):
            content = pattern.sub(f'{key} = {val}', content)
        else:
            if not content.endswith('\n'):
                content += '\n'
            content += f'{key} = {val}\n'

    if content != original:
        path.write_text(content)
        print(f'patched (xcode26) {path}')

# Sanity check: fail loudly if explicit modules are somehow still enabled in Pods-App release.
release_cfg = root / 'Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig'
if release_cfg.is_file():
    txt = release_cfg.read_text()
    bad = re.search(r'SWIFT_ENABLE_EXPLICIT_MODULES\s*=\s*YES', txt) or \
          re.search(r'CLANG_ENABLE_EXPLICIT_MODULES\s*=\s*YES', txt)
    if bad:
        raise SystemExit(f'❌ explicit modules still enabled in {release_cfg}')
    print(f'✅ explicit modules disabled in {release_cfg.name}')
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
