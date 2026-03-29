#!/bin/bash
set -euo pipefail

echo "🧹 Removing old iOS platform..."
rm -rf ios

echo "📱 Adding iOS platform..."
npx cap add ios

echo "🔨 Building web assets..."
CAPACITOR_BUILD=true npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Resolving Swift packages..."
  xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
else
  echo "ℹ️ xcodebuild not found in PATH, skipping package resolution in this environment."
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "🚀 Opening Xcode..."
  npx cap open ios
  echo "✅ Done! Open App.xcodeproj in Xcode"
else
  echo "✅ Done! iOS project prepared at ios/App/App.xcodeproj"
fi
