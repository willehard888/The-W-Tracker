#!/bin/bash
set -euo pipefail

ensure_spm_lockfile() {
  local resolved_path="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
  mkdir -p "$(dirname "$resolved_path")"
  cat > "$resolved_path" << 'EOF'
{
  "pins": [
    {
      "identity": "capacitor-swift-pm",
      "kind": "remoteSourceControl",
      "location": "https://github.com/ionic-team/capacitor-swift-pm.git",
      "state": {
        "revision": "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
        "version": "8.2.0"
      }
    },
    {
      "identity": "purchases-hybrid-common",
      "kind": "remoteSourceControl",
      "location": "https://github.com/RevenueCat/purchases-hybrid-common.git",
      "state": {
        "revision": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
        "version": "17.52.0"
      }
    },
    {
      "identity": "purchases-ios-spm",
      "kind": "remoteSourceControl",
      "location": "https://github.com/RevenueCat/purchases-ios-spm",
      "state": {
        "revision": "9755c68799edb79ec03f90b22b5e35c3829d4ec8",
        "version": "5.65.0"
      }
    }
  ],
  "version": 2
}
EOF
  echo "🔐 Wrote Swift Package lockfile to $resolved_path"
}

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
ensure_spm_lockfile

# Validate Package.resolved
RESOLVED="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
if [[ ! -f "$RESOLVED" ]]; then
  echo "❌ Package.resolved not found at $RESOLVED"
  exit 1
fi
if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$RESOLVED" 2>/dev/null; then
  echo "❌ Package.resolved is not valid JSON"
  exit 1
fi
if ! python3 -c "import json,sys; d=json.load(open(sys.argv[1])); ids={p['identity'] for p in d.get('pins',[])}; req={'capacitor-swift-pm','purchases-hybrid-common','purchases-ios-spm'}; missing=req-ids; import sys as _s; _s.exit(0 if not missing else 1)" "$RESOLVED"; then
  echo "❌ Package.resolved is missing required pins (capacitor-swift-pm, purchases-hybrid-common, purchases-ios-spm)"
  exit 1
fi
echo "✅ Package.resolved exists and is valid JSON"

if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Resolving Swift packages..."
  if [[ -f "ios/App/App.xcworkspace/contents.xcworkspacedata" ]]; then
    xcodebuild -resolvePackageDependencies -workspace ios/App/App.xcworkspace -scheme App
  else
    xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
  fi
else
  echo "ℹ️ xcodebuild not found in PATH, skipping package resolution in this environment."
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "🚀 Opening Xcode..."
  npx cap open ios
  echo "✅ Done! Open App.xcodeproj in Xcode"
else
  echo "✅ Done! iOS project prepared at ios/App/App.xcworkspace"
fi
