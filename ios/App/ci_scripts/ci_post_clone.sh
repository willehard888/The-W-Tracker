#!/bin/bash
# Fail fast on errors so Xcode Cloud surfaces the real failure point instead
# of silently continuing past a broken pod install.
set -euo pipefail

# ---------------------------------------------------------------------------
# 🛑 Xcode Cloud kill switch
# ---------------------------------------------------------------------------
# Automatic Xcode Cloud archive builds keep failing and we don't want them to
# burn build minutes / clutter App Store Connect until the underlying issues
# are resolved manually. To re-enable, set XCODE_CLOUD_ENABLED=1 as an
# environment variable in the Xcode Cloud workflow's "Environment" tab.
# Local developer rebuilds via scripts/ios-rebuild.sh are unaffected because
# they never invoke this script.
if [[ "${XCODE_CLOUD_ENABLED:-0}" != "1" ]]; then
  echo "🛑 Xcode Cloud auto-build is DISABLED for this project."
  echo "   To re-enable: add XCODE_CLOUD_ENABLED=1 in App Store Connect →"
  echo "   Xcode Cloud → Workflow → Environment → Environment Variables,"
  echo "   or delete this kill switch block from ci_post_clone.sh."
  exit 1
fi

echo "🔧 Running post-clone setup for iOS build..."
echo "ℹ️  PWD=$(pwd)"
echo "ℹ️  USER=$(whoami)"
echo "ℹ️  Shell=$BASH_VERSION"

# ---------------------------------------------------------------------------
# Toolchain version pins
# ---------------------------------------------------------------------------
# Exact toolchain versions known-good for this project. We intentionally pin
# Xcode to a major.minor band (Apple bumps Xcode Cloud images frequently and
# we cannot select a patch version from CI), and require Swift 6.x as the
# host compiler (which is what Xcode 26.4.x ships). The Capacitor +
# RevenueCat pod targets are then pinned in the Podfile post_install hook to
# SWIFT_VERSION = 5.0 to dodge the Swift 6 constraint-solver crash on
# Capacitor.swift. Drift in either direction MUST fail the build.
REQUIRED_XCODE_MAJOR_MINOR="26.4"   # Xcode 26.4.x
REQUIRED_SWIFT_MAJOR="6"            # swiftc reports Swift 6.x in Xcode 26.4
PINNED_PODS_SWIFT_VERSION="5.0"     # Capacitor + RevenueCat pod targets
export PINNED_PODS_SWIFT_VERSION    # consumed by ci_pre_xcodebuild.sh

if command -v xcodebuild &>/dev/null; then
  XCODE_VER_FULL=$(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')
  echo "ℹ️  Xcode ${XCODE_VER_FULL} (required: ${REQUIRED_XCODE_MAJOR_MINOR}.x)"
  case "$XCODE_VER_FULL" in
    ${REQUIRED_XCODE_MAJOR_MINOR}*) echo "✅ Xcode version pin satisfied" ;;
    *)
      echo "❌ Xcode ${XCODE_VER_FULL} does not match required ${REQUIRED_XCODE_MAJOR_MINOR}.x"
      echo "   Update the Xcode Cloud workflow image OR bump REQUIRED_XCODE_MAJOR_MINOR after re-validating Capacitor + Swift pins."
      exit 1
      ;;
  esac
else
  echo "⚠️  xcodebuild not on PATH yet at post-clone — skipping Xcode pin check"
fi

if command -v swift &>/dev/null; then
  SWIFT_VER_FULL=$(swift --version 2>/dev/null | head -1 || echo "unknown")
  echo "ℹ️  ${SWIFT_VER_FULL}"
  if echo "$SWIFT_VER_FULL" | grep -qE "Swift version ${REQUIRED_SWIFT_MAJOR}\."; then
    echo "✅ Swift toolchain pin satisfied (Swift ${REQUIRED_SWIFT_MAJOR}.x host compiler)"
  else
    echo "❌ Swift toolchain is not Swift ${REQUIRED_SWIFT_MAJOR}.x — Capacitor pods are pinned to Swift ${PINNED_PODS_SWIFT_VERSION} which assumes a Swift ${REQUIRED_SWIFT_MAJOR} host compiler."
    exit 1
  fi
fi

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

# ---------------------------------------------------------------------------
# Pre-pod-install cleanup: stale modulemaps + Pods cache
# ---------------------------------------------------------------------------
# Xcode 26 + Capacitor specific failure mode:
#
# CocoaPods can leave behind generated Clang modulemaps and umbrella header
# folders (Pods/Headers/Public/Capacitor*, Pods/Headers/Private/Capacitor*,
# Pods/Target Support Files/Capacitor*/*.modulemap) from a previous install
# run. When `:modular_headers => true` was used historically OR when linkage
# strategy flipped (static <-> dynamic), these stale modulemaps shadow the
# pod's own framework modulemap (Capacitor.modulemap, CapacitorCordova.modulemap
# which defines `module Cordova`) and SwiftCompile fails with
#   CAPInstanceDescriptor.h:5:9: error: module 'Cordova' not found
# at `@import Cordova;`.
#
# We delete the entire Pods/ tree AND Podfile.lock to guarantee pod install
# regenerates header layouts from scratch — no stale modulemap can survive.
echo "🧹 Pre-install cleanup: removing stale Pods cache + modulemap artifacts..."
if [[ -d Pods ]]; then
  echo "  • inventory of stale modulemaps about to be deleted:"
  find Pods -type f -name '*.modulemap' 2>/dev/null | sed 's/^/    /' | head -40 || true
  find Pods/Headers -maxdepth 3 -type d \( -name 'Capacitor*' -o -name 'Cordova*' \) 2>/dev/null | sed 's/^/    /' | head -20 || true
fi
rm -rf Pods Podfile.lock
# Defensive: nuke any orphaned modulemap directories that some CocoaPods
# versions leave outside Pods/ (rare, but cheap to guard against).
rm -rf "$IOS_APP_DIR/build" "$IOS_APP_DIR/DerivedData" 2>/dev/null || true
echo "✅ Pods cache cleared — pod install will regenerate header layouts from scratch"

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
