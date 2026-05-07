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
# Xcode 26 scans ALL targets' headers in parallel BEFORE building anything.
# When it scans Capacitor's headers it hits CAPInstanceDescriptor.h:5:
#   @import Cordova
# but Cordova.framework doesn't exist yet (CapacitorCordova not compiled).
# A PBXTargetDependency serialises COMPILE phases only, not the scan phase.
#
# Fix: create a stub Cordova.framework with the real public headers from
# node_modules BEFORE xcodebuild starts. The scanner resolves the Cordova
# module and all CDV types → scan succeeds. The real Cordova.framework
# (with binary) is built by the CapacitorCordova target and overwrites the
# stub. The Podfile add_dependency ensures the real binary is in place
# before Capacitor's ObjC compilation actually links against it.
REPO_ROOT="${IOS_APP_DIR}/../.."
CORDOVA_PKG="${REPO_ROOT}/node_modules/@capacitor/ios/CapacitorCordova/CapacitorCordova"
DERIVED_PRODUCTS="/Volumes/workspace/DerivedData/Build/Products/Release-iphoneos"
CORDOVA_FW="${DERIVED_PRODUCTS}/CapacitorCordova/Cordova.framework"

echo "🔨 Stubbing Cordova.framework for Xcode 26 scan-phase race fix..."
mkdir -p "${CORDOVA_FW}/Headers" "${CORDOVA_FW}/Modules"
find "${CORDOVA_PKG}" -name "*.h" -exec cp {} "${CORDOVA_FW}/Headers/" \;
cp "${CORDOVA_PKG}/CapacitorCordova.modulemap" "${CORDOVA_FW}/Modules/module.modulemap"
if [[ -f "${CORDOVA_FW}/Modules/module.modulemap" && -f "${CORDOVA_FW}/Headers/CapacitorCordova.h" ]]; then
  HDR_COUNT=$(ls "${CORDOVA_FW}/Headers/" | wc -l | tr -d ' ')
  echo "✅ Stub Cordova.framework ready (${HDR_COUNT} headers)"
# ── Patch pod xcconfigs with absolute -F flag for Cordova ───────────────────
# FRAMEWORK_SEARCH_PATHS uses ${PODS_CONFIGURATION_BUILD_DIR} which may not
# expand at scan time. OTHER_CFLAGS -F/absolute bypasses variable expansion.
echo "🔧 Patching pod xcconfigs with absolute -F${DERIVED_PRODUCTS}/CapacitorCordova..."
CORDOVA_ABSPATH="${DERIVED_PRODUCTS}/CapacitorCordova"
find "${IOS_APP_DIR}/Pods/Target Support Files" -name "*.release.xcconfig" | while IFS= read -r CFG; do
  if [[ -f "${CFG}" ]] && ! grep -q "CORDOVA_ABS_PATCHED" "${CFG}" 2>/dev/null; then
    printf '\n// CORDOVA_ABS_PATCHED\nOTHER_CFLAGS = $(inherited) -F%s\n' "${CORDOVA_ABSPATH}" >> "${CFG}"
  fi
done
echo "✅ Pod xcconfigs patched"

else
  echo "❌ Stub Cordova.framework creation failed"
  exit 1
fi

echo "✅ pre-xcodebuild setup complete"
