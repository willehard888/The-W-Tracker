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
