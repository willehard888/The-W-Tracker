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

# ── 3.5. Build a SHARED-DEPS framework directory for plugins to -F into ──────
#
# Build 753 revealed the next layer of the problem:
#   CapacitorHaptics.build/module.modulemap:9: error: header 'CapacitorHaptics-Swift.h' not found
#   could not build Objective-C module 'CapacitorHaptics'  (in target 'CapacitorHaptics')
#
# Same self-referential pattern as build 752, but for plugin targets. Adding
#   -F$(OBJROOT)/UninstalledProducts/$(PLATFORM_NAME)
# to a plugin's compile flags exposes EVERY framework in that directory —
# including the plugin's own partially-built framework. Clang sees the partial
# framework and tries to resolve `import CapacitorHaptics` against it, but the
# Swift header isn't generated yet (we're emitting it right now).
#
# Fix: create a dedicated directory ${PODS_DIR}/CapDepsFwks/ that contains only
# the dependencies plugins need (Capacitor.framework, Cordova.framework) via
# symlinks. Plugins -F into THIS directory only — they never see their own
# framework that way.
#
# The symlink targets don't have to exist when the link is created — by the
# time a plugin actually compiles, Capacitor target has already finished
# (Podfile post_install enforces that ordering) and Capacitor.framework is real.
echo "🔗 Building per-target CapDepsFwks/<Target>/ symlink directories…"
CAP_DEPS_DIR="${PODS_DIR}/CapDepsFwks"
mkdir -p "${CAP_DEPS_DIR}"
if [[ -d "/Volumes/workspace" ]]; then
  # Xcode Cloud archive: OBJROOT/UninstalledProducts is a fixed absolute path
  _UNINSTALLED="/Volumes/workspace/DerivedData/Build/Intermediates.noindex/ArchiveIntermediates/App/IntermediateBuildFilesPath/UninstalledProducts/iphoneos"
else
  # Local dev: derive at script time
  _bdir=$(xcodebuild -workspace "${IOS_APP_DIR}/App.xcworkspace" \
    -scheme App -configuration Release \
    -showBuildSettings 2>/dev/null \
    | awk -F' = ' '/^[[:space:]]*OBJROOT[[:space:]]*=/{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}')
  _UNINSTALLED="${_bdir}/UninstalledProducts/iphoneos"
fi

# Per-target dependency map. Each target gets its OWN subdir containing only
# its direct dependencies — never its own framework — so adding -F to that
# subdir cannot trigger a self-referential module resolution loop.
#
# Format: "<TargetName>:<dep1> <dep2> …" (deps are space-separated framework
# basenames, without .framework suffix).
_dep_entries=(
  "Capacitor:Cordova"
  "CapacitorApp:Capacitor Cordova"
  "CapacitorAppLauncher:Capacitor Cordova"
  "CapacitorBrowser:Capacitor Cordova"
  "CapacitorHaptics:Capacitor Cordova"
  "CapacitorLocalNotifications:Capacitor Cordova"
  "CapacitorPushNotifications:Capacitor Cordova"
  "PurchasesHybridCommon:RevenueCat"
  "RevenuecatPurchasesCapacitor:Capacitor Cordova RevenueCat PurchasesHybridCommon"
)
for _entry in "${_dep_entries[@]}"; do
  _target="${_entry%%:*}"
  _deps="${_entry#*:}"
  _dir="${CAP_DEPS_DIR}/${_target}"
  mkdir -p "${_dir}"
  for _dep in ${_deps}; do
    ln -sfn "${_UNINSTALLED}/${_dep}.framework" "${_dir}/${_dep}.framework"
  done
  echo "✅ CapDepsFwks/${_target}/ ← {${_deps// /, }}.framework"
done

# ── 4. Inject -F flags into pod xcconfigs (target-class-aware) ───────────────
#
# Why this section exists at all (recap from build 748–752 logs):
#
#   In Xcode 26 archive mode, pod targets that have SKIP_INSTALL = YES
#   (Capacitor, CapacitorCordova, every Capacitor* plugin, Revenuecat…)
#   do NOT land in $(PODS_CONFIGURATION_BUILD_DIR)/<TargetName>/ as the
#   CocoaPods-generated FRAMEWORK_SEARCH_PATHS assumes. They land at
#   $(OBJROOT)/UninstalledProducts/$(PLATFORM_NAME)/<Module>.framework
#   instead. Worse, FRAMEWORK_SEARCH_PATHS in xcconfig is not forwarded to
#   swift-frontend / ld in this configuration, so ALL search-path additions
#   need to go through OTHER_LDFLAGS / OTHER_SWIFT_FLAGS / OTHER_CFLAGS.
#
# THREE classes of target, THREE patch strategies:
#
#   A) Capacitor target itself ─ links AGAINST Cordova at archive time, so
#      OTHER_LDFLAGS needs -F$(OBJROOT)/UninstalledProducts/$(PLATFORM_NAME).
#      But its own SOURCE compilation must NOT see its own Capacitor.framework
#      via that -F path — at compile time the framework is partially built
#      (Capacitor-Swift.h hasn't been emitted yet) and Clang would try to
#      resolve `import Capacitor` against the half-finished framework and
#      fail with `header 'Capacitor-Swift.h' not found` (build 752 regression).
#      So we patch ONLY OTHER_LDFLAGS for Capacitor.{release,debug}.xcconfig.
#
#   B) CapacitorCordova target itself ─ leaf node. It builds Cordova.framework
#      and depends on nothing in our pod graph. No patching needed. SKIP.
#
#   C) Every other pod (CapacitorApp, CapacitorAppLauncher, CapacitorBrowser,
#      CapacitorHaptics, CapacitorLocalNotifications, CapacitorPushNotifications,
#      RevenuecatPurchasesCapacitor) ─ depends on Capacitor.framework. Needs
#      -F path at compile time (swift-frontend, embedded Clang, CompileC) AND
#      at link time. Patch all three of LDFLAGS / SWIFT_FLAGS / CFLAGS.
#
# Idempotency: each xcconfig gets a `__CAPDEPSFWKS_F_INJECTED__` marker line.
# Re-running on an already-patched file is a no-op.
echo "🔧 Patching pod xcconfigs to -F into per-target CapDepsFwks/$(TARGET_NAME)/…"
# Each pod target gets a -F path to its OWN dedicated dep dir (per-target
# subdir built in section 3.5). $(TARGET_NAME) is expanded by xcodebuild
# at build time to the pod target's name. Each subdir contains symlinks to
# ONLY that target's direct dependencies — never the target's own framework
# — so self-referential module resolution loops are architecturally impossible.
_deps_F='-F$(PODS_ROOT)/CapDepsFwks/$(TARGET_NAME)'
_marker='__CAPDEPSFWKS_F_INJECTED__'

# Helper: append " -F<path>" to the existing OTHER_LDFLAGS line of an xcconfig.
_append_ldflag_path() {
  local _file="$1"
  /usr/bin/sed -i.bak -E \
    "s|^(OTHER_LDFLAGS = .*)\$|\\1 ${_deps_F}|" \
    "$_file"
  rm -f "${_file}.bak"
}

# Helper: append new OTHER_SWIFT_FLAGS + OTHER_CFLAGS lines that bring the -F
# path into compile-time module / header resolution (last-definition wins).
_append_compile_flags() {
  local _file="$1"
  cat >> "$_file" <<'XCCONFIG'

// Build 753+754 fix: resolve cross-target framework deps via
// Pods/CapDepsFwks/$(TARGET_NAME)/ which contains symlinks to ONLY this
// target's direct dependencies. Self-frameworks are never present there,
// so no self-referential module loops. -D COCOAPODS re-emitted because
// xcconfig last-definition-wins replaces the prior OTHER_SWIFT_FLAGS line.
OTHER_SWIFT_FLAGS = $(inherited) -D COCOAPODS -F$(PODS_ROOT)/CapDepsFwks/$(TARGET_NAME) -Xcc -F$(PODS_ROOT)/CapDepsFwks/$(TARGET_NAME)
OTHER_CFLAGS = $(inherited) -F$(PODS_ROOT)/CapDepsFwks/$(TARGET_NAME)
XCCONFIG
}

# Helper: stamp the idempotency marker.
_stamp_marker() {
  echo "// __CAPDEPSFWKS_F_INJECTED__" >> "$1"
}

_patched_full=0
_skipped=0

while IFS= read -r -d '' _xcc; do
  _name=$(basename "$_xcc")

  # Already patched in a previous run?
  if grep -q "${_marker}" "$_xcc" 2>/dev/null; then
    _skipped=$((_skipped + 1))
    continue
  fi

  case "$_name" in
    # Leaf targets (build their framework from sources alone, no deps to find).
    CapacitorCordova.release.xcconfig | CapacitorCordova.debug.xcconfig | \
    RevenueCat.release.xcconfig       | RevenueCat.debug.xcconfig)
      _skipped=$((_skipped + 1))
      continue
      ;;
    # Targets that need to find dependency frameworks at compile + link time.
    # Per-target subdir means -F never exposes self-framework, so FULL patch
    # (LDFLAGS + SWIFT_FLAGS + CFLAGS) is safe for every entry.
    Capacitor.release.xcconfig | Capacitor.debug.xcconfig | \
    Capacitor*.release.xcconfig | Capacitor*.debug.xcconfig | \
    RevenuecatPurchasesCapacitor.release.xcconfig | RevenuecatPurchasesCapacitor.debug.xcconfig | \
    PurchasesHybridCommon.release.xcconfig         | PurchasesHybridCommon.debug.xcconfig)
      _append_ldflag_path "$_xcc"
      _append_compile_flags "$_xcc"
      _stamp_marker "$_xcc"
      _patched_full=$((_patched_full + 1))
      echo "✅ Patched ${_name} → CapDepsFwks/\$(TARGET_NAME)/"
      ;;
    *)
      ;;
  esac
done < <(find "${PODS_DIR}/Target Support Files" \
  \( -name "Capacitor*.xcconfig" \
     -o -name "RevenuecatPurchasesCapacitor*.xcconfig" \
     -o -name "PurchasesHybridCommon*.xcconfig" \
     -o -name "RevenueCat*.xcconfig" \) \
  -print0 2>/dev/null)

echo "✅ xcconfig patches summary: ${_patched_full} patched, ${_skipped} skipped (leaf)"

# ── 4b. Wrap `-disable-availability-checking` in `-Xfrontend` (warning fix) ──
# Bare `-disable-availability-checking` is a swift-frontend flag, not a
# swift-driver flag. Passing it directly emits:
#   Save unknown driver flag -disable-availability-checking as additional swift-frontend flag
# which Xcode 26's xcresult escalates to a [Swift Compiler Error] (cosmetic
# but ugly). Wrap in `-Xfrontend` so the driver forwards it correctly.
# Podfile is already updated for future pod-installs; this sed-edit covers
# any pbxproj already on disk from a previous pod install. Idempotent.
echo "🔧 Wrapping bare -disable-availability-checking in -Xfrontend in Pods.xcodeproj…"
PODS_PBXPROJ="${PODS_DIR}/Pods.xcodeproj/project.pbxproj"
if [[ -f "${PODS_PBXPROJ}" ]]; then
  # Replace ` -disable-availability-checking` only if not already preceded by -Xfrontend
  /usr/bin/python3 - <<PY
import re, sys
p = "${PODS_PBXPROJ}"
with open(p) as f:
    s = f.read()
# Match a bare " -disable-availability-checking" not preceded by "-Xfrontend ".
new_s = re.sub(
    r"(?<!-Xfrontend) -disable-availability-checking",
    " -Xfrontend -disable-availability-checking",
    s,
)
if new_s != s:
    with open(p, "w") as f:
        f.write(new_s)
    print("✅ Patched bare -disable-availability-checking → -Xfrontend …")
else:
    print("ℹ️  Already wrapped (or absent) — no change")
PY
else
  echo "⚠️  Pods.xcodeproj/project.pbxproj not found at ${PODS_PBXPROJ}"
fi

# ── 4c. Filter bogus Metal.xctoolchain absolute paths from LIBRARY_SEARCH_PATHS
# Warning seen in builds:
#   ld: warning: search path '/Users/local/Library/Developer/DVTDownloads/
#     MetalToolchain/mounts/<UUID>/Metal.xctoolchain/usr/lib/swift/iphoneos' not found
# The Metal toolchain mount uses a per-machine UUID that doesn't exist on the
# Xcode Cloud worker by the time it runs the linker. Strip any absolute
# Metal.xctoolchain path from LIBRARY_SEARCH_PATHS in Pods xcconfigs.
echo "🔧 Filtering bogus Metal.xctoolchain paths from Pods xcconfigs…"
_metal_filtered=0
while IFS= read -r -d '' _xcc; do
  if grep -q "Metal.xctoolchain" "$_xcc" 2>/dev/null; then
    /usr/bin/sed -i.bak -E \
      -e 's|"[^"]*Metal\.xctoolchain[^"]*"||g' \
      -e 's|/[^[:space:]"]*Metal\.xctoolchain[^[:space:]"]*||g' \
      "$_xcc"
    rm -f "${_xcc}.bak"
    _metal_filtered=$((_metal_filtered + 1))
  fi
done < <(find "${PODS_DIR}/Target Support Files" -name "*.xcconfig" -print0 2>/dev/null)
echo "✅ Stripped Metal.xctoolchain refs from ${_metal_filtered} xcconfig(s)"

# ── 4d. Mark [CP] Embed Pods Frameworks script phase as alwaysOutOfDate ──────
# Warning:
#   Run script build phase '[CP] Embed Pods Frameworks' will be run during
#   every build because it does not specify any outputs.
# The Podfile sets `:disable_input_output_paths => true`, so we explicitly
# tell xcodebuild to always run this phase (silences the warning).
# Edit App.xcodeproj/project.pbxproj — add `alwaysOutOfDate = 1;` to the
# Embed Pods Frameworks PBXShellScriptBuildPhase section.
echo "🔧 Setting alwaysOutOfDate on [CP] Embed Pods Frameworks script phase…"
if [[ -f "${APP_PBXPROJ}" ]]; then
  if grep -q '\[CP\] Embed Pods Frameworks' "${APP_PBXPROJ}" && \
     ! grep -q 'alwaysOutOfDate.*\[CP\] Embed Pods Frameworks' "${APP_PBXPROJ}" 2>/dev/null; then
    /usr/bin/python3 - <<PY
import re
p = "${APP_PBXPROJ}"
with open(p) as f:
    s = f.read()
# Find the Embed Pods Frameworks PBXShellScriptBuildPhase block and add
# alwaysOutOfDate = 1; right after the opening brace if not already present.
def patch_block(m):
    block = m.group(0)
    if 'alwaysOutOfDate' in block:
        return block
    # Insert after the "isa = PBXShellScriptBuildPhase;" line
    return re.sub(
        r"(isa = PBXShellScriptBuildPhase;\n\t+)",
        r"\1alwaysOutOfDate = 1;\n\t\t\t",
        block, count=1)
new_s = re.sub(
    r"\{[^{}]*\[CP\] Embed Pods Frameworks[^{}]*\}",
    patch_block, s, flags=re.DOTALL)
if new_s != s:
    with open(p, "w") as f:
        f.write(new_s)
    print("✅ Added alwaysOutOfDate = 1 to [CP] Embed Pods Frameworks phase")
else:
    print("ℹ️  Embed Pods Frameworks already has alwaysOutOfDate (or pattern not matched)")
PY
  else
    echo "ℹ️  alwaysOutOfDate already set or [CP] Embed Pods Frameworks phase absent"
  fi
fi

# ── 5. Disable user-script sandboxing for the App target ─────────────────────
# Build 755 actual error (the dependency-scan messages were warnings; the real
# failure was hidden in a sandbox-exec invocation):
#   /bin/sh: /Volumes/.../Pods-App-frameworks.sh: Operation not permitted
#   Command PhaseScriptExecution failed with a nonzero exit code
#
# Xcode 26 enforces ENABLE_USER_SCRIPT_SANDBOXING by default; the resulting
# sandbox profile only whitelists specific input/output files. CocoaPods'
# `[CP] Embed Pods Frameworks` script phase runs Pods-App-frameworks.sh which
# accesses paths NOT in the sandbox profile (the Podfile sets
# `:disable_input_output_paths => true`, so the script's I/O is unconstrained
# from CocoaPods' side but the sandbox doesn't know that). Result: the
# sandbox refuses to execute the script.
#
# Standard Capacitor / CocoaPods workaround: turn off user-script sandboxing
# for the App target. The setting is hard-coded as `YES` in the App's
# .pbxproj (per-configuration), so xcconfig overrides won't reach it —
# we sed-edit project.pbxproj directly. Idempotent: if already NO, no-op.
echo "🔧 Disabling ENABLE_USER_SCRIPT_SANDBOXING in App.xcodeproj…"
APP_PBXPROJ="${IOS_APP_DIR}/App.xcodeproj/project.pbxproj"
if [[ -f "${APP_PBXPROJ}" ]]; then
  if grep -q "ENABLE_USER_SCRIPT_SANDBOXING = YES;" "${APP_PBXPROJ}"; then
    /usr/bin/sed -i.bak \
      -e 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' \
      "${APP_PBXPROJ}"
    rm -f "${APP_PBXPROJ}.bak"
    echo "✅ Flipped ENABLE_USER_SCRIPT_SANDBOXING from YES → NO"
  else
    echo "ℹ️  ENABLE_USER_SCRIPT_SANDBOXING already NO (or absent) — no change"
  fi
else
  echo "⚠️  App.xcodeproj/project.pbxproj not found at ${APP_PBXPROJ}"
fi

echo "✅ pre-xcodebuild setup complete"
