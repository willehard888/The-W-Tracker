#!/bin/bash
set -euo pipefail

echo "🔧 Running pre-xcodebuild setup..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$IOS_APP_DIR/../.." && pwd)"

echo "ℹ️  ROOT_DIR=$ROOT_DIR"
echo "ℹ️  IOS_APP_DIR=$IOS_APP_DIR"

# ---------------------------------------------------------------------------
# Toolchain version pin re-verification
# ---------------------------------------------------------------------------
# ci_post_clone.sh exports PINNED_PODS_SWIFT_VERSION + verifies Xcode/Swift
# host versions. Re-check here so that even if Xcode Cloud restructures the
# build pipeline (skipping post-clone, running pre-xcodebuild from a cached
# image, etc.), we still fail fast on toolchain drift.
REQUIRED_XCODE_MAJOR_MINOR="${REQUIRED_XCODE_MAJOR_MINOR:-26.4}"
REQUIRED_SWIFT_MAJOR="${REQUIRED_SWIFT_MAJOR:-6}"
PINNED_PODS_SWIFT_VERSION="${PINNED_PODS_SWIFT_VERSION:-5.0}"
export PINNED_PODS_SWIFT_VERSION

if command -v xcodebuild &>/dev/null; then
  XCODE_VER_FULL=$(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')
  case "$XCODE_VER_FULL" in
    ${REQUIRED_XCODE_MAJOR_MINOR}*) echo "✅ Xcode ${XCODE_VER_FULL} matches pin ${REQUIRED_XCODE_MAJOR_MINOR}.x" ;;
    *)
      echo "❌ Xcode ${XCODE_VER_FULL} does not match required ${REQUIRED_XCODE_MAJOR_MINOR}.x"
      exit 1
      ;;
  esac
fi
if command -v swift &>/dev/null; then
  SWIFT_VER_FULL=$(swift --version 2>/dev/null | head -1 || echo "unknown")
  if echo "$SWIFT_VER_FULL" | grep -qE "Swift version ${REQUIRED_SWIFT_MAJOR}\."; then
    echo "✅ Swift host compiler is Swift ${REQUIRED_SWIFT_MAJOR}.x as required"
  else
    echo "❌ Swift host compiler is not Swift ${REQUIRED_SWIFT_MAJOR}.x — Capacitor pods pinned to Swift ${PINNED_PODS_SWIFT_VERSION} cannot be built safely."
    echo "   Reported: ${SWIFT_VER_FULL}"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Stale modulemap detector — pre-pod-install gate
# ---------------------------------------------------------------------------
# If a stale Capacitor*.modulemap or Cordova*.modulemap from a previous build
# survives into pre-xcodebuild, it can shadow the pod's own framework
# modulemap and trigger `module 'Cordova' not found` during SwiftCompile.
# When we control pod install (the missing-Pods branch below), we delete and
# regenerate. Otherwise we just report — Pods/ here is a sibling of the
# Podfile that ci_post_clone.sh already cleaned + re-installed.
if [[ -d "$IOS_APP_DIR/Pods" ]]; then
  STRAY_MAPS=$(find "$IOS_APP_DIR/Pods/Headers" -type f -name '*.modulemap' 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  if [[ "$STRAY_MAPS" != "0" ]]; then
    echo "⚠️  ${STRAY_MAPS} stray modulemap(s) under Pods/Headers — listing for diagnosis:"
    find "$IOS_APP_DIR/Pods/Headers" -type f -name '*.modulemap' 2>/dev/null | head -20
  fi
fi


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

  # Defensive cleanup before this fallback pod install runs. ci_post_clone.sh
  # already does this on the primary path; we duplicate the logic here so a
  # cached image / re-entry into pre_xcodebuild cannot inherit stale modulemaps.
  echo "🧹 Pre-install cleanup (pre-xcodebuild fallback): removing stale Pods cache + modulemap artifacts..."
  if [[ -d Pods ]]; then
    find Pods -type f -name '*.modulemap' 2>/dev/null | sed 's/^/  • /' | head -40 || true
  fi
  rm -rf Pods Podfile.lock
  echo "✅ Stale Pods cache cleared"

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

# Sanity gate: Podfile MUST NOT re-enable :modular_headers on Capacitor pods.
# Under Xcode 26.4.1 this causes SwiftCompile to fail with
# "module 'Cordova' not found" because CocoaPods-generated modulemaps shadow
# the framework modulemaps shipped inside the pod.
if grep -nE "pod\s+'Capacitor(Cordova)?'[^\\n]*:modular_headers\s*=>\s*true" \
     "$IOS_APP_DIR/Podfile" >/dev/null 2>&1; then
  echo "❌ Podfile uses :modular_headers => true on Capacitor pods — this breaks '@import Cordova' under Xcode 26."
  echo "   Remove the :modular_headers => true flag from the Capacitor and CapacitorCordova pod declarations."
  exit 1
fi
echo "✅ Podfile does not force modular_headers on Capacitor pods"

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

# Sanity gate: ensure CapacitorCordova ended up dynamic (mh_dylib), not static.
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

# ---------------------------------------------------------------------------
# Sanity gate: detect unquoted "Target Support Files" paths in Capacitor's
# generated xcconfig. The Podfile post_install hook injects Cordova modulemap
# visibility into SWIFT_INCLUDE_PATHS / HEADER_SEARCH_PATHS / OTHER_SWIFT_FLAGS;
# every value MUST be wrapped in escaped double quotes because Xcode's flag
# tokenizer splits on unquoted whitespace, which produced this regression in
# archive build 401:
#   error: Unexpected input file: .../Pods/Support
#   error: Unexpected input file: .../Pods/Files/CapacitorCordova/CapacitorCordova.modulemap
# ---------------------------------------------------------------------------
echo "🔒 Verifying Capacitor xcconfig has no unquoted 'Target Support Files' paths..."
unquoted_violations=0
for cfg_path in \
  "$IOS_APP_DIR/Pods/Target Support Files/Capacitor/Capacitor.release.xcconfig" \
  "$IOS_APP_DIR/Pods/Target Support Files/Capacitor/Capacitor.debug.xcconfig"; do
  [[ -f "$cfg_path" ]] || continue
  while IFS= read -r line; do
    case "$line" in
      SWIFT_INCLUDE_PATHS*|HEADER_SEARCH_PATHS*|OTHER_SWIFT_FLAGS*)
        # Strip every "..." quoted span, then look for the literal substring
        # 'Target Support Files'. If it survives stripping, it was unquoted.
        stripped=$(printf '%s' "$line" | sed -E 's/"[^"]*"//g')
        if printf '%s' "$stripped" | grep -q 'Target Support Files'; then
          echo "❌ Unquoted 'Target Support Files' in $(basename "$cfg_path"):"
          echo "    $line"
          unquoted_violations=$((unquoted_violations + 1))
        fi
        ;;
    esac
  done < "$cfg_path"
done
if [[ "$unquoted_violations" -gt 0 ]]; then
  echo "❌ ${unquoted_violations} unquoted-path violation(s) — Xcode will tokenize on the whitespace and fail with 'Unexpected input file: .../Pods/Support'."
  echo "   Fix: ensure the Podfile post_install hook wraps every Cordova path in escaped double quotes."
  exit 1
fi
echo "✅ Capacitor xcconfig paths all properly quoted"

# ---------------------------------------------------------------------------
# Sanity gate: forbid -fmodule-map-file=...CapacitorCordova.modulemap.
# Build 686 failed because swift-frontend was forced to load that modulemap,
# whose umbrella header is declared *relatively* but actually lives inside
# Cordova.framework/Headers/. The result was:
#   error: umbrella header 'CapacitorCordova.h' not found
#   error: could not build module 'Cordova'
# `@import Cordova;` MUST resolve via the built Cordova.framework's own
# Modules/module.modulemap (found through FRAMEWORK_SEARCH_PATHS), never via
# Pods/Target Support Files/CapacitorCordova/CapacitorCordova.modulemap.
# ---------------------------------------------------------------------------
echo "🔒 Verifying no -fmodule-map-file points at CapacitorCordova.modulemap..."
forbidden_modmap_hits=0
for cfg_path in \
  "$IOS_APP_DIR/Pods/Target Support Files/Capacitor/Capacitor.release.xcconfig" \
  "$IOS_APP_DIR/Pods/Target Support Files/Capacitor/Capacitor.debug.xcconfig"; do
  [[ -f "$cfg_path" ]] || continue
  if grep -E 'fmodule-map-file=[^ ]*CapacitorCordova\.modulemap' "$cfg_path" >/dev/null 2>&1; then
    echo "❌ $(basename "$cfg_path") forces CapacitorCordova.modulemap via -fmodule-map-file:"
    grep -nE 'fmodule-map-file' "$cfg_path" || true
    forbidden_modmap_hits=$((forbidden_modmap_hits + 1))
  fi
done
if [[ "$forbidden_modmap_hits" -gt 0 ]]; then
  echo "❌ Remove the -fmodule-map-file injection from Podfile post_install — let Cordova.framework provide the modulemap."
  exit 1
fi
echo "✅ No forbidden -fmodule-map-file=CapacitorCordova.modulemap injection"

# ---------------------------------------------------------------------------
# Self-healing: ensure Swift-target xcconfigs are pinned to SWIFT_VERSION = 5.
# The Podfile post_install hook writes these settings into build_settings, but
# CocoaPods occasionally omits default-matching values from the emitted
# xcconfig — so we patch the files directly to guarantee the sanity gate and
# the Xcode build agree on the pinned version.
# ---------------------------------------------------------------------------
echo "🛠  Self-healing: pinning SWIFT_VERSION=${PINNED_PODS_SWIFT_VERSION} + SWIFT_OPTIMIZATION_LEVEL on Capacitor Swift pods..."
IOS_APP_DIR_FOR_PATCH="$IOS_APP_DIR" \
PINNED_PODS_SWIFT_VERSION="$PINNED_PODS_SWIFT_VERSION" \
python3 - <<'PY'
import os
import re
from pathlib import Path

root = Path(os.environ['IOS_APP_DIR_FOR_PATCH'])
pinned_swift = os.environ['PINNED_PODS_SWIFT_VERSION']
# Pods whose Swift targets hit the Xcode 26.4.1 constraint-solver crash.
swift_pinned_pods = ['Capacitor', 'RevenuecatPurchasesCapacitor']
configs = ['release', 'debug']

required_settings = {
    'SWIFT_VERSION': pinned_swift,
    'SWIFT_OPTIMIZATION_LEVEL': '-Onone',
    'SWIFT_COMPILATION_MODE': 'singlefile',
}

for pod in swift_pinned_pods:
    for cfg in configs:
        path = root / f'Pods/Target Support Files/{pod}/{pod}.{cfg}.xcconfig'
        if not path.is_file():
            print(f'⚠️  {path} missing — skipping')
            continue
        content = path.read_text()
        original = content
        for key, val in required_settings.items():
            pattern = re.compile(rf'^{re.escape(key)}\s*=.*$', re.MULTILINE)
            if pattern.search(content):
                content = pattern.sub(f'{key} = {val}', content)
            else:
                if not content.endswith('\n'):
                    content += '\n'
                content += f'{key} = {val}\n'
        if content != original:
            path.write_text(content)
            print(f'patched {path.relative_to(root)}')
        else:
            print(f'ok {path.relative_to(root)}')
PY

# Sanity gate (after self-healing): confirm Capacitor pod is pinned to Swift 5
# to dodge the Xcode 26.4.1 Swift 6 type-checker crash on Capacitor.swift.
CAP_RELEASE_CFG="$IOS_APP_DIR/Pods/Target Support Files/Capacitor/Capacitor.release.xcconfig"
if [[ -f "$CAP_RELEASE_CFG" ]]; then
  if grep -qE '^SWIFT_VERSION\s*=\s*5' "$CAP_RELEASE_CFG"; then
    echo "✅ Capacitor.release.xcconfig pinned to SWIFT_VERSION = 5"
  else
    echo "❌ Capacitor.release.xcconfig is NOT pinned to SWIFT_VERSION = 5 — Swift 6 type-checker will crash."
    grep -E '^SWIFT_VERSION' "$CAP_RELEASE_CFG" || echo "  (no SWIFT_VERSION line found)"
    exit 1
  fi
  if grep -qE '^SWIFT_OPTIMIZATION_LEVEL\s*=\s*-Onone' "$CAP_RELEASE_CFG"; then
    echo "✅ Capacitor.release.xcconfig uses -Onone (constraint solver workaround)"
  else
    echo "⚠️  Capacitor.release.xcconfig missing SWIFT_OPTIMIZATION_LEVEL=-Onone — type-checker may still crash"
  fi
fi

RC_RELEASE_CFG="$IOS_APP_DIR/Pods/Target Support Files/RevenuecatPurchasesCapacitor/RevenuecatPurchasesCapacitor.release.xcconfig"
if [[ -f "$RC_RELEASE_CFG" ]]; then
  if grep -qE '^SWIFT_VERSION\s*=\s*5' "$RC_RELEASE_CFG"; then
    echo "✅ RevenuecatPurchasesCapacitor.release.xcconfig pinned to SWIFT_VERSION = 5"
  else
    echo "❌ RevenuecatPurchasesCapacitor.release.xcconfig is NOT pinned to SWIFT_VERSION = 5."
    exit 1
  fi
fi

# ── Stub Cordova.framework for Xcode 26 dependency scanner ─────────────────
# Xcode 26's explicit-modules build system scans ALL Swift targets for module
# dependencies BEFORE any compilation begins. Capacitor's headers reach
# `@import Cordova` (CAPInstanceDescriptor.h:5) during that scan, but
# Cordova.framework hasn't been compiled yet → Module 'Cordova' not found.
#
# Strategy — two stubs, belt-and-suspenders:
#
# 1. FIXED stub inside Pods/CordovaStub/ (absolute path, no variable expansion).
#    We patch the Capacitor xcconfig files to add this path to FRAMEWORK_SEARCH_PATHS
#    so the scanner finds it regardless of how PODS_CONFIGURATION_BUILD_DIR resolves.
#
# 2. DerivedData stub at ${BUILD_DIR}/Release-iphoneos/CapacitorCordova/ — where
#    CocoaPods' xcconfig already points via ${PODS_CONFIGURATION_BUILD_DIR}.
#    Belt-and-suspenders: if variable expansion is correct this path also works.
#
# Both stubs are populated with the real Cordova headers from node_modules so
# `@import Cordova` compiles cleanly. The real CapacitorCordova target overwrites
# the DerivedData stub with a proper binary during normal compilation.
echo "🔨 Creating Cordova.framework stub for Xcode 26 scan-phase race..."

CORDOVA_SRC="${ROOT_DIR}/node_modules/@capacitor/ios/CapacitorCordova/CapacitorCordova"

if [[ ! -d "${CORDOVA_SRC}" ]]; then
  echo "❌ Cordova source not found at ${CORDOVA_SRC}"
  exit 1
fi

# Helper: populate a Cordova.framework directory with real headers + modulemap.
_make_cordova_fw() {
  local fw="$1"
  mkdir -p "${fw}/Headers" "${fw}/Modules"
  find "${CORDOVA_SRC}" -name "*.h" -exec cp {} "${fw}/Headers/" \;
  cat > "${fw}/Modules/module.modulemap" << 'MODULEMAP'
framework module Cordova {
  umbrella header "CapacitorCordova.h"
  export *
  module * { export * }
}
MODULEMAP
  # Placeholder binary — some tools check framework bundle completeness.
  touch "${fw}/Cordova"
}

# ── 1. Fixed stub: inside Pods directory (always exists after pod install) ────
PODS_DIR="${IOS_APP_DIR}/Pods"
FIXED_STUB_DIR="${PODS_DIR}/CordovaStub"
FIXED_FW="${FIXED_STUB_DIR}/Cordova.framework"

_make_cordova_fw "${FIXED_FW}"

HDR_COUNT=$(ls "${FIXED_FW}/Headers/" 2>/dev/null | wc -l | tr -d ' ')
if [[ -f "${FIXED_FW}/Modules/module.modulemap" && -f "${FIXED_FW}/Headers/CapacitorCordova.h" ]]; then
  echo "✅ Fixed stub at ${FIXED_FW} (${HDR_COUNT} headers)"
else
  echo "❌ Fixed stub creation failed"
  ls -la "${FIXED_FW}/Headers/" 2>/dev/null | head -5
  exit 1
fi

# ── 2a. Patch Capacitor xcconfigs via OTHER_SWIFT_FLAGS → -Xcc -F ──────────────
# ROOT-CAUSE: Xcode 26 archive builds do NOT forward FRAMEWORK_SEARCH_PATHS to
# swift-frontend's embedded Clang (confirmed from build logs: the only -F flag
# in the swift-frontend invocation is the target's own CONFIGURATION_BUILD_DIR).
# The only reliable way to inject a -F path into embedded Clang is via
# OTHER_SWIFT_FLAGS = … -Xcc -F<path>.
# In xcconfig the LAST definition of a key wins, so we append our override.
# We re-include -D COCOAPODS so the value from the first line is not lost.
for _xcc in \
  "${PODS_DIR}/Target Support Files/Capacitor/Capacitor.release.xcconfig" \
  "${PODS_DIR}/Target Support Files/Capacitor/Capacitor.debug.xcconfig"; do
  if [[ -f "$_xcc" ]]; then
    if grep -q "CordovaStub" "$_xcc" 2>/dev/null; then
      echo "ℹ️  $(basename "$_xcc") already patched — skipping"
    else
      printf '\n// Cordova stub — injected by ci_pre_xcodebuild.sh\n// FRAMEWORK_SEARCH_PATHS is NOT forwarded to swift-frontend in Xcode 26 archive\n// builds; -Xcc -F via OTHER_SWIFT_FLAGS is the correct mechanism.\nOTHER_SWIFT_FLAGS = $(inherited) -D COCOAPODS -Xcc -F%s\n' \
        "${FIXED_STUB_DIR}" >> "$_xcc"
      echo "✅ Patched $(basename "$_xcc") with CordovaStub via OTHER_SWIFT_FLAGS -Xcc -F"
    fi
  else
    echo "⚠️  xcconfig not found: $_xcc"
  fi
done

# ── 2b. (REMOVED) DerivedData stub no longer needed ───────────────────────────
# Build 746 revealed that pre-seeding our stub Cordova.framework at the path
# CapacitorCordova would normally build into (${PODS_CONFIGURATION_BUILD_DIR}/
# CapacitorCordova/Cordova.framework) caused the linker to fail with
# "Framework 'Cordova' not found": once our stub exists at that path,
# xcodebuild treats the framework as already-up-to-date and skips producing
# the real binary, leaving the linker with our empty Cordova binary stub.
#
# With the source-level patches in section 3 (CAPInstanceDescriptor.h/.m and
# CAPBridgeViewController+CDVScreenOrientationDelegate.h), Cordova module
# resolution at compile time no longer depends on these pre-seeded stubs:
#   - CAPInstanceDescriptor.h: @class forward decl, no module needed
#   - CAPInstanceDescriptor.m: relative-path #import to real header on disk
#   - Category .h: inline protocol declaration, no module needed
# So the DerivedData stubs were doing harm without any remaining benefit.
#
# We KEEP only the Pods/CordovaStub/ stub (above), which is at a path
# xcodebuild never writes to — so it's purely additive and never blocks
# real framework builds.
#
# Sanity-check that xcodebuild WILL produce Cordova.framework as expected:
# the CapacitorCordova podspec sets `s.module_name = 'Cordova'`, so its
# build product is Cordova.framework at PODS_CONFIGURATION_BUILD_DIR/CapacitorCordova/.
echo "ℹ️  Skipping DerivedData stub seeding — relies on real CapacitorCordova target build instead"

# Sanity-check the actual build path will not contain a leftover empty stub
# from a previous build run (safe-guard against caching across builds).
if [[ -d "/Volumes/workspace" ]]; then
  XC_DD="/Volumes/workspace/DerivedData"
  ARCHIVE_PODS_CFG_BUILD_DIR="${XC_DD}/Build/Intermediates.noindex/ArchiveIntermediates/App/BuildProductsPath/Release-iphoneos"
  PRODUCTS_PODS_CFG_BUILD_DIR="${XC_DD}/Build/Products/Release-iphoneos"
  for _stale in \
    "${ARCHIVE_PODS_CFG_BUILD_DIR}/CapacitorCordova/Cordova.framework" \
    "${PRODUCTS_PODS_CFG_BUILD_DIR}/CapacitorCordova/Cordova.framework" \
    "${ARCHIVE_PODS_CFG_BUILD_DIR}/Capacitor/Cordova.framework" \
    "${PRODUCTS_PODS_CFG_BUILD_DIR}/Capacitor/Cordova.framework"; do
    if [[ -d "${_stale}" ]]; then
      _stale_bin="${_stale}/Cordova"
      # Heuristic: a stub binary is < 100 bytes (we touched it empty).
      # A real Mach-O binary is many KB. Remove only if it's stub-sized.
      if [[ -f "${_stale_bin}" ]] && [[ $(stat -f%z "${_stale_bin}" 2>/dev/null || stat -c%s "${_stale_bin}" 2>/dev/null) -lt 100 ]]; then
        echo "🧹 Removing stale stub framework at ${_stale}"
        rm -rf "${_stale}"
      fi
    fi
  done
fi
# ── 3. SOURCE-LEVEL PATCH (the nuclear option that ALWAYS works) ───────────────
# All previous attempts (FRAMEWORK_SEARCH_PATHS, OTHER_SWIFT_FLAGS -Xcc -F,
# pre-seeded stubs) rely on Xcode 26 honouring xcconfig propagation to
# swift-frontend's embedded Clang — which it demonstrably does NOT do for the
# Pods.xcodeproj's Capacitor target during archive builds.
#
# The remaining-rock-solid fix: change the SOURCE so the umbrella header
# (CAPInstanceDescriptor.h) no longer needs the Cordova module during the
# scan/import-underlying-module phase. The header only uses ONE Cordova type —
# CDVConfigParser — and only as a property type, so a forward `@class`
# declaration is sufficient. The .m and .swift files inside the Capacitor target
# can still find Cordova via the existing OTHER_LDFLAGS link directive.
echo "🔧 Source-patching CAPInstanceDescriptor.h to drop @import Cordova umbrella dependency..."
CAP_HDR="${ROOT_DIR}/node_modules/@capacitor/ios/Capacitor/Capacitor/CAPInstanceDescriptor.h"
if [[ -f "${CAP_HDR}" ]]; then
  if grep -q "// @import Cordova; — patched by ci_pre_xcodebuild.sh" "${CAP_HDR}" 2>/dev/null; then
    echo "ℹ️  CAPInstanceDescriptor.h already patched — skipping"
  elif grep -q "^@import Cordova;" "${CAP_HDR}" 2>/dev/null; then
    # Replace `@import Cordova;` with a forward declaration of the only Cordova
    # symbol referenced in this header (CDVConfigParser).
    /usr/bin/sed -i.bak \
      -e 's|^@import Cordova;|// @import Cordova; — patched by ci_pre_xcodebuild.sh\n@class CDVConfigParser;|' \
      "${CAP_HDR}"
    rm -f "${CAP_HDR}.bak"
    if grep -q "@class CDVConfigParser;" "${CAP_HDR}"; then
      echo "✅ Patched CAPInstanceDescriptor.h: @import Cordova → @class CDVConfigParser"
    else
      echo "❌ sed patch did not produce expected output in CAPInstanceDescriptor.h"
      grep -n "Cordova\|CDVConfigParser" "${CAP_HDR}" | head -5
      exit 1
    fi
  else
    echo "⚠️  CAPInstanceDescriptor.h does not contain '@import Cordova;' — header may have changed"
    grep -n "Cordova" "${CAP_HDR}" | head -5
  fi
else
  echo "❌ CAPInstanceDescriptor.h not found at ${CAP_HDR}"
  exit 1
fi

# ── 3b. Make CDVConfigParser visible in CAPInstanceDescriptor.m ───────────────
# Removing @import Cordova from the .h leaves CAPInstanceDescriptor.m with only
# the @class forward declaration, which doesn't expose +alloc / -init.
#
# Build 743 confirmed `@import Cordova;` ALSO fails inside the regular CompileC
# task — Xcode 26 archive builds simply don't propagate FRAMEWORK_SEARCH_PATHS
# to module resolution for these pod targets, regardless of which Clang
# invocation we're talking about.
#
# Bulletproof fix: bypass the module system entirely. Use a relative-path
# `#import "..."` to the real CDVConfigParser.h on disk. This is plain header
# inclusion based on the source file's directory — needs neither
# FRAMEWORK_SEARCH_PATHS nor HEADER_SEARCH_PATHS nor module resolution.
# CDVConfigParser.h itself only imports <Foundation/Foundation.h>.
CAP_IMPL="${ROOT_DIR}/node_modules/@capacitor/ios/Capacitor/Capacitor/CAPInstanceDescriptor.m"
if [[ -f "${CAP_IMPL}" ]]; then
  if grep -q "// Cordova header injected by ci_pre_xcodebuild.sh" "${CAP_IMPL}" 2>/dev/null; then
    echo "ℹ️  CAPInstanceDescriptor.m already patched — skipping"
  else
    # Remove any prior `@import Cordova;` line we may have injected on a
    # previous build (idempotent re-runs).
    /usr/bin/sed -i.bak \
      -e '/^\/\/ Cordova import injected by ci_pre_xcodebuild\.sh/d' \
      -e '/^@import Cordova;$/d' \
      "${CAP_IMPL}"
    # Inject a relative-path #import at the very top.
    /usr/bin/sed -i.bak2 \
      -e '1i\
// Cordova header injected by ci_pre_xcodebuild.sh — see CAPInstanceDescriptor.h patch\
#import "../../CapacitorCordova/CapacitorCordova/Classes/Public/CDVConfigParser.h"\
' \
      "${CAP_IMPL}"
    rm -f "${CAP_IMPL}.bak" "${CAP_IMPL}.bak2"
    if grep -q '#import "../../CapacitorCordova/CapacitorCordova/Classes/Public/CDVConfigParser.h"' "${CAP_IMPL}"; then
      echo "✅ Patched CAPInstanceDescriptor.m with direct relative-path import of CDVConfigParser.h"
    else
      echo "❌ sed patch did not produce expected output in CAPInstanceDescriptor.m"
      head -5 "${CAP_IMPL}"
      exit 1
    fi
  fi
else
  echo "❌ CAPInstanceDescriptor.m not found at ${CAP_IMPL}"
  exit 1
fi
# Sanity-check that the target header actually exists at the expected relative path.
_relative_target="${ROOT_DIR}/node_modules/@capacitor/ios/CapacitorCordova/CapacitorCordova/Classes/Public/CDVConfigParser.h"
if [[ ! -f "${_relative_target}" ]]; then
  echo "❌ CDVConfigParser.h not found at expected location: ${_relative_target}"
  exit 1
fi
echo "✅ CDVConfigParser.h confirmed at ${_relative_target}"

# ── 3c. Make CDVScreenOrientationDelegate visible in the category header ──────
# CAPBridgeViewController+CDVScreenOrientationDelegate.h declares
#   @interface CAPBridgeViewController (...) <CDVScreenOrientationDelegate>
# but only imports <Capacitor/Capacitor-Swift.h>. The protocol previously came
# in transitively via @import Cordova in CAPInstanceDescriptor.h — now stripped.
#
# WHY the relative-path #import (build 745) didn't work for this .h while it did
# for the .m: this header is consumed via CocoaPods' public-headers symlink
# directory (Pods/Headers/Public/Capacitor/...). When Clang resolves a relative
# `#import "..."` from that symlinked location, the path no longer points to
# CapacitorCordova/. The .m, by contrast, is compiled directly from its real
# source path so its relative import works.
#
# Bulletproof fix for the .h: don't rely on path resolution at all. Inline
# the protocol declaration. We guard with __has_include so the inline copy is
# only used when the real Cordova header isn't reachable via the module system —
# eliminating any redefinition-clash risk.
CAP_CAT_HDR="${ROOT_DIR}/node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeViewController+CDVScreenOrientationDelegate.h"
if [[ -f "${CAP_CAT_HDR}" ]]; then
  if grep -q "// CDVScreenOrientationDelegate inline-protocol injected by ci_pre_xcodebuild.sh" "${CAP_CAT_HDR}" 2>/dev/null; then
    echo "ℹ️  CAPBridgeViewController+CDVScreenOrientationDelegate.h already patched — skipping"
  else
    # First, strip any prior failed injection (the build-745 relative-path attempt).
    /usr/bin/sed -i.bak \
      -e '/^\/\/ CDVScreenOrientationDelegate header injected by ci_pre_xcodebuild\.sh/d' \
      -e '/^#import "\.\.\/\.\.\/CapacitorCordova/d' \
      "${CAP_CAT_HDR}"
    # Inject inline protocol declaration with __has_include fallback.
    /usr/bin/sed -i.bak2 -e '1i\
// CDVScreenOrientationDelegate inline-protocol injected by ci_pre_xcodebuild.sh\
// Avoids reliance on FRAMEWORK_SEARCH_PATHS for module resolution at scan time.\
#import <UIKit/UIKit.h>\
#if __has_include(<Cordova/CDVScreenOrientationDelegate.h>)\
  #import <Cordova/CDVScreenOrientationDelegate.h>\
#else\
@protocol CDVScreenOrientationDelegate <NSObject>\
- (BOOL)shouldAutorotate;\
- (UIInterfaceOrientationMask)supportedInterfaceOrientations;\
@end\
#endif\
' \
      "${CAP_CAT_HDR}"
    rm -f "${CAP_CAT_HDR}.bak" "${CAP_CAT_HDR}.bak2"
    if grep -q '@protocol CDVScreenOrientationDelegate <NSObject>' "${CAP_CAT_HDR}"; then
      echo "✅ Patched CAPBridgeViewController+CDVScreenOrientationDelegate.h with inline protocol"
    else
      echo "❌ sed patch did not produce expected output"
      head -15 "${CAP_CAT_HDR}"
      exit 1
    fi
  fi
else
  echo "❌ Category header not found at ${CAP_CAT_HDR}"
  exit 1
fi

# ── 3d. Sweep for ANY other Cordova-symbol references in Capacitor headers ────
# Catch-all: scan all Capacitor public headers / source files for unresolved
# Cordova type references (CDV*) that aren't already satisfied by an import.
# Reports findings so future builds surface this kind of issue early instead of
# during xcodebuild. Non-fatal — informational only.
echo "🔍 Scanning Capacitor sources for additional Cordova type references…"
CAP_SRC_DIR="${ROOT_DIR}/node_modules/@capacitor/ios/Capacitor/Capacitor"
_extra_cdv_refs=$(grep -rEho '\bCDV[A-Z][A-Za-z0-9_]+' "${CAP_SRC_DIR}" \
  --include="*.h" --include="*.m" --include="*.swift" 2>/dev/null \
  | sort -u \
  | grep -v -E '^(CDVConfigParser|CDVScreenOrientationDelegate)$' || true)
if [[ -n "${_extra_cdv_refs}" ]]; then
  echo "ℹ️  Other Cordova types referenced (already covered by Cordova module via .m / .swift compilation):"
  echo "${_extra_cdv_refs}" | sed 's/^/    - /'
fi

# ── 4. Inject -F flags via xcconfig file appends (no ruby/gems required) ─────
# Build 750 ci_pre_xcodebuild.log: the Ruby xcodeproj approach failed because
# Xcode Cloud's /usr/bin/ruby (system 2.6) doesn't have the xcodeproj gem:
#   require: cannot load such file -- xcodeproj (LoadError)
#
# Plain xcconfig file appends DO work — that's how section 2a already injects
# OTHER_SWIFT_FLAGS successfully. xcconfig last-definition-wins, and xcconfig
# OTHER_LDFLAGS demonstrably reaches ld (it's how `-framework Cordova` got
# there in the first place).
#
# Build 748 linker log proved Cordova.framework is built at
#   \$(OBJROOT)/UninstalledProducts/\$(PLATFORM_NAME)/Cordova.framework
# during archive — NOT in \$(PODS_CONFIGURATION_BUILD_DIR)/CapacitorCordova/.
# So we append both candidate -F paths and let ld pick the one that exists.
# We also re-emit the original -framework "Cordova" -framework "WebKit"
# entries because the new line REPLACES the original OTHER_LDFLAGS.
echo "🔧 Appending OTHER_LDFLAGS -F paths into Capacitor xcconfigs…"
for _xcc in \
  "${PODS_DIR}/Target Support Files/Capacitor/Capacitor.release.xcconfig" \
  "${PODS_DIR}/Target Support Files/Capacitor/Capacitor.debug.xcconfig"; do
  if [[ -f "$_xcc" ]]; then
    if grep -q "UninstalledProducts" "$_xcc" 2>/dev/null; then
      echo "ℹ️  $(basename "$_xcc") already has UninstalledProducts -F — skipping"
    else
      cat >> "$_xcc" <<'XCCONFIG'

// Build 748+750 fix: ld can't find Cordova.framework because xcconfig
// FRAMEWORK_SEARCH_PATHS points at $(PODS_CONFIGURATION_BUILD_DIR)/CapacitorCordova
// while archive builds actually place it at $(OBJROOT)/UninstalledProducts/$(PLATFORM_NAME).
// Last-definition-wins: re-include -framework Cordova/WebKit then add explicit -F paths.
OTHER_LDFLAGS = $(inherited) -framework "Cordova" -framework "WebKit" -F$(OBJROOT)/UninstalledProducts/$(PLATFORM_NAME) -F$(PODS_CONFIGURATION_BUILD_DIR)/CapacitorCordova
XCCONFIG
      echo "✅ Appended -F UninstalledProducts to $(basename "$_xcc")"
    fi
  else
    echo "⚠️  xcconfig not found: $_xcc"
  fi
done

echo "✅ pre-xcodebuild setup complete"
