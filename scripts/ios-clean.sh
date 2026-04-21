#!/bin/bash
set -euo pipefail

echo "🧹 Removing old Pods, Podfile.lock and node_modules..."
rm -rf ios/App/Pods ios/App/Podfile.lock node_modules

echo "📦 Installing npm dependencies..."
npm install

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

echo "📦 Running pod install (with retry logic)..."
export COCOAPODS_DISABLE_STATS=1

pod_install_with_retry() {
  local attempt=1
  local max_attempts=3
  local repo_update_flag=""

  cd ios/App

  while [[ $attempt -le $max_attempts ]]; do
    echo "📦 pod install attempt $attempt/$max_attempts ${repo_update_flag:-(no repo-update)}..."
    if pod install $repo_update_flag 2>&1; then
      echo "✅ pod install succeeded on attempt $attempt"
      cd ../..
      return 0
    fi
    echo "⚠️ pod install attempt $attempt failed"
    repo_update_flag="--repo-update"
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
  cd ../..
  return $final_status
}

if ! pod_install_with_retry; then
  echo "❌ pod install failed after all retries"
  exit 1
fi

RESOLVED_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
RESOLVED_FILE="$RESOLVED_DIR/Package.resolved"
mkdir -p "$RESOLVED_DIR"

# Generate/update Package.resolved before asking Xcode to verify it
SCRIPT_ROOT="$(pwd)"
python3 - "$SCRIPT_ROOT" << 'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
manifest = root / "ios/App/CapApp-SPM/Package.swift"
resolved = root / "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

if not manifest.exists():
    raise SystemExit(f"Missing Swift package manifest: {manifest}")

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
collect_manifests(manifest, set(), manifests)

digest = hashlib.sha256()
for item in manifests:
    digest.update(str(item.relative_to(root)).encode("utf-8"))
    digest.update(b"\0")
    digest.update(item.read_bytes())
    digest.update(b"\0")

origin_hash = digest.hexdigest()

if resolved.exists():
    data = json.loads(resolved.read_text())
else:
    data = {"originHash": "", "pins": [], "version": 3}

existing_pins = {pin["identity"]: pin for pin in data.get("pins", [])}
fallback_revisions = {
    "capacitor-swift-pm": {
        "8.2.0": "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
    },
    "purchases-hybrid-common": {
        "17.52.0": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
    },
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

    pins.append(
        {
            "identity": identity,
            "kind": spec["kind"],
            "location": spec["location"],
            "state": state,
        }
    )

data = {
    "originHash": origin_hash,
    "pins": pins,
    "version": 3,
}

resolved.write_text(json.dumps(data, indent=2) + "\n")
print(f"✅ Package.resolved fallback generated ({origin_hash})")
PY

if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Verifying Swift packages via Xcode..."
  RESOLVE_LOG="${TMPDIR:-/tmp}/xcode-package-resolve.log"
  if xcodebuild -resolvePackageDependencies \
    -project ios/App/App.xcodeproj \
    -scheme App \
    -clonedSourcePackagesDirPath "${TMPDIR:-/tmp}/spm-packages" \
    > "$RESOLVE_LOG" 2>&1; then
    echo "✅ Xcode package resolution succeeded"
    tail -5 "$RESOLVE_LOG"
  else
    echo "⚠️ Xcode verification failed — keeping generated Package.resolved"
    tail -30 "$RESOLVE_LOG" || true
  fi
fi

if [[ -f "$RESOLVED_FILE" ]]; then
  echo "✅ Package.resolved generated"
else
  echo "⚠️ Package.resolved not generated"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "🚀 Opening Xcode..."
  npx cap open ios
  echo "✅ Done! Open App.xcodeproj in Xcode"
else
  echo "✅ Done! iOS project prepared at ios/App/App.xcworkspace"
fi
