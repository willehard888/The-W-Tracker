#!/bin/bash
set -euo pipefail

echo "🧹 Removing old iOS platform..."
rm -rf ios

echo "📱 Adding iOS platform..."
npx cap add ios

echo "📦 Installing npm dependencies..."
npm install

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

RESOLVED_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
mkdir -p "$RESOLVED_DIR"

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

manifest_text = manifest.read_text()

if "@capacitor-community/apple-sign-in" in manifest_text or "CapacitorCommunityAppleSignIn" in manifest_text:
    raise SystemExit("Unsupported Swift package remains in CapApp-SPM: @capacitor-community/apple-sign-in")

pattern = re.compile(r'\.package\((?:name:\s*"[^"]+",\s*)?path:\s*"([^"]+)"')

def collect_manifests(entry: Path, seen: set[Path], ordered: list[Path]) -> None:
    entry = entry.resolve()
    if entry in seen:
        return
    seen.add(entry)
    ordered.append(entry)
    contents = entry.read_text()
    for rel_path in pattern.findall(contents):
        child = (entry.parent / rel_path / "Package.swift").resolve()
        if not child.exists():
            raise SystemExit(f"Missing local Swift package manifest: {child}")
        collect_manifests(child, seen, ordered)

manifests: list[Path] = []
collect_manifests(manifest, set(), manifests)

digest = hashlib.sha256()
for item in manifests:
    digest.update(str(item.relative_to(root)).encode("utf-8"))
    digest.update(b"\0")
    digest.update(item.read_bytes())
    digest.update(b"\0")

origin_hash = digest.hexdigest()
data = {
    "originHash": origin_hash,
    "pins": [
        {
            "identity": "capacitor-swift-pm",
            "kind": "remoteSourceControl",
            "location": "https://github.com/ionic-team/capacitor-swift-pm.git",
            "state": {
                "revision": "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
                "version": "8.2.0",
            },
        },
        {
            "identity": "purchases-hybrid-common",
            "kind": "remoteSourceControl",
            "location": "https://github.com/RevenueCat/purchases-hybrid-common.git",
            "state": {
                "revision": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
                "version": "17.52.0",
            },
        },
        {
            "identity": "purchases-ios-spm",
            "kind": "remoteSourceControl",
            "location": "https://github.com/RevenueCat/purchases-ios-spm.git",
            "state": {
                "revision": "9755c68799edb79ec03f90b22b5e35c3829d4ec8",
                "version": "5.65.0",
            },
        },
    ],
    "version": 3,
}

resolved.write_text(json.dumps(data, indent=2) + "\n")
print(f"✅ Package.resolved fallback generated ({origin_hash})")
PY

if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Resolving Swift packages..."
  RESOLVE_LOG="${TMPDIR:-/tmp}/xcode-package-resolve.log"

  if xcodebuild -resolvePackageDependencies \
    -project ios/App/App.xcodeproj \
    -scheme App > "$RESOLVE_LOG" 2>&1; then
    tail -20 "$RESOLVE_LOG"
  else
    tail -100 "$RESOLVE_LOG"
    echo "⚠️ Swift package resolution failed — keeping generated fallback Package.resolved"
  fi

  if [[ -f "$RESOLVED_DIR/Package.resolved" ]]; then
    echo "✅ Package.resolved generated"
  else
    echo "⚠️ Package.resolved not generated — keeping existing lockfile state"
  fi
else
  echo "ℹ️ xcodebuild not found, skipping package resolution"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "🚀 Opening Xcode..."
  npx cap open ios
  echo "✅ Done! Open App.xcodeproj in Xcode"
else
  echo "✅ Done! iOS project prepared at ios/App/App.xcworkspace"
fi
