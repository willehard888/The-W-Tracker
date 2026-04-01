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

# Resolve SPM dependencies dynamically
RESOLVED_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
mkdir -p "$RESOLVED_DIR"
rm -f "$RESOLVED_DIR/Package.resolved"

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
