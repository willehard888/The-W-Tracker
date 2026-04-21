#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_APP_DIR="$ROOT_DIR/ios/App"

echo "ℹ️  ROOT_DIR=$ROOT_DIR"
echo "ℹ️  IOS_APP_DIR=$IOS_APP_DIR"

echo "🧹 Removing old Pods, Podfile.lock and node_modules..."
rm -rf "$IOS_APP_DIR/Pods" "$IOS_APP_DIR/Podfile.lock" "$ROOT_DIR/node_modules"

cd "$ROOT_DIR"

echo "📦 Installing npm dependencies..."
npm install

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios || echo "⚠️ cap sync had warnings — continuing"

echo "📦 Running pod install (with retry logic)..."
export COCOAPODS_DISABLE_STATS=1

echo "🌐 Verifying CocoaPods CDN reachability..."
if ! curl -sf --max-time 15 https://cdn.cocoapods.org/CocoaPods-version.yml > /dev/null; then
  echo "⚠️ CocoaPods CDN unreachable — installing GitHub Specs mirror as fallback"
  pod repo remove trunk 2>&1 || true
  pod repo add trunk https://github.com/CocoaPods/Specs.git 2>&1 || \
    pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>&1 || true
fi

pod_install_with_retry() {
  local attempt=1
  local max_attempts=4
  local repo_update_flag=""

  cd "$IOS_APP_DIR"

  while [[ $attempt -le $max_attempts ]]; do
    echo "📦 pod install attempt $attempt/$max_attempts ${repo_update_flag:-(no repo-update)}..."
    if pod install $repo_update_flag 2>&1; then
      echo "✅ pod install succeeded on attempt $attempt"
      cd "$ROOT_DIR"
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
  local final_status=$?
  cd "$ROOT_DIR"
  return $final_status
}

if ! pod_install_with_retry; then
  echo "❌ pod install failed after all retries"
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify cap sync produced a clean iOS project (no module errors).
# This catches regressions of the "CapacitorCordova does not define modules"
# class of failures BEFORE we hand off to Xcode.
# ---------------------------------------------------------------------------
echo "🔄 Re-verifying Capacitor sync..."
SYNC_LOG="${TMPDIR:-/tmp}/cap-sync-verify.log"
if npx cap sync ios > "$SYNC_LOG" 2>&1; then
  if grep -qi "does not define modules" "$SYNC_LOG"; then
    echo "❌ cap sync reported a 'does not define modules' error:"
    grep -i "does not define modules" "$SYNC_LOG" || true
    exit 2
  fi
  echo "✅ cap sync verification passed"
else
  echo "⚠️ cap sync exited non-zero — dumping tail of log:"
  tail -40 "$SYNC_LOG" || true
  if grep -qi "does not define modules" "$SYNC_LOG"; then
    echo "❌ Hard module-resolution failure detected"
    exit 2
  fi
  echo "ℹ️  Continuing — non-module sync warnings are non-fatal here"
fi

# ---------------------------------------------------------------------------
# Optional: regenerate Package.resolved if a SPM manifest exists.
# Two supported cases:
#   A) CapApp-SPM/Package.swift PRESENT → regenerate + verify Package.resolved
#   B) CapApp-SPM/Package.swift MISSING → skip silently (CocoaPods-only project)
# Only exits non-zero if case A is detected AND every recovery option fails.
# ---------------------------------------------------------------------------
SPM_MANIFEST="$IOS_APP_DIR/CapApp-SPM/Package.swift"
RESOLVED_DIR="$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
RESOLVED_FILE="$RESOLVED_DIR/Package.resolved"

regenerate_package_resolved() {
  mkdir -p "$RESOLVED_DIR"
  ROOT_FOR_PY="$ROOT_DIR" MANIFEST_FOR_PY="$SPM_MANIFEST" RESOLVED_FOR_PY="$RESOLVED_FILE" python3 - <<'PY'
import hashlib
import json
import os
import re
import sys
from pathlib import Path

root = Path(os.environ['ROOT_FOR_PY'])
manifest = Path(os.environ['MANIFEST_FOR_PY'])
resolved = Path(os.environ['RESOLVED_FOR_PY'])

local_pattern = re.compile(r'\.package\((?:name:\s*"[^"]+",\s*)?path:\s*"([^"]+)"')
remote_pattern = re.compile(r'\.package\(url:\s*"([^"]+)",\s*(exact|from):\s*"([^"]+)"')

def package_identity(url):
    return url.rstrip("/").split("/")[-1].removesuffix(".git").lower()

def collect_manifests(entry, seen, ordered):
    entry = entry.resolve()
    if entry in seen:
        return
    seen.add(entry)
    ordered.append(entry)
    contents = entry.read_text()
    for rel_path in local_pattern.findall(contents):
        child = (entry.parent / rel_path / "Package.swift").resolve()
        if child.exists():
            collect_manifests(child, seen, ordered)

manifests = []
try:
    collect_manifests(manifest, set(), manifests)
except Exception as e:
    print(f"::error:: failed to read SPM manifest: {e}", file=sys.stderr)
    sys.exit(1)

digest = hashlib.sha256()
for item in manifests:
    try:
        rel = item.relative_to(root)
    except ValueError:
        rel = item
    digest.update(str(rel).encode("utf-8"))
    digest.update(b"\0")
    digest.update(item.read_bytes())
    digest.update(b"\0")

origin_hash = digest.hexdigest()

if resolved.exists():
    try:
        data = json.loads(resolved.read_text())
    except json.JSONDecodeError:
        data = {"originHash": "", "pins": [], "version": 3}
else:
    data = {"originHash": "", "pins": [], "version": 3}

existing_pins = {pin["identity"]: pin for pin in data.get("pins", [])}
fallback_revisions = {
    "capacitor-swift-pm": {"8.2.0": "0e862e6ff13852a710c8a484180ca4d6a2cc9761"},
    "purchases-hybrid-common": {"17.52.0": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee"},
}

required_pins = {}
for item in manifests:
    contents = item.read_text()
    for url, requirement_type, version in remote_pattern.findall(contents):
        identity = package_identity(url)
        existing = required_pins.get(identity)
        if existing is None or requirement_type == "exact" or existing["requirement_type"] != "exact":
            required_pins[identity] = {
                "identity": identity,
                "kind": "remoteSourceControl",
                "location": url,
                "version": version,
                "requirement_type": requirement_type,
            }

pins = []
for identity in sorted(required_pins):
    spec = required_pins[identity]
    existing_pin = existing_pins.get(identity)
    if existing_pin and existing_pin.get("state", {}).get("version") == spec["version"]:
        state = existing_pin["state"]
    else:
        state = {"version": spec["version"]}
        revision = fallback_revisions.get(identity, {}).get(spec["version"])
        if revision:
            state = {"revision": revision, "version": spec["version"]}
    pins.append({
        "identity": identity,
        "kind": spec["kind"],
        "location": spec["location"],
        "state": state,
    })

data = {"originHash": origin_hash, "pins": pins, "version": 3}
resolved.write_text(json.dumps(data, indent=2) + "\n")
print(f"✅ Package.resolved fallback generated ({origin_hash})")
PY
}

verify_with_xcode() {
  if ! command -v xcodebuild >/dev/null 2>&1; then
    echo "ℹ️  xcodebuild not available — skipping Xcode SPM verification"
    return 0
  fi
  echo "📦 Verifying Swift packages via Xcode..."
  local resolve_log="${TMPDIR:-/tmp}/xcode-package-resolve.log"
  if xcodebuild -resolvePackageDependencies \
    -project "$IOS_APP_DIR/App.xcodeproj" \
    -scheme App \
    -clonedSourcePackagesDirPath "${TMPDIR:-/tmp}/spm-packages" \
    > "$resolve_log" 2>&1; then
    echo "✅ Xcode package resolution succeeded"
    tail -5 "$resolve_log" || true
    return 0
  fi
  echo "⚠️ Xcode verification failed — log tail:"
  tail -30 "$resolve_log" || true
  return 1
}

if [[ -f "$SPM_MANIFEST" ]]; then
  echo "📦 SPM manifest found at $SPM_MANIFEST"
  spm_ok=0

  echo "📦 Attempt 1/2 — generating Package.resolved from manifest..."
  if regenerate_package_resolved && [[ -f "$RESOLVED_FILE" ]]; then
    if verify_with_xcode; then
      spm_ok=1
    else
      echo "🔁 Attempt 2/2 — wiping cached SPM clone and retrying..."
      rm -rf "${TMPDIR:-/tmp}/spm-packages"
      rm -f "$RESOLVED_FILE"
      if regenerate_package_resolved && [[ -f "$RESOLVED_FILE" ]] && verify_with_xcode; then
        spm_ok=1
      fi
    fi
  else
    echo "⚠️ Initial Package.resolved generation failed"
  fi

  if [[ "$spm_ok" -eq 1 ]]; then
    echo "✅ Package.resolved present and verified"
  else
    echo "❌ All SPM recovery options exhausted (regenerate + xcode-resolve)"
    exit 3
  fi
else
  echo "ℹ️  No SPM manifest at $SPM_MANIFEST — CocoaPods-only project, skipping SPM step"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "🚀 Opening Xcode..."
  npx cap open ios || echo "⚠️ cap open ios failed — open $IOS_APP_DIR/App.xcworkspace manually"
  echo "✅ Done! Open App.xcworkspace in Xcode"
else
  echo "✅ Done! iOS project prepared at $IOS_APP_DIR/App.xcworkspace"
fi

exit 0
