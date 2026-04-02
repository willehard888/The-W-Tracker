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

python3 - << 'PY'
import hashlib
import json
from pathlib import Path

root = Path("/dev-server")
manifest = root / "ios/App/CapApp-SPM/Package.swift"
resolved = root / "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

if not manifest.exists():
    raise SystemExit(f"Missing Swift package manifest: {manifest}")

origin_hash = hashlib.sha256(manifest.read_bytes()).hexdigest()
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
print(f"✅ Package.resolved generated ({origin_hash})")
PY

if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Resolving Swift packages..."
  xcodebuild -resolvePackageDependencies \
    -project ios/App/App.xcodeproj \
    -scheme App \
    2>&1 | tail -5

  if [[ -f "$RESOLVED_DIR/Package.resolved" ]]; then
    echo "✅ Package.resolved generated"
  else
    echo "⚠️ Package.resolved not generated — Xcode will resolve on first open"
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
